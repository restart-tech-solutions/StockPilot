import mongoose, { PipelineStage } from "mongoose";
import GoodsReceipt from "../../models/GoodsReceipt";
import InventoryBalance from "../../models/InventoryBalance";
import InventoryMovement from "../../models/InventoryMovement";
import Product from "../../models/Product";
import PurchaseOrder from "../../models/PurchaseOrder";
import SalesOrder from "../../models/SalesOrder";
import SalesReturn from "../../models/SalesReturn";
import Supplier from "../../models/Supplier";
import Warehouse from "../../models/Warehouse";
import { escapeRegex } from "../../utils/resourceQuery";

export type AnalyticsPeriod = "day" | "week" | "month";
export type ReportType = "sales" | "purchases" | "inventory" | "products";
export type ReportRow = Record<string, unknown>;

export interface AnalyticsFilters {
  businessId: string;
  from?: Date;
  to?: Date;
}

export interface ReportPagination {
  skip: number;
  limit: number;
}

export interface ReportPage {
  rows: ReportRow[];
  total: number;
}

interface SalesOrderRow extends ReportRow {
  _id: mongoose.Types.ObjectId;
  salesOrderNumber: string;
  customerName: string;
  status: string;
  completedAt: Date;
  salesRevenue: number;
  costAmount: number;
  returnedQuantity: number;
  missingCostSnapshot: number;
  estimatedGrossProfit: number | null;
}

interface ReceiptLineRow extends ReportRow {
  receiptId: mongoose.Types.ObjectId;
  receiptNumber: string;
  receivedAt: Date;
  purchaseOrderId: mongoose.Types.ObjectId;
  purchaseOrderNumber: string;
  supplierId: mongoose.Types.ObjectId;
  supplierName: string;
  productId: mongoose.Types.ObjectId;
  productName: string;
  sku: string;
  receivedQuantity: number;
  damagedQuantity: number;
  goodQuantity: number;
  unitPrice: number;
  receivedValue: number;
}

const completedSalesStatuses = [
  "COMPLETED",
  "PARTIALLY_RETURNED",
  "RETURNED",
];

function objectId(value: string): mongoose.Types.ObjectId {
  return new mongoose.Types.ObjectId(value);
}

function dateRange(
  field: string,
  from?: Date,
  to?: Date
): Record<string, Date> | undefined {
  if (!from && !to) return undefined;
  return {
    ...(from ? { $gte: from } : {}),
    ...(to ? { $lte: to } : {}),
  };
}

function scopeAndDate(
  businessId: string,
  field: string,
  from?: Date,
  to?: Date
): Record<string, unknown> {
  const range = dateRange(field, from, to);
  return {
    businessId: objectId(businessId),
    ...(range ? { [field]: range } : {}),
  };
}

function salesItemStages(filters: AnalyticsFilters): PipelineStage[] {
  return [
    {
      $match: {
        ...scopeAndDate(
          filters.businessId,
          "completedAt",
          filters.from,
          filters.to
        ),
        status: { $in: completedSalesStatuses },
      },
    },
    { $unwind: "$products" },
    {
      $set: {
        netQuantity: {
          $max: [
            {
              $subtract: [
                "$products.quantity",
                { $ifNull: ["$products.returnedQuantity", 0] },
              ],
            },
            0,
          ],
        },
        returnedQuantity: { $ifNull: ["$products.returnedQuantity", 0] },
      },
    },
    {
      $set: {
        lineRevenue: {
          $multiply: [
            "$netQuantity",
            "$products.unitPrice",
            {
              $subtract: [
                1,
                { $divide: ["$products.discountPercentage", 100] },
              ],
            },
          ],
        },
        lineCost: {
          $cond: [
            {
              $and: [
                { $gt: ["$netQuantity", 0] },
                { $ne: [{ $ifNull: ["$products.unitCost", null] }, null] },
              ],
            },
            { $multiply: ["$netQuantity", "$products.unitCost"] },
            0,
          ],
        },
        missingLineCost: {
          $cond: [
            {
              $and: [
                { $gt: ["$netQuantity", 0] },
                { $eq: [{ $ifNull: ["$products.unitCost", null] }, null] },
              ],
            },
            1,
            0,
          ],
        },
      },
    },
  ];
}

