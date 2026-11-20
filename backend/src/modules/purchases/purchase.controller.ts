import { Response } from "express";
import mongoose from "mongoose";

import GoodsReceipt, { IGoodsReceiptItem } from "../../models/GoodsReceipt";
import InventoryBalance from "../../models/InventoryBalance";
import InventoryMovement from "../../models/InventoryMovement";
import Product from "../../models/Product";
import PurchaseOrder, {
  IPurchaseOrderItem,
  PurchaseOrderStatus,
} from "../../models/PurchaseOrder";
import Supplier from "../../models/Supplier";
import TaxInvoiceSettings from "../../models/TaxInvoiceSettings";
import Warehouse from "../../models/Warehouse";
import { AuthenticatedRequest } from "../../middleware/auth.middleware";
import { recordAuditLog } from "../../services/auditLog.service";
import { syncStockAlert } from "../../services/stockAlert.service";
import {
  escapeRegex,
  isRecord,
  isDuplicateKeyError,
  parsePagination,
} from "../../utils/resourceQuery";

class PurchaseWorkflowError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
  }
}

interface PurchaseInput {
  purchaseOrderNumber: string;
  supplierId: string;
  products: Array<{ productId: string; quantity: number }>;
  expectedDeliveryDate?: Date;
}

const getPurchaseOrderId = (req: AuthenticatedRequest): string =>
  typeof req.params.purchaseOrderId === "string"
    ? req.params.purchaseOrderId
    : "";

const roundMoney = (value: number): number => Math.round(value * 100) / 100;

const parsePurchaseInput = (body: unknown): PurchaseInput | null => {
  if (!isRecord(body)) {
    return null;
  }
  const { purchaseOrderNumber, supplierId, products, expectedDeliveryDate } =
    body;
  if (
    typeof purchaseOrderNumber !== "string" ||
    !purchaseOrderNumber.trim() ||
    purchaseOrderNumber.trim().length > 80 ||
    typeof supplierId !== "string" ||
    !mongoose.Types.ObjectId.isValid(supplierId) ||
    !Array.isArray(products) ||
    products.length === 0
  ) {
    return null;
  }

  const parsedProducts: PurchaseInput["products"] = [];
  const productIds = new Set<string>();
  for (const product of products) {
    if (
      !isRecord(product) ||
      typeof product.productId !== "string" ||
      !mongoose.Types.ObjectId.isValid(product.productId) ||
      typeof product.quantity !== "number" ||
      !Number.isFinite(product.quantity) ||
      product.quantity <= 0 ||
      productIds.has(product.productId)
    ) {
      return null;
    }
    productIds.add(product.productId);
    parsedProducts.push({
      productId: product.productId,
      quantity: product.quantity,
    });
  }

  let deliveryDate: Date | undefined;
  if (expectedDeliveryDate !== undefined && expectedDeliveryDate !== "") {
    if (
      typeof expectedDeliveryDate !== "string" ||
      Number.isNaN(new Date(expectedDeliveryDate).getTime())
    ) {
      return null;
    }
    deliveryDate = new Date(expectedDeliveryDate);
  }

  return {
    purchaseOrderNumber: purchaseOrderNumber.trim(),
    supplierId,
    products: parsedProducts,
    ...(deliveryDate ? { expectedDeliveryDate: deliveryDate } : {}),
  };
};

