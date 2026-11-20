import mongoose, { Document, Schema } from "mongoose";
import {
  SubscriptionPlan,
  BillingCycle,
} from "./Subscription";

export type PaymentStatus =
  | "PENDING"
  | "CAPTURED"
  | "FAILED";

export interface IPayment extends Document {
  businessId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  plan: SubscriptionPlan;
  billingCycle: BillingCycle;
  amount: number;
  currency: string;
  status: PaymentStatus;
  razorpayOrderId: string;
  razorpayPaymentId?: string;
  paidAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const paymentSchema = new Schema<IPayment>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    plan: {
      type: String,
      enum: ["FREE", "STARTER", "PRO", "ENTERPRISE"],
      required: true,
    },
    billingCycle: {
      type: String,
      enum: ["MONTHLY", "YEARLY"],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 1,
    },
    currency: {
      type: String,
      default: "INR",
      uppercase: true,
    },
    status: {
      type: String,
      enum: ["PENDING", "CAPTURED", "FAILED"],
      default: "PENDING",
      required: true,
    },
    razorpayOrderId: {
      type: String,
      required: true,
      unique: true,
    },
    razorpayPaymentId: {
      type: String,
      sparse: true,
      unique: true,
    },
    paidAt: Date,
  },
  { timestamps: true }
);

paymentSchema.index({ businessId: 1, createdAt: -1 });

const Payment = mongoose.model<IPayment>("Payment", paymentSchema);

export default Payment;
