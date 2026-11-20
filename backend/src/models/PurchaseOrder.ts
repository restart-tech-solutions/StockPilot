import mongoose, { Document, Schema } from "mongoose";

export type PurchaseOrderStatus =
  | "DRAFT"
  | "APPROVED"
  | "PARTIALLY_RECEIVED"
  | "RECEIVED"
  | "CANCELLED";

export interface IPurchaseOrderItem {
  productId: mongoose.Types.ObjectId;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  receivedQuantity: number;
}

export interface IPurchaseOrder extends Document {
  businessId: mongoose.Types.ObjectId;
  purchaseOrderNumber: string;
  supplierId: mongoose.Types.ObjectId;
  products: IPurchaseOrderItem[];
  subtotal: number;
  taxPercentage: number;
  tax: number;
  totalAmount: number;
  status: PurchaseOrderStatus;
  expectedDeliveryDate?: Date;
  createdBy: mongoose.Types.ObjectId;
  updatedAt: Date;
  createdAt: Date;
}

const purchaseOrderItemSchema = new Schema<IPurchaseOrderItem>(
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
    receivedQuantity: { type: Number, required: true, min: 0, default: 0 },
  },
  { _id: false }
);

const purchaseOrderSchema = new Schema<IPurchaseOrder>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
    },
    purchaseOrderNumber: { type: String, required: true, trim: true },
    supplierId: {
      type: Schema.Types.ObjectId,
      ref: "Supplier",
      required: true,
    },
    products: {
      type: [purchaseOrderItemSchema],
      required: true,
      validate: {
        validator: (items: IPurchaseOrderItem[]) => items.length > 0,
        message: "A purchase order must contain at least one product.",
      },
    },
    subtotal: { type: Number, required: true, min: 0 },
    taxPercentage: { type: Number, required: true, min: 0, max: 100 },
    tax: { type: Number, required: true, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ["DRAFT", "APPROVED", "PARTIALLY_RECEIVED", "RECEIVED", "CANCELLED"],
      required: true,
      default: "DRAFT",
    },
    expectedDeliveryDate: { type: Date },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

purchaseOrderSchema.index(
  { businessId: 1, purchaseOrderNumber: 1 },
  { unique: true }
);
purchaseOrderSchema.index({ businessId: 1, createdAt: -1 });
purchaseOrderSchema.index({ businessId: 1, supplierId: 1, status: 1 });

const PurchaseOrder = mongoose.model<IPurchaseOrder>(
  "PurchaseOrder",
  purchaseOrderSchema
);

export default PurchaseOrder;