const buildOrderValues = async (
  input: PurchaseInput,
  businessId: string
): Promise<{
  products: IPurchaseOrderItem[];
  subtotal: number;
  taxPercentage: number;
  tax: number;
  totalAmount: number;
}> => {
  const supplierExists = await Supplier.exists({
    _id: input.supplierId,
    businessId,
  });
  if (!supplierExists) {
    throw new PurchaseWorkflowError(
      404,
      "Supplier not found in this business."
    );
  }

  const productRecords = await Product.find({
    businessId,
    _id: { $in: input.products.map((item) => item.productId) },
  }).lean();
  if (productRecords.length !== input.products.length) {
    throw new PurchaseWorkflowError(
      404,
      "One or more products were not found in this business."
    );
  }

  const products = input.products.map((item) => {
    const product = productRecords.find(
      (record) => record._id.toString() === item.productId
    );
    if (!product) {
      throw new PurchaseWorkflowError(
        404,
        "One or more products were not found in this business."
      );
    }
    return {
      productId: product._id,
      productName: product.productName,
      sku: product.sku,
      quantity: item.quantity,
      unitPrice: product.purchasePrice,
      receivedQuantity: 0,
    };
  });

  const subtotal = roundMoney(
    products.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
  );
  const taxSettings = await TaxInvoiceSettings.findOne({ businessId }).lean();
  const taxPercentage =
    taxSettings?.taxEnabled === true ? taxSettings.taxPercentage : 0;
  const tax = roundMoney((subtotal * taxPercentage) / 100);

  return {
    products,
    subtotal,
    taxPercentage,
    tax,
    totalAmount: roundMoney(subtotal + tax),
  };
};

export const createPurchaseOrder = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const businessId = req.businessMembership?.businessId;
  const createdBy = req.user?.userId;
  const input = parsePurchaseInput(req.body);
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
      message: "Provide a purchase number, supplier and valid product quantities.",
    });
    return;
  }

  try {
    const amounts = await buildOrderValues(input, businessId);
    const purchaseOrder = await PurchaseOrder.create({
      businessId,
      purchaseOrderNumber: input.purchaseOrderNumber,
      supplierId: input.supplierId,
      ...amounts,
      status: "DRAFT",
      ...(input.expectedDeliveryDate
        ? { expectedDeliveryDate: input.expectedDeliveryDate }
        : {}),
      createdBy,
    });
    await recordAuditLog({
      businessId,
      actorUserId: createdBy,
      action: "PURCHASE_CREATED",
      resourceType: "PURCHASE_ORDER",
      resourceId: purchaseOrder._id,
      description: `Created purchase order ${purchaseOrder.purchaseOrderNumber}.`,
    });
    res.status(201).json({
      success: true,
      message: "Purchase order created successfully.",
      purchaseOrder,
    });
  } catch (error) {
    if (error instanceof PurchaseWorkflowError) {
      res.status(error.status).json({ success: false, message: error.message });
      return;
    }
    if (isDuplicateKeyError(error)) {
      res.status(409).json({
        success: false,
        message: "This purchase order number already exists in this business.",
      });
      return;
    }
    console.error("Create Purchase Order Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create purchase order.",
    });
  }
};

export const updatePurchaseOrder = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const businessId = req.businessMembership?.businessId;
  const purchaseOrderId = getPurchaseOrderId(req);
  const input = parsePurchaseInput(req.body);
  if (!businessId) {
    res.status(403).json({
      success: false,
      message: "You do not have access to this business.",
    });
    return;
  }
  if (!mongoose.Types.ObjectId.isValid(purchaseOrderId)) {
    res.status(400).json({ success: false, message: "Invalid purchase order ID." });
    return;
  }
  if (!input) {
    res.status(400).json({
      success: false,
      message: "Provide a purchase number, supplier and valid product quantities.",
    });
    return;
  }

  try {
    const currentOrder = await PurchaseOrder.findOne({
      _id: purchaseOrderId,
      businessId,
    }).lean();
    if (!currentOrder) {
      res.status(404).json({ success: false, message: "Purchase order not found." });
      return;
    }
    if (currentOrder.status !== "DRAFT") {
      res.status(409).json({
        success: false,
        message: "Only draft purchase orders can be edited.",
      });
      return;
    }

    const amounts = await buildOrderValues(input, businessId);
    const update: Record<string, unknown> = {
      $set: {
        purchaseOrderNumber: input.purchaseOrderNumber,
        supplierId: input.supplierId,
        ...amounts,
      },
    };
    if (input.expectedDeliveryDate) {
      (update.$set as Record<string, unknown>).expectedDeliveryDate =
        input.expectedDeliveryDate;
    } else {
      update.$unset = { expectedDeliveryDate: 1 };
    }
    const purchaseOrder = await PurchaseOrder.findOneAndUpdate(
      { _id: purchaseOrderId, businessId, status: "DRAFT" },
      update,
      { returnDocument: "after", runValidators: true }
    ).lean();
    if (!purchaseOrder) {
      res.status(409).json({
        success: false,
        message: "The purchase order changed; reload it and try again.",
      });
      return;
    }
    if (req.user?.userId) {
      await recordAuditLog({
        businessId,
        actorUserId: req.user.userId,
        action: "PURCHASE_UPDATED",
        resourceType: "PURCHASE_ORDER",
        resourceId: purchaseOrder._id,
        description: `Updated purchase order ${purchaseOrder.purchaseOrderNumber}.`,
      });
    }
    res.status(200).json({
      success: true,
      message: "Purchase order updated successfully.",
      purchaseOrder,
    });
  } catch (error) {
    if (error instanceof PurchaseWorkflowError) {
      res.status(error.status).json({ success: false, message: error.message });
      return;
    }
    if (isDuplicateKeyError(error)) {
      res.status(409).json({
        success: false,
        message: "This purchase order number already exists in this business.",
      });
      return;
    }
    console.error("Update Purchase Order Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update purchase order.",
    });
  }
};

