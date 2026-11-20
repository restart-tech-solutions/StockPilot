import { Response } from "express";
import mongoose from "mongoose";

import InventoryMovement, {
  InventoryMovementType,
} from "../../models/InventoryMovement";
import Product from "../../models/Product";
import Warehouse from "../../models/Warehouse";
import { AuthenticatedRequest } from "../../middleware/auth.middleware";
import { isRecord, parsePagination } from "../../utils/resourceQuery";
import { recordAuditLog } from "../../services/auditLog.service";
import { syncStockAlert } from "../../services/stockAlert.service";

const movementTypes: InventoryMovementType[] = [
  "OPENING_STOCK",
  "STOCK_IN",
  "STOCK_OUT",
  "SALES_DEDUCTION",
  "PURCHASE_RECEIPT",
  "STOCK_ADJUSTMENT",
  "STOCK_TRANSFER",
  "DAMAGED_STOCK",
  "RETURNED_STOCK",
  "SALES_CANCELLATION",
];

const isPositiveNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

const parseDate = (value: unknown): Date | undefined => {
  if (typeof value !== "string" || !value.trim()) {
    return undefined;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

export const listInventoryMovements = async (
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
      res.status(400).json({
        success: false,
        message: "Invalid pagination values.",
      });
      return;
    }

    const { productId, warehouseId, movementType, from, to } = req.query;
    if (
      (productId !== undefined && typeof productId !== "string") ||
      (warehouseId !== undefined && typeof warehouseId !== "string") ||
      (movementType !== undefined && typeof movementType !== "string") ||
      (from !== undefined && typeof from !== "string") ||
      (to !== undefined && typeof to !== "string")
    ) {
      res.status(400).json({
        success: false,
        message: "Movement filters must be strings.",
      });
      return;
    }

    const filter: Record<string, unknown> = { businessId };
    if (typeof productId === "string" && productId.trim()) {
      if (!mongoose.Types.ObjectId.isValid(productId)) {
        res.status(400).json({
          success: false,
          message: "Invalid product ID.",
        });
        return;
      }
      filter.productId = productId;
    }
    if (typeof warehouseId === "string" && warehouseId.trim()) {
      if (!mongoose.Types.ObjectId.isValid(warehouseId)) {
        res.status(400).json({
          success: false,
          message: "Invalid warehouse ID.",
        });
        return;
      }
      const warehouseExists = await Warehouse.exists({
        _id: warehouseId,
        businessId,
      });
      if (!warehouseExists) {
        res.status(404).json({
          success: false,
          message: "Warehouse not found in this business.",
        });
        return;
      }
      filter.warehouseId = warehouseId;
    }
    if (typeof movementType === "string" && movementType.trim()) {
      if (!movementTypes.includes(movementType as InventoryMovementType)) {
        res.status(400).json({
          success: false,
          message: "Invalid movement type.",
        });
        return;
      }
      filter.movementType = movementType;
    }

    const fromDate = from === undefined ? undefined : parseDate(from);
    const toDate = to === undefined ? undefined : parseDate(to);
    if (
      (from !== undefined && !fromDate) ||
      (to !== undefined && !toDate) ||
      (fromDate && toDate && fromDate > toDate)
    ) {
      res.status(400).json({
        success: false,
        message: "Invalid movement date range.",
      });
      return;
    }
    if (fromDate || toDate) {
      filter.createdAt = {
        ...(fromDate ? { $gte: fromDate } : {}),
        ...(toDate ? { $lte: toDate } : {}),
      };
    }

    const [movements, total] = await Promise.all([
      InventoryMovement.find(filter)
        .populate({
          path: "productId",
          select: "productName sku",
          match: { businessId },
        })
        .populate({
          path: "warehouseId",
          select: "warehouseName",
          match: { businessId },
        })
        .populate({ path: "performedBy", select: "name email" })
        .sort({ createdAt: -1, _id: -1 })
        .skip(pagination.skip)
        .limit(pagination.limit)
        .lean(),
      InventoryMovement.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      movements,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit),
      },
    });
  } catch (error) {
    console.error("List Inventory Movements Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to list inventory movements.",
    });
  }
};

