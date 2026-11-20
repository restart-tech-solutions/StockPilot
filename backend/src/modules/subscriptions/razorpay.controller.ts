import { Request, Response } from "express";
import mongoose from "mongoose";
import Razorpay from "razorpay";
import {
  createHmac,
  timingSafeEqual,
} from "crypto";

import Payment from "../../models/Payment";
import Subscription, {
  BillingCycle,
  SubscriptionPlan,
} from "../../models/Subscription";
import { AuthenticatedRequest } from "../../middleware/auth.middleware";
import { SUBSCRIPTION_PLANS } from "./subscription.plans";

const getRazorpay = (): Razorpay | null => {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;

  if (!key_id || !key_secret) return null;

  return new Razorpay({ key_id, key_secret });
};

const isValidSignature = (
  expected: string,
  received: string
): boolean => {
  const expectedBuffer = Buffer.from(expected, "hex");
  const receivedBuffer = Buffer.from(received, "hex");

  return (
    expectedBuffer.length === receivedBuffer.length &&
    timingSafeEqual(expectedBuffer, receivedBuffer)
  );
};

const getEndDate = (
  startDate: Date,
  billingCycle: BillingCycle
): Date => {
  const endDate = new Date(startDate);

  if (billingCycle === "YEARLY") {
    endDate.setFullYear(endDate.getFullYear() + 1);
  } else {
    endDate.setMonth(endDate.getMonth() + 1);
  }

  return endDate;
};

export const createSubscriptionOrder = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  console.log("🔥 CREATE ORDER CONTROLLER HIT");
  try {
    const businessId = req.businessMembership?.businessId;
    const userId = req.user?.userId;
    const { plan, billingCycle } = req.body;

    if (!businessId || !mongoose.Types.ObjectId.isValid(businessId) || !userId) {
      res.status(403).json({
        success: false,
        message: "Valid business access is required.",
      });
      return;
    }

    if (req.businessMembership?.role !== "BUSINESS_OWNER") {
      res.status(403).json({
        success: false,
        message: "Only the business owner can purchase a subscription.",
      });
      return;
    }

    if (
      !["STARTER", "PRO"].includes(plan) ||
      !["MONTHLY", "YEARLY"].includes(billingCycle)
    ) {
      res.status(400).json({
        success: false,
        message: "Invalid subscription plan or billing cycle.",
      });
      return;
    }

    const selectedPlan = SUBSCRIPTION_PLANS[
      plan as SubscriptionPlan
    ];

    const amount =
      billingCycle === "YEARLY"
        ? selectedPlan.yearlyPrice
        : selectedPlan.monthlyPrice;

    if (!Number.isSafeInteger(amount) || amount <= 0) {
      res.status(400).json({
        success: false,
        message: "Invalid subscription amount.",
      });
      return;
    }

    const razorpay = getRazorpay();

    if (!razorpay) {
      res.status(503).json({
        success: false,
        message: "Payment gateway is not configured.",
      });
      return;
    }

    const order = await razorpay.orders.create({
      amount: amount * 100,
      currency: "INR",
      receipt: `sp_${new mongoose.Types.ObjectId().toString()}`,
      notes: {
        businessId,
        userId: userId.toString(),
        plan,
        billingCycle,
      },
    });

    await Payment.create({
      businessId: new mongoose.Types.ObjectId(businessId),
      userId: new mongoose.Types.ObjectId(userId),
      plan,
      billingCycle,
      amount,
      currency: "INR",
      status: "PENDING",
      razorpayOrderId: order.id,
    });

    res.status(201).json({
      success: true,
      message: "Payment order created successfully.",
      order: {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
      },
      keyId: process.env.RAZORPAY_KEY_ID,
      plan,
      billingCycle,
    });
  } catch (error) {
    console.log("CREATE ORDER DEBUG:", {
  businessId: req.businessMembership?.businessId,
  userId: req.user?.userId,
  plan: req.body.plan,
  billingCycle: req.body.billingCycle,
  razorpayConfigured: Boolean(
    process.env.RAZORPAY_KEY_ID &&
    process.env.RAZORPAY_KEY_SECRET
  ),
});
console.error(
  "CREATE ORDER ACTUAL ERROR:",
  error instanceof Error ? error.stack : error
);
    res.status(500).json({
      success: false,
      message: "Failed to create payment order.",
    });
  }
};

