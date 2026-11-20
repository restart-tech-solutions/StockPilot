import { Response } from "express";
import mongoose from "mongoose";

import Product from "../../models/Product";
import PurchaseOrder from "../../models/PurchaseOrder";
import Supplier from "../../models/Supplier";
import { AuthenticatedRequest } from "../../middleware/auth.middleware";
import {
  escapeRegex,
  isRecord,
  isDuplicateKeyError,
  parsePagination,
} from "../../utils/resourceQuery";

const supplierNameCollation = { locale: "en", strength: 2 } as const;
const getSupplierId = (req: AuthenticatedRequest): string =>
  typeof req.params.supplierId === "string" ? req.params.supplierId : "";

const isValidEmail = (email: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const isValidPhone = (phone: string): boolean =>
  /^\+?[0-9][0-9\s().-]{5,19}$/.test(phone);

const supplierFields = [
  "supplierName",
  "companyName",
  "contactPerson",
  "email",
  "phone",
  "address",
  "taxIdentification",
  "paymentTerms",
] as const;

function validateSupplierFields(
  body: Record<string, unknown>,
  isCreate: boolean
): { values?: Record<string, string | undefined>; message?: string } {
  const values: Record<string, string | undefined> = {};

  if (isCreate && (typeof body.supplierName !== "string" || !body.supplierName.trim())) {
    return { message: "Supplier name is required" };
  }

  for (const field of supplierFields) {
    if (body[field] === undefined) {
      continue;
    }
    if (typeof body[field] !== "string") {
      return { message: `${field} must be a string` };
    }
    const value = (body[field] as string).trim();
    if (field === "supplierName" && !value) {
      return { message: "Supplier name is required" };
    }
    if (field === "email" && value && !isValidEmail(value)) {
      return { message: "Enter a valid supplier email address" };
    }
    if (field === "phone" && value && !isValidPhone(value)) {
      return { message: "Enter a valid supplier phone number" };
    }
    values[field] = value || undefined;
  }

  return { values };
}

export const createSupplier = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!isRecord(req.body)) {
      res.status(400).json({ success: false, message: "Supplier fields must be an object" });
      return;
    }
    const businessId = req.businessMembership?.businessId;
    if (!businessId) {
      res.status(403).json({ success: false, message: "You do not have access to this business" });
      return;
    }
    const validation = validateSupplierFields(req.body, true);
    if (!validation.values) {
      res.status(400).json({ success: false, message: validation.message });
      return;
    }

    const supplierName = validation.values.supplierName!;
    const existing = await Supplier.findOne({ businessId, supplierName })
      .collation(supplierNameCollation)
      .lean();
    if (existing) {
      res.status(409).json({
        success: false,
        message: "A supplier with this name already exists in your business",
      });
      return;
    }

    const supplier = await Supplier.create({ businessId, ...validation.values });
    res.status(201).json({
      success: true,
      message: "Supplier created successfully",
      supplier,
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      res.status(409).json({
        success: false,
        message: "A supplier with this name already exists in your business",
      });
      return;
    }
    console.error("Create Supplier Error:", error);
    res.status(500).json({ success: false, message: "Failed to create supplier" });
  }
};

export const listSuppliers = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const businessId = req.businessMembership?.businessId;
    if (!businessId) {
      res.status(403).json({ success: false, message: "You do not have access to this business" });
      return;
    }
    const pagination = parsePagination(req.query.page, req.query.limit);
    if (!pagination) {
      res.status(400).json({ success: false, message: "Invalid pagination values" });
      return;
    }
    if (req.query.search !== undefined && typeof req.query.search !== "string") {
      res.status(400).json({ success: false, message: "Search must be a string" });
      return;
    }

    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const filter: Record<string, unknown> = { businessId };
    if (search) {
      const expression = new RegExp(escapeRegex(search), "i");
      filter.$or = [
        { supplierName: expression },
        { companyName: expression },
        { contactPerson: expression },
        { email: expression },
        { phone: expression },
      ];
    }

    const [suppliers, total] = await Promise.all([
      Supplier.find(filter)
        .sort({ supplierName: 1, _id: 1 })
        .skip(pagination.skip)
        .limit(pagination.limit)
        .lean(),
      Supplier.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      suppliers,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit),
      },
    });
  } catch (error) {
    console.error("List Suppliers Error:", error);
    res.status(500).json({ success: false, message: "Failed to list suppliers" });
  }
};