function salesOrderSummaryStages(
  filters: AnalyticsFilters
): PipelineStage[] {
  return [
    ...salesItemStages(filters),
    {
      $group: {
        _id: "$_id",
        salesOrderNumber: { $first: "$salesOrderNumber" },
        customerName: { $first: "$customerName" },
        status: { $first: "$status" },
        completedAt: { $first: "$completedAt" },
        salesRevenue: { $sum: "$lineRevenue" },
        costAmount: { $sum: "$lineCost" },
        returnedQuantity: { $sum: "$returnedQuantity" },
        missingCostSnapshot: { $max: "$missingLineCost" },
      },
    },
    {
      $set: {
        estimatedGrossProfit: {
          $cond: [
            { $eq: ["$missingCostSnapshot", 0] },
            { $subtract: ["$salesRevenue", "$costAmount"] },
            null,
          ],
        },
      },
    },
  ];
}

function receiptLineStages(filters: AnalyticsFilters): PipelineStage[] {
  return [
    {
      $match: scopeAndDate(
        filters.businessId,
        "receivedAt",
        filters.from,
        filters.to
      ),
    },
    { $unwind: "$products" },
    {
      $lookup: {
        from: PurchaseOrder.collection.name,
        let: {
          orderId: "$purchaseOrderId",
          scopedBusinessId: "$businessId",
          lineProductId: "$products.productId",
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$_id", "$$orderId"] },
                  { $eq: ["$businessId", "$$scopedBusinessId"] },
                ],
              },
            },
          },
          { $unwind: "$products" },
          {
            $match: {
              $expr: { $eq: ["$products.productId", "$$lineProductId"] },
            },
          },
          {
            $project: {
              purchaseOrderNumber: 1,
              productName: "$products.productName",
              sku: "$products.sku",
              unitPrice: "$products.unitPrice",
            },
          },
        ],
        as: "orderLine",
      },
    },
    { $unwind: "$orderLine" },
    {
      $lookup: {
        from: Supplier.collection.name,
        let: {
          supplierId: "$supplierId",
          scopedBusinessId: "$businessId",
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$_id", "$$supplierId"] },
                  { $eq: ["$businessId", "$$scopedBusinessId"] },
                ],
              },
            },
          },
          { $project: { supplierName: 1 } },
        ],
        as: "supplier",
      },
    },
    { $unwind: "$supplier" },
    {
      $set: {
        goodQuantity: {
          $max: [
            {
              $subtract: [
                "$products.receivedQuantity",
                "$products.damagedQuantity",
              ],
            },
            0,
          ],
        },
      },
    },
    {
      $set: {
        receivedValue: { $multiply: ["$goodQuantity", "$orderLine.unitPrice"] },
      },
    },
    {
      $project: {
        _id: 0,
        receiptId: "$_id",
        receiptNumber: 1,
        receivedAt: 1,
        purchaseOrderId: 1,
        purchaseOrderNumber: "$orderLine.purchaseOrderNumber",
        supplierId: 1,
        supplierName: "$supplier.supplierName",
        productId: "$products.productId",
        productName: "$orderLine.productName",
        sku: "$orderLine.sku",
        receivedQuantity: "$products.receivedQuantity",
        damagedQuantity: "$products.damagedQuantity",
        goodQuantity: 1,
        unitPrice: "$orderLine.unitPrice",
        receivedValue: 1,
      },
    },
  ];
}

