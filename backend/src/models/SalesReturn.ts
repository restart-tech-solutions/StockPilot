import mongoose, { Document, Schema } from "mongoose";

export interface ISalesReturnItem {
  productId: mongoose.Types.ObjectId;
  productName: string;
  quantity: number;
}

export interface ISalesReturn extends Document {
  businessId: mongoose.Types.ObjectId;
  returnNumber: string;
  salesOrderId: mongoose.Types.ObjectId;
  idempotencyKey: string;
  products: ISalesReturnItem[];
  returnedBy: mongoose.Types.ObjectId;
  createdAt: Date;
}

const salesReturnItemSchema = new Schema<ISalesReturnItem>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    productName: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 0.000001 },
  },
  { _id: false }
);

const salesReturnSchema = new Schema<ISalesReturn>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
    },
    returnNumber: { type: String, required: true, trim: true },
    salesOrderId: {
      type: Schema.Types.ObjectId,
      ref: "SalesOrder",
      required: true,
    },
    idempotencyKey: { type: String, required: true, trim: true, maxlength: 120 },
    products: {
      type: [salesReturnItemSchema],
      required: true,
      validate: {
        validator: (items: ISalesReturnItem[]) => items.length > 0,
        message: "A sales return must contain at least one product.",
      },
    },
    returnedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

salesReturnSchema.index(
  { businessId: 1, idempotencyKey: 1 },
  { unique: true }
);
salesReturnSchema.index(
  { businessId: 1, returnNumber: 1 },
  { unique: true }
);
salesReturnSchema.index({ businessId: 1, salesOrderId: 1, createdAt: -1 });

const SalesReturn = mongoose.model<ISalesReturn>("SalesReturn", salesReturnSchema);

export default SalesReturn;