export const getSupplier = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const businessId = req.businessMembership?.businessId;
    const supplierId = getSupplierId(req);
    if (!businessId) {
      res.status(403).json({ success: false, message: "You do not have access to this business" });
      return;
    }
    if (!mongoose.Types.ObjectId.isValid(supplierId)) {
      res.status(400).json({ success: false, message: "Invalid supplier ID" });
      return;
    }

    const supplier = await Supplier.findOne({ _id: supplierId, businessId }).lean();
    if (!supplier) {
      res.status(404).json({ success: false, message: "Supplier not found" });
      return;
    }

    const associatedProducts = await Product.find({
      businessId,
      supplier: supplier._id,
    })
      .select("productName sku currentStock")
      .sort({ productName: 1, _id: 1 })
      .lean();

    res.status(200).json({
      success: true,
      supplier,
      associatedProducts,
    });
  } catch (error) {
    console.error("Get Supplier Error:", error);
    res.status(500).json({ success: false, message: "Failed to retrieve supplier" });
  }
};

export const updateSupplier = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!isRecord(req.body)) {
      res.status(400).json({ success: false, message: "Supplier fields must be an object" });
      return;
    }
    const businessId = req.businessMembership?.businessId;
    const supplierId = getSupplierId(req);
    if (!businessId) {
      res.status(403).json({ success: false, message: "You do not have access to this business" });
      return;
    }
    if (!mongoose.Types.ObjectId.isValid(supplierId)) {
      res.status(400).json({ success: false, message: "Invalid supplier ID" });
      return;
    }

    const validation = validateSupplierFields(req.body, false);
    if (!validation.values) {
      res.status(400).json({ success: false, message: validation.message });
      return;
    }
    if (Object.keys(validation.values).length === 0) {
      res.status(400).json({ success: false, message: "Provide at least one supplier field to update" });
      return;
    }

    const currentSupplier = await Supplier.findOne({ _id: supplierId, businessId }).lean();
    if (!currentSupplier) {
      res.status(404).json({ success: false, message: "Supplier not found" });
      return;
    }

    if (validation.values.supplierName) {
      const duplicate = await Supplier.findOne({
        businessId,
        _id: { $ne: supplierId },
        supplierName: validation.values.supplierName,
      })
        .collation(supplierNameCollation)
        .lean();
      if (duplicate) {
        res.status(409).json({
          success: false,
          message: "A supplier with this name already exists in your business",
        });
        return;
      }
    }

    const setValues = Object.fromEntries(
      Object.entries(validation.values).filter(([, value]) => value !== undefined)
    );
    const unsetValues = Object.fromEntries(
      Object.entries(validation.values)
        .filter(([, value]) => value === undefined)
        .map(([field]) => [field, 1])
    );
    const update: Record<string, unknown> = {};
    if (Object.keys(setValues).length > 0) {
      update.$set = setValues;
    }
    if (Object.keys(unsetValues).length > 0) {
      update.$unset = unsetValues;
    }

    const supplier = await Supplier.findOneAndUpdate(
      { _id: supplierId, businessId },
      update,
      { returnDocument: "after", runValidators: true }
    ).lean();
    if (!supplier) {
      res.status(404).json({ success: false, message: "Supplier not found" });
      return;
    }
    res.status(200).json({ success: true, message: "Supplier updated successfully", supplier });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      res.status(409).json({
        success: false,
        message: "A supplier with this name already exists in your business",
      });
      return;
    }
    console.error("Update Supplier Error:", error);
    res.status(500).json({ success: false, message: "Failed to update supplier" });
  }
};

export const deleteSupplier = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const businessId = req.businessMembership?.businessId;
    const supplierId = getSupplierId(req);
    if (!businessId) {
      res.status(403).json({ success: false, message: "You do not have access to this business" });
      return;
    }
    if (!mongoose.Types.ObjectId.isValid(supplierId)) {
      res.status(400).json({ success: false, message: "Invalid supplier ID" });
      return;
    }

    const supplier = await Supplier.findOne({ _id: supplierId, businessId });
    if (!supplier) {
      res.status(404).json({ success: false, message: "Supplier not found" });
      return;
    }
    const [hasProducts, hasPurchaseOrders] = await Promise.all([
      Product.exists({ businessId, supplier: supplierId }),
      PurchaseOrder.exists({ businessId, supplierId }),
    ]);
    if (hasProducts || hasPurchaseOrders) {
      res.status(409).json({
        success: false,
        message:
          "This supplier is associated with products or purchase orders and cannot be deleted",
      });
      return;
    }

    await supplier.deleteOne();
    res.status(200).json({ success: true, message: "Supplier deleted successfully" });
  } catch (error) {
    console.error("Delete Supplier Error:", error);
    res.status(500).json({ success: false, message: "Failed to delete supplier" });
  }
};