async function getSalesHeadline(filters: AnalyticsFilters) {
  const [summary] = await SalesOrder.aggregate<{
    orderCount: number;
    salesRevenue: number;
    estimatedGrossProfit: number;
    ordersMissingCost: number;
    revenueWithCostSnapshot: number;
    revenueWithoutCostSnapshot: number;
  }>([
    ...salesOrderSummaryStages(filters),
    {
      $group: {
        _id: null,
        orderCount: { $sum: 1 },
        salesRevenue: { $sum: "$salesRevenue" },
        estimatedGrossProfit: {
          $sum: { $ifNull: ["$estimatedGrossProfit", 0] },
        },
        ordersMissingCost: { $sum: "$missingCostSnapshot" },
        revenueWithCostSnapshot: {
          $sum: {
            $cond: [
              { $eq: ["$missingCostSnapshot", 0] },
              "$salesRevenue",
              0,
            ],
          },
        },
        revenueWithoutCostSnapshot: {
          $sum: {
            $cond: [
              { $gt: ["$missingCostSnapshot", 0] },
              "$salesRevenue",
              0,
            ],
          },
        },
      },
    },
  ]);
  const result = summary ?? {
    orderCount: 0,
    salesRevenue: 0,
    estimatedGrossProfit: 0,
    ordersMissingCost: 0,
    revenueWithCostSnapshot: 0,
    revenueWithoutCostSnapshot: 0,
  };
  return {
    ...result,
    estimatedGrossProfit:
      result.ordersMissingCost === 0 ? result.estimatedGrossProfit : null,
  };
}

async function getPurchaseHeadline(filters: AnalyticsFilters) {
  const [summary] = await GoodsReceipt.aggregate<{
    receiptIds: mongoose.Types.ObjectId[];
    receivedQuantity: number;
    damagedQuantity: number;
    goodQuantity: number;
    purchaseValue: number;
  }>([
    ...receiptLineStages(filters),
    {
      $group: {
        _id: null,
        receiptIds: { $addToSet: "$receiptId" },
        receivedQuantity: { $sum: "$receivedQuantity" },
        damagedQuantity: { $sum: "$damagedQuantity" },
        goodQuantity: { $sum: "$goodQuantity" },
        purchaseValue: { $sum: "$receivedValue" },
      },
    },
  ]);
  return {
    receiptCount: summary?.receiptIds.length ?? 0,
    receivedQuantity: summary?.receivedQuantity ?? 0,
    damagedQuantity: summary?.damagedQuantity ?? 0,
    goodQuantity: summary?.goodQuantity ?? 0,
    purchaseValue: summary?.purchaseValue ?? 0,
  };
}

async function getInventoryHeadline(businessId: string) {
  const [summary] = await Product.aggregate<{
    productCount: number;
    inventoryValue: number;
    lowStockCount: number;
    outOfStockCount: number;
  }>([
    { $match: { businessId: objectId(businessId) } },
    {
      $group: {
        _id: null,
        productCount: { $sum: 1 },
        inventoryValue: {
          $sum: { $multiply: ["$currentStock", "$purchasePrice"] },
        },
        lowStockCount: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $gt: ["$currentStock", 0] },
                  { $gt: ["$minimumStockThreshold", 0] },
                  { $lte: ["$currentStock", "$minimumStockThreshold"] },
                ],
              },
              1,
              0,
            ],
          },
        },
        outOfStockCount: {
          $sum: { $cond: [{ $eq: ["$currentStock", 0] }, 1, 0] },
        },
      },
    },
  ]);
  return (
    summary ?? {
      productCount: 0,
      inventoryValue: 0,
      lowStockCount: 0,
      outOfStockCount: 0,
    }
  );
}