export const listPurchaseOrders = async (
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
    const { search, status, supplierId } = req.query;
    if (
      (search !== undefined && typeof search !== "string") ||
      (status !== undefined && typeof status !== "string") ||
      (supplierId !== undefined && typeof supplierId !== "string")
    ) {
      res.status(400).json({
        success: false,
        message: "Purchase filters must be strings.",
      });
      return;
    }

    const filter: Record<string, unknown> = { businessId };
    if (typeof search === "string" && search.trim()) {
      filter.purchaseOrderNumber = new RegExp(escapeRegex(search.trim()), "i");
    }
    if (typeof status === "string" && status.trim()) {
      const statuses: PurchaseOrderStatus[] = [
        "DRAFT",
        "APPROVED",
        "PARTIALLY_RECEIVED",
        "RECEIVED",
        "CANCELLED",
      ];
      if (!statuses.includes(status as PurchaseOrderStatus)) {
        res.status(400).json({ success: false, message: "Invalid purchase status." });
        return;
      }
      filter.status = status;
    }
    if (typeof supplierId === "string" && supplierId.trim()) {
      if (!mongoose.Types.ObjectId.isValid(supplierId)) {
        res.status(400).json({ success: false, message: "Invalid supplier ID." });
        return;
      }
      filter.supplierId = supplierId;
    }

    const [purchaseOrders, total] = await Promise.all([
      PurchaseOrder.find(filter)
        .populate({
          path: "supplierId",
          select: "supplierName",
          match: { businessId },
        })
        .sort({ createdAt: -1, _id: -1 })
        .skip(pagination.skip)
        .limit(pagination.limit)
        .lean(),
      PurchaseOrder.countDocuments(filter),
    ]);
    res.status(200).json({
      success: true,
      purchaseOrders,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit),
      },
    });
  } catch (error) {
    console.error("List Purchase Orders Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to list purchase orders.",
    });
  }
};

export const getPurchaseOrder = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const businessId = req.businessMembership?.businessId;
    const purchaseOrderId = getPurchaseOrderId(req);
    if (!businessId) {
      res.status(403).json({
        success: false,
        message: "You do not have access to this business.",
      });
      return;
    }
    if (!mongoose.Types.ObjectId.isValid(purchaseOrderId)) {
      res.status(400).json({ success: false, message: "Invalid purchase order ID." });
      return;
    }

    const purchaseOrder = await PurchaseOrder.findOne({
      _id: purchaseOrderId,
      businessId,
    })
      .populate({
        path: "supplierId",
        select: "supplierName email phone",
        match: { businessId },
      })
      .populate({
        path: "createdBy",
        select: "name email",
      })
      .lean();
    if (!purchaseOrder) {
      res.status(404).json({ success: false, message: "Purchase order not found." });
      return;
    }
    const receipts = await GoodsReceipt.find({
      businessId,
      purchaseOrderId,
    })
      .populate({ path: "warehouseId", select: "warehouseName", match: { businessId } })
      .populate({ path: "receivedBy", select: "name email" })
      .sort({ receivedAt: -1 })
      .lean();
    res.status(200).json({ success: true, purchaseOrder, receipts });
  } catch (error) {
    console.error("Get Purchase Order Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve purchase order.",
    });
  }
};

