import { Response } from "express";
import mongoose from "mongoose";

import Category from "../../models/Category";
import InventoryMovement from "../../models/InventoryMovement";
import Product from "../../models/Product";
import PurchaseOrder from "../../models/PurchaseOrder";
import SalesOrder from "../../models/SalesOrder";
import Supplier from "../../models/Supplier";
import { AuthenticatedRequest } from "../../middleware/auth.middleware";
import {
  escapeRegex,
  isRecord,
  isDuplicateKeyError,
  parsePagination,
} from "../../utils/resourceQuery";
import { recordAuditLog } from "../../services/auditLog.service";
import { syncStockAlert } from "../../services/stockAlert.service";

const getProductId = (req: AuthenticatedRequest): string =>
  typeof req.params.productId === "string" ? req.params.productId : "";

const isNonNegativeNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

export const createProduct = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!isRecord(req.body)) {
      res.status(400).json({
        success: false,
        message: "Product fields must be provided as an object.",
      });
      return;
    }
    const businessId = req.businessMembership?.businessId;
    const {
      productName,
      sku,
      barcode,
      category,
      brand,
      purchasePrice,
      sellingPrice,
      currentStock,
      minimumStockThreshold,
      supplier,
      productDescription,
      productImage,
    } = req.body;

    if (!businessId) {
      res.status(403).json({
        success: false,
        message: "You do not have access to this business.",
      });
      return;
    }

    if (
      typeof productName !== "string" ||
      !productName.trim() ||
      typeof sku !== "string" ||
      !sku.trim() ||
      typeof category !== "string" ||
      purchasePrice === undefined ||
      sellingPrice === undefined
    ) {
      res.status(400).json({
        success: false,
        message: "Please provide all required product fields.",
      });
      return;
    }

    if (
      !mongoose.Types.ObjectId.isValid(category) ||
      (supplier !== undefined &&
        supplier !== "" &&
        (typeof supplier !== "string" ||
          !mongoose.Types.ObjectId.isValid(supplier)))
    ) {
      res.status(400).json({
        success: false,
        message: "Invalid category or supplier ID.",
      });
      return;
    }

    const openingStock = currentStock ?? 0;
    const minimumThreshold = minimumStockThreshold ?? 0;
    if (
      !isNonNegativeNumber(purchasePrice) ||
      !isNonNegativeNumber(sellingPrice) ||
      !isNonNegativeNumber(openingStock) ||
      openingStock !== 0 ||
      !isNonNegativeNumber(minimumThreshold)
    ) {
      res.status(400).json({
        success: false,
        message:
          openingStock !== 0
            ? "Opening stock will be added through the Inventory workflow."
            : "Product prices and stock values must be valid non-negative numbers.",
      });
      return;
    }

    for (const [field, value] of Object.entries({
      barcode,
      brand,
      productDescription,
      productImage,
    })) {
      if (value !== undefined && typeof value !== "string") {
        res.status(400).json({
          success: false,
          message: `${field} must be a string.`,
        });
        return;
      }
    }

    const existingCategory = await Category.findOne({
      _id: category,
      businessId,
    }).lean();
    if (!existingCategory) {
      res.status(404).json({
        success: false,
        message: "Category not found in this business.",
      });
      return;
    }

    const normalizedSku = sku.trim().toUpperCase();
    const existingProduct = await Product.findOne({
      businessId,
      sku: normalizedSku,
    }).lean();
    if (existingProduct) {
      res.status(409).json({
        success: false,
        message: "This SKU already exists in your business.",
      });
      return;
    }

    let supplierId: string | undefined;
    if (typeof supplier === "string" && supplier.trim()) {
      const existingSupplier = await Supplier.findOne({
        _id: supplier,
        businessId,
      }).lean();
      if (!existingSupplier) {
        res.status(404).json({
          success: false,
          message: "Supplier not found in this business.",
        });
        return;
      }
      supplierId = supplier;
    }

    const product = await Product.create({
      businessId,
      productName: productName.trim(),
      sku: normalizedSku,
      barcode: typeof barcode === "string" ? barcode.trim() : undefined,
      category,
      brand: typeof brand === "string" ? brand.trim() : undefined,
      purchasePrice,
      sellingPrice,
      currentStock: 0,
      minimumStockThreshold: minimumThreshold,
      supplier: supplierId,
      productDescription:
        typeof productDescription === "string"
          ? productDescription.trim()
          : undefined,
      productImage:
        typeof productImage === "string" ? productImage.trim() : undefined,
    });
    await syncStockAlert(product);
    if (req.user?.userId) {
      await recordAuditLog({
        businessId,
        actorUserId: req.user.userId,
        action: "PRODUCT_CREATED",
        resourceType: "PRODUCT",
        resourceId: product._id,
        description: `Created product ${product.productName} (${product.sku}).`,
      });
    }

    res.status(201).json({
      success: true,
      message: "Product created successfully.",
      data: product,
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      res.status(409).json({
        success: false,
        message: "This SKU already exists in your business.",
      });
      return;
    }
    console.error("Create Product Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create product.",
    });
  }
};

