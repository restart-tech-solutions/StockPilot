import { Response } from "express";
import mongoose from "mongoose";
import MeasurementUnit from "../../models/MeasurementUnit";
import { AuthenticatedRequest } from "../../middleware/auth.middleware";

const escapeRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getRouteParam = (
  req: AuthenticatedRequest,
  name: string
): string => (typeof req.params[name] === "string" ? req.params[name] : "");

export const createMeasurementUnit = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const businessId = req.businessMembership?.businessId;
    const { unitName, unitSymbol } = req.body;

    if (!businessId) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this business",
      });
    }

    if (
      typeof unitName !== "string" ||
      !unitName.trim() ||
      typeof unitSymbol !== "string" ||
      !unitSymbol.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Unit name and unit symbol are required",
      });
    }

    const normalizedName = unitName.trim();
    const normalizedSymbol = unitSymbol.trim();

    const duplicateName = await MeasurementUnit.findOne({
      businessId,
      unitName: {
        $regex: `^${escapeRegex(normalizedName)}$`,
        $options: "i",
      },
    }).lean();

    if (duplicateName) {
      return res.status(409).json({
        success: false,
        message: "This unit name already exists in your business",
      });
    }

    const duplicateSymbol = await MeasurementUnit.findOne({
      businessId,
      unitSymbol: {
        $regex: `^${escapeRegex(normalizedSymbol)}$`,
        $options: "i",
      },
    }).lean();

    if (duplicateSymbol) {
      return res.status(409).json({
        success: false,
        message: "This unit symbol already exists in your business",
      });
    }

    const measurementUnit = await MeasurementUnit.create({
      businessId,
      unitName: normalizedName,
      unitSymbol: normalizedSymbol,
    });

    return res.status(201).json({
      success: true,
      message: "Measurement unit created successfully",
      measurementUnit,
    });
  } catch (error: any) {
    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "This unit name or symbol already exists in your business",
      });
    }

    console.error("Create Measurement Unit Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create measurement unit",
    });
  }
};

export const listMeasurementUnits = async (
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

    const units = await MeasurementUnit.find({ businessId })
      .sort({ unitName: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      measurementUnits: units,
    });
  } catch (error) {
    console.error("List Measurement Units Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to list measurement units",
    });
  }
};

export const getMeasurementUnit = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const businessId = req.businessMembership?.businessId;
    const unitId = getRouteParam(req, "unitId");

    if (!businessId) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this business",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(unitId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid measurement unit ID",
      });
    }

    const measurementUnit = await MeasurementUnit.findOne({
      _id: unitId,
      businessId,
    }).lean();

    if (!measurementUnit) {
      return res.status(404).json({
        success: false,
        message: "Measurement unit not found",
      });
    }

    return res.status(200).json({
      success: true,
      measurementUnit,
    });
  } catch (error) {
    console.error("Get Measurement Unit Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve measurement unit",
    });
  }
};

export const updateMeasurementUnit = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const businessId = req.businessMembership?.businessId;
    const unitId = getRouteParam(req, "unitId");
    const { unitName, unitSymbol } = req.body;

    if (!businessId) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this business",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(unitId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid measurement unit ID",
      });
    }

    if (unitName === undefined && unitSymbol === undefined) {
      return res.status(400).json({
        success: false,
        message: "At least one measurement unit field is required",
      });
    }

    const updates: { unitName?: string; unitSymbol?: string } = {};

    if (unitName !== undefined) {
      if (typeof unitName !== "string" || !unitName.trim()) {
        return res.status(400).json({
          success: false,
          message: "Unit name must be a non-empty string",
        });
      }

      updates.unitName = unitName.trim();

      const duplicateName = await MeasurementUnit.findOne({
        _id: { $ne: unitId },
        businessId,
        unitName: {
          $regex: `^${escapeRegex(updates.unitName)}$`,
          $options: "i",
        },
      }).lean();

      if (duplicateName) {
        return res.status(409).json({
          success: false,
          message: "This unit name already exists in your business",
        });
      }
    }

    if (unitSymbol !== undefined) {
      if (typeof unitSymbol !== "string" || !unitSymbol.trim()) {
        return res.status(400).json({
          success: false,
          message: "Unit symbol must be a non-empty string",
        });
      }

      updates.unitSymbol = unitSymbol.trim();

      const duplicateSymbol = await MeasurementUnit.findOne({
        _id: { $ne: unitId },
        businessId,
        unitSymbol: {
          $regex: `^${escapeRegex(updates.unitSymbol)}$`,
          $options: "i",
        },
      }).lean();

      if (duplicateSymbol) {
        return res.status(409).json({
          success: false,
          message: "This unit symbol already exists in your business",
        });
      }
    }

    const measurementUnit = await MeasurementUnit.findOneAndUpdate(
      { _id: unitId, businessId },
      { $set: updates },
      { new: true, runValidators: true }
    ).lean();

    if (!measurementUnit) {
      return res.status(404).json({
        success: false,
        message: "Measurement unit not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Measurement unit updated successfully",
      measurementUnit,
    });
  } catch (error: any) {
    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "This unit name or symbol already exists in your business",
      });
    }

    console.error("Update Measurement Unit Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update measurement unit",
    });
  }
};

export const deleteMeasurementUnit = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const businessId = req.businessMembership?.businessId;
    const unitId = getRouteParam(req, "unitId");

    if (!businessId) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this business",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(unitId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid measurement unit ID",
      });
    }

    const measurementUnit = await MeasurementUnit.findOne({
      _id: unitId,
      businessId,
    }).lean();

    if (!measurementUnit) {
      return res.status(404).json({
        success: false,
        message: "Measurement unit not found",
      });
    }

    await MeasurementUnit.deleteOne({
      _id: unitId,
      businessId,
    });

    return res.status(200).json({
      success: true,
      message: "Measurement unit deleted successfully",
    });
  } catch (error) {
    console.error("Delete Measurement Unit Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete measurement unit",
    });
  }
};