export const approvePurchaseOrder = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const businessId = req.businessMembership?.businessId;
    const purchaseOrderId = getPurchaseOrderId(req);
    if (!businessId) {
      res.status(403).json({
        success: false,
        message: "You do not have access to this business.",
      });
      return;
    }
    if (!mongoose.Types.ObjectId.isValid(purchaseOrderId)) {
      res.status(400).json({ success: false, message: "Invalid purchase order ID." });
      return;
    }
    const purchaseOrder = await PurchaseOrder.findOneAndUpdate(
      { _id: purchaseOrderId, businessId, status: "DRAFT" },
      { $set: { status: "APPROVED" } },
      { returnDocument: "after" }
    ).lean();
    if (!purchaseOrder) {
      const exists = await PurchaseOrder.exists({ _id: purchaseOrderId, businessId });
      res.status(exists ? 409 : 404).json({
        success: false,
        message: exists
          ? "Only draft purchase orders can be approved."
          : "Purchase order not found.",
      });
      return;
    }
    if (req.user?.userId) {
      await recordAuditLog({
        businessId,
        actorUserId: req.user.userId,
        action: "PURCHASE_APPROVED",
        resourceType: "PURCHASE_ORDER",
        resourceId: purchaseOrder._id,
        description: `Approved purchase order ${purchaseOrder.purchaseOrderNumber}.`,
      });
    }
    res.status(200).json({
      success: true,
      message: "Purchase order approved.",
      purchaseOrder,
    });
  } catch (error) {
    console.error("Approve Purchase Order Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to approve purchase order.",
    });
  }
};

export const cancelPurchaseOrder = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const businessId = req.businessMembership?.businessId;
    const purchaseOrderId = getPurchaseOrderId(req);
    if (!businessId) {
      res.status(403).json({
        success: false,
        message: "You do not have access to this business.",
      });
      return;
    }
    if (!mongoose.Types.ObjectId.isValid(purchaseOrderId)) {
      res.status(400).json({ success: false, message: "Invalid purchase order ID." });
      return;
    }
    const purchaseOrder = await PurchaseOrder.findOneAndUpdate(
      {
        _id: purchaseOrderId,
        businessId,
        status: { $in: ["DRAFT", "APPROVED"] },
      },
      { $set: { status: "CANCELLED" } },
      { returnDocument: "after" }
    ).lean();
    if (!purchaseOrder) {
      const exists = await PurchaseOrder.exists({ _id: purchaseOrderId, businessId });
      res.status(exists ? 409 : 404).json({
        success: false,
        message: exists
          ? "A purchase order with received goods cannot be cancelled."
          : "Purchase order not found.",
      });
      return;
    }
    if (req.user?.userId) {
      await recordAuditLog({
        businessId,
        actorUserId: req.user.userId,
        action: "PURCHASE_CANCELLED",
        resourceType: "PURCHASE_ORDER",
        resourceId: purchaseOrder._id,
        description: `Cancelled purchase order ${purchaseOrder.purchaseOrderNumber}.`,
      });
    }
    res.status(200).json({
      success: true,
      message: "Purchase order cancelled.",
      purchaseOrder,
    });
  } catch (error) {
    console.error("Cancel Purchase Order Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to cancel purchase order.",
    });
  }
};

