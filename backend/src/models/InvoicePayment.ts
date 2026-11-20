import mongoose, { Document, Schema } from "mongoose";

export const invoicePaymentMethods = [
  "CASH",
  "CARD",
  "BANK_TRANSFER",
  "UPI",
  "OTHER",
] as const;

export type InvoicePaymentMethod = (typeof invoicePaymentMethods)[number];

export interface IInvoicePayment extends Document {
  businessId: mongoose.Types.ObjectId;
  invoiceId: mongoose.Types.ObjectId;
  idempotencyKey: string;
  amount: number;
  paymentMethod: InvoicePaymentMethod;
  reference?: string;
  note?: string;
  recordedBy: mongoose.Types.ObjectId;
  createdAt: Date;
}

const invoicePaymentSchema = new Schema<IInvoicePayment>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    invoiceId: {
      type: Schema.Types.ObjectId,
      ref: "Invoice",
      required: true,
      index: true,
    },
    idempotencyKey: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    amount: { type: Number, required: true, min: 0.01 },
    paymentMethod: {
      type: String,
      enum: invoicePaymentMethods,
      required: true,
    },
    reference: { type: String, trim: true, maxlength: 100 },
    note: { type: String, trim: true, maxlength: 500 },
    recordedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

invoicePaymentSchema.index(
  { businessId: 1, idempotencyKey: 1 },
  { unique: true }
);
invoicePaymentSchema.index(
  { businessId: 1, paymentMethod: 1, reference: 1 },
  {
    unique: true,
    partialFilterExpression: { reference: { $type: "string" } },
  }
);
invoicePaymentSchema.index({ businessId: 1, invoiceId: 1, createdAt: -1 });

const InvoicePayment = mongoose.model<IInvoicePayment>(
  "InvoicePayment",
  invoicePaymentSchema
);

export default InvoicePayment;
