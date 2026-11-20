import { Response } from "express";
import mongoose from "mongoose";

import Customer from "../../models/Customer";
import InventoryBalance from "../../models/InventoryBalance";
import InventoryMovement from "../../models/InventoryMovement";
import Product from "../../models/Product";
import SalesOrder, {
  ISalesOrderItem,
  SalesOrderStatus,
} from "../../models/SalesOrder";
import SalesReturn, {
  ISalesReturnItem,
} from "../../models/SalesReturn";
import TaxInvoiceSettings from "../../models/TaxInvoiceSettings";
import Warehouse from "../../models/Warehouse";
import { AuthenticatedRequest } from "../../middleware/auth.middleware";
import { recordAuditLog } from "../../services/auditLog.service";
import { syncStockAlert } from "../../services/stockAlert.service";
import {
  escapeRegex,
  isDuplicateKeyError,
  isRecord,
  parsePagination,
} from "../../utils/resourceQuery";

class SalesWorkflowError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
  }
}

interface SalesInput {
  customerId: string;
  warehouseId: string;
  products: Array<{
    productId: string;
    quantity: number;
    discountPercentage: number;
  }>;
}

interface ReturnInput {
  products: Array<{ productId: string; quantity: number }>;
}

const orderStatuses: SalesOrderStatus[] = [
  "DRAFT",
  "COMPLETED",
  "PARTIALLY_RETURNED",
  "RETURNED",
  "CANCELLED",
];

const getSalesOrderId = (req: AuthenticatedRequest): string =>
  typeof req.params.salesOrderId === "string" ? req.params.salesOrderId : "";

const roundMoney = (value: number): number => Math.round(value * 100) / 100;

const parseSalesInput = (body: unknown): SalesInput | null => {
  if (
    !isRecord(body) ||
    typeof body.customerId !== "string" ||
    !mongoose.Types.ObjectId.isValid(body.customerId) ||
    typeof body.warehouseId !== "string" ||
    !mongoose.Types.ObjectId.isValid(body.warehouseId) ||
    !Array.isArray(body.products) ||
    body.products.length === 0 ||
    body.products.length > 100
  ) {
    return null;
  }

  const products: SalesInput["products"] = [];
  const productIds = new Set<string>();
  for (const item of body.products) {
    const discountPercentage =
      isRecord(item) && item.discountPercentage === undefined
        ? 0
        : isRecord(item)
          ? item.discountPercentage
          : undefined;
    if (
      !isRecord(item) ||
      typeof item.productId !== "string" ||
      !mongoose.Types.ObjectId.isValid(item.productId) ||
      typeof item.quantity !== "number" ||
      !Number.isFinite(item.quantity) ||
      item.quantity <= 0 ||
      typeof discountPercentage !== "number" ||
      !Number.isFinite(discountPercentage) ||
      discountPercentage < 0 ||
      discountPercentage > 100 ||
      productIds.has(item.productId)
    ) {
      return null;
    }
    productIds.add(item.productId);
    products.push({
      productId: item.productId,
      quantity: item.quantity,
      discountPercentage,
    });
  }

  return {
    customerId: body.customerId,
    warehouseId: body.warehouseId,
    products,
  };
};

const parseReturnInput = (body: unknown): ReturnInput | null => {
  if (
    !isRecord(body) ||
    !Array.isArray(body.products) ||
    body.products.length === 0 ||
    body.products.length > 100
  ) {
    return null;
  }
  const products: ReturnInput["products"] = [];
  const productIds = new Set<string>();
  for (const item of body.products) {
    if (
      !isRecord(item) ||
      typeof item.productId !== "string" ||
      !mongoose.Types.ObjectId.isValid(item.productId) ||
      typeof item.quantity !== "number" ||
      !Number.isFinite(item.quantity) ||
      item.quantity <= 0 ||
      productIds.has(item.productId)
    ) {
      return null;
    }
    productIds.add(item.productId);
    products.push({ productId: item.productId, quantity: item.quantity });
  }
  return { products };
};

