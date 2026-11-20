
import mongoose, { Document, Schema } from "mongoose";

export type UserRole =
  | "SUPER_ADMIN"
  | "BUSINESS_OWNER"
  | "INVENTORY_MANAGER"
  | "SALES_EMPLOYEE"
  | "ACCOUNTANT";

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  firebaseUid?: string;
  role: UserRole;
  isActive: boolean;
}

const userSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
      select: false,
    },

    firebaseUid: {
      type: String,
      sparse: true,
      unique: true,
    },

    role: {
      type: String,
      enum: [
        "SUPER_ADMIN",
        "BUSINESS_OWNER",
        "INVENTORY_MANAGER",
        "SALES_EMPLOYEE",
        "ACCOUNTANT",
      ],
      required: true,
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

const User = mongoose.model<IUser>("User", userSchema);

export default User;
