import mongoose, { Document, Schema } from "mongoose";

export interface IMembership extends Document {
  userId: mongoose.Types.ObjectId;
  businessId: mongoose.Types.ObjectId;
  role: string;
  status: "ACTIVE" | "INACTIVE";
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const membershipSchema = new Schema<IMembership>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
    },

    role: {
      type: String,
      required: true,
      enum: [
        "BUSINESS_OWNER",
        "INVENTORY_MANAGER",
        "SALES_EMPLOYEE",
        "ACCOUNTANT",
      ],
    },

    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE"],
      default: "ACTIVE",
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

membershipSchema.index(
  { userId: 1, businessId: 1 },
  { unique: true }
);

const Membership = mongoose.model<IMembership>(
  "Membership",
  membershipSchema
);

export default Membership;