export const receivePurchaseOrder = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const businessId = req.businessMembership?.businessId;
  const receivedBy = req.user?.userId;
  const purchaseOrderId = getPurchaseOrderId(req);
  const idempotencyKey = req.get("Idempotency-Key")?.trim();
  if (!businessId || !receivedBy) {
    res.status(403).json({
      success: false,
      message: "You do not have access to this business.",
    });
    return;
  }
  if (!mongoose.Types.ObjectId.isValid(purchaseOrderId)) {
    res.status(400).json({ success: false, message: "Invalid purchase order ID." });
    return;
  }
  if (!idempotencyKey || idempotencyKey.length > 120) {
    res.status(400).json({
      success: false,
      message: "A valid Idempotency-Key header is required.",
    });
    return;
  }
  if (!isRecord(req.body)) {
    res.status(400).json({
      success: false,
      message: "Goods receipt fields must be provided as an object.",
    });
    return;
  }

  const { warehouseId, products, discrepancies } = req.body;
  if (
    typeof warehouseId !== "string" ||
    !mongoose.Types.ObjectId.isValid(warehouseId) ||
    !Array.isArray(products) ||
    products.length === 0 ||
    (discrepancies !== undefined &&
      (typeof discrepancies !== "string" || discrepancies.length > 2000))
  ) {
    res.status(400).json({
      success: false,
      message: "Provide a valid warehouse and at least one receipt line.",
    });
    return;
  }

  const receiptLines: IGoodsReceiptItem[] = [];
  const receivedProductIds = new Set<string>();
  for (const line of products) {
    const damagedQuantity =
      isRecord(line) && typeof line.damagedQuantity === "number"
        ? line.damagedQuantity
        : 0;
    if (
      !isRecord(line) ||
      typeof line.productId !== "string" ||
      !mongoose.Types.ObjectId.isValid(line.productId) ||
      typeof line.receivedQuantity !== "number" ||
      !Number.isFinite(line.receivedQuantity) ||
      line.receivedQuantity <= 0 ||
      !Number.isFinite(damagedQuantity) ||
      damagedQuantity < 0 ||
      damagedQuantity > line.receivedQuantity ||
      receivedProductIds.has(line.productId)
    ) {
      res.status(400).json({
        success: false,
        message: "Receipt lines must contain unique products and valid quantities.",
      });
      return;
    }
    receivedProductIds.add(line.productId);
    receiptLines.push({
      productId: new mongoose.Types.ObjectId(line.productId),
      receivedQuantity: line.receivedQuantity,
      damagedQuantity,
    });
  }

  let session: mongoose.ClientSession | undefined;
  try {
    session = await mongoose.startSession();
    const activeSession = session;
    let receipt: InstanceType<typeof GoodsReceipt> | undefined;
    await activeSession.withTransaction(async () => {
      const alreadyProcessed = await GoodsReceipt.exists({
        businessId,
        idempotencyKey,
      }).session(activeSession);
      if (alreadyProcessed) {
        throw new PurchaseWorkflowError(
          409,
          "This goods receipt has already been processed."
        );
      }

      const order = await PurchaseOrder.findOne({
        _id: purchaseOrderId,
        businessId,
      }).session(activeSession);
      if (!order) {
        throw new PurchaseWorkflowError(404, "Purchase order not found.");
      }
      if (!["APPROVED", "PARTIALLY_RECEIVED"].includes(order.status)) {
        throw new PurchaseWorkflowError(
          409,
          "Only approved purchase orders can receive goods."
        );
      }
      const warehouseExists = await Warehouse.exists({
        _id: warehouseId,
        businessId,
      }).session(activeSession);
      if (!warehouseExists) {
        throw new PurchaseWorkflowError(
          404,
          "Warehouse not found in this business."
        );
      }

      const orderItems = new Map(
        order.products.map((item) => [item.productId.toString(), item])
      );
      for (const line of receiptLines) {
        const orderItem = orderItems.get(line.productId.toString());
        if (
          !orderItem ||
          orderItem.receivedQuantity + line.receivedQuantity >
            orderItem.quantity + Number.EPSILON
        ) {
          throw new PurchaseWorkflowError(
            400,
            "Received quantities cannot exceed the remaining ordered quantities."
          );
        }
      }

      const receiptNumber = `GR-${new mongoose.Types.ObjectId()
        .toString()
        .slice(-10)
        .toUpperCase()}`;
      const createdReceipt = new GoodsReceipt({
        businessId,
        receiptNumber,
        idempotencyKey,
        purchaseOrderId,
        supplierId: order.supplierId,
        warehouseId,
        products: receiptLines,
        discrepancies:
          typeof discrepancies === "string" ? discrepancies.trim() : "",
        receivedBy,
      });
      await createdReceipt.save({ session: activeSession });

      for (const line of receiptLines) {
        const orderItem = orderItems.get(line.productId.toString());
        if (!orderItem) {
          throw new PurchaseWorkflowError(
            400,
            "Receipt contains a product not included in the purchase order."
          );
        }
        orderItem.receivedQuantity += line.receivedQuantity;
        const goodQuantity = line.receivedQuantity - line.damagedQuantity;
        const product = await Product.findOne({
          _id: line.productId,
          businessId,
        })
          .session(activeSession)
          .lean();
        if (!product) {
          throw new PurchaseWorkflowError(
            404,
            "A purchase product no longer exists in this business."
          );
        }
        if (goodQuantity === 0) {
          continue;
        }

        const balance = await InventoryBalance.findOneAndUpdate(
          { businessId, productId: line.productId, warehouseId },
          {
            $inc: { availableQuantity: goodQuantity },
            $setOnInsert: { reservedQuantity: 0 },
          },
          {
            upsert: true,
            returnDocument: "after",
            runValidators: true,
            session: activeSession,
          }
        ).lean();
        const updatedProduct = await Product.findOneAndUpdate(
          { _id: line.productId, businessId },
          { $inc: { currentStock: goodQuantity } },
          { returnDocument: "after", runValidators: true, session: activeSession }
        ).lean();
        if (!balance || !updatedProduct) {
          throw new Error("Purchase receipt inventory update failed.");
        }
        await syncStockAlert(updatedProduct, activeSession);
        await InventoryMovement.create(
          [
            {
              businessId,
              productId: line.productId,
              warehouseId,
              movementType: "PURCHASE_RECEIPT",
              quantity: goodQuantity,
              previousStock: balance.availableQuantity - goodQuantity,
              newStock: balance.availableQuantity,
              referenceType: "GOODS_RECEIPT",
              referenceId: receiptNumber,
              performedBy: receivedBy,
            },
          ],
          { session: activeSession }
        );
      }

      order.status = order.products.every(
        (item) => item.receivedQuantity >= item.quantity
      )
        ? "RECEIVED"
        : "PARTIALLY_RECEIVED";
      await order.save({ session: activeSession });
      await recordAuditLog(
        {
          businessId,
          actorUserId: receivedBy,
          action: "PURCHASE_RECEIVED",
          resourceType: "GOODS_RECEIPT",
          resourceId: createdReceipt._id,
          description: `Received goods for purchase order ${order.purchaseOrderNumber}.`,
        },
        activeSession
      );
      receipt = createdReceipt;
    });

    if (!receipt) {
      res.status(500).json({
        success: false,
        message: "Goods receipt did not complete.",
      });
      return;
    }
    const purchaseOrder = await PurchaseOrder.findOne({
      _id: purchaseOrderId,
      businessId,
    }).lean();
    res.status(201).json({
      success: true,
      message: "Goods received and warehouse stock updated.",
      receipt,
      purchaseOrder,
    });
  } catch (error) {
    if (error instanceof PurchaseWorkflowError) {
      res.status(error.status).json({ success: false, message: error.message });
      return;
    }
    if (isDuplicateKeyError(error)) {
      res.status(409).json({
        success: false,
        message: "This goods receipt has already been processed.",
      });
      return;
    }
    console.error("Receive Purchase Order Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to receive purchase order.",
    });
  } finally {
    if (session) {
      await session.endSession();
    }
  }
};
