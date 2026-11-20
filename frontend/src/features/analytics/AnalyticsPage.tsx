import { lazy, Suspense, useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AppShell } from "../../components/layout/AppShell";
import { apiRequest, StockPilotApiError } from "../../services/api";
import { useWorkspace } from "../workspace/workspaceContext";
import type {
  AnalyticsResponse,
  InventoryAnalytics,
  OverviewAnalytics,
  PurchaseAnalytics,
  SalesAnalytics,
} from "./analytics.types";

const SalesRevenueChart = lazy(() =>
  import("./SalesRevenueChart").then((module) => ({
    default: module.SalesRevenueChart,
  }))
);
type Period = "daily" | "weekly" | "monthly";
type AnalyticsPayload =
  | InventoryAnalytics
  | OverviewAnalytics
  | PurchaseAnalytics
  | SalesAnalytics;

interface AnalyticsState {
  overview?: OverviewAnalytics;
  sales?: SalesAnalytics;
  purchases?: PurchaseAnalytics;
  inventory?: InventoryAnalytics;
}

function currentMonthRange(): { from: string; to: string } {
  const now = new Date();
  return {
    from: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
      .toISOString()
      .slice(0, 10),
    to: now.toISOString().slice(0, 10),
  };
}

function formatMoney(value: number | null | undefined, currency: string): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "Unavailable";
  }
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

function errorMessage(error: unknown): string {
  return error instanceof StockPilotApiError
    ? error.message
    : "Analytics could not be loaded.";
}

function queryFor(
  businessId: string,
  from: string,
  to: string,
  period?: Period
): string {
  const params = new URLSearchParams({ businessId, from, to });
  if (period) params.set("period", period);
  return params.toString();
}

function MetricCard({
  label,
  value,
  note,
  href,
}: {
  label: string;
  value: string;
  note?: string;
  href?: string;
}) {
  return (
    <article className="min-w-0 rounded-xl border border-stock-border bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-stock-secondary-text">{label}</p>
      <p className="mt-3 break-words text-2xl font-semibold text-stock-deep-navy">
        {href ? (
          <a className="hover:text-stock-primary-blue" href={href}>
            {value}
          </a>
        ) : (
          value
        )}
      </p>
      {note && (
        <p className="mt-2 text-xs leading-5 text-stock-secondary-text">{note}</p>
      )}
    </article>
  );
}

