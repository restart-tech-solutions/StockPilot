import mongoose from "mongoose";
import Product from "../../models/Product";
import SalesOrder from "../../models/SalesOrder";

type ForecastOptions = {
  businessId: mongoose.Types.ObjectId;
  productId?: string;
  horizon: 7 | 30;
};

type DailySales = {
  _id: {
    productId: mongoose.Types.ObjectId;
    day: string;
  };
  quantity: number;
};

export const generateInventoryForecast = async ({
  businessId,
  productId,
  horizon,
}: ForecastOptions) => {
  const now = new Date();
  const historyStart = new Date(now);
  historyStart.setUTCDate(historyStart.getUTCDate() - 30);
  historyStart.setUTCHours(0, 0, 0, 0);

  const productFilter: Record<string, unknown> = { businessId };

  if (productId) {
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      throw new Error("INVALID_PRODUCT_ID");
    }

    productFilter._id = new mongoose.Types.ObjectId(productId);
  }

  const products = await Product.find(productFilter)
    .select(
      "_id productName sku currentStock minimumStockThreshold purchasePrice sellingPrice"
    )
    .lean();

  const salesHistory: DailySales[] = await SalesOrder.aggregate([
    {
      $match: {
        businessId,
        status: { $in: ["COMPLETED", "PARTIALLY_RETURNED"] },
      },
    },
    {
      $addFields: {
        saleDate: { $ifNull: ["$completedAt", "$createdAt"] },
      },
    },
    {
      $match: {
        saleDate: { $gte: historyStart, $lte: now },
      },
    },
    { $unwind: "$products" },
    {
      $group: {
        _id: {
          productId: "$products.productId",
          day: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$saleDate",
              timezone: "UTC",
            },
          },
        },
        quantity: {
          $sum: {
            $max: [
              0,
              {
                $subtract: [
                  "$products.quantity",
                  { $ifNull: ["$products.returnedQuantity", 0] },
                ],
              },
            ],
          },
        },
      },
    },
  ]);

  const salesMap = new Map<string, number>();

  for (const entry of salesHistory) {
    const key = `${entry._id.productId.toString()}_${entry._id.day}`;
    salesMap.set(key, entry.quantity);
  }

  const forecasts = products.map((product) => {
    const productIdString = product._id.toString();

    const dailySales: number[] = [];

    for (let i = 29; i >= 0; i--) {
      const date = new Date(now);
      date.setUTCDate(date.getUTCDate() - i);

      const day = date.toISOString().slice(0, 10);
      const key = `${productIdString}_${day}`;

      dailySales.push(salesMap.get(key) ?? 0);
    }

    const total30DaySales = dailySales.reduce(
      (sum, quantity) => sum + quantity,
      0
    );

    const last7DaysSales = dailySales.slice(-7).reduce(
      (sum, quantity) => sum + quantity,
      0
    );

    const average30Day = total30DaySales / 30;
    const average7Day = last7DaysSales / 7;

    // Weighted demand estimate: recent demand receives higher weight.
    const averageDailyDemand =
      average7Day * 0.7 + average30Day * 0.3;

    const predictedDemand = Math.ceil(
      averageDailyDemand * horizon
    );

    const currentStock = product.currentStock;
    const minimumStock = product.minimumStockThreshold;

    const stockCoverDays =
      averageDailyDemand > 0
        ? Number((currentStock / averageDailyDemand).toFixed(1))
        : null;

    const estimatedStockOutDate =
      stockCoverDays !== null
        ? new Date(
            now.getTime() + stockCoverDays * 24 * 60 * 60 * 1000
          ).toISOString()
        : null;

    let riskLevel: "HIGH" | "MEDIUM" | "LOW" | "NO_DATA" = "NO_DATA";

    if (averageDailyDemand > 0) {
      if (currentStock <= minimumStock || stockCoverDays! <= 7) {
        riskLevel = "HIGH";
      } else if (stockCoverDays! <= 14) {
        riskLevel = "MEDIUM";
      } else {
        riskLevel = "LOW";
      }
    } else if (currentStock <= minimumStock) {
      riskLevel = "HIGH";
    }

    const targetStock = Math.max(
      minimumStock,
      Math.ceil(averageDailyDemand * 14)
    );

    const reorderQuantity = Math.max(
      0,
      targetStock - currentStock
    );

    const activeSalesDays = dailySales.filter(
      (quantity) => quantity > 0
    ).length;

    const confidence =
      activeSalesDays >= 14
        ? "HIGH"
        : activeSalesDays >= 7
          ? "MEDIUM"
          : "LOW";

    return {
      productId: productIdString,
      productName: product.productName,
      sku: product.sku,
      currentStock,
      minimumStockThreshold: minimumStock,
      totalSalesLast30Days: Number(total30DaySales.toFixed(2)),
      averageDailyDemand: Number(averageDailyDemand.toFixed(2)),
      predictedDemand,
      forecastPeriodDays: horizon,
      stockCoverDays,
      estimatedStockOutDate,
      riskLevel,
      reorderQuantity,
      suggestedPurchaseValue: Number(
        (reorderQuantity * product.purchasePrice).toFixed(2)
      ),
      confidence,
      activeSalesDays,
    };
  });

  const highRisk = forecasts.filter(
    (item) => item.riskLevel === "HIGH"
  ).length;

  const mediumRisk = forecasts.filter(
    (item) => item.riskLevel === "MEDIUM"
  ).length;

  const reorderRequired = forecasts.filter(
    (item) => item.reorderQuantity > 0
  ).length;

  return {
    generatedAt: now.toISOString(),
    forecastPeriodDays: horizon,
    historyPeriodDays: 30,
    summary: {
      totalProducts: forecasts.length,
      highRisk,
      mediumRisk,
      reorderRequired,
    },
    forecasts: forecasts.sort((a, b) => {
      const riskOrder = { HIGH: 0, MEDIUM: 1, LOW: 2, NO_DATA: 3 };
      return (
        riskOrder[a.riskLevel] - riskOrder[b.riskLevel] ||
        b.reorderQuantity - a.reorderQuantity
      );
    }),
  };
};
