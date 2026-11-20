import { Response } from "express";
import TaxInvoiceSettings from "../../models/TaxInvoiceSettings";
import { AuthenticatedRequest } from "../../middleware/auth.middleware";

export const getTaxInvoiceSettings = async (
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

    const settings = await TaxInvoiceSettings.findOne({
      businessId,
    }).lean();

    if (!settings) {
      return res.status(404).json({
        success: false,
        message: "Tax and invoice settings not found",
      });
    }

    return res.status(200).json({
      success: true,
      settings,
    });
  } catch (error) {
    console.error("Get Tax and Invoice Settings Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve tax and invoice settings",
    });
  }
};

export const createOrUpdateTaxInvoiceSettings = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const businessId = req.businessMembership?.businessId;
    const {
      taxEnabled,
      taxName,
      taxPercentage,
      invoicePrefix,
    } = req.body;

    if (!businessId) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this business",
      });
    }

    if (
      typeof taxEnabled !== "boolean" ||
      typeof invoicePrefix !== "string" ||
      !invoicePrefix.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Tax status and invoice prefix are required",
      });
    }

    if (
      taxName !== undefined &&
      (typeof taxName !== "string" || !taxName.trim())
    ) {
      return res.status(400).json({
        success: false,
        message: "Tax name must be a non-empty string",
      });
    }

    if (
      taxPercentage !== undefined &&
      (typeof taxPercentage !== "number" ||
        !Number.isFinite(taxPercentage) ||
        taxPercentage < 0 ||
        taxPercentage > 100)
    ) {
      return res.status(400).json({
        success: false,
        message: "Tax percentage must be between 0 and 100",
      });
    }

    const existingSettings = await TaxInvoiceSettings.findOne({
      businessId,
    }).lean();

    if (existingSettings) {
      const settings = await TaxInvoiceSettings.findOneAndUpdate(
        { businessId },
        {
          $set: {
            taxEnabled,
            taxName:
              taxName !== undefined ? taxName.trim() : existingSettings.taxName,
            taxPercentage:
              taxPercentage !== undefined
                ? taxPercentage
                : existingSettings.taxPercentage,
            invoicePrefix: invoicePrefix.trim(),
          },
        },
        {
          new: true,
          runValidators: true,
        }
      ).lean();

      return res.status(200).json({
        success: true,
        message: "Tax and invoice settings updated successfully",
        settings,
      });
    }

    const settings = await TaxInvoiceSettings.create({
      businessId,
      taxEnabled,
      taxName: taxName !== undefined ? taxName.trim() : "GST",
      taxPercentage: taxPercentage ?? 0,
      invoicePrefix: invoicePrefix.trim(),
    });

    return res.status(201).json({
      success: true,
      message: "Tax and invoice settings created successfully",
      settings,
    });
  } catch (error: any) {
    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Tax and invoice settings already exist for this business",
      });
    }

    console.error("Create or Update Tax and Invoice Settings Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to save tax and invoice settings",
    });
  }
};
