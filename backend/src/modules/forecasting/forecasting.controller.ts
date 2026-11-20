import { Response } from "express";
import { AuthenticatedRequest } from "../../middleware/auth.middleware";
import { generateInventoryForecast } from "./forecasting.service";
import mongoose from "mongoose";
export const getInventoryForecast = async (
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

    const rawHorizon = req.query.horizon ?? "7";
    const rawProductId = req.query.productId;

    if (
      typeof rawHorizon !== "string" ||
      !["7", "30"].includes(rawHorizon)
    ) {
      res.status(400).json({
        success: false,
        message: "Forecast horizon must be 7 or 30 days.",
      });
      return;
    }

    if (
      rawProductId !== undefined &&
      (typeof rawProductId !== "string" || !rawProductId.trim())
    ) {
      res.status(400).json({
        success: false,
        message: "Invalid product ID.",
      });
      return;
    }

    const result = await generateInventoryForecast({
businessId: new mongoose.Types.ObjectId(businessId),      horizon: Number(rawHorizon) as 7 | 30,
      productId: rawProductId as string | undefined,
    });

    res.status(200).json({
      success: true,
      message: "Inventory forecast generated successfully.",
      data: result,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_PRODUCT_ID") {
      res.status(400).json({
        success: false,
        message: "Invalid product ID.",
      });
      return;
    }

    console.error("Inventory forecast error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to generate inventory forecast.",
    });
  }
};
