import mongoose, { Document, Schema } from "mongoose";

export type StockAlertCondition = "LOW_STOCK" | "OUT_OF_STOCK";
export type StockAlertStatus = "ACTIVE" | "RESOLVED";

export interface IStockAlert extends Document {
  businessId: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  condition: StockAlertCondition;
  status: StockAlertStatus;
  currentStock: number;
  minimumStockThreshold: number;
  openedAt: Date;
  resolvedAt?: Date;
  lastEventId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const stockAlertSchema = new Schema<IStockAlert>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      immutable: true,
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      immutable: true,
    },
    condition: {
      type: String,
      enum: ["LOW_STOCK", "OUT_OF_STOCK"],
      required: true,
      immutable: true,
    },
    status: {
      type: String,
      enum: ["ACTIVE", "RESOLVED"],
      required: true,
      default: "ACTIVE",
    },
    currentStock: { type: Number, required: true, min: 0 },
    minimumStockThreshold: { type: Number, required: true, min: 0 },
    openedAt: { type: Date, required: true, default: Date.now },
    resolvedAt: { type: Date },
    lastEventId: {
      type: Schema.Types.ObjectId,
      required: true,
      default: () => new mongoose.Types.ObjectId(),
    },
  },
  { timestamps: true }
);

stockAlertSchema.index(
  { businessId: 1, productId: 1, condition: 1 },
  { unique: true }
);
stockAlertSchema.index({ businessId: 1, status: 1, condition: 1, updatedAt: -1 });

const StockAlert = mongoose.model<IStockAlert>("StockAlert", stockAlertSchema);

export default StockAlert;