const buildSalesValues = async (
  input: SalesInput,
  businessId: string
): Promise<{
  customerId: string;
  customerName: string;
  warehouseId: string;
  products: ISalesOrderItem[];
  subtotal: number;
  discountTotal: number;
  taxableAmount: number;
  taxName: string;
  taxPercentage: number;
  tax: number;
  totalAmount: number;
}> => {
  const [customer, warehouse, productRecords, taxSettings] = await Promise.all([
    Customer.findOne({ _id: input.customerId, businessId }).lean(),
    Warehouse.findOne({ _id: input.warehouseId, businessId }).lean(),
    Product.find({
      businessId,
      _id: { $in: input.products.map((item) => item.productId) },
    }).lean(),
    TaxInvoiceSettings.findOne({ businessId }).lean(),
  ]);
  if (!customer) {
    throw new SalesWorkflowError(404, "Customer not found in this business.");
  }
  if (!warehouse) {
    throw new SalesWorkflowError(404, "Warehouse not found in this business.");
  }
  if (productRecords.length !== input.products.length) {
    throw new SalesWorkflowError(
      404,
      "One or more products were not found in this business."
    );
  }

  const products = input.products.map((item) => {
    const product = productRecords.find(
      (record) => record._id.toString() === item.productId
    );
    if (!product) {
      throw new SalesWorkflowError(
        404,
        "One or more products were not found in this business."
      );
    }
    const subtotal = roundMoney(product.sellingPrice * item.quantity);
    const discountAmount = roundMoney(
      (subtotal * item.discountPercentage) / 100
    );
    return {
      productId: product._id,
      productName: product.productName,
      sku: product.sku,
      quantity: item.quantity,
      unitPrice: product.sellingPrice,
      unitCost: product.purchasePrice,
      discountPercentage: item.discountPercentage,
      subtotal,
      discountAmount,
      taxableAmount: roundMoney(subtotal - discountAmount),
      returnedQuantity: 0,
    };
  });
  const subtotal = roundMoney(
    products.reduce((sum, item) => sum + item.subtotal, 0)
  );
  const discountTotal = roundMoney(
    products.reduce((sum, item) => sum + item.discountAmount, 0)
  );
  const taxableAmount = roundMoney(subtotal - discountTotal);
  const taxPercentage =
    taxSettings?.taxEnabled === true ? taxSettings.taxPercentage : 0;
  const taxName = taxSettings?.taxName ?? "GST";
  const tax = roundMoney((taxableAmount * taxPercentage) / 100);

  return {
    customerId: customer._id.toString(),
    customerName: customer.customerName,
    warehouseId: warehouse._id.toString(),
    products,
    subtotal,
    discountTotal,
    taxableAmount,
    taxName,
    taxPercentage,
    tax,
    totalAmount: roundMoney(taxableAmount + tax),
  };
};

export const createSalesOrder = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const businessId = req.businessMembership?.businessId;
  const createdBy = req.user?.userId;
  const input = parseSalesInput(req.body);
  if (!businessId || !createdBy) {
    res.status(403).json({
      success: false,
      message: "You do not have access to this business.",
    });
    return;
  }
  if (!input) {
    res.status(400).json({
      success: false,
      message: "Provide a customer, warehouse and unique products with valid quantities and discounts.",
    });
    return;
  }

  try {
    const values = await buildSalesValues(input, businessId);
    const salesOrder = await SalesOrder.create({
      businessId,
      salesOrderNumber: `SO-${new mongoose.Types.ObjectId()
        .toString()
        .slice(-10)
        .toUpperCase()}`,
      ...values,
      status: "DRAFT",
      createdBy,
    });
    await recordAuditLog({
      businessId,
      actorUserId: createdBy,
      action: "SALES_ORDER_CREATED",
      resourceType: "SALES_ORDER",
      resourceId: salesOrder._id,
      description: `Created sales order ${salesOrder.salesOrderNumber}.`,
    });
    res.status(201).json({
      success: true,
      message: "Sales order created successfully.",
      salesOrder,
    });
  } catch (error) {
    if (error instanceof SalesWorkflowError) {
      res.status(error.status).json({ success: false, message: error.message });
      return;
    }
    if (isDuplicateKeyError(error)) {
      res.status(409).json({
        success: false,
        message: "A sales order with this number already exists.",
      });
      return;
    }
    console.error("Create Sales Order Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create sales order.",
    });
  }
};