export async function getOverviewAnalytics(filters: AnalyticsFilters) {
  const businessId = objectId(filters.businessId);
  const [inventory, sales, purchases, pendingPurchaseOrders] =
    await Promise.all([
      getInventoryHeadline(filters.businessId),
      getSalesHeadline(filters),
      getPurchaseHeadline(filters),
      PurchaseOrder.countDocuments({
        businessId,
        status: { $in: ["DRAFT", "APPROVED", "PARTIALLY_RECEIVED"] },
      }),
    ]);

  return {
    ...inventory,
    totalSalesRevenue: sales.salesRevenue,
    purchaseValue: purchases.purchaseValue,
    estimatedGrossProfit: sales.estimatedGrossProfit,
    grossProfitCostCoverage: {
      ordersWithMissingCostSnapshot: sales.ordersMissingCost,
      salesRevenueWithCostSnapshot: sales.revenueWithCostSnapshot,
      salesRevenueWithoutCostSnapshot: sales.revenueWithoutCostSnapshot,
    },
    pendingPurchaseOrders,
    valuationBasis: "Current product purchase prices; estimated, not FIFO/average cost.",
    revenueBasis:
      "Completed sales, net of recorded returns and discounts, excluding tax.",
  };
}

export async function getSalesAnalytics(
  filters: AnalyticsFilters,
  period: AnalyticsPeriod
) {
  const [summary, trend, topProducts, statusRows, returnSummary] =
    await Promise.all([
      getSalesHeadline(filters),
      SalesOrder.aggregate<{
        _id: Date;
        salesRevenue: number;
        quantity: number;
      }>([
        ...salesItemStages(filters),
        {
          $group: {
            _id: {
              $dateTrunc: {
                date: "$completedAt",
                unit: period,
                ...(period === "week" ? { startOfWeek: "monday" } : {}),
              },
            },
            salesRevenue: { $sum: "$lineRevenue" },
            quantity: { $sum: "$netQuantity" },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      SalesOrder.aggregate<{
        _id: { productId: mongoose.Types.ObjectId; productName: string; sku: string };
        quantity: number;
        salesRevenue: number;
      }>([
        ...salesItemStages(filters),
        {
          $group: {
            _id: {
              productId: "$products.productId",
              productName: "$products.productName",
              sku: "$products.sku",
            },
            quantity: { $sum: "$netQuantity" },
            salesRevenue: { $sum: "$lineRevenue" },
          },
        },
        { $sort: { quantity: -1, salesRevenue: -1, "_id.productName": 1 } },
        { $limit: 10 },
      ]),
      SalesOrder.aggregate<{ _id: string; count: number }>([
        {
          $match: scopeAndDate(
            filters.businessId,
            "createdAt",
            filters.from,
            filters.to
          ),
        },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      SalesReturn.aggregate<{ returnCount: number; returnedQuantity: number }>([
        {
          $match: scopeAndDate(
            filters.businessId,
            "createdAt",
            filters.from,
            filters.to
          ),
        },
        { $unwind: "$products" },
        {
          $group: {
            _id: "$_id",
            returnedQuantity: { $sum: "$products.quantity" },
          },
        },
        {
          $group: {
            _id: null,
            returnCount: { $sum: 1 },
            returnedQuantity: { $sum: "$returnedQuantity" },
          },
        },
        { $project: { _id: 0, returnCount: 1, returnedQuantity: 1 } },
      ]),
    ]);

  const statuses = Object.fromEntries(
    statusRows.map(({ _id, count }) => [_id, count])
  );
  return {
    ...summary,
    orderCounts: {
      completed: (statuses.COMPLETED ?? 0) +
        (statuses.PARTIALLY_RETURNED ?? 0) +
        (statuses.RETURNED ?? 0),
      cancelled: statuses.CANCELLED ?? 0,
      returned:
        (statuses.PARTIALLY_RETURNED ?? 0) + (statuses.RETURNED ?? 0),
      byStatus: statuses,
    },
    returns: returnSummary[0] ?? { returnCount: 0, returnedQuantity: 0 },
    trend,
    topProducts: topProducts.map((item) => ({
      productId: item._id.productId,
      productName: item._id.productName,
      sku: item._id.sku,
      quantity: item.quantity,
      salesRevenue: item.salesRevenue,
    })),
    revenueBasis:
      "Sales are grouped by completion date, net of recorded returns and discounts, excluding tax. Later returns adjust the original sale period.",
    grossProfitBasis:
      "Estimated gross profit is unavailable if any included order lacks a unit-cost snapshot; tax and operating expenses are excluded.",
  };
}

export async function getPurchaseAnalytics(
  filters: AnalyticsFilters,
  period: AnalyticsPeriod
) {
  const [receiptSummary, trends, supplierRows, purchaseStatusRows] =
    await Promise.all([
      getPurchaseHeadline(filters),
      GoodsReceipt.aggregate<{ _id: Date; purchaseValue: number; goodQuantity: number }>([
        ...receiptLineStages(filters),
        {
          $group: {
            _id: {
              $dateTrunc: {
                date: "$receivedAt",
                unit: period,
                ...(period === "week" ? { startOfWeek: "monday" } : {}),
              },
            },
            purchaseValue: { $sum: "$receivedValue" },
            goodQuantity: { $sum: "$goodQuantity" },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      GoodsReceipt.aggregate<{
        _id: { supplierId: mongoose.Types.ObjectId; supplierName: string };
        purchaseValue: number;
        goodQuantity: number;
      }>([
        ...receiptLineStages(filters),
        {
          $group: {
            _id: { supplierId: "$supplierId", supplierName: "$supplierName" },
            purchaseValue: { $sum: "$receivedValue" },
            goodQuantity: { $sum: "$goodQuantity" },
          },
        },
        { $sort: { purchaseValue: -1, "_id.supplierName": 1 } },
      ]),
      PurchaseOrder.aggregate<{ _id: string; count: number; orderedValue: number }>([
        {
          $match: scopeAndDate(
            filters.businessId,
            "createdAt",
            filters.from,
            filters.to
          ),
        },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
            orderedValue: { $sum: "$totalAmount" },
          },
        },
      ]),
    ]);

  return {
    ...receiptSummary,
    trends,
    supplierAnalysis: supplierRows.map((item) => ({
      supplierId: item._id.supplierId,
      supplierName: item._id.supplierName,
      purchaseValue: item.purchaseValue,
      goodQuantity: item.goodQuantity,
    })),
    purchaseOrderStatuses: purchaseStatusRows,
    valueBasis:
      "Cost of good quantities in recorded goods receipts using purchase-order unit-price snapshots; excludes damaged goods and tax.",
  };
}

function warehouseReconciliationPipeline(
  businessId: string
): PipelineStage[] {
  return [
    { $match: { businessId: objectId(businessId) } },
    {
      $group: {
        _id: { productId: "$productId", warehouseId: "$warehouseId" },
        quantity: {
          $sum: { $add: ["$availableQuantity", "$reservedQuantity"] },
        },
      },
    },
    {
      $group: {
        _id: "$_id.productId",
        totalWarehouseQuantity: { $sum: "$quantity" },
        balances: {
          $push: {
            warehouseId: "$_id.warehouseId",
            quantity: "$quantity",
          },
        },
      },
    },
    {
      $lookup: {
        from: Product.collection.name,
        let: { productId: "$_id", expectedBusinessId: objectId(businessId) },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$_id", "$$productId"] },
                  { $eq: ["$businessId", "$$expectedBusinessId"] },
                ],
              },
            },
          },
          { $project: { currentStock: 1 } },
        ],
        as: "product",
      },
    },
    { $unwind: "$product" },
    {
      $match: {
        $expr: {
          $and: [
            { $gt: ["$totalWarehouseQuantity", 0] },
            {
              $lte: [
                {
                  $abs: {
                    $subtract: [
                      "$totalWarehouseQuantity",
                      "$product.currentStock",
                    ],
                  },
                },
                0.00000001,
              ],
            },
          ],
        },
      },
    },
    {
      $facet: {
        coverage: [{ $count: "reconciledProductCount" }],
        byWarehouse: [
          { $unwind: "$balances" },
          {
            $group: {
              _id: "$balances.warehouseId",
              quantity: { $sum: "$balances.quantity" },
              products: { $addToSet: "$_id" },
            },
          },
          {
            $lookup: {
              from: Warehouse.collection.name,
              let: {
                warehouseId: "$_id",
                expectedBusinessId: objectId(businessId),
              },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [
                        { $eq: ["$_id", "$$warehouseId"] },
                        { $eq: ["$businessId", "$$expectedBusinessId"] },
                      ],
                    },
                  },
                },
                { $project: { warehouseName: 1 } },
              ],
              as: "warehouse",
            },
          },
          { $unwind: "$warehouse" },
          {
            $project: {
              _id: 0,
              warehouseId: "$_id",
              warehouseName: "$warehouse.warehouseName",
              quantity: 1,
              productCount: { $size: "$products" },
            },
          },
          { $sort: { warehouseName: 1 } },
        ],
      },
    },
  ];
}

