import { Response } from "express";
import mongoose from "mongoose";
import Category from "../../models/Category";
import Product from "../../models/Product";
import { AuthenticatedRequest } from "../../middleware/auth.middleware";

const escapeRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const createCategory = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const { categoryName, description } = req.body;
    const businessId = req.businessMembership?.businessId;

    if (!businessId) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this business",
      });
    }

    if (typeof categoryName !== "string" || !categoryName.trim()) {
      return res.status(400).json({
        success: false,
        message: "Category name is required",
      });
    }

    if (
      description !== undefined &&
      (typeof description !== "string" || !description.trim())
    ) {
      return res.status(400).json({
        success: false,
        message: "Description must be a non-empty string",
      });
    }

    const normalizedCategoryName = categoryName.trim();
    const existingCategory = await Category.findOne({
      businessId,
      categoryName: {
        $regex: `^${escapeRegex(normalizedCategoryName)}$`,
        $options: "i",
      },
    }).lean();

    if (existingCategory) {
      return res.status(409).json({
        success: false,
        message: "This category name already exists in your business",
      });
    }

    const category = await Category.create({
      businessId,
      categoryName: normalizedCategoryName,
      description:
        typeof description === "string"
          ? description.trim()
          : undefined,
    });

    return res.status(201).json({
      success: true,
      message: "Category created successfully",
      category,
    });
  } catch (error) {
    console.error("Create Category Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create category",
    });
  }
};

export const listCategories = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const businessId = req.businessMembership?.businessId;

    if (!businessId) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this business",
      });
    }

    const categories = await Category.find({ businessId })
      .sort({ categoryName: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      categories,
    });
  } catch (error) {
    console.error("List Categories Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to list categories",
    });
  }
};

export const getCategory = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const businessId = req.businessMembership?.businessId;
    const categoryId =
      typeof req.params.categoryId === "string"
        ? req.params.categoryId
        : "";

    if (!businessId) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this business",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category ID",
      });
    }

    const category = await Category.findOne({
      _id: categoryId,
      businessId,
    }).lean();

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    return res.status(200).json({
      success: true,
      category,
    });
  } catch (error) {
    console.error("Get Category Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve category",
    });
  }
};

export const updateCategory = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const businessId = req.businessMembership?.businessId;
    const categoryId =
      typeof req.params.categoryId === "string"
        ? req.params.categoryId
        : "";
    const { categoryName, description } = req.body;

    if (!businessId) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this business",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category ID",
      });
    }

    if (categoryName === undefined && description === undefined) {
      return res.status(400).json({
        success: false,
        message: "At least one category field is required",
      });
    }

    const updates: {
      categoryName?: string;
      description?: string;
    } = {};

    if (categoryName !== undefined) {
      if (typeof categoryName !== "string" || !categoryName.trim()) {
        return res.status(400).json({
          success: false,
          message: "Category name must be a non-empty string",
        });
      }

      updates.categoryName = categoryName.trim();
      const existingCategory = await Category.findOne({
        _id: { $ne: categoryId },
        businessId,
        categoryName: {
          $regex: `^${escapeRegex(updates.categoryName)}$`,
          $options: "i",
        },
      }).lean();

      if (existingCategory) {
        return res.status(409).json({
          success: false,
          message: "This category name already exists in your business",
        });
      }
    }

    if (description !== undefined) {
      if (typeof description !== "string" || !description.trim()) {
        return res.status(400).json({
          success: false,
          message: "Description must be a non-empty string",
        });
      }
      updates.description = description.trim();
    }

    const category = await Category.findOneAndUpdate(
      { _id: categoryId, businessId },
      { $set: updates },
      { new: true, runValidators: true }
    ).lean();

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Category updated successfully",
      category,
    });
  } catch (error) {
    console.error("Update Category Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update category",
    });
  }
};

export const deleteCategory = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const businessId = req.businessMembership?.businessId;
    const categoryId =
      typeof req.params.categoryId === "string"
        ? req.params.categoryId
        : "";

    if (!businessId) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this business",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category ID",
      });
    }

    const category = await Category.findOne({
      _id: categoryId,
      businessId,
    }).lean();

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    const referencedProduct = await Product.exists({
      businessId,
      category: categoryId,
    });

    if (referencedProduct) {
      return res.status(409).json({
        success: false,
        message:
          "Category cannot be deleted because it is referenced by existing products",
      });
    }

    await Category.deleteOne({
      _id: categoryId,
      businessId,
    });

    return res.status(200).json({
      success: true,
      message: "Category deleted successfully",
    });
  } catch (error) {
    console.error("Delete Category Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete category",
    });
  }
};
