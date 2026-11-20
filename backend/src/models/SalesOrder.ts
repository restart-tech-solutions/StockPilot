import mongoose, { Document, Schema } from "mongoose";

export type SalesOrderStatus =
  | "DRAFT"
  | "COMPLETED"
  | "PARTIALLY_RETURNED"
  | "RETURNED"
  | "CANCELLED";

export interface ISalesOrderItem {
  productId: mongoose.Types.ObjectId;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  unitCost?: number;
  discountPercentage: number;
  subtotal: number;
  discountAmount: number;
  taxableAmount: number;
  returnedQuantity: number;
}

export interface ISalesOrder extends Document {
  businessId: mongoose.Types.ObjectId;
  salesOrderNumber: string;
  customerId: mongoose.Types.ObjectId;
  customerName: string;
  warehouseId: mongoose.Types.ObjectId;
  products: ISalesOrderItem[];
  subtotal: number;
  discountTotal: number;
  taxableAmount: number;
  taxName: string;
  taxPercentage: number;
  tax: number;
  totalAmount: number;
  status: SalesOrderStatus;
  invoiceId?: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  completedAt?: Date;
  cancelledAt?: Date;
  returnedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const salesOrderItemSchema = new Schema<ISalesOrderItem>(
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
    unitCost: { type: Number, min: 0 },
    discountPercentage: { type: Number, required: true, min: 0, max: 100 },
    subtotal: { type: Number, required: true, min: 0 },
    discountAmount: { type: Number, required: true, min: 0 },
    taxableAmount: { type: Number, required: true, min: 0 },
    returnedQuantity: { type: Number, required: true, min: 0, default: 0 },
  },
  { _id: false }
);

const salesOrderSchema = new Schema<ISalesOrder>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
    },
    salesOrderNumber: { type: String, required: true, trim: true },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    customerName: { type: String, required: true, trim: true },
    warehouseId: {
      type: Schema.Types.ObjectId,
      ref: "Warehouse",
      required: true,
    },
    products: {
      type: [salesOrderItemSchema],
      required: true,
      validate: {
        validator: (items: ISalesOrderItem[]) => items.length > 0,
        message: "A sales order must contain at least one product.",
      },
    },
    subtotal: { type: Number, required: true, min: 0 },
    discountTotal: { type: Number, required: true, min: 0 },
    taxableAmount: { type: Number, required: true, min: 0 },
    taxName: { type: String, required: true, trim: true, default: "GST" },
    taxPercentage: { type: Number, required: true, min: 0, max: 100 },
    tax: { type: Number, required: true, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: [
        "DRAFT",
        "COMPLETED",
        "PARTIALLY_RETURNED",
        "RETURNED",
        "CANCELLED",
      ],
      required: true,
      default: "DRAFT",
    },
    invoiceId: { type: Schema.Types.ObjectId, ref: "Invoice" },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    completedAt: { type: Date },
    cancelledAt: { type: Date },
    returnedAt: { type: Date },
  },
  { timestamps: true }
);

salesOrderSchema.index(
  { businessId: 1, salesOrderNumber: 1 },
  { unique: true }
);
salesOrderSchema.index({ businessId: 1, createdAt: -1 });
salesOrderSchema.index({ businessId: 1, status: 1, createdAt: -1 });
salesOrderSchema.index({ businessId: 1, customerId: 1, createdAt: -1 });
salesOrderSchema.index({ businessId: 1, status: 1, invoiceId: 1, createdAt: -1 });
salesOrderSchema.index({ businessId: 1, status: 1, completedAt: -1 });

const SalesOrder = mongoose.model<ISalesOrder>("SalesOrder", salesOrderSchema);

export default SalesOrder;
