import mongoose, { Document, Schema } from "mongoose";

export interface IInventoryTransfer extends Document {
  businessId: mongoose.Types.ObjectId;
  transferNumber: string;
  idempotencyKey: string;
  productId: mongoose.Types.ObjectId;
  sourceWarehouseId: mongoose.Types.ObjectId;
  destinationWarehouseId: mongoose.Types.ObjectId;
  quantity: number;
  performedBy: mongoose.Types.ObjectId;
  createdAt: Date;
}

const inventoryTransferSchema = new Schema<IInventoryTransfer>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
    },
    transferNumber: { type: String, required: true, trim: true },
    idempotencyKey: { type: String, required: true, trim: true },
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    sourceWarehouseId: {
      type: Schema.Types.ObjectId,
      ref: "Warehouse",
      required: true,
    },
    destinationWarehouseId: {
      type: Schema.Types.ObjectId,
      ref: "Warehouse",
      required: true,
    },
    quantity: { type: Number, required: true, min: 0.000001 },
    performedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

inventoryTransferSchema.index(
  { businessId: 1, idempotencyKey: 1 },
  { unique: true }
);
inventoryTransferSchema.index({ businessId: 1, createdAt: -1 });

const InventoryTransfer = mongoose.model<IInventoryTransfer>(
  "InventoryTransfer",
  inventoryTransferSchema
);

export default InventoryTransfer;
