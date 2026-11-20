import { Request, Response } from "express";
import mongoose from "mongoose";
import Subscription from "../../models/Subscription";
import { SUBSCRIPTION_PLANS } from "./subscription.plans";
import { AuthenticatedRequest } from "../../middleware/auth.middleware";

export const getSubscriptionPlans = (
  _req: Request,
  res: Response
): void => {
  res.status(200).json({
    success: true,
    plans: Object.entries(SUBSCRIPTION_PLANS).map(([key, plan]) => ({
      id: key,
      ...plan,
    })),
  });
};

export const getCurrentSubscription = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const businessId = req.businessMembership?.businessId;

    if (!businessId || !mongoose.Types.ObjectId.isValid(businessId)) {
      res.status(400).json({
        success: false,
        message: "A valid business context is required.",
      });
      return;
    }

    let subscription = await Subscription.findOne({ businessId });

    if (!subscription) {
      subscription = await Subscription.create({
        businessId: new mongoose.Types.ObjectId(businessId),
        plan: "FREE",
        status: "ACTIVE",
        billingCycle: "MONTHLY",
        amount: 0,
        currency: "INR",
        startDate: new Date(),
      });
    }

    const plan = SUBSCRIPTION_PLANS[subscription.plan];

    res.status(200).json({
      success: true,
      subscription,
      plan,
    });
  } catch (error) {
    console.error("Get Current Subscription Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to retrieve current subscription.",
    });
  }
};