export const verifySubscriptionPayment = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const businessId = req.businessMembership?.businessId;
    const userId = req.user?.userId;

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    if (!businessId || !userId) {
      res.status(403).json({
        success: false,
        message: "Business access is required.",
      });
      return;
    }

    if (req.businessMembership?.role !== "BUSINESS_OWNER") {
      res.status(403).json({
        success: false,
        message: "Only the business owner can verify subscription payments.",
      });
      return;
    }

    if (
      typeof razorpay_order_id !== "string" ||
      typeof razorpay_payment_id !== "string" ||
      typeof razorpay_signature !== "string"
    ) {
      res.status(400).json({
        success: false,
        message: "Valid Razorpay payment details are required.",
      });
      return;
    }

    const razorpay = getRazorpay();

    if (!razorpay) {
      res.status(503).json({
        success: false,
        message: "Payment gateway is not configured.",
      });
      return;
    }

    const paymentRecord = await Payment.findOne({
      businessId,
      userId,
      razorpayOrderId: razorpay_order_id,
    });

    if (!paymentRecord) {
      res.status(404).json({
        success: false,
        message: "Payment order not found.",
      });
      return;
    }

    const secret = process.env.RAZORPAY_KEY_SECRET!;

    const expectedSignature = createHmac("sha256", secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (!isValidSignature(expectedSignature, razorpay_signature)) {
      res.status(400).json({
        success: false,
        message: "Payment signature verification failed.",
      });
      return;
    }

    if (paymentRecord.status === "CAPTURED") {
      if (paymentRecord.razorpayPaymentId !== razorpay_payment_id) {
        res.status(409).json({
          success: false,
          message: "This order has already been processed.",
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "Payment was already verified.",
        subscription: await Subscription.findOne({ businessId }),
      });
      return;
    }

    const razorpayPayment = await razorpay.payments.fetch(
      razorpay_payment_id
    );

    if (
      razorpayPayment.order_id !== razorpay_order_id ||
      razorpayPayment.status !== "captured" ||
      razorpayPayment.amount !== paymentRecord.amount * 100 ||
      razorpayPayment.currency !== paymentRecord.currency
    ) {
      res.status(400).json({
        success: false,
        message: "Payment is not captured or payment details do not match.",
      });
      return;
    }

    const session = await mongoose.startSession();

    let activatedSubscription: unknown = null;

    try {
      await session.withTransaction(async () => {
        const updatedPayment = await Payment.findOneAndUpdate(
          {
            _id: paymentRecord._id,
            status: "PENDING",
          },
          {
            $set: {
              status: "CAPTURED",
              razorpayPaymentId: razorpay_payment_id,
              paidAt: new Date(),
            },
          },
          { new: true, session }
        );

        if (!updatedPayment) {
          const existing = await Payment.findById(paymentRecord._id)
            .session(session);

          if (
            existing?.status === "CAPTURED" &&
            existing.razorpayPaymentId === razorpay_payment_id
          ) {
            activatedSubscription = await Subscription.findOne({
              businessId,
            }).session(session);

            return;
          }

          throw new Error("PAYMENT_ALREADY_PROCESSED");
        }

        const startDate = new Date();
        const endDate = getEndDate(
          startDate,
          paymentRecord.billingCycle
        );

        activatedSubscription = await Subscription.findOneAndUpdate(
          { businessId },
          {
            $set: {
              plan: paymentRecord.plan,
              status: "ACTIVE",
              billingCycle: paymentRecord.billingCycle,
              amount: paymentRecord.amount,
              currency: paymentRecord.currency,
              startDate,
              endDate,
              nextBillingDate: endDate,
              cancelledAt: undefined,
            },
          },
          {
            new: true,
            upsert: true,
            runValidators: true,
            session,
          }
        );
      });
    } finally {
      await session.endSession();
    }

    res.status(200).json({
      success: true,
      message: "Payment verified and subscription activated successfully.",
      subscription: activatedSubscription,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "PAYMENT_ALREADY_PROCESSED") {
      res.status(409).json({
        success: false,
        message: "This payment has already been processed.",
      });
      return;
    }

    console.error("Verify Subscription Payment Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to verify subscription payment.",
    });
  }
};

export const handleRazorpayWebhook = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers["x-razorpay-signature"];

    if (!secret || typeof signature !== "string" || !Buffer.isBuffer(req.body)) {
      res.status(400).json({
        success: false,
        message: "Invalid webhook configuration or payload.",
      });
      return;
    }

    const expectedSignature = createHmac("sha256", secret)
      .update(req.body)
      .digest("hex");

    if (!isValidSignature(expectedSignature, signature)) {
      res.status(401).json({
        success: false,
        message: "Invalid webhook signature.",
      });
      return;
    }

    const event = JSON.parse(req.body.toString("utf8"));
    const paymentEntity = event.payload?.payment?.entity;

    if (
      event.event === "payment.captured" &&
      paymentEntity?.order_id &&
      paymentEntity?.id
    ) {
      const paymentRecord = await Payment.findOne({
        razorpayOrderId: paymentEntity.order_id,
      });

      if (
        paymentRecord &&
        paymentRecord.status === "PENDING" &&
        paymentEntity.amount === paymentRecord.amount * 100 &&
        paymentEntity.currency === paymentRecord.currency
      ) {
        const razorpay = getRazorpay();

        if (!razorpay) {
          res.status(503).json({
            success: false,
            message: "Payment gateway is not configured.",
          });
          return;
        }

        const confirmedPayment = await razorpay.payments.fetch(
          paymentEntity.id
        );

        if (
          confirmedPayment.status === "captured" &&
          confirmedPayment.order_id === paymentRecord.razorpayOrderId
        ) {
          const session = await mongoose.startSession();

          try {
            await session.withTransaction(async () => {
              const updated = await Payment.findOneAndUpdate(
                {
                  _id: paymentRecord._id,
                  status: "PENDING",
                },
                {
                  $set: {
                    status: "CAPTURED",
                    razorpayPaymentId: paymentEntity.id,
                    paidAt: new Date(),
                  },
                },
                { new: true, session }
              );

              if (!updated) return;

              const startDate = new Date();
              const endDate = getEndDate(
                startDate,
                paymentRecord.billingCycle
              );

              await Subscription.findOneAndUpdate(
                { businessId: paymentRecord.businessId },
                {
                  $set: {
                    plan: paymentRecord.plan,
                    status: "ACTIVE",
                    billingCycle: paymentRecord.billingCycle,
                    amount: paymentRecord.amount,
                    currency: paymentRecord.currency,
                    startDate,
                    endDate,
                    nextBillingDate: endDate,
                    cancelledAt: undefined,
                  },
                },
                {
                  new: true,
                  upsert: true,
                  runValidators: true,
                  session,
                }
              );
            });
          } finally {
            await session.endSession();
          }
        }
      }
    }

    res.status(200).json({ success: true, received: true });
  } catch (error) {
    console.error("Razorpay Webhook Error:", error);

    res.status(500).json({
      success: false,
      message: "Webhook processing failed.",
    });
  }
};
