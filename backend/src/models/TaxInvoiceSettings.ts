
import mongoose, { Document, Schema } from "mongoose";

export interface ITaxInvoiceSettings extends Document {
  businessId: mongoose.Types.ObjectId;
  taxEnabled: boolean;
  taxName: string;
  taxPercentage: number;
  invoicePrefix: string;
  lastInvoiceSequence: number;
  createdAt: Date;
  updatedAt: Date;
}

const taxInvoiceSettingsSchema = new Schema<ITaxInvoiceSettings>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      unique: true,
    },

    taxEnabled: {
      type: Boolean,
      required: true,
      default: false,
    },

    taxName: {
      type: String,
      trim: true,
      default: "GST",
    },

    taxPercentage: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },

    invoicePrefix: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      default: "INV",
    },
    lastInvoiceSequence: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

const TaxInvoiceSettings = mongoose.model<ITaxInvoiceSettings>(
  "TaxInvoiceSettings",
  taxInvoiceSettingsSchema
);

export default TaxInvoiceSettings;
