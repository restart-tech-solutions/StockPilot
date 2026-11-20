
import mongoose, { Document, Schema } from "mongoose";

export interface IStockNotificationPreference extends Document {
  businessId: mongoose.Types.ObjectId;
  lowStockNotificationsEnabled: boolean;
  outOfStockNotificationsEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const stockNotificationPreferenceSchema =
  new Schema<IStockNotificationPreference>(
    {
      businessId: {
        type: Schema.Types.ObjectId,
        ref: "Business",
        required: true,
        unique: true,
      },
      lowStockNotificationsEnabled: {
        type: Boolean,
        required: true,
        default: true,
      },
      outOfStockNotificationsEnabled: {
        type: Boolean,
        required: true,
        default: true,
      },
    },
    {
      timestamps: true,
    }
  );

const StockNotificationPreference =
  mongoose.model<IStockNotificationPreference>(
    "StockNotificationPreference",
    stockNotificationPreferenceSchema
  );

export default StockNotificationPreference;