export const updateSalesOrder = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const businessId = req.businessMembership?.businessId;
  const salesOrderId = getSalesOrderId(req);
  const input = parseSalesInput(req.body);
  if (!businessId) {
    res.status(403).json({
      success: false,
      message: "You do not have access to this business.",
    });
    return;
  }
  if (!mongoose.Types.ObjectId.isValid(salesOrderId)) {
    res.status(400).json({ success: false, message: "Invalid sales order ID." });
    return;
  }
  if (!input) {
    res.status(400).json({
      success: false,
      message: "Provide a customer, warehouse and unique products with valid quantities and discounts.",
    });
    return;
  }

  try {
    const currentOrder = await SalesOrder.findOne({
      _id: salesOrderId,
      businessId,
    }).lean();
    if (!currentOrder) {
      res.status(404).json({ success: false, message: "Sales order not found." });
      return;
    }
    if (currentOrder.status !== "DRAFT") {
      res.status(409).json({
        success: false,
        message: "Only draft sales orders can be edited.",
      });
      return;
    }

    const values = await buildSalesValues(input, businessId);
    const salesOrder = await SalesOrder.findOneAndUpdate(
      { _id: salesOrderId, businessId, status: "DRAFT" },
      { $set: values },
      { returnDocument: "after", runValidators: true }
    ).lean();
    if (!salesOrder) {
      res.status(409).json({
        success: false,
        message: "The sales order changed; reload it and try again.",
      });
      return;
    }
    if (req.user?.userId) {
      await recordAuditLog({
        businessId,
        actorUserId: req.user.userId,
        action: "SALES_ORDER_UPDATED",
        resourceType: "SALES_ORDER",
        resourceId: salesOrder._id,
        description: `Updated sales order ${salesOrder.salesOrderNumber}.`,
      });
    }
    res.status(200).json({
      success: true,
      message: "Sales order updated successfully.",
      salesOrder,
    });
  } catch (error) {
    if (error instanceof SalesWorkflowError) {
      res.status(error.status).json({ success: false, message: error.message });
      return;
    }
    console.error("Update Sales Order Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update sales order.",
    });
  }
};

export const listSalesOrders = async (
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
    const { search, status, customerId } = req.query;
    if (
      (search !== undefined && typeof search !== "string") ||
      (status !== undefined && typeof status !== "string") ||
      (customerId !== undefined && typeof customerId !== "string")
    ) {
      res.status(400).json({
        success: false,
        message: "Sales filters must be strings.",
      });
      return;
    }
    const filter: Record<string, unknown> = { businessId };
    if (typeof search === "string" && search.trim()) {
      const expression = new RegExp(escapeRegex(search.trim()), "i");
      filter.$or = [
        { salesOrderNumber: expression },
        { customerName: expression },
      ];
    }
    if (typeof status === "string" && status.trim()) {
      if (!orderStatuses.includes(status as SalesOrderStatus)) {
        res.status(400).json({ success: false, message: "Invalid sales status." });
        return;
      }
      filter.status = status;
    }
    if (typeof customerId === "string" && customerId.trim()) {
      if (!mongoose.Types.ObjectId.isValid(customerId)) {
        res.status(400).json({ success: false, message: "Invalid customer ID." });
        return;
      }
      filter.customerId = customerId;
    }

    const [salesOrders, total] = await Promise.all([
      SalesOrder.find(filter)
        .populate({
          path: "customerId",
          select: "customerName",
          match: { businessId },
        })
        .populate({
          path: "warehouseId",
          select: "warehouseName city",
          match: { businessId },
        })
        .sort({ createdAt: -1, _id: -1 })
        .skip(pagination.skip)
        .limit(pagination.limit)
        .lean(),
      SalesOrder.countDocuments(filter),
    ]);
    res.status(200).json({
      success: true,
      salesOrders,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit),
      },
    });
  } catch (error) {
    console.error("List Sales Orders Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to list sales orders.",
    });
  }
};

