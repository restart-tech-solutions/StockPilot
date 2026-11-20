export interface AnalyticsResponse<T> {
  success: boolean;
  analytics: T;
}

export interface OverviewAnalytics {
  productCount: number;
  inventoryValue: number;
  lowStockCount: number;
  outOfStockCount: number;
  totalSalesRevenue: number;
  purchaseValue: number;
  estimatedGrossProfit: number | null;
  grossProfitCostCoverage: {
    ordersWithMissingCostSnapshot: number;
    salesRevenueWithCostSnapshot: number;
    salesRevenueWithoutCostSnapshot: number;
  };
  pendingPurchaseOrders: number;
  valuationBasis: string;
  revenueBasis: string;
}

export interface SalesAnalytics {
  orderCount: number;
  salesRevenue: number;
  estimatedGrossProfit: number | null;
  ordersMissingCost: number;
  revenueWithCostSnapshot: number;
  revenueWithoutCostSnapshot: number;
  orderCounts: {
    completed: number;
    cancelled: number;
    returned: number;
    byStatus: Record<string, number>;
  };
  returns: { returnCount: number; returnedQuantity: number };
  trend: Array<{ _id: string; salesRevenue: number; quantity: number }>;
  topProducts: Array<{
    productId: string;
    productName: string;
    sku: string;
    quantity: number;
    salesRevenue: number;
  }>;
  revenueBasis: string;
  grossProfitBasis: string;
}

export interface PurchaseAnalytics {
  receiptCount: number;
  receivedQuantity: number;
  damagedQuantity: number;
  goodQuantity: number;
  purchaseValue: number;
  trends: Array<{ _id: string; purchaseValue: number; goodQuantity: number }>;
  supplierAnalysis: Array<{
    supplierId: string;
    supplierName: string;
    purchaseValue: number;
    goodQuantity: number;
  }>;
  purchaseOrderStatuses: Array<{
    _id: string;
    count: number;
    orderedValue: number;
  }>;
  valueBasis: string;
}

export interface InventoryAnalytics {
  productCount: number;
  inventoryValue: number;
  lowStockCount: number;
  outOfStockCount: number;
  movements: Array<{
    _id: string;
    movementCount: number;
    quantity: number;
  }>;
  warehouseBalances: Array<{
    warehouseId: string;
    warehouseName: string;
    quantity: number;
    productCount: number;
  }>;
  warehouseBalanceCoverage: {
    reconciledProductCount: number;
    stockedProductCount: number;
    unreconciledProductCount: number;
    note: string;
  };
  valuationBasis: string;
  movementBasis: string;
}

export interface ReportResponse {
  success: boolean;
  reportType: string;
  rows: Array<Record<string, unknown>>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  inventorySnapshot?: {
    asOf: string;
    dateFiltersApplyTo: string;
  };
}