export async function getInventoryAnalytics(filters: AnalyticsFilters) {
  const [headline, movements, reconciled, stockedProductCount] =
    await Promise.all([
      getInventoryHeadline(filters.businessId),
      InventoryMovement.aggregate<{
        _id: string;
        movementCount: number;
        quantity: number;
      }>([
        {
          $match: scopeAndDate(
            filters.businessId,
            "createdAt",
            filters.from,
            filters.to
          ),
        },
        {
          $group: {
            _id: "$movementType",
            movementCount: { $sum: 1 },
            quantity: { $sum: "$quantity" },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      InventoryBalance.aggregate<{
        coverage: { reconciledProductCount: number }[];
        byWarehouse: ReportRow[];
      }>(warehouseReconciliationPipeline(filters.businessId)),
      Product.countDocuments({
        businessId: objectId(filters.businessId),
        currentStock: { $gt: 0 },
      }),
    ]);

  const warehouseData = reconciled[0] ?? { coverage: [], byWarehouse: [] };
  const reconciledProductCount =
    warehouseData.coverage[0]?.reconciledProductCount ?? 0;
  return {
    ...headline,
    movements,
    warehouseBalances: warehouseData.byWarehouse,
    warehouseBalanceCoverage: {
      reconciledProductCount,
      stockedProductCount,
      unreconciledProductCount: Math.max(
        stockedProductCount - reconciledProductCount,
        0
      ),
      note:
        "Warehouse totals include only products whose recorded warehouse balances exactly match aggregate product stock. Legacy/opening stock may be omitted.",
    },
    valuationBasis:
      "Estimated current stock value at each product's current purchase price; not a historical or FIFO/average-cost valuation.",
    movementBasis:
      "Counts inventory ledger entries. Transfers can create separate source and destination entries.",
  };
}

async function paginatedAggregate<T extends ReportRow>(
  model: typeof SalesOrder | typeof GoodsReceipt,
  pipeline: PipelineStage[],
  pagination: ReportPagination
): Promise<ReportPage> {
  const [result] = await model.aggregate<{
    rows: T[];
    metadata: { total: number }[];
  }>([
    ...pipeline,
    {
      $facet: {
        rows: [{ $skip: pagination.skip }, { $limit: pagination.limit }],
        metadata: [{ $count: "total" }],
      },
    },
  ]);
  return {
    rows: result?.rows ?? [],
    total: result?.metadata[0]?.total ?? 0,
  };
}

async function getSalesReport(
  filters: AnalyticsFilters,
  search: string,
  pagination: ReportPagination
): Promise<ReportPage> {
  const stages = salesOrderSummaryStages(filters);
  const safeSearch = search ? new RegExp(escapeRegex(search), "i") : undefined;
  if (safeSearch) {
    stages.push({
      $match: {
        $or: [
          { salesOrderNumber: safeSearch },
          { customerName: safeSearch },
          { status: safeSearch },
        ],
      },
    });
  }
  stages.push({ $sort: { completedAt: -1, _id: -1 } });
  return paginatedAggregate<SalesOrderRow>(SalesOrder, stages, pagination);
}

async function getPurchaseReport(
  filters: AnalyticsFilters,
  search: string,
  pagination: ReportPagination
): Promise<ReportPage> {
  const stages = receiptLineStages(filters);
  const safeSearch = search ? new RegExp(escapeRegex(search), "i") : undefined;
  if (safeSearch) {
    stages.push({
      $match: {
        $or: [
          { purchaseOrderNumber: safeSearch },
          { supplierName: safeSearch },
          { productName: safeSearch },
          { sku: safeSearch },
        ],
      },
    });
  }
  stages.push({ $sort: { receivedAt: -1, receiptNumber: 1, productName: 1 } });
  return paginatedAggregate<ReceiptLineRow>(GoodsReceipt, stages, pagination);
}

async function getInventoryReport(
  filters: AnalyticsFilters,
  search: string,
  pagination: ReportPagination
): Promise<ReportPage> {
  const businessId = objectId(filters.businessId);
  const filter: Record<string, unknown> = { businessId };
  if (search) {
    const expression = new RegExp(escapeRegex(search), "i");
    filter.$or = [{ productName: expression }, { sku: expression }];
  }
  const [rows, total] = await Promise.all([
    Product.find(filter)
      .select("productName sku currentStock minimumStockThreshold purchasePrice sellingPrice")
      .sort({ productName: 1, _id: 1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .lean(),
    Product.countDocuments(filter),
  ]);
  return {
    rows: rows.map((product) => ({
      productId: product._id,
      productName: product.productName,
      sku: product.sku,
      currentStock: product.currentStock,
      minimumStockThreshold: product.minimumStockThreshold,
      currentPurchasePrice: product.purchasePrice,
      estimatedStockValue: product.currentStock * product.purchasePrice,
    })),
    total,
  };
}

async function getProductPerformanceReport(
  filters: AnalyticsFilters,
  search: string,
  pagination: ReportPagination
): Promise<ReportPage> {
  const stages = salesItemStages(filters);
  const safeSearch = search ? new RegExp(escapeRegex(search), "i") : undefined;
  if (safeSearch) {
    stages.push({
      $match: {
        $or: [
          { "products.productName": safeSearch },
          { "products.sku": safeSearch },
        ],
      },
    });
  }
  stages.push(
    {
      $group: {
        _id: {
          productId: "$products.productId",
          productName: "$products.productName",
          sku: "$products.sku",
        },
        quantitySold: { $sum: "$netQuantity" },
        salesRevenue: { $sum: "$lineRevenue" },
        costAmount: { $sum: "$lineCost" },
        missingCostSnapshot: { $max: "$missingLineCost" },
      },
    },
    {
      $set: {
        estimatedGrossProfit: {
          $cond: [
            { $eq: ["$missingCostSnapshot", 0] },
            { $subtract: ["$salesRevenue", "$costAmount"] },
            null,
          ],
        },
      },
    },
    { $sort: { salesRevenue: -1, "_id.productName": 1 } },
    {
      $project: {
        _id: 0,
        productId: "$_id.productId",
        productName: "$_id.productName",
        sku: "$_id.sku",
        quantitySold: 1,
        salesRevenue: 1,
        estimatedGrossProfit: 1,
        missingCostSnapshot: 1,
      },
    }
  );
  return paginatedAggregate<ReportRow>(SalesOrder, stages, pagination);
}

export async function getReportPage(
  type: ReportType,
  filters: AnalyticsFilters,
  search: string,
  pagination: ReportPagination
): Promise<ReportPage> {
  switch (type) {
    case "sales":
      return getSalesReport(filters, search, pagination);
    case "purchases":
      return getPurchaseReport(filters, search, pagination);
    case "inventory":
      return getInventoryReport(filters, search, pagination);
    case "products":
      return getProductPerformanceReport(filters, search, pagination);
  }
}