export const getSalesOrder = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const businessId = req.businessMembership?.businessId;
    const salesOrderId = getSalesOrderId(req);
    if (!businessId) {
      res.status(403).json({
        success: false,
        message: "You do not have access to this business.",
      });
      return;
    }
    if (!mongoose.Types.ObjectId.isValid(salesOrderId)) {
      res.status(400).json({ success: false, message: "Invalid sales order ID." });
      return;
    }
    const salesOrder = await SalesOrder.findOne({
      _id: salesOrderId,
      businessId,
    })
      .populate({
        path: "customerId",
        select: "customerName email phone",
        match: { businessId },
      })
      .populate({
        path: "warehouseId",
        select: "warehouseName city",
        match: { businessId },
      })
      .populate({ path: "createdBy", select: "name email" })
      .lean();
    if (!salesOrder) {
      res.status(404).json({ success: false, message: "Sales order not found." });
      return;
    }
    const returns = await SalesReturn.find({ businessId, salesOrderId })
      .populate({ path: "returnedBy", select: "name email" })
      .sort({ createdAt: -1, _id: -1 })
      .lean();
    res.status(200).json({ success: true, salesOrder, returns });
  } catch (error) {
    console.error("Get Sales Order Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve sales order.",
    });
  }
};

export const completeSalesOrder = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const businessId = req.businessMembership?.businessId;
  const performedBy = req.user?.userId;
  const salesOrderId = getSalesOrderId(req);
  if (!businessId || !performedBy) {
    res.status(403).json({
      success: false,
      message: "You do not have access to this business.",
    });
    return;
  }
  if (!mongoose.Types.ObjectId.isValid(salesOrderId)) {
    res.status(400).json({ success: false, message: "Invalid sales order ID." });
    return;
  }

  let session: mongoose.ClientSession | undefined;
  try {
    session = await mongoose.startSession();
    const activeSession = session;
    let completedOrder: InstanceType<typeof SalesOrder> | null = null;
    await activeSession.withTransaction(async () => {
      const order = await SalesOrder.findOne({
        _id: salesOrderId,
        businessId,
      }).session(activeSession);
      if (!order) {
        throw new SalesWorkflowError(404, "Sales order not found.");
      }
      if (order.status !== "DRAFT") {
        throw new SalesWorkflowError(
          409,
          "Only draft sales orders can be completed."
        );
      }
      const customerExists = await Customer.exists({
        _id: order.customerId,
        businessId,
      }).session(activeSession);
      const warehouseExists = await Warehouse.exists({
        _id: order.warehouseId,
        businessId,
      }).session(activeSession);
      if (!customerExists || !warehouseExists) {
        throw new SalesWorkflowError(
          404,
          "The customer or warehouse no longer belongs to this business."
        );
      }

      for (const line of order.products) {
        const product = await Product.findOneAndUpdate(
          {
            _id: line.productId,
            businessId,
            currentStock: { $gte: line.quantity },
          },
          { $inc: { currentStock: -line.quantity } },
          {
            returnDocument: "after",
            runValidators: true,
            session: activeSession,
          }
        ).lean();
        if (!product) {
          const exists = await Product.exists({
            _id: line.productId,
            businessId,
          }).session(activeSession);
          throw new SalesWorkflowError(
            exists ? 409 : 404,
            exists
              ? `There is not enough aggregate stock for ${line.productName}.`
              : `Product ${line.productName} no longer belongs to this business.`
          );
        }

        const balance = await InventoryBalance.findOneAndUpdate(
          {
            businessId,
            productId: line.productId,
            warehouseId: order.warehouseId,
            availableQuantity: { $gte: line.quantity },
          },
          { $inc: { availableQuantity: -line.quantity } },
          {
            returnDocument: "after",
            runValidators: true,
            session: activeSession,
          }
        ).lean();
        if (!balance) {
          throw new SalesWorkflowError(
            409,
            `There is not enough available stock for ${line.productName} in the selected warehouse.`
          );
        }
        await syncStockAlert(product, activeSession);
        await InventoryMovement.create(
          [
            {
              businessId,
              productId: line.productId,
              warehouseId: order.warehouseId,
              movementType: "SALES_DEDUCTION",
              quantity: line.quantity,
              previousStock: balance.availableQuantity + line.quantity,
              newStock: balance.availableQuantity,
              referenceType: "SALES_ORDER",
              referenceId: order._id.toString(),
              performedBy,
            },
          ],
          { session: activeSession }
        );
      }

      const updatedOrder = await SalesOrder.findOneAndUpdate(
        { _id: order._id, businessId, status: "DRAFT" },
        { $set: { status: "COMPLETED", completedAt: new Date() } },
        { returnDocument: "after", session: activeSession }
      );
      if (!updatedOrder) {
        throw new SalesWorkflowError(
          409,
          "The sales order changed; reload it and try again."
        );
      }
      await recordAuditLog(
        {
          businessId,
          actorUserId: performedBy,
          action: "SALES_COMPLETED",
          resourceType: "SALES_ORDER",
          resourceId: updatedOrder._id,
          description: `Completed sales order ${updatedOrder.salesOrderNumber}.`,
        },
        activeSession
      );
      completedOrder = updatedOrder;
    });

    if (!completedOrder) {
      res.status(500).json({
        success: false,
        message: "Sales order completion did not finish.",
      });
      return;
    }
    res.status(200).json({
      success: true,
      message: "Sales order completed and warehouse stock deducted.",
      salesOrder: completedOrder,
    });
  } catch (error) {
    if (error instanceof SalesWorkflowError) {
      res.status(error.status).json({ success: false, message: error.message });
      return;
    }
    console.error("Complete Sales Order Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to complete sales order.",
    });
  } finally {
    if (session) await session.endSession();
  }
};

