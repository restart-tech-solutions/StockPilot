
import mongoose, { Document, Schema } from "mongoose";

export interface ICategory extends Document {
  businessId: mongoose.Types.ObjectId;
  categoryName: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

const categorySchema = new Schema<ICategory>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },

    categoryName: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

const Category = mongoose.model<ICategory>(
  "Category",
  categorySchema
);

export default Category;
