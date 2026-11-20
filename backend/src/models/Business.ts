import mongoose, { Document, Schema } from "mongoose";

export interface IBusiness extends Document {
  businessName: string;
  ownerId: mongoose.Types.ObjectId;
  contactDetails: {
    email?: string;
    phone?: string;
  };
  category: string;
  location: string;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
}

const businessSchema = new Schema<IBusiness>(
  {
    businessName: {
      type: String,
      required: true,
      trim: true,
    },
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    contactDetails: {
      email: {
        type: String,
        trim: true,
        lowercase: true,
      },
      phone: {
        type: String,
        trim: true,
      },
    },

    category: {
      type: String,
      required: true,
      trim: true,
    },

    location: {
      type: String,
      required: true,
      trim: true,
    },

    currency: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
  },
  {
    timestamps: true,
  }
);

const Business = mongoose.model<IBusiness>(
  "Business",
  businessSchema
);

export default Business;