export function AnalyticsPage() {
  const { workspace } = useWorkspace();
  const [range, setRange] = useState(currentMonthRange);
  const [period, setPeriod] = useState<Period>("daily");
  const [analytics, setAnalytics] = useState<AnalyticsState>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!workspace?.id) {
      setAnalytics({});
      return;
    }
    if (range.from && range.to && range.from > range.to) {
      setError("Start date must be on or before end date.");
      return;
    }

    let active = true;
    const role = workspace.membershipRole;
    const canViewFinancial = role === "BUSINESS_OWNER" || role === "ACCOUNTANT";
    const canViewPurchases =
      canViewFinancial || role === "INVENTORY_MANAGER";
    setLoading(true);
    setError("");

    const query = queryFor(workspace.id, range.from, range.to, period);
    const requests: Promise<AnalyticsResponse<AnalyticsPayload>>[] = [
      apiRequest<AnalyticsResponse<InventoryAnalytics>>(
        `/analytics/inventory?${queryFor(workspace.id, range.from, range.to)}`
      ),
    ];
    if (canViewFinancial) {
      requests.push(
        apiRequest<AnalyticsResponse<OverviewAnalytics>>(
          `/analytics/overview?${queryFor(workspace.id, range.from, range.to)}`
        ),
        apiRequest<AnalyticsResponse<SalesAnalytics>>(
          `/analytics/sales?${query}`
        )
      );
    }
    if (canViewPurchases) {
      requests.push(
        apiRequest<AnalyticsResponse<PurchaseAnalytics>>(
          `/analytics/purchases?${query}`
        )
      );
    }

    Promise.all(requests)
      .then((responses) => {
        if (!active) return;
        const next: AnalyticsState = {};
        for (const response of responses) {
          if (
            !response.success ||
            typeof response.analytics !== "object" ||
            response.analytics === null
          ) {
            throw new Error("The analytics response was not valid.");
          }
          const value = response.analytics;
          if ("movements" in value) next.inventory = value;
          else if ("grossProfitCostCoverage" in value) next.overview = value;
          else if ("supplierAnalysis" in value) next.purchases = value;
          else if ("topProducts" in value) next.sales = value;
          else throw new Error("The analytics response was not recognized.");
        }
        setAnalytics(next);
      })
      .catch((loadError: unknown) => {
        if (active) setError(errorMessage(loadError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [workspace?.id, workspace?.membershipRole, range.from, range.to, period]);

  const currency = workspace?.currency ?? "USD";
  const canViewFinancial =
    workspace?.membershipRole === "BUSINESS_OWNER" ||
    workspace?.membershipRole === "ACCOUNTANT";

  return (
    <AppShell
      mode="business"
      title="Business Analytics"
      description="Workspace-scoped sales, purchase and inventory performance from recorded business data."
      action={
        <div className="flex flex-wrap gap-2">
          <label className="flex flex-col gap-1 text-xs font-medium text-stock-secondary-text">
            From
            <input
              aria-label="Analytics start date"
              type="date"
              value={range.from}
              onChange={(event) =>
                setRange((current) => ({ ...current, from: event.target.value }))
              }
              className="h-10 rounded-lg border border-stock-border bg-white px-3 text-sm text-stock-primary-text"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-stock-secondary-text">
            To
            <input
              aria-label="Analytics end date"
              type="date"
              value={range.to}
              onChange={(event) =>
                setRange((current) => ({ ...current, to: event.target.value }))
              }
              className="h-10 rounded-lg border border-stock-border bg-white px-3 text-sm text-stock-primary-text"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-stock-secondary-text">
            Trend interval
            <select
              value={period}
              onChange={(event) => setPeriod(event.target.value as Period)}
              className="h-10 rounded-lg border border-stock-border bg-white px-3 text-sm text-stock-primary-text"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </label>
        </div>
      }
    >
      <div className="space-y-6">
        {!workspace && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Select a business workspace to view its analytics.
          </div>
        )}
        {loading && (
          <div
            role="status"
            className="rounded-xl border border-stock-border bg-white p-4 text-sm text-stock-secondary-text"
          >
            Loading analytics…
          </div>
        )}
        {error && (
          <section
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          >
            {error}
          </section>
        )}

        {analytics.overview && (
          <section
            aria-label="Business key performance indicators"
            className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
          >
            <MetricCard
              label="Total Products"
              value={String(analytics.overview.productCount)}
              href="/products"
            />
            <MetricCard
              label="Estimated Inventory Value"
              value={formatMoney(analytics.overview.inventoryValue, currency)}
              note="Current stock at current purchase prices; not FIFO or average cost."
              href="/reports/inventory"
            />
            <MetricCard
              label="Sales Revenue"
              value={formatMoney(analytics.overview.totalSalesRevenue, currency)}
              note="Completed sales, net of recorded returns and discounts; excludes tax."
              href="/reports/sales"
            />
            <MetricCard
              label="Received Purchase Value"
              value={formatMoney(analytics.overview.purchaseValue, currency)}
              note="Good received quantities at purchase-order unit prices; excludes tax."
              href="/reports/purchases"
            />
            <MetricCard
              label="Estimated Gross Profit"
              value={formatMoney(analytics.overview.estimatedGrossProfit, currency)}
              note={
                analytics.overview.estimatedGrossProfit === null
                  ? `${analytics.overview.grossProfitCostCoverage.ordersWithMissingCostSnapshot} included order(s) have no cost snapshot.`
                  : "Excludes tax and operating expenses; not net profit."
              }
              href="/reports/sales"
            />
            <MetricCard
              label="Low Stock Products"
              value={String(analytics.overview.lowStockCount)}
              href="/inventory/alerts"
            />
            <MetricCard
              label="Out of Stock Products"
              value={String(analytics.overview.outOfStockCount)}
              href="/inventory/alerts"
            />
            <MetricCard
              label="Pending Purchase Orders"
              value={String(analytics.overview.pendingPurchaseOrders)}
              href="/purchases"
            />
          </section>
        )}

        {!loading && !error && !analytics.overview && analytics.inventory && (
          <div className="rounded-xl border border-stock-border bg-white p-4 text-sm text-stock-secondary-text">
            Financial analytics are restricted to business owners and accountants. Inventory analytics available to your role are shown below.
          </div>
        )}

        {analytics.sales && (
          <section className="grid min-w-0 gap-4 xl:grid-cols-2">
            <article className="min-w-0 rounded-xl border border-stock-border bg-white p-5 shadow-sm sm:p-6">
              <h2 className="text-base font-semibold text-stock-deep-navy">
                Sales Revenue Trend
              </h2>
              <p className="mt-1 text-sm text-stock-secondary-text">
                Revenue is grouped by completion date and excludes tax.
              </p>
              {analytics.sales.trend.length === 0 ? (
                <p className="mt-8 rounded-lg bg-stock-light-grey p-6 text-center text-sm text-stock-secondary-text">
                  No completed sales match this date range.
                </p>
              ) : (
                <div className="mt-5 h-72 min-w-0">
                  <Suspense
                    fallback={
                      <div className="flex h-72 items-center justify-center text-sm text-stock-secondary-text">
                        Loading sales chart...
                      </div>
                    }
                  >
                    <SalesRevenueChart
                      data={analytics.sales.trend}
                      currency={currency}
                      showTooltipDate
                    />
                  </Suspense>
                </div>
              )}
            </article>

            <article className="min-w-0 rounded-xl border border-stock-border bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold text-stock-deep-navy">
                    Top-Selling Products
                  </h2>
                  <p className="mt-1 text-sm text-stock-secondary-text">
                    Net quantities after recorded returns.
                  </p>
                </div>
                <p className="text-sm text-stock-secondary-text">
                  Completed: {analytics.sales.orderCounts.completed} · Cancelled:{" "}
                  {analytics.sales.orderCounts.cancelled} · Returned:{" "}
                  {analytics.sales.orderCounts.returned}
                </p>
              </div>
              {analytics.sales.topProducts.length === 0 ? (
                <p className="mt-8 rounded-lg bg-stock-light-grey p-6 text-center text-sm text-stock-secondary-text">
                  No product sales match this date range.
                </p>
              ) : (
                <div className="mt-5 h-72 min-w-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics.sales.topProducts} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis
                        type="category"
                        dataKey="productName"
                        width={110}
                        tick={{ fontSize: 12 }}
                      />
                      <Tooltip
                        formatter={(value) => [Number(value), "Net units sold"]}
                      />
                      <Bar dataKey="quantity" fill="#0F766E" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
              {analytics.sales.estimatedGrossProfit === null && canViewFinancial && (
                <p className="mt-3 text-xs leading-5 text-amber-800">
                  Gross profit is unavailable because some included sales lack a cost snapshot.
                </p>
              )}
            </article>
          </section>
        )}

        {analytics.purchases && (
          <section className="grid min-w-0 gap-4 xl:grid-cols-2">
            <article className="min-w-0 rounded-xl border border-stock-border bg-white p-5 shadow-sm sm:p-6">
              <h2 className="text-base font-semibold text-stock-deep-navy">
                Goods Received Trend
              </h2>
              <p className="mt-1 text-sm text-stock-secondary-text">
                Received value excludes damaged quantities and tax.
              </p>
              {analytics.purchases.trends.length === 0 ? (
                <p className="mt-8 rounded-lg bg-stock-light-grey p-6 text-center text-sm text-stock-secondary-text">
                  No goods receipts match this date range.
                </p>
              ) : (
                <div className="mt-5 h-72 min-w-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics.purchases.trends}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="_id"
                        tickFormatter={(value: string) =>
                          new Date(value).toLocaleDateString()
                        }
                      />
                      <YAxis />
                      <Tooltip
                        formatter={(value) => [
                          formatMoney(Number(value), currency),
                          "Received purchase value",
                        ]}
                      />
                      <Bar dataKey="purchaseValue" fill="#0F766E" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </article>

            <article className="min-w-0 rounded-xl border border-stock-border bg-white p-5 shadow-sm sm:p-6">
              <h2 className="text-base font-semibold text-stock-deep-navy">
                Supplier Purchases
              </h2>
              <p className="mt-1 text-sm text-stock-secondary-text">
                {analytics.purchases.receiptCount} goods receipt(s) ·{" "}
                {analytics.purchases.damagedQuantity} damaged unit(s)
              </p>
              <div className="mt-4 max-h-72 overflow-auto">
                {analytics.purchases.supplierAnalysis.length === 0 ? (
                  <p className="rounded-lg bg-stock-light-grey p-6 text-center text-sm text-stock-secondary-text">
                    No supplier receipts match this date range.
                  </p>
                ) : (
                  <table className="w-full min-w-[28rem] text-left text-sm">
                    <thead className="sticky top-0 bg-white text-stock-secondary-text">
                      <tr className="border-b border-stock-border">
                        <th className="px-3 py-2 font-medium">Supplier</th>
                        <th className="px-3 py-2 font-medium">Good units</th>
                        <th className="px-3 py-2 font-medium">Received value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.purchases.supplierAnalysis.map((supplier) => (
                        <tr
                          key={supplier.supplierId}
                          className="border-b border-stock-border last:border-0"
                        >
                          <td className="px-3 py-3 font-medium text-stock-primary-text">
                            {supplier.supplierName}
                          </td>
                          <td className="px-3 py-3">{supplier.goodQuantity}</td>
                          <td className="px-3 py-3">
                            {formatMoney(supplier.purchaseValue, currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </article>
          </section>
        )}

        {analytics.inventory && (
          <section className="grid min-w-0 gap-4 xl:grid-cols-2">
            <article className="rounded-xl border border-stock-border bg-white p-5 shadow-sm sm:p-6">
              <h2 className="text-base font-semibold text-stock-deep-navy">
                Inventory Summary
              </h2>
              <p className="mt-1 text-sm text-stock-secondary-text">
                {analytics.inventory.valuationBasis}
              </p>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <MetricCard
                  label="Products"
                  value={String(analytics.inventory.productCount)}
                  href="/products"
                />
                <MetricCard
                  label="Estimated Value"
                  value={formatMoney(analytics.inventory.inventoryValue, currency)}
                />
                <MetricCard
                  label="Low Stock"
                  value={String(analytics.inventory.lowStockCount)}
                  href="/inventory/alerts"
                />
                <MetricCard
                  label="Out of Stock"
                  value={String(analytics.inventory.outOfStockCount)}
                  href="/inventory/alerts"
                />
              </div>
            </article>
            <article className="rounded-xl border border-stock-border bg-white p-5 shadow-sm sm:p-6">
              <h2 className="text-base font-semibold text-stock-deep-navy">
                Stock Movement Summary
              </h2>
              <p className="mt-1 text-sm text-stock-secondary-text">
                Transfer entries can include separate source and destination movements.
              </p>
              {analytics.inventory.movements.length === 0 ? (
                <p className="mt-5 rounded-lg bg-stock-light-grey p-6 text-center text-sm text-stock-secondary-text">
                  No stock movements match this date range.
                </p>
              ) : (
                <ul className="mt-4 divide-y divide-stock-border">
                  {analytics.inventory.movements.map((movement) => (
                    <li
                      key={movement._id}
                      className="flex items-center justify-between gap-3 py-3 text-sm"
                    >
                      <span className="font-medium text-stock-primary-text">
                        {movement._id.replaceAll("_", " ")}
                      </span>
                      <span className="text-right text-stock-secondary-text">
                        {movement.movementCount} entries · {movement.quantity} units
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {analytics.inventory.warehouseBalances.length > 0 && (
                <div className="mt-5 border-t border-stock-border pt-4">
                  <h3 className="text-sm font-semibold text-stock-deep-navy">
                    Reconciled Warehouse Stock
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-stock-secondary-text">
                    {analytics.inventory.warehouseBalanceCoverage.note}
                  </p>
                  <ul className="mt-2 space-y-2 text-sm">
                    {analytics.inventory.warehouseBalances.map((warehouse) => (
                      <li
                        key={warehouse.warehouseId}
                        className="flex justify-between gap-2"
                      >
                        <span>{warehouse.warehouseName}</span>
                        <span>{warehouse.quantity} units</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </article>
          </section>
        )}
      </div>
    </AppShell>
  );
}
