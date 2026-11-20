import { Response } from "express";
import StockAlert, {
  StockAlertCondition,
  StockAlertStatus,
} from "../../models/StockAlert";
import Product from "../../models/Product";
import { AuthenticatedRequest } from "../../middleware/auth.middleware";
import { escapeRegex, parsePagination } from "../../utils/resourceQuery";
import { syncStockAlert } from "../../services/stockAlert.service";

const conditions: StockAlertCondition[] = ["LOW_STOCK", "OUT_OF_STOCK"];
const statuses: StockAlertStatus[] = ["ACTIVE", "RESOLVED"];

export const listStockAlerts = async (
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

    const { condition, status, search } = req.query;
    if (
      (condition !== undefined &&
        (typeof condition !== "string" ||
          !conditions.includes(condition as StockAlertCondition))) ||
      (status !== undefined &&
        (typeof status !== "string" ||
          !statuses.includes(status as StockAlertStatus))) ||
      (search !== undefined &&
        (typeof search !== "string" || search.length > 100))
    ) {
      res.status(400).json({
        success: false,
        message: "Invalid stock alert filters.",
      });
      return;
    }

    const filter: Record<string, unknown> = {
      businessId,
      status: status ?? "ACTIVE",
    };
    if (typeof condition === "string") filter.condition = condition;

    const productFilter: Record<string, unknown> = { businessId };
    if (typeof search === "string" && search.trim()) {
      const regex = new RegExp(escapeRegex(search.trim()), "i");
      productFilter.$or = [{ productName: regex }, { sku: regex }];
    }
    const candidateFilter = {
      $and: [
        productFilter,
        {
          $or: [
            { currentStock: 0 },
            {
              $expr: {
                $and: [
                  { $gt: ["$currentStock", 0] },
                  { $lte: ["$currentStock", "$minimumStockThreshold"] },
                ],
              },
            },
          ],
        },
      ],
    };
    const candidateProducts = await Product.find(candidateFilter)
      .select("businessId productName sku currentStock minimumStockThreshold")
      .lean();
    for (const product of candidateProducts) {
      await syncStockAlert(product);
    }
    const productIds = await Product.find(productFilter).distinct("_id");
    filter.productId = { $in: productIds };

    const [alerts, total] = await Promise.all([
      StockAlert.find(filter)
        .populate({
          path: "productId",
          select: "productName sku currentStock minimumStockThreshold",
          match: { businessId },
        })
        .sort({ updatedAt: -1, _id: -1 })
        .skip(pagination.skip)
        .limit(pagination.limit)
        .lean(),
      StockAlert.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      alerts: alerts.filter((alert) => alert.productId !== null),
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit),
      },
    });
  } catch (error) {
    console.error("List Stock Alerts Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve stock alerts.",
    });
  }
};
