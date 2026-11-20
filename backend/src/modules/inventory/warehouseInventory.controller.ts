import { Response } from "express";
import mongoose from "mongoose";

import InventoryBalance from "../../models/InventoryBalance";
import InventoryMovement from "../../models/InventoryMovement";
import InventoryTransfer from "../../models/InventoryTransfer";
import Product from "../../models/Product";
import Warehouse from "../../models/Warehouse";
import { AuthenticatedRequest } from "../../middleware/auth.middleware";
import { recordAuditLog } from "../../services/auditLog.service";
import { isRecord, parsePagination } from "../../utils/resourceQuery";

class InventoryTransferError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
  }
}

const isPositiveNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

export const listInventoryBalances = async (
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
    const { warehouseId, productId } = req.query;
    if (
      (warehouseId !== undefined && typeof warehouseId !== "string") ||
      (productId !== undefined && typeof productId !== "string")
    ) {
      res.status(400).json({
        success: false,
        message: "Inventory filters must be strings.",
      });
      return;
    }
    const filter: Record<string, unknown> = { businessId };
    if (typeof warehouseId === "string" && warehouseId.trim()) {
      if (!mongoose.Types.ObjectId.isValid(warehouseId)) {
        res.status(400).json({ success: false, message: "Invalid warehouse ID." });
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
    if (typeof productId === "string" && productId.trim()) {
      if (!mongoose.Types.ObjectId.isValid(productId)) {
        res.status(400).json({ success: false, message: "Invalid product ID." });
        return;
      }
      filter.productId = productId;
    }

    const [balances, total] = await Promise.all([
      InventoryBalance.find(filter)
        .populate({
          path: "productId",
          select: "productName sku minimumStockThreshold purchasePrice",
          match: { businessId },
        })
        .populate({
          path: "warehouseId",
          select: "warehouseName city",
          match: { businessId },
        })
        .sort({ updatedAt: -1, _id: -1 })
        .skip(pagination.skip)
        .limit(pagination.limit)
        .lean(),
      InventoryBalance.countDocuments(filter),
    ]);
    res.status(200).json({
      success: true,
      balances,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit),
      },
    });
  } catch (error) {
    console.error("List Inventory Balances Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to list warehouse inventory.",
    });
  }
};

export const listInventoryTransfers = async (
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
    const filter = { businessId };
    const [transfers, total] = await Promise.all([
      InventoryTransfer.find(filter)
        .populate({ path: "productId", select: "productName sku", match: { businessId } })
        .populate({
          path: "sourceWarehouseId",
          select: "warehouseName",
          match: { businessId },
        })
        .populate({
          path: "destinationWarehouseId",
          select: "warehouseName",
          match: { businessId },
        })
        .sort({ createdAt: -1, _id: -1 })
        .skip(pagination.skip)
        .limit(pagination.limit)
        .lean(),
      InventoryTransfer.countDocuments(filter),
    ]);
    res.status(200).json({
      success: true,
      transfers,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit),
      },
    });
  } catch (error) {
    console.error("List Inventory Transfers Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to list inventory transfers.",
    });
  }
};