export const cancelSalesOrder = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const businessId = req.businessMembership?.businessId;
  const performedBy = req.user?.userId;
  const salesOrderId = getSalesOrderId(req);
  if (!businessId || !performedBy) {
    res.status(403).json({
      success: false,
      message: "You do not have access to this business.",
    });
    return;
  }
  if (!mongoose.Types.ObjectId.isValid(salesOrderId)) {
    res.status(400).json({ success: false, message: "Invalid sales order ID." });
    return;
  }

  let session: mongoose.ClientSession | undefined;
  try {
    session = await mongoose.startSession();
    const activeSession = session;
    let cancelledOrder: InstanceType<typeof SalesOrder> | null = null;
    await activeSession.withTransaction(async () => {
      const order = await SalesOrder.findOne({
        _id: salesOrderId,
        businessId,
      }).session(activeSession);
      if (!order) {
        throw new SalesWorkflowError(404, "Sales order not found.");
      }
      if (!["DRAFT", "COMPLETED"].includes(order.status)) {
        throw new SalesWorkflowError(
          409,
          "This sales order can no longer be cancelled."
        );
      }
      if (
        order.status === "COMPLETED" &&
        order.products.some((line) => line.returnedQuantity > 0)
      ) {
        throw new SalesWorkflowError(
          409,
          "A sales order with returned products cannot be cancelled."
        );
      }
      const previousStatus = order.status;
      const updatedOrder = await SalesOrder.findOneAndUpdate(
        { _id: order._id, businessId, status: previousStatus },
        { $set: { status: "CANCELLED", cancelledAt: new Date() } },
        { returnDocument: "after", session: activeSession }
      );
      if (!updatedOrder) {
        throw new SalesWorkflowError(
          409,
          "The sales order changed; reload it and try again."
        );
      }

      if (previousStatus === "COMPLETED") {
        const warehouseExists = await Warehouse.exists({
          _id: order.warehouseId,
          businessId,
        }).session(activeSession);
        if (!warehouseExists) {
          throw new SalesWorkflowError(404, "Sales warehouse not found.");
        }
        for (const line of order.products) {
          const product = await Product.findOneAndUpdate(
            { _id: line.productId, businessId },
            { $inc: { currentStock: line.quantity } },
            {
              returnDocument: "after",
              runValidators: true,
              session: activeSession,
            }
          ).lean();
          if (!product) {
            throw new SalesWorkflowError(
              404,
              `Product ${line.productName} no longer belongs to this business.`
            );
          }
          const balance = await InventoryBalance.findOneAndUpdate(
            {
              businessId,
              productId: line.productId,
              warehouseId: order.warehouseId,
            },
            {
              $inc: { availableQuantity: line.quantity },
              $setOnInsert: { reservedQuantity: 0 },
            },
            {
              upsert: true,
              returnDocument: "after",
              runValidators: true,
              session: activeSession,
            }
          ).lean();
          if (!balance) {
            throw new Error("Sales cancellation could not restore warehouse stock.");
          }
          await syncStockAlert(product, activeSession);
          await InventoryMovement.create(
            [
              {
                businessId,
                productId: line.productId,
                warehouseId: order.warehouseId,
                movementType: "SALES_CANCELLATION",
                quantity: line.quantity,
                previousStock: balance.availableQuantity - line.quantity,
                newStock: balance.availableQuantity,
                referenceType: "SALES_CANCELLATION",
                referenceId: order._id.toString(),
                performedBy,
              },
            ],
            { session: activeSession }
          );
        }
      }
      await recordAuditLog(
        {
          businessId,
          actorUserId: performedBy,
          action: "SALES_CANCELLED",
          resourceType: "SALES_ORDER",
          resourceId: updatedOrder._id,
          description: `Cancelled sales order ${updatedOrder.salesOrderNumber}.`,
        },
        activeSession
      );
      cancelledOrder = updatedOrder;
    });

    if (!cancelledOrder) {
      res.status(500).json({
        success: false,
        message: "Sales order cancellation did not finish.",
      });
      return;
    }
    res.status(200).json({
      success: true,
      message: "Sales order cancelled.",
      salesOrder: cancelledOrder,
    });
  } catch (error) {
    if (error instanceof SalesWorkflowError) {
      res.status(error.status).json({ success: false, message: error.message });
      return;
    }
    console.error("Cancel Sales Order Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to cancel sales order.",
    });
  } finally {
    if (session) await session.endSession();
  }
};

