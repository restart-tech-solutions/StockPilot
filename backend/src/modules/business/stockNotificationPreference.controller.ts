import { Response } from "express";
import StockNotificationPreference from "../../models/StockNotificationPreference";
import { AuthenticatedRequest } from "../../middleware/auth.middleware";

export const getStockNotificationPreferences = async (
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

    const preferences = await StockNotificationPreference.findOne({
      businessId,
    }).lean();

    if (!preferences) {
      return res.status(404).json({
        success: false,
        message: "Stock notification preferences not found",
      });
    }

    return res.status(200).json({
      success: true,
      preferences,
    });
  } catch (error) {
    console.error("Get Stock Notification Preferences Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve stock notification preferences",
    });
  }
};

export const saveStockNotificationPreferences = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const businessId = req.businessMembership?.businessId;
    const {
      lowStockNotificationsEnabled,
      outOfStockNotificationsEnabled,
    } = req.body;

    if (!businessId) {
      res.status(403).json({
        success: false,
        message: "You do not have access to this business",
      });
      return;
    }

    if (
      typeof lowStockNotificationsEnabled !== "boolean" ||
      typeof outOfStockNotificationsEnabled !== "boolean"
    ) {
      res.status(400).json({
        success: false,
        message:
          "Low-stock and out-of-stock notification preferences must be boolean values",
      });
      return;
    }

    const existingPreferences =
      await StockNotificationPreference.findOne({
        businessId,
      }).lean();

    if (existingPreferences) {
      const preferences =
        await StockNotificationPreference.findOneAndUpdate(
          { businessId },
          {
            $set: {
              lowStockNotificationsEnabled,
              outOfStockNotificationsEnabled,
            },
          },
          {
            new: true,
            runValidators: true,
          }
        ).lean();

      res.status(200).json({
        success: true,
        message: "Stock notification preferences updated successfully",
        preferences,
      });
      return;
    }

    const preferences = await StockNotificationPreference.create({
      businessId,
      lowStockNotificationsEnabled,
      outOfStockNotificationsEnabled,
    });

    res.status(201).json({
      success: true,
      message: "Stock notification preferences created successfully",
      preferences,
    });
  } catch (error: any) {
    if (error?.code === 11000) {
      res.status(409).json({
        success: false,
        message:
          "Stock notification preferences already exist for this business",
      });
      return;
    }

    console.error("Save Stock Notification Preferences Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to save stock notification preferences",
    });
  }
};
