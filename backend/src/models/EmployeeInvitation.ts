
import mongoose, { Document, Schema } from "mongoose";

export type EmployeeRole =
  | "INVENTORY_MANAGER"
  | "SALES_EMPLOYEE"
  | "ACCOUNTANT";

export type EmployeeInvitationStatus =
  | "PENDING"
  | "ACCEPTED"
  | "EXPIRED"
  | "REVOKED";

export interface IEmployeeInvitation extends Document {
  businessId: mongoose.Types.ObjectId;
  email: string;
  role: EmployeeRole;
  tokenHash: string;
  status: EmployeeInvitationStatus;
  expiresAt: Date;
  acceptedAt?: Date;
  acceptedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const employeeInvitationSchema = new Schema<IEmployeeInvitation>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    role: {
      type: String,
      required: true,
      enum: [
        "INVENTORY_MANAGER",
        "SALES_EMPLOYEE",
        "ACCOUNTANT",
      ],
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      select: false,
    },
    status: {
      type: String,
      required: true,
      enum: ["PENDING", "ACCEPTED", "EXPIRED", "REVOKED"],
      default: "PENDING",
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    acceptedAt: {
      type: Date,
    },
    acceptedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

employeeInvitationSchema.index(
  { businessId: 1, email: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "PENDING" },
  }
);

const EmployeeInvitation = mongoose.model<IEmployeeInvitation>(
  "EmployeeInvitation",
  employeeInvitationSchema
);

export default EmployeeInvitation;