export const returnSalesOrder = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const businessId = req.businessMembership?.businessId;
  const returnedBy = req.user?.userId;
  const salesOrderId = getSalesOrderId(req);
  const idempotencyKey = req.get("Idempotency-Key")?.trim();
  const input = parseReturnInput(req.body);
  if (!businessId || !returnedBy) {
    res.status(403).json({
      success: false,
      message: "You do not have access to this business.",
    });
    return;
  }
  if (!mongoose.Types.ObjectId.isValid(salesOrderId)) {
    res.status(400).json({ success: false, message: "Invalid sales order ID." });
    return;
  }
  if (!idempotencyKey || idempotencyKey.length > 120) {
    res.status(400).json({
      success: false,
      message: "A valid Idempotency-Key header is required.",
    });
    return;
  }
  if (!input) {
    res.status(400).json({
      success: false,
      message: "Provide unique sales products with positive return quantities.",
    });
    return;
  }

  let session: mongoose.ClientSession | undefined;
  try {
    session = await mongoose.startSession();
    const activeSession = session;
    let salesReturn: InstanceType<typeof SalesReturn> | undefined;
    let returnedOrder: InstanceType<typeof SalesOrder> | null = null;
    await activeSession.withTransaction(async () => {
      const duplicate = await SalesReturn.exists({
        businessId,
        idempotencyKey,
      }).session(activeSession);
      if (duplicate) {
        throw new SalesWorkflowError(
          409,
          "This sales return has already been processed."
        );
      }
      const order = await SalesOrder.findOne({
        _id: salesOrderId,
        businessId,
      }).session(activeSession);
      if (!order) {
        throw new SalesWorkflowError(404, "Sales order not found.");
      }
      if (!["COMPLETED", "PARTIALLY_RETURNED"].includes(order.status)) {
        throw new SalesWorkflowError(
          409,
          "Only completed, non-cancelled sales orders can be returned."
        );
      }
      const orderLines = new Map(
        order.products.map((line) => [line.productId.toString(), line])
      );
      const returnLines: ISalesReturnItem[] = input.products.map((item) => {
        const orderLine = orderLines.get(item.productId);
        if (
          !orderLine ||
          orderLine.returnedQuantity + item.quantity >
            orderLine.quantity + Number.EPSILON
        ) {
          throw new SalesWorkflowError(
            400,
            "Return quantities cannot exceed the unreturned quantity sold."
          );
        }
        return {
          productId: orderLine.productId,
          productName: orderLine.productName,
          quantity: item.quantity,
        };
      });
      const warehouseExists = await Warehouse.exists({
        _id: order.warehouseId,
        businessId,
      }).session(activeSession);
      if (!warehouseExists) {
        throw new SalesWorkflowError(404, "Sales warehouse not found.");
      }

      const returnNumber = `SR-${new mongoose.Types.ObjectId()
        .toString()
        .slice(-10)
        .toUpperCase()}`;
      const newReturn = new SalesReturn({
        businessId,
        returnNumber,
        salesOrderId: order._id,
        idempotencyKey,
        products: returnLines,
        returnedBy,
      });
      await newReturn.save({ session: activeSession });

      for (const line of returnLines) {
        const product = await Product.findOneAndUpdate(
          { _id: line.productId, businessId },
          { $inc: { currentStock: line.quantity } },
          {
            returnDocument: "after",
            runValidators: true,
            session: activeSession,
          }
        ).lean();
        if (!product) {
          throw new SalesWorkflowError(
            404,
            `Product ${line.productName} no longer belongs to this business.`
          );
        }
        const balance = await InventoryBalance.findOneAndUpdate(
          {
            businessId,
            productId: line.productId,
            warehouseId: order.warehouseId,
          },
          {
            $inc: { availableQuantity: line.quantity },
            $setOnInsert: { reservedQuantity: 0 },
          },
          {
            upsert: true,
            returnDocument: "after",
            runValidators: true,
            session: activeSession,
          }
        ).lean();
        if (!balance) {
          throw new Error("Sales return could not restore warehouse stock.");
        }
        await syncStockAlert(product, activeSession);
        const orderLine = orderLines.get(line.productId.toString());
        if (!orderLine) {
          throw new SalesWorkflowError(400, "Invalid sales return product.");
        }
        orderLine.returnedQuantity += line.quantity;
        await InventoryMovement.create(
          [
            {
              businessId,
              productId: line.productId,
              warehouseId: order.warehouseId,
              movementType: "RETURNED_STOCK",
              quantity: line.quantity,
              previousStock: balance.availableQuantity - line.quantity,
              newStock: balance.availableQuantity,
              referenceType: "SALES_RETURN",
              referenceId: newReturn._id.toString(),
              performedBy: returnedBy,
            },
          ],
          { session: activeSession }
        );
      }
      order.status = order.products.every(
        (line) => line.returnedQuantity >= line.quantity - Number.EPSILON
      )
        ? "RETURNED"
        : "PARTIALLY_RETURNED";
      order.returnedAt = new Date();
      await order.save({ session: activeSession });
      await recordAuditLog(
        {
          businessId,
          actorUserId: returnedBy,
          action: "SALES_RETURNED",
          resourceType: "SALES_RETURN",
          resourceId: newReturn._id,
          description: `Recorded return ${newReturn.returnNumber} for sales order ${order.salesOrderNumber}.`,
        },
        activeSession
      );
      salesReturn = newReturn;
      returnedOrder = order;
    });

    if (!salesReturn || !returnedOrder) {
      res.status(500).json({
        success: false,
        message: "Sales return did not finish.",
      });
      return;
    }
    res.status(201).json({
      success: true,
      message: "Sales return recorded and stock restored.",
      salesReturn,
      salesOrder: returnedOrder,
    });
  } catch (error) {
    if (error instanceof SalesWorkflowError) {
      res.status(error.status).json({ success: false, message: error.message });
      return;
    }
    if (isDuplicateKeyError(error)) {
      res.status(409).json({
        success: false,
        message: "This sales return has already been processed.",
      });
      return;
    }
    console.error("Return Sales Order Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to return sales order products.",
    });
  } finally {
    if (session) await session.endSession();
  }
};
