import mongoose, { Document, Schema } from "mongoose";

export interface ISupplier extends Document {
  businessId: mongoose.Types.ObjectId;
  supplierName: string;
  companyName?: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  taxIdentification?: string;
  paymentTerms?: string;
  createdAt: Date;
  updatedAt: Date;
}

const supplierSchema = new Schema<ISupplier>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
    },
    supplierName: { type: String, required: true, trim: true },
    companyName: { type: String, trim: true },
    contactPerson: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    address: { type: String, trim: true },
    taxIdentification: { type: String, trim: true },
    paymentTerms: { type: String, trim: true },
  },
  { timestamps: true }
);

supplierSchema.index(
  { businessId: 1, supplierName: 1 },
  {
    unique: true,
    collation: { locale: "en", strength: 2 },
  }
);
supplierSchema.index({ businessId: 1, contactPerson: 1 });

const Supplier = mongoose.model<ISupplier>("Supplier", supplierSchema);

export default Supplier;
