import mongoose, { Document, Schema } from "mongoose";

export type SubscriptionPlan =
  | "FREE"
  | "STARTER"
  | "PRO"
  | "ENTERPRISE";

export type SubscriptionStatus =
  | "TRIAL"
  | "ACTIVE"
  | "PAST_DUE"
  | "CANCELLED"
  | "EXPIRED";

export type BillingCycle = "MONTHLY" | "YEARLY";

export interface ISubscription extends Document {
  businessId: mongoose.Types.ObjectId;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  billingCycle: BillingCycle;
  amount: number;
  currency: string;
  startDate: Date;
  endDate?: Date;
  nextBillingDate?: Date;
  cancelledAt?: Date;
  razorpayCustomerId?: string;
  razorpaySubscriptionId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const subscriptionSchema = new Schema<ISubscription>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      unique: true,
      index: true,
    },

    plan: {
      type: String,
      enum: ["FREE", "STARTER", "PRO", "ENTERPRISE"],
      default: "FREE",
      required: true,
    },

    status: {
      type: String,
      enum: ["TRIAL", "ACTIVE", "PAST_DUE", "CANCELLED", "EXPIRED"],
      default: "ACTIVE",
      required: true,
    },

    billingCycle: {
      type: String,
      enum: ["MONTHLY", "YEARLY"],
      default: "MONTHLY",
    },

    amount: {
      type: Number,
      default: 0,
      min: 0,
    },

    currency: {
      type: String,
      default: "INR",
      uppercase: true,
      trim: true,
    },

    startDate: {
      type: Date,
      default: Date.now,
    },

    endDate: Date,
    nextBillingDate: Date,
    cancelledAt: Date,

    razorpayCustomerId: String,
    razorpaySubscriptionId: String,
  },
  {
    timestamps: true,
  }
);

subscriptionSchema.index({ status: 1, endDate: 1 });

const Subscription = mongoose.model<ISubscription>(
  "Subscription",
  subscriptionSchema
);

export default Subscription;
