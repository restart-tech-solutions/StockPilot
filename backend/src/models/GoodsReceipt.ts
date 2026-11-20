import mongoose, { Document, Schema } from "mongoose";

export interface IGoodsReceiptItem {
  productId: mongoose.Types.ObjectId;
  receivedQuantity: number;
  damagedQuantity: number;
}

export interface IGoodsReceipt extends Document {
  businessId: mongoose.Types.ObjectId;
  receiptNumber: string;
  idempotencyKey: string;
  purchaseOrderId: mongoose.Types.ObjectId;
  supplierId: mongoose.Types.ObjectId;
  warehouseId: mongoose.Types.ObjectId;
  products: IGoodsReceiptItem[];
  discrepancies: string;
  receivedBy: mongoose.Types.ObjectId;
  receivedAt: Date;
  createdAt: Date;
}

const goodsReceiptItemSchema = new Schema<IGoodsReceiptItem>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    receivedQuantity: { type: Number, required: true, min: 0.000001 },
    damagedQuantity: { type: Number, required: true, min: 0, default: 0 },
  },
  { _id: false }
);

const goodsReceiptSchema = new Schema<IGoodsReceipt>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
    },
    receiptNumber: { type: String, required: true, trim: true },
    idempotencyKey: { type: String, required: true, trim: true },
    purchaseOrderId: {
      type: Schema.Types.ObjectId,
      ref: "PurchaseOrder",
      required: true,
    },
    supplierId: {
      type: Schema.Types.ObjectId,
      ref: "Supplier",
      required: true,
    },
    warehouseId: {
      type: Schema.Types.ObjectId,
      ref: "Warehouse",
      required: true,
    },
    products: {
      type: [goodsReceiptItemSchema],
      required: true,
      validate: {
        validator: (items: IGoodsReceiptItem[]) => items.length > 0,
        message: "A goods receipt must contain at least one product.",
      },
    },
    discrepancies: { type: String, trim: true, maxlength: 2000, default: "" },
    receivedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receivedAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true }
);

goodsReceiptSchema.index(
  { businessId: 1, idempotencyKey: 1 },
  { unique: true }
);
goodsReceiptSchema.index(
  { businessId: 1, purchaseOrderId: 1, receivedAt: -1 }
);
goodsReceiptSchema.index({ businessId: 1, receivedAt: -1 });

const GoodsReceipt = mongoose.model<IGoodsReceipt>(
  "GoodsReceipt",
  goodsReceiptSchema
);

export default GoodsReceipt;