export const createInventoryMovement = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  if (!isRecord(req.body)) {
    res.status(400).json({
      success: false,
      message: "Inventory movement fields must be provided as an object.",
    });
    return;
  }

  const businessId = req.businessMembership?.businessId;
  const performedBy = req.user?.userId;
  const { productId, movementType, quantity, newStock, referenceType, referenceId } =
    req.body;

  if (!businessId || !performedBy) {
    res.status(403).json({
      success: false,
      message: "You do not have access to this business.",
    });
    return;
  }
  if (typeof productId !== "string" || !mongoose.Types.ObjectId.isValid(productId)) {
    res.status(400).json({
      success: false,
      message: "A valid product ID is required.",
    });
    return;
  }

  const supportedTypes: InventoryMovementType[] = [
    "STOCK_IN",
    "STOCK_OUT",
    "STOCK_ADJUSTMENT",
    "DAMAGED_STOCK",
    "RETURNED_STOCK",
  ];
  if (
    typeof movementType !== "string" ||
    !supportedTypes.includes(movementType as InventoryMovementType)
  ) {
    res.status(400).json({
      success: false,
      message: "Unsupported inventory movement type.",
    });
    return;
  }

  const isAdjustment = movementType === "STOCK_ADJUSTMENT";
  const requestedQuantity = isPositiveNumber(quantity) ? quantity : 0;
  const targetStock =
    typeof newStock === "number" &&
    Number.isFinite(newStock) &&
    newStock >= 0
      ? newStock
      : 0;
  if (
    (isAdjustment &&
      (typeof newStock !== "number" ||
        !Number.isFinite(newStock) ||
        newStock < 0)) ||
    (!isAdjustment && requestedQuantity === 0)
  ) {
    res.status(400).json({
      success: false,
      message: isAdjustment
        ? "A valid non-negative newStock is required for a stock adjustment."
        : "Quantity must be a positive number.",
    });
    return;
  }

  const hasReferenceType = referenceType !== undefined && referenceType !== "";
  const hasReferenceId = referenceId !== undefined && referenceId !== "";
  if (
    hasReferenceType !== hasReferenceId ||
    (hasReferenceType &&
      (typeof referenceType !== "string" ||
        !referenceType.trim() ||
        referenceType.length > 100)) ||
    (hasReferenceId &&
      (typeof referenceId !== "string" ||
        !referenceId.trim() ||
        referenceId.length > 100))
  ) {
    res.status(400).json({
      success: false,
      message: "Reference type and reference ID must both be valid strings.",
    });
    return;
  }

  const normalizedReferenceType =
    typeof referenceType === "string" ? referenceType.trim() : undefined;
  const normalizedReferenceId =
    typeof referenceId === "string" ? referenceId.trim() : undefined;

  let session: mongoose.ClientSession | undefined;
  try {
    const activeSession = await mongoose.startSession();
    session = activeSession;
    let createdMovement:
      | InstanceType<typeof InventoryMovement>
      | undefined;

    await activeSession.withTransaction(async () => {
      const currentProduct = isAdjustment
        ? await Product.findOne({ _id: productId, businessId })
            .session(activeSession)
            .lean()
        : null;
      if (isAdjustment && !currentProduct) {
        return;
      }

      const previousStock = currentProduct?.currentStock;
      const adjustmentDifference =
        previousStock !== undefined ? targetStock - previousStock : 0;
      if (isAdjustment && adjustmentDifference === 0) {
        throw new Error("NO_STOCK_CHANGE");
      }

      const isInbound =
        movementType === "STOCK_IN" || movementType === "RETURNED_STOCK";
      const isOutbound =
        movementType === "STOCK_OUT" || movementType === "DAMAGED_STOCK";
      const movementQuantity = isAdjustment
        ? Math.abs(adjustmentDifference)
        : requestedQuantity;
      const update =
        isAdjustment
          ? {
              filter: { _id: productId, businessId, currentStock: previousStock },
              update: { $set: { currentStock: targetStock } },
            }
          : isInbound
            ? {
                filter: { _id: productId, businessId },
                update: { $inc: { currentStock: movementQuantity } },
              }
            : {
                filter: {
                  _id: productId,
                  businessId,
                  currentStock: { $gte: movementQuantity },
                },
                update: { $inc: { currentStock: -movementQuantity } },
              };

      const updatedProduct = await Product.findOneAndUpdate(
        update.filter,
        update.update,
        { new: true, runValidators: true, session: activeSession }
      ).lean();
      if (!updatedProduct) {
        return;
      }

      const movement = new InventoryMovement({
        businessId,
        productId,
        movementType,
        quantity: movementQuantity,
        previousStock: isAdjustment
          ? previousStock
          : isInbound
            ? updatedProduct.currentStock - movementQuantity
            : updatedProduct.currentStock + movementQuantity,
        newStock: updatedProduct.currentStock,
        ...(normalizedReferenceType
          ? { referenceType: normalizedReferenceType }
          : {}),
        ...(normalizedReferenceId ? { referenceId: normalizedReferenceId } : {}),
        performedBy,
      });
      await movement.save({ session: activeSession });
      await syncStockAlert(updatedProduct, activeSession);
      await recordAuditLog(
        {
          businessId,
          actorUserId: performedBy,
          action: `INVENTORY_${movementType}`,
          resourceType: "INVENTORY_MOVEMENT",
          resourceId: movement._id,
          description: `${movementType.replaceAll("_", " ")} for ${updatedProduct.productName}: ${movementQuantity}.`,
        },
        activeSession
      );
      createdMovement = movement;
    });

    if (!createdMovement) {
      const productExists = await Product.exists({ _id: productId, businessId });
      if (!productExists) {
        res.status(404).json({
          success: false,
          message: "Product not found in this business.",
        });
        return;
      }
      res.status(409).json({
        success: false,
        message: "Insufficient or changed stock; refresh the current quantity and retry.",
      });
      return;
    }

    res.status(201).json({
      success: true,
      message: "Inventory movement recorded successfully.",
      movement: createdMovement,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "NO_STOCK_CHANGE") {
      res.status(400).json({
        success: false,
        message: "Stock adjustment must change the current quantity.",
      });
      return;
    }
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === 11000
    ) {
      res.status(409).json({
        success: false,
        message: "This referenced inventory movement has already been recorded.",
      });
      return;
    }
    console.error("Create Inventory Movement Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to record inventory movement.",
    });
  } finally {
    if (session) {
      await session.endSession();
    }
  }
};
