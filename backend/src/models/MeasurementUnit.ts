
import mongoose, { Document, Schema } from "mongoose";

export interface IMeasurementUnit extends Document {
  businessId: mongoose.Types.ObjectId;
  unitName: string;
  unitSymbol: string;
  createdAt: Date;
  updatedAt: Date;
}

const measurementUnitSchema = new Schema<IMeasurementUnit>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },

    unitName: {
      type: String,
      required: true,
      trim: true,
    },

    unitSymbol: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

measurementUnitSchema.index(
  { businessId: 1, unitName: 1 },
  { unique: true }
);
measurementUnitSchema.index(
  { businessId: 1, unitSymbol: 1 },
  { unique: true }
);

const MeasurementUnit = mongoose.model<IMeasurementUnit>(
  "MeasurementUnit",
  measurementUnitSchema
);

export default MeasurementUnit;
