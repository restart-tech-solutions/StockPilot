
import mongoose, { Document, Schema } from "mongoose";

export interface IProduct extends Document {
  businessId: mongoose.Types.ObjectId;
  productName: string;
  sku: string;
  barcode?: string;
  category: mongoose.Types.ObjectId;
  brand?: string;
  purchasePrice: number;
  sellingPrice: number;
  currentStock: number;
  minimumStockThreshold: number;
  supplier?: mongoose.Types.ObjectId;
  productDescription?: string;
  productImage?: string;
  createdAt: Date;
  updatedAt: Date;
}

const productSchema = new Schema<IProduct>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    productName: {
      type: String,
      required: true,
      trim: true,
    },
    sku: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    barcode: {
      type: String,
      trim: true,
    },
    category: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    brand: {
      type: String,
      trim: true,
    },
    purchasePrice: {
      type: Number,
      required: true,
      min: 0,
    },
    sellingPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    currentStock: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    minimumStockThreshold: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    supplier: {
      type: Schema.Types.ObjectId,
      ref: "Supplier",
    },
    productDescription: {
      type: String,
      trim: true,
    },
    productImage: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

productSchema.index(
  { businessId: 1, sku: 1 },
  { unique: true }
);

const Product = mongoose.model<IProduct>("Product", productSchema);

export default Product;
