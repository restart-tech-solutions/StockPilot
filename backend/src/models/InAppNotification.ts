import mongoose, { Document, Schema } from "mongoose";

export type NotificationCategory = "STOCK_ALERT" | "SYSTEM";
export type StockNotificationEvent =
  | "LOW_STOCK"
  | "OUT_OF_STOCK"
  | "STOCK_RESTORED";

export interface IInAppNotification extends Document {
  businessId: mongoose.Types.ObjectId;
  recipientUserId: mongoose.Types.ObjectId;
  category: NotificationCategory;
  eventType: StockNotificationEvent;
  eventKey: string;
  alertId: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  title: string;
  message: string;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const inAppNotificationSchema = new Schema<IInAppNotification>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      immutable: true,
    },
    recipientUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
    },
    category: {
      type: String,
      enum: ["STOCK_ALERT", "SYSTEM"],
      required: true,
      default: "STOCK_ALERT",
      immutable: true,
    },
    eventType: {
      type: String,
      enum: ["LOW_STOCK", "OUT_OF_STOCK", "STOCK_RESTORED"],
      required: true,
      immutable: true,
    },
    eventKey: { type: String, required: true, immutable: true },
    alertId: {
      type: Schema.Types.ObjectId,
      ref: "StockAlert",
      required: true,
      immutable: true,
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      immutable: true,
    },
    title: { type: String, required: true, trim: true, immutable: true },
    message: { type: String, required: true, trim: true, immutable: true },
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
);

inAppNotificationSchema.index(
  { businessId: 1, recipientUserId: 1, eventKey: 1 },
  { unique: true }
);
inAppNotificationSchema.index({
  businessId: 1,
  recipientUserId: 1,
  readAt: 1,
  createdAt: -1,
});

const InAppNotification = mongoose.model<IInAppNotification>(
  "InAppNotification",
  inAppNotificationSchema
);

export default InAppNotification;