export const listProducts = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const businessId = req.businessMembership?.businessId;
    if (!businessId) {
      res.status(403).json({
        success: false,
        message: "You do not have access to this business.",
      });
      return;
    }
    const pagination = parsePagination(req.query.page, req.query.limit);
    if (!pagination) {
      res.status(400).json({ success: false, message: "Invalid pagination values." });
      return;
    }
    if (
      (req.query.search !== undefined && typeof req.query.search !== "string") ||
      (req.query.categoryId !== undefined &&
        typeof req.query.categoryId !== "string")
    ) {
      res.status(400).json({
        success: false,
        message: "Search and categoryId must be strings.",
      });
      return;
    }

    const filter: Record<string, unknown> = { businessId };
    const search =
      typeof req.query.search === "string" ? req.query.search.trim() : "";
    if (search) {
      const expression = new RegExp(escapeRegex(search), "i");
      filter.$or = [{ productName: expression }, { sku: expression }];
    }
    const categoryId =
      typeof req.query.categoryId === "string"
        ? req.query.categoryId.trim()
        : "";
    if (categoryId) {
      if (!mongoose.Types.ObjectId.isValid(categoryId)) {
        res.status(400).json({ success: false, message: "Invalid category ID." });
        return;
      }
      const categoryExists = await Category.exists({
        _id: categoryId,
        businessId,
      });
      if (!categoryExists) {
        res.status(404).json({
          success: false,
          message: "Category not found in this business.",
        });
        return;
      }
      filter.category = categoryId;
    }

    const [products, total] = await Promise.all([
      Product.find(filter)
        .populate({
          path: "category",
          select: "categoryName",
          match: { businessId },
        })
        .populate({
          path: "supplier",
          select: "supplierName",
          match: { businessId },
        })
        .sort({ productName: 1, _id: 1 })
        .skip(pagination.skip)
        .limit(pagination.limit)
        .lean(),
      Product.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      products,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit),
      },
    });
  } catch (error) {
    console.error("List Products Error:", error);
    res.status(500).json({ success: false, message: "Failed to list products." });
  }
};

export const getProduct = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const businessId = req.businessMembership?.businessId;
    const productId = getProductId(req);
    if (!businessId) {
      res.status(403).json({
        success: false,
        message: "You do not have access to this business.",
      });
      return;
    }
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      res.status(400).json({ success: false, message: "Invalid product ID." });
      return;
    }

    const product = await Product.findOne({ _id: productId, businessId })
      .populate({
        path: "category",
        select: "categoryName",
        match: { businessId },
      })
      .populate({
        path: "supplier",
        select: "supplierName",
        match: { businessId },
      })
      .lean();
    if (!product) {
      res.status(404).json({ success: false, message: "Product not found." });
      return;
    }
    res.status(200).json({ success: true, product });
  } catch (error) {
    console.error("Get Product Error:", error);
    res.status(500).json({ success: false, message: "Failed to retrieve product." });
  }
};

