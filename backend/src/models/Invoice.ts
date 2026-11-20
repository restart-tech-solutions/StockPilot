import mongoose, { Document, Schema } from "mongoose";

export type InvoicePaymentStatus =
  | "UNPAID"
  | "PARTIALLY_PAID"
  | "PAID";

export interface IInvoiceItem {
  productId: mongoose.Types.ObjectId;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  discountPercentage: number;
  subtotal: number;
  discountAmount: number;
  taxableAmount: number;
  taxAmount: number;
  lineTotal: number;
}

export interface IInvoice extends Document {
  businessId: mongoose.Types.ObjectId;
  invoiceNumber: string;
  invoiceDate: Date;
  currency: string;
  businessName: string;
  businessLocation: string;
  businessEmail?: string;
  businessPhone?: string;
  salesOrderId: mongoose.Types.ObjectId;
  salesOrderNumber: string;
  customerId: mongoose.Types.ObjectId;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  customerAddress?: string;
  products: IInvoiceItem[];
  subtotal: number;
  discountTotal: number;
  taxableAmount: number;
  taxName: string;
  taxPercentage: number;
  tax: number;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  paymentStatus: InvoicePaymentStatus;
  lastPaymentAt?: Date;
  paidAt?: Date;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const invoiceItemSchema = new Schema<IInvoiceItem>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    productName: { type: String, required: true, trim: true },
    sku: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 0.000001 },
    unitPrice: { type: Number, required: true, min: 0 },
    discountPercentage: { type: Number, required: true, min: 0, max: 100 },
    subtotal: { type: Number, required: true, min: 0 },
    discountAmount: { type: Number, required: true, min: 0 },
    taxableAmount: { type: Number, required: true, min: 0 },
    taxAmount: { type: Number, required: true, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const invoiceSchema = new Schema<IInvoice>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    invoiceNumber: { type: String, required: true, trim: true },
    invoiceDate: { type: Date, required: true },
    currency: { type: String, required: true, trim: true, uppercase: true },
    businessName: { type: String, required: true, trim: true },
    businessLocation: { type: String, required: true, trim: true },
    businessEmail: { type: String, trim: true },
    businessPhone: { type: String, trim: true },
    salesOrderId: {
      type: Schema.Types.ObjectId,
      ref: "SalesOrder",
      required: true,
    },
    salesOrderNumber: { type: String, required: true, trim: true },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    customerName: { type: String, required: true, trim: true },
    customerEmail: { type: String, trim: true, lowercase: true },
    customerPhone: { type: String, trim: true },
    customerAddress: { type: String, trim: true },
    products: {
      type: [invoiceItemSchema],
      required: true,
      validate: {
        validator: (items: IInvoiceItem[]) => items.length > 0,
        message: "An invoice must contain at least one product.",
      },
    },
    subtotal: { type: Number, required: true, min: 0 },
    discountTotal: { type: Number, required: true, min: 0 },
    taxableAmount: { type: Number, required: true, min: 0 },
    taxName: { type: String, required: true, trim: true },
    taxPercentage: { type: Number, required: true, min: 0, max: 100 },
    tax: { type: Number, required: true, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    amountPaid: { type: Number, required: true, min: 0, default: 0 },
    balanceDue: { type: Number, required: true, min: 0 },
    paymentStatus: {
      type: String,
      enum: ["UNPAID", "PARTIALLY_PAID", "PAID"],
      required: true,
      default: "UNPAID",
    },
    lastPaymentAt: { type: Date },
    paidAt: { type: Date },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

invoiceSchema.index(
  { businessId: 1, invoiceNumber: 1 },
  { unique: true }
);
invoiceSchema.index(
  { businessId: 1, salesOrderId: 1 },
  { unique: true }
);
invoiceSchema.index({ businessId: 1, invoiceDate: -1 });
invoiceSchema.index({ businessId: 1, paymentStatus: 1, invoiceDate: -1 });

const Invoice = mongoose.model<IInvoice>("Invoice", invoiceSchema);

export default Invoice;
