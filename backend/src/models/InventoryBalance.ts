import mongoose, { Document, Schema } from "mongoose";

export interface IInventoryBalance extends Document {
  businessId: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  warehouseId: mongoose.Types.ObjectId;
  availableQuantity: number;
  reservedQuantity: number;
  createdAt: Date;
  updatedAt: Date;
}

const inventoryBalanceSchema = new Schema<IInventoryBalance>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    warehouseId: {
      type: Schema.Types.ObjectId,
      ref: "Warehouse",
      required: true,
    },
    availableQuantity: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    reservedQuantity: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
  },
  { timestamps: true }
);

inventoryBalanceSchema.index(
  { businessId: 1, productId: 1, warehouseId: 1 },
  { unique: true }
);
inventoryBalanceSchema.index({ businessId: 1, warehouseId: 1, productId: 1 });

const InventoryBalance = mongoose.model<IInventoryBalance>(
  "InventoryBalance",
  inventoryBalanceSchema
);

export default InventoryBalance;
