import { lazy, Suspense, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AppShell } from "../../components/layout/AppShell";
import { apiRequest, StockPilotApiError } from "../../services/api";
import { useAuth } from "../auth/authContext";
import { useWorkspace } from "../workspace/workspaceContext";
import type {
  AnalyticsResponse,
  InventoryAnalytics,
  OverviewAnalytics,
  PurchaseAnalytics,
  SalesAnalytics,
} from "../analytics/analytics.types";

const SalesRevenueChart = lazy(() =>
  import("../analytics/SalesRevenueChart").then((module) => ({
    default: module.SalesRevenueChart,
  }))
);

type DashboardPeriod = "this-month" | "last-month" | "last-90-days";

interface BusinessSummary {
  id: string;
  businessName: string;
  currency: string;
  ownerId?: string;
  membershipRole?: string;
}

interface BusinessDetailResponse {
  success: boolean;
  business: BusinessSummary;
}

interface DashboardAnalytics {
  overview?: OverviewAnalytics;
  sales?: SalesAnalytics;
  purchases?: PurchaseAnalytics;
  inventory?: InventoryAnalytics;
}

type DashboardState =
  | { status: "idle" }
  | { status: "loading" }
  | {
      status: "loaded";
      business: BusinessSummary;
      analytics: DashboardAnalytics;
    }
  | { status: "error"; message: string };

type DashboardResult =
  | { kind: "overview"; value: OverviewAnalytics }
  | { kind: "sales"; value: SalesAnalytics }
  | { kind: "purchases"; value: PurchaseAnalytics }
  | { kind: "inventory"; value: InventoryAnalytics };

function dateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function rangeFor(period: DashboardPeriod): { from: string; to: string } {
  const today = new Date();
  const currentMonthStart = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)
  );
  if (period === "this-month") {
    return { from: dateString(currentMonthStart), to: dateString(today) };
  }
  if (period === "last-month") {
    const lastMonthStart = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1)
    );
    const lastMonthEnd = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0)
    );
    return { from: dateString(lastMonthStart), to: dateString(lastMonthEnd) };
  }
  const start = new Date(today);
  start.setUTCDate(start.getUTCDate() - 89);
  return { from: dateString(start), to: dateString(today) };
}

function formatMoney(value: number | null, currency: string): string {
  if (value === null || !Number.isFinite(value)) return "Unavailable";
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
    : "The dashboard could not be loaded.";
}

function MetricCard({
  label,
  value,
  href,
  note,
  tone,
}: {
  label: string;
  value: string;
  href: string;
  note?: string;
  tone?: "low" | "out";
}) {
  const toneClass =
    tone === "low"
      ? "border-amber-300 bg-amber-50 hover:border-amber-400"
      : tone === "out"
        ? "border-rose-300 bg-rose-50 hover:border-rose-400"
        : "border-stock-border bg-white hover:border-stock-primary-blue";

  return (
    <Link
      to={href}
      className={`flex min-h-32 min-w-0 flex-col rounded-xl border p-5 shadow-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stock-primary-blue ${toneClass}`}
    >
      <span className="text-sm font-medium text-stock-secondary-text">{label}</span>
      <span className="mt-3 break-words text-xl font-semibold text-stock-deep-navy">
        {value}
      </span>
      {note && (
        <span className="mt-auto pt-2 text-xs leading-5 text-stock-secondary-text">
          {note}
        </span>
      )}
    </Link>
  );
}

