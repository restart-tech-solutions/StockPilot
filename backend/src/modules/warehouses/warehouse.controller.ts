import { Response } from "express";
import mongoose from "mongoose";
import GoodsReceipt from "../../models/GoodsReceipt";
import InventoryBalance from "../../models/InventoryBalance";
import InventoryMovement from "../../models/InventoryMovement";
import InventoryTransfer from "../../models/InventoryTransfer";
import SalesOrder from "../../models/SalesOrder";
import Warehouse from "../../models/Warehouse";
import { AuthenticatedRequest } from "../../middleware/auth.middleware";

const escapeRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getRouteParam = (req: AuthenticatedRequest, name: string): string =>
  typeof req.params[name] === "string" ? req.params[name] : "";

export const createWarehouse = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const businessId = req.businessMembership?.businessId;
    const { warehouseName, address, city, contactNumber } = req.body;

    if (!businessId) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this business",
      });
    }

    if (
      typeof warehouseName !== "string" ||
      !warehouseName.trim() ||
      typeof address !== "string" ||
      !address.trim() ||
      typeof city !== "string" ||
      !city.trim() ||
      typeof contactNumber !== "string" ||
      !contactNumber.trim()
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Warehouse name, address, city and contact number are required",
      });
    }

    const normalizedName = warehouseName.trim();
    const existingWarehouse = await Warehouse.findOne({
      businessId,
      warehouseName: {
        $regex: `^${escapeRegex(normalizedName)}$`,
        $options: "i",
      },
    }).lean();

    if (existingWarehouse) {
      return res.status(409).json({
        success: false,
        message: "A warehouse with this name already exists in your business",
      });
    }

    const warehouse = await Warehouse.create({
      businessId,
      warehouseName: normalizedName,
      address: address.trim(),
      city: city.trim(),
      contactNumber: contactNumber.trim(),
    });

    return res.status(201).json({
      success: true,
      message: "Warehouse created successfully",
      warehouse,
    });
  } catch (error) {
    console.error("Create Warehouse Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create warehouse",
    });
  }
};

export const listWarehouses = async (
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

    const warehouses = await Warehouse.find({ businessId })
      .sort({ warehouseName: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      warehouses,
    });
  } catch (error) {
    console.error("List Warehouses Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to list warehouses",
    });
  }
};

export const getWarehouse = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const businessId = req.businessMembership?.businessId;
    const warehouseId = getRouteParam(req, "warehouseId");

    if (!businessId) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this business",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(warehouseId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid warehouse ID",
      });
    }

    const warehouse = await Warehouse.findOne({
      _id: warehouseId,
      businessId,
    }).lean();

    if (!warehouse) {
      return res.status(404).json({
        success: false,
        message: "Warehouse not found",
      });
    }

    return res.status(200).json({
      success: true,
      warehouse,
    });
  } catch (error) {
    console.error("Get Warehouse Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve warehouse",
    });
  }
};

export const updateWarehouse = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const businessId = req.businessMembership?.businessId;
    const warehouseId = getRouteParam(req, "warehouseId");
    const { warehouseName, address, city, contactNumber } = req.body;

    if (!businessId) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this business",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(warehouseId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid warehouse ID",
      });
    }

    if (
      warehouseName === undefined &&
      address === undefined &&
      city === undefined &&
      contactNumber === undefined
    ) {
      return res.status(400).json({
        success: false,
        message: "At least one warehouse field is required",
      });
    }

    const updates: {
      warehouseName?: string;
      address?: string;
      city?: string;
      contactNumber?: string;
    } = {};

    for (const [field, value] of [
      ["warehouseName", warehouseName],
      ["address", address],
      ["city", city],
      ["contactNumber", contactNumber],
    ] as const) {
      if (value !== undefined) {
        if (typeof value !== "string" || !value.trim()) {
          return res.status(400).json({
            success: false,
            message: `${field} must be a non-empty string`,
          });
        }
        updates[field] = value.trim();
      }
    }

    if (updates.warehouseName) {
      const existingWarehouse = await Warehouse.findOne({
        _id: { $ne: warehouseId },
        businessId,
        warehouseName: {
          $regex: `^${escapeRegex(updates.warehouseName)}$`,
          $options: "i",
        },
      }).lean();

      if (existingWarehouse) {
        return res.status(409).json({
          success: false,
          message: "A warehouse with this name already exists in your business",
        });
      }
    }

    const warehouse = await Warehouse.findOneAndUpdate(
      { _id: warehouseId, businessId },
      { $set: updates },
      { new: true, runValidators: true }
    ).lean();

    if (!warehouse) {
      return res.status(404).json({
        success: false,
        message: "Warehouse not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Warehouse updated successfully",
      warehouse,
    });
  } catch (error) {
    console.error("Update Warehouse Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update warehouse",
    });
  }
};

export const deleteWarehouse = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const businessId = req.businessMembership?.businessId;
    const warehouseId = getRouteParam(req, "warehouseId");

    if (!businessId) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this business",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(warehouseId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid warehouse ID",
      });
    }

    const warehouse = await Warehouse.findOne({
      _id: warehouseId,
      businessId,
    }).lean();

    if (!warehouse) {
      return res.status(404).json({
        success: false,
        message: "Warehouse not found",
      });
    }

    const [hasBalances, hasReceipts, hasTransfers, hasMovements, hasSalesOrders] =
      await Promise.all([
        InventoryBalance.exists({ businessId, warehouseId }),
        GoodsReceipt.exists({ businessId, warehouseId }),
        InventoryTransfer.exists({
          businessId,
          $or: [{ sourceWarehouseId: warehouseId }, { destinationWarehouseId: warehouseId }],
        }),
        InventoryMovement.exists({ businessId, warehouseId }),
        SalesOrder.exists({ businessId, warehouseId }),
      ]);
    if (
      hasBalances ||
      hasReceipts ||
      hasTransfers ||
      hasMovements ||
      hasSalesOrders
    ) {
      return res.status(409).json({
        success: false,
        message:
          "This warehouse has inventory or transaction history and cannot be deleted.",
      });
    }

    await Warehouse.deleteOne({
      _id: warehouseId,
      businessId,
    });

    return res.status(200).json({
      success: true,
      message: "Warehouse deleted successfully",
    });
  } catch (error) {
    console.error("Delete Warehouse Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete warehouse",
    });
  }
};
