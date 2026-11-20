import { Response } from "express";
import mongoose from "mongoose";

import Customer from "../../models/Customer";
import SalesOrder from "../../models/SalesOrder";
import { AuthenticatedRequest } from "../../middleware/auth.middleware";
import {
  escapeRegex,
  isRecord,
  isDuplicateKeyError,
  parsePagination,
} from "../../utils/resourceQuery";

const getCustomerId = (req: AuthenticatedRequest): string =>
  typeof req.params.customerId === "string" ? req.params.customerId : "";

const isValidEmail = (email: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const isValidPhone = (phone: string): boolean =>
  /^\+?[0-9][0-9\s().-]{5,19}$/.test(phone);

const customerFields = ["customerName", "email", "phone", "address"] as const;

function validateCustomerFields(
  body: Record<string, unknown>,
  isCreate: boolean
): { values?: Record<string, string | undefined>; message?: string } {
  const values: Record<string, string | undefined> = {};

  if (
    isCreate &&
    (typeof body.customerName !== "string" || !body.customerName.trim())
  ) {
    return { message: "Customer name is required" };
  }

  for (const field of customerFields) {
    if (body[field] === undefined) {
      continue;
    }
    if (typeof body[field] !== "string") {
      return { message: `${field} must be a string` };
    }
    const value = (body[field] as string).trim();
    if (field === "customerName" && !value) {
      return { message: "Customer name is required" };
    }
    if (field === "email" && value && !isValidEmail(value)) {
      return { message: "Enter a valid customer email address" };
    }
    if (field === "phone" && value && !isValidPhone(value)) {
      return { message: "Enter a valid customer phone number" };
    }
    values[field] = value || undefined;
  }

  if (values.email) {
    values.email = values.email.toLowerCase();
  }
  return { values };
}

export const createCustomer = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!isRecord(req.body)) {
      res.status(400).json({ success: false, message: "Customer fields must be an object" });
      return;
    }
    const businessId = req.businessMembership?.businessId;
    if (!businessId) {
      res.status(403).json({ success: false, message: "You do not have access to this business" });
      return;
    }
    const validation = validateCustomerFields(req.body, true);
    if (!validation.values) {
      res.status(400).json({ success: false, message: validation.message });
      return;
    }

    if (validation.values.email) {
      const existing = await Customer.findOne({
        businessId,
        email: validation.values.email,
      }).lean();
      if (existing) {
        res.status(409).json({
          success: false,
          message: "A customer with this email already exists in your business",
        });
        return;
      }
    }

    const customer = await Customer.create({ businessId, ...validation.values });
    res.status(201).json({
      success: true,
      message: "Customer created successfully",
      customer,
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      res.status(409).json({
        success: false,
        message: "A customer with this email already exists in your business",
      });
      return;
    }
    console.error("Create Customer Error:", error);
    res.status(500).json({ success: false, message: "Failed to create customer" });
  }
};

export const listCustomers = async (
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
        { customerName: expression },
        { email: expression },
        { phone: expression },
      ];
    }

    const [customers, total] = await Promise.all([
      Customer.find(filter)
        .sort({ customerName: 1, _id: 1 })
        .skip(pagination.skip)
        .limit(pagination.limit)
        .lean(),
      Customer.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      customers,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit),
      },
    });
  } catch (error) {
    console.error("List Customers Error:", error);
    res.status(500).json({ success: false, message: "Failed to list customers" });
  }
};

export const getCustomer = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const businessId = req.businessMembership?.businessId;
    const customerId = getCustomerId(req);
    if (!businessId) {
      res.status(403).json({ success: false, message: "You do not have access to this business" });
      return;
    }
    if (!mongoose.Types.ObjectId.isValid(customerId)) {
      res.status(400).json({ success: false, message: "Invalid customer ID" });
      return;
    }

    const customer = await Customer.findOne({ _id: customerId, businessId }).lean();
    if (!customer) {
      res.status(404).json({ success: false, message: "Customer not found" });
      return;
    }
    res.status(200).json({ success: true, customer });
  } catch (error) {
    console.error("Get Customer Error:", error);
    res.status(500).json({ success: false, message: "Failed to retrieve customer" });
  }
};

export const updateCustomer = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!isRecord(req.body)) {
      res.status(400).json({ success: false, message: "Customer fields must be an object" });
      return;
    }
    const businessId = req.businessMembership?.businessId;
    const customerId = getCustomerId(req);
    if (!businessId) {
      res.status(403).json({ success: false, message: "You do not have access to this business" });
      return;
    }
    if (!mongoose.Types.ObjectId.isValid(customerId)) {
      res.status(400).json({ success: false, message: "Invalid customer ID" });
      return;
    }

    const validation = validateCustomerFields(req.body, false);
    if (!validation.values) {
      res.status(400).json({ success: false, message: validation.message });
      return;
    }
    if (Object.keys(validation.values).length === 0) {
      res.status(400).json({ success: false, message: "Provide at least one customer field to update" });
      return;
    }
    const currentCustomer = await Customer.findOne({ _id: customerId, businessId }).lean();
    if (!currentCustomer) {
      res.status(404).json({ success: false, message: "Customer not found" });
      return;
    }
    if (validation.values.email) {
      const duplicate = await Customer.findOne({
        businessId,
        _id: { $ne: customerId },
        email: validation.values.email,
      }).lean();
      if (duplicate) {
        res.status(409).json({
          success: false,
          message: "A customer with this email already exists in your business",
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

    const customer = await Customer.findOneAndUpdate(
      { _id: customerId, businessId },
      update,
      { returnDocument: "after", runValidators: true }
    ).lean();
    if (!customer) {
      res.status(404).json({ success: false, message: "Customer not found" });
      return;
    }
    res.status(200).json({ success: true, message: "Customer updated successfully", customer });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      res.status(409).json({
        success: false,
        message: "A customer with this email already exists in your business",
      });
      return;
    }
    console.error("Update Customer Error:", error);
    res.status(500).json({ success: false, message: "Failed to update customer" });
  }
};

export const deleteCustomer = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const businessId = req.businessMembership?.businessId;
    const customerId = getCustomerId(req);
    if (!businessId) {
      res.status(403).json({ success: false, message: "You do not have access to this business" });
      return;
    }
    if (!mongoose.Types.ObjectId.isValid(customerId)) {
      res.status(400).json({ success: false, message: "Invalid customer ID" });
      return;
    }

    const hasSalesOrders = await SalesOrder.exists({ businessId, customerId });
    if (hasSalesOrders) {
      res.status(409).json({
        success: false,
        message: "Customers referenced by sales orders cannot be deleted.",
      });
      return;
    }
    const customer = await Customer.findOneAndDelete({ _id: customerId, businessId });
    if (!customer) {
      res.status(404).json({ success: false, message: "Customer not found" });
      return;
    }
    res.status(200).json({ success: true, message: "Customer deleted successfully" });
  } catch (error) {
    console.error("Delete Customer Error:", error);
    res.status(500).json({ success: false, message: "Failed to delete customer" });
  }
};