export function BusinessDashboardPage() {
  const { workspace, setWorkspace } = useWorkspace();
  const { user } = useAuth();
  const [period, setPeriod] = useState<DashboardPeriod>("this-month");
  const [retryCount, setRetryCount] = useState(0);
  const [state, setState] = useState<DashboardState>(() =>
    workspace ? { status: "loading" } : { status: "idle" }
  );
  const range = rangeFor(period);

  const effectiveRole =
    workspace?.membershipRole ||
    (workspace?.ownerId && user?.id === workspace.ownerId
      ? "BUSINESS_OWNER"
      : undefined) ||
    (user?.role === "BUSINESS_OWNER" ? "BUSINESS_OWNER" : undefined);
  const canViewFinancial =
    effectiveRole === "BUSINESS_OWNER" || effectiveRole === "ACCOUNTANT";
  const canViewPurchases =
    canViewFinancial || effectiveRole === "INVENTORY_MANAGER";

  useEffect(() => {
    if (!workspace?.id) {
      setState({ status: "idle" });
      return;
    }
    let active = true;
    setState({ status: "loading" });

    const query = new URLSearchParams({
      businessId: workspace.id,
      from: range.from,
      to: range.to,
    }).toString();

    void (async () => {
      try {
        const businessResponse = await apiRequest<BusinessDetailResponse>(
          `/business/${encodeURIComponent(workspace.id)}`
        );
        if (
          !businessResponse.success ||
          businessResponse.business?.id !== workspace.id
        ) {
          throw new Error("The selected business workspace could not be verified.");
        }

        const resolvedRole =
          businessResponse.business.membershipRole ||
          workspace.membershipRole ||
          (workspace.ownerId && user?.id === workspace.ownerId
            ? "BUSINESS_OWNER"
            : undefined) ||
          (user?.role === "BUSINESS_OWNER" ? "BUSINESS_OWNER" : undefined);

        if (
          businessResponse.business.membershipRole &&
          workspace.membershipRole !== businessResponse.business.membershipRole
        ) {
          setWorkspace({
            ...workspace,
            ...businessResponse.business,
            membershipRole: businessResponse.business.membershipRole,
          });
        }

        const roleCanViewFinancial =
          resolvedRole === "BUSINESS_OWNER" || resolvedRole === "ACCOUNTANT";
        const roleCanViewPurchases =
          roleCanViewFinancial || resolvedRole === "INVENTORY_MANAGER";

        const requests: Promise<DashboardResult>[] = [];

        if (roleCanViewFinancial) {
          requests.push(
            apiRequest<AnalyticsResponse<OverviewAnalytics>>(
              `/analytics/overview?${query}`
            ).then(({ analytics }) => ({ kind: "overview", value: analytics })),
            apiRequest<AnalyticsResponse<SalesAnalytics>>(
              `/analytics/sales?${query}&period=daily`
            ).then(({ analytics }) => ({ kind: "sales", value: analytics }))
          );
        }
        if (roleCanViewPurchases) {
          requests.push(
            apiRequest<AnalyticsResponse<PurchaseAnalytics>>(
              `/analytics/purchases?${query}&period=daily`
            ).then(({ analytics }) => ({ kind: "purchases", value: analytics }))
          );
        }
        if (roleCanViewFinancial || resolvedRole === "INVENTORY_MANAGER") {
          requests.push(
            apiRequest<AnalyticsResponse<InventoryAnalytics>>(
              `/analytics/inventory?${query}`
            ).then(({ analytics }) => ({ kind: "inventory", value: analytics }))
          );
        }

        const results = await Promise.all(requests);
        if (!active) return;
        const analytics: DashboardAnalytics = {};
        for (const result of results) {
          if (result.kind === "overview") analytics.overview = result.value;
          else if (result.kind === "sales") analytics.sales = result.value;
          else if (result.kind === "purchases") analytics.purchases = result.value;
          else analytics.inventory = result.value;
        }
        setState({
          status: "loaded",
          business: businessResponse.business,
          analytics,
        });
      } catch (error: unknown) {
        if (active) setState({ status: "error", message: errorMessage(error) });
      }
    })();

    return () => {
      active = false;
    };
  }, [
    workspace?.id,
    workspace?.membershipRole,
    workspace?.ownerId,
    user?.id,
    user?.role,
    range.from,
    range.to,
    retryCount,
    setWorkspace,
  ]);

  const business =
    state.status === "loaded" ? state.business : undefined;
  const analytics =
    state.status === "loaded" ? state.analytics : undefined;
  const currency = business?.currency ?? workspace?.currency ?? "USD";

  return (
    <AppShell
      mode="business"
      title="Business Dashboard"
      description={
        business
          ? `${business.businessName} · Currency: ${currency}`
          : "Workspace performance overview"
      }
      action={
        <label className="flex h-11 items-center gap-2 rounded-lg border border-stock-border bg-white px-3">
          <span className="text-sm text-stock-secondary-text">Period</span>
          <select
            aria-label="Dashboard period"
            value={period}
            onChange={(event) =>
              setPeriod(event.target.value as DashboardPeriod)
            }
            className="min-w-0 bg-transparent text-sm font-medium text-stock-primary-text outline-none"
          >
            <option value="this-month">This Month</option>
            <option value="last-month">Last Month</option>
            <option value="last-90-days">Last 90 Days</option>
          </select>
        </label>
      }
    >
      <div className="space-y-6">
        {state.status === "idle" && (
          <section className="rounded-xl border border-stock-border bg-white p-5">
            <h2 className="font-semibold text-stock-deep-navy">
              No workspace selected
            </h2>
            <p className="mt-2 text-sm text-stock-secondary-text">
              Choose a business workspace to view its dashboard.
            </p>
            <Link
              to="/workspaces"
              className="mt-4 inline-flex h-10 items-center rounded-lg bg-stock-primary-blue px-4 text-sm font-semibold text-white"
            >
              Select workspace
            </Link>
          </section>
        )}
        {state.status === "loading" && (
          <div
            role="status"
            className="rounded-xl border border-stock-border bg-white p-4 text-sm text-stock-secondary-text"
          >
            Loading dashboard…
          </div>
        )}
        {state.status === "error" && (
          <section
            role="alert"
            className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <p className="text-sm text-red-800">{state.message}</p>
            <button
              type="button"
              onClick={() => setRetryCount((current) => current + 1)}
              className="h-10 rounded-lg border border-red-300 px-4 text-sm font-semibold text-red-800"
            >
              Retry
            </button>
          </section>
        )}

        {state.status === "loaded" &&
          !canViewFinancial &&
!state.analytics.inventory && (            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              Dashboard analytics are restricted for your workspace role.
            </div>
          )}

        {analytics?.overview && (
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
              note="At current purchase prices; not FIFO or average cost."
              href="/reports/inventory"
            />
            <MetricCard
              label="Sales Revenue"
              value={formatMoney(analytics.overview.totalSalesRevenue, currency)}
              note="Net of recorded returns and discounts; excludes tax."
              href="/reports/sales"
            />
            <MetricCard
              label="Received Purchase Value"
              value={formatMoney(analytics.overview.purchaseValue, currency)}
              note="Good received quantities; excludes damaged goods and tax."
              href="/reports/purchases"
            />
            <MetricCard
              label="Estimated Gross Profit"
              value={formatMoney(analytics.overview.estimatedGrossProfit, currency)}
              note={
                analytics.overview.estimatedGrossProfit === null
                  ? `${analytics.overview.grossProfitCostCoverage.ordersWithMissingCostSnapshot} order(s) lack cost snapshots.`
                  : "Excludes tax and operating expenses; not net profit."
              }
              href="/reports/sales"
            />
            <MetricCard
              label="Low Stock Products"
              value={String(analytics.overview.lowStockCount)}
              href="/inventory/alerts"
              tone="low"
            />
            <MetricCard
              label="Out of Stock Products"
              value={String(analytics.overview.outOfStockCount)}
              href="/inventory/alerts"
              tone="out"
            />
            <MetricCard
              label="Pending Purchase Orders"
              value={String(analytics.overview.pendingPurchaseOrders)}
              href="/purchases"
            />
          </section>
        )}

        {analytics?.inventory && !analytics.overview && (
          <section
            aria-label="Inventory key performance indicators"
            className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
          >
            <MetricCard
              label="Total Products"
              value={String(analytics.inventory.productCount)}
              href="/products"
            />
            <MetricCard
              label="Estimated Inventory Value"
              value={formatMoney(analytics.inventory.inventoryValue, currency)}
              note={analytics.inventory.valuationBasis}
              href="/reports/inventory"
            />
            <MetricCard
              label="Low Stock Products"
              value={String(analytics.inventory.lowStockCount)}
              href="/inventory/alerts"
              tone="low"
            />
            <MetricCard
              label="Out of Stock Products"
              value={String(analytics.inventory.outOfStockCount)}
              href="/inventory/alerts"
              tone="out"
            />
          </section>
        )}

        {analytics?.sales && (
          <section className="grid min-w-0 gap-4 xl:grid-cols-[2fr_1fr]">
            <article className="min-w-0 rounded-xl border border-stock-border bg-white p-5 shadow-sm sm:p-6">
              <h2 className="text-base font-semibold text-stock-deep-navy">
                Sales Revenue Trend
              </h2>
              <p className="mt-1 text-sm text-stock-secondary-text">
                {period === "last-90-days" ? "Last 90 days" : period === "last-month" ? "Last month" : "This month"} · excludes tax
              </p>
              {analytics.sales.trend.length === 0 ? (
                <p className="mt-6 rounded-lg bg-stock-light-grey p-8 text-center text-sm text-stock-secondary-text">
                  No completed sales match this period.
                </p>
              ) : (
                <div className="mt-4 h-72 min-w-0">
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
                    />
                  </Suspense>
                </div>
              )}
            </article>
            <article className="rounded-xl border border-stock-border bg-white p-5 shadow-sm sm:p-6">
              <h2 className="text-base font-semibold text-stock-deep-navy">
                Sales Overview
              </h2>
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between gap-2">
                  <dt className="text-stock-secondary-text">Completed</dt>
                  <dd className="font-semibold">{analytics.sales.orderCounts.completed}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-stock-secondary-text">Cancelled</dt>
                  <dd className="font-semibold">{analytics.sales.orderCounts.cancelled}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-stock-secondary-text">Returned</dt>
                  <dd className="font-semibold">{analytics.sales.orderCounts.returned}</dd>
                </div>
              </dl>
              <Link
                to="/analytics"
                className="mt-6 inline-flex text-sm font-semibold text-stock-primary-blue hover:underline"
              >
                View full analytics
              </Link>
            </article>
          </section>
        )}

        {analytics?.sales && analytics.sales.topProducts.length > 0 && (
          <section className="rounded-xl border border-stock-border bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-base font-semibold text-stock-deep-navy">
              Top-Selling Products
            </h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[32rem] text-left text-sm">
                <thead className="border-b border-stock-border text-stock-secondary-text">
                  <tr>
                    <th className="px-3 py-3 font-medium">Product</th>
                    <th className="px-3 py-3 font-medium">Net quantity</th>
                    <th className="px-3 py-3 font-medium">Sales revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.sales.topProducts.map((product) => (
                    <tr
                      key={product.productId}
                      className="border-b border-stock-border last:border-0"
                    >
                      <td className="px-3 py-3">
                        <span className="font-medium">{product.productName}</span>
                        <span className="ml-2 text-xs text-stock-secondary-text">
                          {product.sku}
                        </span>
                      </td>
                      <td className="px-3 py-3">{product.quantity}</td>
                      <td className="px-3 py-3">
                        {formatMoney(product.salesRevenue, currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {analytics?.overview?.estimatedGrossProfit === null && (
          <p className="text-xs leading-5 text-stock-secondary-text">
            Gross profit is unavailable when included sales have no unit-cost snapshot. Inventory value is estimated using current product purchase prices.
          </p>
        )}
      </div>
    </AppShell>
  );
}
