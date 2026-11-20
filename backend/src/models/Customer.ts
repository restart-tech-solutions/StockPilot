import mongoose, { Document, Schema } from "mongoose";

export interface ICustomer extends Document {
  businessId: mongoose.Types.ObjectId;
  customerName: string;
  email?: string;
  phone?: string;
  address?: string;
  createdAt: Date;
  updatedAt: Date;
}

const customerSchema = new Schema<ICustomer>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
    },
    customerName: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    address: { type: String, trim: true },
  },
  { timestamps: true }
);

customerSchema.index({ businessId: 1, customerName: 1 });
customerSchema.index(
  { businessId: 1, email: 1 },
  {
    unique: true,
    partialFilterExpression: { email: { $type: "string" } },
  }
);

const Customer = mongoose.model<ICustomer>("Customer", customerSchema);

export default Customer;
