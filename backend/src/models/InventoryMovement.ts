
import mongoose, { Document, Schema } from "mongoose";

export type InventoryMovementType =
  | "OPENING_STOCK"
  | "STOCK_IN"
  | "STOCK_OUT"
  | "SALES_DEDUCTION"
  | "PURCHASE_RECEIPT"
  | "STOCK_ADJUSTMENT"
  | "STOCK_TRANSFER"
  | "DAMAGED_STOCK"
  | "RETURNED_STOCK"
  | "SALES_CANCELLATION";

export interface IInventoryMovement extends Document {
  businessId: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  warehouseId?: mongoose.Types.ObjectId;
  movementType: InventoryMovementType;
  quantity: number;
  previousStock: number;
  newStock: number;
  referenceType?: string;
  referenceId?: string;
  performedBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const inventoryMovementSchema = new Schema<IInventoryMovement>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    warehouseId: {
      type: Schema.Types.ObjectId,
      ref: "Warehouse",
      index: true,
    },
    movementType: {
      type: String,
      enum: [
        "OPENING_STOCK",
        "STOCK_IN",
        "STOCK_OUT",
        "SALES_DEDUCTION",
        "PURCHASE_RECEIPT",
        "STOCK_ADJUSTMENT",
        "STOCK_TRANSFER",
        "DAMAGED_STOCK",
        "RETURNED_STOCK",
        "SALES_CANCELLATION",
      ],
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 0,
    },
    previousStock: {
      type: Number,
      required: true,
      min: 0,
    },
    newStock: {
      type: Number,
      required: true,
      min: 0,
    },
    referenceType: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    referenceId: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    performedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

inventoryMovementSchema.index({
  businessId: 1,
  productId: 1,
  createdAt: -1,
});
inventoryMovementSchema.index({ businessId: 1, createdAt: -1, movementType: 1 });
inventoryMovementSchema.index(
  {
    businessId: 1,
    productId: 1,
    warehouseId: 1,
    movementType: 1,
    referenceType: 1,
    referenceId: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      referenceType: { $type: "string" },
      referenceId: { $type: "string" },
    },
  }
);

const InventoryMovement = mongoose.model<IInventoryMovement>(
  "InventoryMovement",
  inventoryMovementSchema
);

export default InventoryMovement;