export const updateProduct = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const businessId = req.businessMembership?.businessId;
    const productId = getProductId(req);
    if (!businessId) {
      res.status(403).json({
        success: false,
        message: "You do not have access to this business.",
      });
      return;
    }
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      res.status(400).json({ success: false, message: "Invalid product ID." });
      return;
    }
    if (!isRecord(req.body)) {
      res.status(400).json({
        success: false,
        message: "Product fields must be provided as an object.",
      });
      return;
    }
    if (Object.prototype.hasOwnProperty.call(req.body, "currentStock")) {
      res.status(400).json({
        success: false,
        message: "Current stock can only be changed through Inventory.",
      });
      return;
    }

    const editableFields = [
      "productName",
      "sku",
      "barcode",
      "category",
      "brand",
      "purchasePrice",
      "sellingPrice",
      "minimumStockThreshold",
      "supplier",
      "productDescription",
      "productImage",
    ] as const;
    const updates: Record<string, string | number | undefined> = {};
    for (const field of editableFields) {
      const value = req.body[field];
      if (value === undefined) {
        continue;
      }
      if (
        [
          "productName",
          "sku",
          "barcode",
          "category",
          "brand",
          "supplier",
          "productDescription",
          "productImage",
        ].includes(field)
      ) {
        if (typeof value !== "string") {
          res.status(400).json({
            success: false,
            message: `${field} must be a string.`,
          });
          return;
        }
        updates[field] = value.trim();
      } else {
        if (!isNonNegativeNumber(value)) {
          res.status(400).json({
            success: false,
            message: `${field} must be a valid non-negative number.`,
          });
          return;
        }
        updates[field] = value;
      }
    }
    if (Object.keys(updates).length === 0) {
      res.status(400).json({
        success: false,
        message: "Provide at least one product field to update.",
      });
      return;
    }

    if (typeof updates.productName === "string" && !updates.productName) {
      res.status(400).json({ success: false, message: "Product name is required." });
      return;
    }
    if (typeof updates.sku === "string") {
      if (!updates.sku) {
        res.status(400).json({ success: false, message: "SKU is required." });
        return;
      }
      updates.sku = updates.sku.toUpperCase();
    }
    if (typeof updates.category === "string") {
      if (!mongoose.Types.ObjectId.isValid(updates.category)) {
        res.status(400).json({ success: false, message: "Invalid category ID." });
        return;
      }
      const categoryExists = await Category.exists({
        _id: updates.category,
        businessId,
      });
      if (!categoryExists) {
        res.status(404).json({
          success: false,
          message: "Category not found in this business.",
        });
        return;
      }
    }
    if (typeof updates.supplier === "string" && updates.supplier) {
      if (!mongoose.Types.ObjectId.isValid(updates.supplier)) {
        res.status(400).json({ success: false, message: "Invalid supplier ID." });
        return;
      }
      const supplierExists = await Supplier.exists({
        _id: updates.supplier,
        businessId,
      });
      if (!supplierExists) {
        res.status(404).json({
          success: false,
          message: "Supplier not found in this business.",
        });
        return;
      }
    }

    if (typeof updates.sku === "string") {
      const duplicateSku = await Product.findOne({
        businessId,
        _id: { $ne: productId },
        sku: updates.sku,
      }).lean();
      if (duplicateSku) {
        res.status(409).json({
          success: false,
          message: "This SKU already exists in your business.",
        });
        return;
      }
    }

    const existingProduct = await Product.findOne({ _id: productId, businessId }).lean();
    if (!existingProduct) {
      res.status(404).json({ success: false, message: "Product not found." });
      return;
    }

    const clearSupplier = req.body.supplier === "";
    if (clearSupplier) {
      delete updates.supplier;
    }
    const update: Record<string, unknown> = {};
    if (Object.keys(updates).length > 0) {
      update.$set = updates;
    }
    if (clearSupplier) {
      update.$unset = { supplier: 1 };
    }
    const product = await Product.findOneAndUpdate(
      { _id: productId, businessId },
      update,
      { returnDocument: "after", runValidators: true }
    )
      .populate({
        path: "category",
        select: "categoryName",
        match: { businessId },
      })
      .populate({
        path: "supplier",
        select: "supplierName",
        match: { businessId },
      })
      .lean();
    if (!product) {
      res.status(404).json({ success: false, message: "Product not found." });
      return;
    }
    if (
      typeof updates.minimumStockThreshold === "number" &&
      existingProduct.minimumStockThreshold !== updates.minimumStockThreshold
    ) {
      await syncStockAlert(product);
      if (req.user?.userId) {
        await recordAuditLog({
          businessId,
          actorUserId: req.user.userId,
          action: "PRODUCT_REORDER_THRESHOLD_UPDATED",
          resourceType: "PRODUCT",
          resourceId: product._id,
          description: `Updated minimum stock threshold for ${product.productName} to ${product.minimumStockThreshold}.`,
        });
      }
    }
    res.status(200).json({
      success: true,
      message: "Product updated successfully.",
      data: product,
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      res.status(409).json({
        success: false,
        message: "This SKU already exists in your business.",
      });
      return;
    }
    console.error("Update Product Error:", error);
    res.status(500).json({ success: false, message: "Failed to update product." });
  }
};

export const deleteProduct = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const businessId = req.businessMembership?.businessId;
    const productId = getProductId(req);
    if (!businessId) {
      res.status(403).json({
        success: false,
        message: "You do not have access to this business.",
      });
      return;
    }
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      res.status(400).json({ success: false, message: "Invalid product ID." });
      return;
    }

    const product = await Product.findOne({ _id: productId, businessId });
    if (!product) {
      res.status(404).json({ success: false, message: "Product not found." });
      return;
    }
    const [hasInventoryMovements, hasPurchaseOrders, hasSalesOrders] = await Promise.all([
      InventoryMovement.exists({ businessId, productId }),
      PurchaseOrder.exists({ businessId, "products.productId": productId }),
      SalesOrder.exists({ businessId, "products.productId": productId }),
    ]);
    if (hasInventoryMovements || hasPurchaseOrders || hasSalesOrders) {
      res.status(409).json({
        success: false,
        message:
          "This product has purchase, sales or inventory history and cannot be deleted.",
      });
      return;
    }

    await product.deleteOne();
    res.status(200).json({ success: true, message: "Product deleted successfully." });
  } catch (error) {
    console.error("Delete Product Error:", error);
    res.status(500).json({ success: false, message: "Failed to delete product." });
  }
};
