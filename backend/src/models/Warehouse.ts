
import mongoose, { Document, Schema } from "mongoose";

export interface IWarehouse extends Document {
  businessId: mongoose.Types.ObjectId;
  warehouseName: string;
  address: string;
  city: string;
  contactNumber: string;
  createdAt: Date;
  updatedAt: Date;
}

const warehouseSchema = new Schema<IWarehouse>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },

    warehouseName: {
      type: String,
      required: true,
      trim: true,
    },

    address: {
      type: String,
      required: true,
      trim: true,
    },

    city: {
      type: String,
      required: true,
      trim: true,
    },

    contactNumber: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

const Warehouse = mongoose.model<IWarehouse>(
  "Warehouse",
  warehouseSchema
);

export default Warehouse;