export const createInventoryTransfer = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const businessId = req.businessMembership?.businessId;
  const performedBy = req.user?.userId;
  const idempotencyKey = req.get("Idempotency-Key")?.trim();
  if (!businessId || !performedBy) {
    res.status(403).json({
      success: false,
      message: "You do not have access to this business.",
    });
    return;
  }
  if (!isRecord(req.body)) {
    res.status(400).json({
      success: false,
      message: "Transfer fields must be provided as an object.",
    });
    return;
  }

  const { productId, sourceWarehouseId, destinationWarehouseId, quantity } =
    req.body;
  if (
    typeof productId !== "string" ||
    !mongoose.Types.ObjectId.isValid(productId) ||
    typeof sourceWarehouseId !== "string" ||
    !mongoose.Types.ObjectId.isValid(sourceWarehouseId) ||
    typeof destinationWarehouseId !== "string" ||
    !mongoose.Types.ObjectId.isValid(destinationWarehouseId) ||
    sourceWarehouseId === destinationWarehouseId ||
    !isPositiveNumber(quantity) ||
    !idempotencyKey ||
    idempotencyKey.length > 120
  ) {
    res.status(400).json({
      success: false,
      message:
        "Provide a product, distinct source and destination warehouses, positive quantity, and Idempotency-Key.",
    });
    return;
  }

  let session: mongoose.ClientSession | undefined;
  try {
    session = await mongoose.startSession();
    const activeSession = session;
    let transfer: InstanceType<typeof InventoryTransfer> | undefined;
    await activeSession.withTransaction(async () => {
      const alreadyProcessed = await InventoryTransfer.exists({
        businessId,
        idempotencyKey,
      }).session(activeSession);
      if (alreadyProcessed) {
        throw new InventoryTransferError(
          409,
          "This inventory transfer has already been processed."
        );
      }

      const product = await Product.exists({
        _id: productId,
        businessId,
      }).session(activeSession);
      const sourceWarehouse = await Warehouse.exists({
        _id: sourceWarehouseId,
        businessId,
      }).session(activeSession);
      const destinationWarehouse = await Warehouse.exists({
        _id: destinationWarehouseId,
        businessId,
      }).session(activeSession);
      if (!product) {
        throw new InventoryTransferError(
          404,
          "Product not found in this business."
        );
      }
      if (!sourceWarehouse || !destinationWarehouse) {
        throw new InventoryTransferError(
          404,
          "Both warehouses must belong to this business."
        );
      }

      const sourceBalance = await InventoryBalance.findOneAndUpdate(
        {
          businessId,
          productId,
          warehouseId: sourceWarehouseId,
          availableQuantity: { $gte: quantity },
        },
        { $inc: { availableQuantity: -quantity } },
        {
          returnDocument: "after",
          runValidators: true,
          session: activeSession,
        }
      ).lean();
      if (!sourceBalance) {
        throw new InventoryTransferError(
          409,
          "The source warehouse does not have enough available stock."
        );
      }

      const destinationBalance = await InventoryBalance.findOneAndUpdate(
        { businessId, productId, warehouseId: destinationWarehouseId },
        {
          $inc: { availableQuantity: quantity },
          $setOnInsert: { reservedQuantity: 0 },
        },
        {
          upsert: true,
          returnDocument: "after",
          runValidators: true,
          session: activeSession,
        }
      ).lean();
      if (!destinationBalance) {
        throw new Error("Destination inventory balance could not be updated.");
      }

      const transferNumber = `TR-${new mongoose.Types.ObjectId()
        .toString()
        .slice(-10)
        .toUpperCase()}`;
      const createdTransfer = new InventoryTransfer({
        businessId,
        transferNumber,
        idempotencyKey,
        productId,
        sourceWarehouseId,
        destinationWarehouseId,
        quantity,
        performedBy,
      });
      await createdTransfer.save({ session: activeSession });
      await InventoryMovement.create(
        [
          {
            businessId,
            productId,
            warehouseId: sourceWarehouseId,
            movementType: "STOCK_TRANSFER",
            quantity,
            previousStock: sourceBalance.availableQuantity + quantity,
            newStock: sourceBalance.availableQuantity,
            referenceType: "STOCK_TRANSFER",
            referenceId: transferNumber,
            performedBy,
          },
          {
            businessId,
            productId,
            warehouseId: destinationWarehouseId,
            movementType: "STOCK_TRANSFER",
            quantity,
            previousStock: destinationBalance.availableQuantity - quantity,
            newStock: destinationBalance.availableQuantity,
            referenceType: "STOCK_TRANSFER",
            referenceId: transferNumber,
            performedBy,
          },
        ],
        { session: activeSession, ordered: true }
      );
      await recordAuditLog(
        {
          businessId,
          actorUserId: performedBy,
          action: "INVENTORY_STOCK_TRANSFER",
          resourceType: "INVENTORY_TRANSFER",
          resourceId: createdTransfer._id,
          description: `Transferred ${quantity} units from one warehouse to another for product ${productId}.`,
        },
        activeSession
      );
      transfer = createdTransfer;
    });

    if (!transfer) {
      res.status(500).json({
        success: false,
        message: "Inventory transfer did not complete.",
      });
      return;
    }
    res.status(201).json({
      success: true,
      message: "Stock transferred successfully.",
      transfer,
    });
  } catch (error) {
    if (error instanceof InventoryTransferError) {
      res.status(error.status).json({ success: false, message: error.message });
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
        message: "This inventory transfer has already been processed.",
      });
      return;
    }
    console.error("Create Inventory Transfer Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to transfer inventory.",
    });
  } finally {
    if (session) {
      await session.endSession();
    }
  }
};
