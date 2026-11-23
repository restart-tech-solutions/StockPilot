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
type MetricIcon = "products" | "inventory" | "revenue" | "purchases" | "profit" | "low" | "out" | "pending";

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


function normalizeCurrency(currency: string): string {
  const value = String(currency || "").trim().toUpperCase();

  // Handles values such as 5009INR
  const match = value.match(/([A-Z]{3})$/);

  return match ? match[1] : "INR";
}

function formatMoney(value: number | null, currency: string): string {
  if (value === null || !Number.isFinite(value)) {
    return "Unavailable";
  }

  const currencyCode = normalizeCurrency(currency);

  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `₹${value.toFixed(2)}`;
  }
}

function errorMessage(error: unknown): string {
  return error instanceof StockPilotApiError
    ? error.message
    : error instanceof Error
      ? error.message
      : "The dashboard could not be loaded.";
}

function MetricIconView({ name }: { name: MetricIcon }) {
  const common = {
    className: "h-5 w-5",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    viewBox: "0 0 24 24",
    "aria-hidden": true as const,
  };

  switch (name) {
    case "products":
      return <svg {...common}><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 12 9 5 9-5M3 16l9 5 9-5" /></svg>;
    case "inventory":
      return <svg {...common}><path d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5v-9Z" /><path d="m4.5 7.8 7.5 4.3 7.5-4.3M12 12v9" /></svg>;
    case "revenue":
      return <svg {...common}><path d="M12 2v20M17 6.5c-.8-1-2.3-1.5-4.5-1.5-2.5 0-4 1.1-4 3s1.5 3 4.5 3 4.5 1.1 4.5 3-1.7 3.5-4.5 3.5c-2.1 0-3.8-.7-4.8-1.8" /></svg>;
    case "purchases":
      return <svg {...common}><path d="M3 7h18l-2 13H5L3 7Z" /><path d="M8 7a4 4 0 0 1 8 0M9 11v.01M15 11v.01" /></svg>;
    case "profit":
      return <svg {...common}><path d="m4 16 5-5 4 3 7-8" /><path d="M14 6h6v6" /></svg>;
    case "low":
      return <svg {...common}><path d="M12 3 2.8 19h18.4L12 3Z" /><path d="M12 9v4m0 3h.01" /></svg>;
    case "out":
      return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="m9 9 6 6m0-6-6 6" /></svg>;
    case "pending":
      return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
  }
}

function MetricCard({
  label,
  value,
  href,
  note,
  tone = "blue",
  icon,
}: {
  label: string;
  value: string;
  href: string;
  note?: string;
  tone?: "blue" | "teal" | "amber" | "rose" | "violet";
  icon: MetricIcon;
}) {
  const toneStyles = {
    blue: "bg-blue-50 text-blue-700 ring-blue-100",
    teal: "bg-teal-50 text-teal-700 ring-teal-100",
    amber: "bg-amber-50 text-amber-700 ring-amber-100",
    rose: "bg-rose-50 text-rose-700 ring-rose-100",
    violet: "bg-violet-50 text-violet-700 ring-violet-100",
  };

  return (
    <Link
      to={href}
      className="group flex min-h-[166px] min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm font-medium leading-5 text-slate-500">{label}</span>
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ${toneStyles[tone]}`}>
          <MetricIconView name={icon} />
        </span>
      </div>
      <span className="mt-4 break-words text-2xl font-bold tracking-tight text-[#10213D] sm:text-[27px]">
        {value}
      </span>
      <div className="mt-auto flex items-end justify-between gap-2 pt-3">
        {note ? (
          <span className="text-xs leading-5 text-slate-400">{note}</span>
        ) : (
          <span className="text-xs text-slate-400">View details</span>
        )}
        <span className="shrink-0 text-blue-700 opacity-0 transition group-hover:translate-x-1 group-hover:opacity-100" aria-hidden="true">→</span>
      </div>
    </Link>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && (
          <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.16em] text-blue-600">
            {eyebrow}
          </p>
        )}
        <h2 className="text-lg font-bold tracking-tight text-[#10213D]">{title}</h2>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {action}
    </div>
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

  const canViewFinancial =
    workspace?.membershipRole === "BUSINESS_OWNER" ||
    workspace?.membershipRole === "ACCOUNTANT" ||
    (workspace?.ownerId === user?.id && Boolean(user?.id)) ||
    user?.role === "BUSINESS_OWNER";

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

  // Keep these values non-optional for TypeScript while loading/error states render separately.
  const businessName =
    state.status === "loaded"
      ? state.business.businessName
      : workspace?.businessName ?? "your business";
  const analytics: DashboardAnalytics =
    state.status === "loaded" ? state.analytics : {};
  const currency =
    (state.status === "loaded" ? state.business.currency : undefined) ??
    workspace?.currency ??
    "INR";
  const periodLabel =
    period === "last-90-days"
      ? "Last 90 days"
      : period === "last-month"
        ? "Last month"
        : "This month";

  return (
    <AppShell
      mode="business"
      title="Business Dashboard"
      description={
        state.status === "loaded"
          ? `${state.business.businessName} · ${currency}`
          : "Your business performance at a glance"
      }
      action={
        <label className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 shadow-sm">
          <span className="text-xs font-semibold text-slate-500">Period</span>
          <select
            aria-label="Dashboard period"
            value={period}
            onChange={(event) => setPeriod(event.target.value as DashboardPeriod)}
            className="min-w-0 bg-transparent text-sm font-semibold text-[#10213D] outline-none"
          >
            <option value="this-month">This Month</option>
            <option value="last-month">Last Month</option>
            <option value="last-90-days">Last 90 Days</option>
          </select>
        </label>
      }
    >
      <div className="space-y-8">
        {state.status === "idle" && (
          <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
              <MetricIconView name="inventory" />
            </div>
            <h2 className="mt-4 text-xl font-bold text-[#10213D]">No workspace selected</h2>
            <p className="mt-2 text-sm text-slate-500">
              Choose a business workspace to view its dashboard.
            </p>
            <Link
              to="/workspaces"
              className="mt-5 inline-flex h-11 items-center rounded-xl bg-[#174A91] px-5 text-sm font-semibold text-white transition hover:bg-[#123B77]"
            >
              Select workspace
            </Link>
          </section>
        )}

        {state.status === "loading" && (
          <div role="status" className="space-y-5">
            <div className="animate-pulse rounded-2xl bg-[#10213D] p-7">
              <div className="h-3 w-36 rounded bg-white/20" />
              <div className="mt-4 h-7 w-64 max-w-full rounded bg-white/20" />
              <div className="mt-3 h-4 w-80 max-w-full rounded bg-white/10" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[1, 2, 3, 4].map((item) => (
                <div key={item} className="h-40 animate-pulse rounded-2xl border border-slate-200 bg-white" />
              ))}
            </div>
            <p className="text-sm text-slate-500">Loading your business analytics…</p>
          </div>
        )}

        {state.status === "error" && (
          <section
            role="alert"
            className="flex flex-col gap-4 rounded-2xl border border-red-200 bg-red-50 p-5 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <h2 className="font-semibold text-red-900">Dashboard unavailable</h2>
              <p className="mt-1 text-sm text-red-800">{state.message}</p>
            </div>
            <button
              type="button"
              onClick={() => setRetryCount((current) => current + 1)}
              className="h-10 shrink-0 rounded-xl border border-red-300 bg-white px-4 text-sm font-semibold text-red-800 transition hover:bg-red-100"
            >
              Try again
            </button>
          </section>
        )}

        {state.status === "loaded" && (
          <>
            {/* Welcome banner */}
            <section className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#10213D] via-[#14345F] to-[#174A91] p-6 shadow-sm sm:p-8">
              <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-blue-400/15 blur-3xl" />
              <div className="absolute -bottom-28 right-1/3 h-56 w-56 rounded-full bg-cyan-300/10 blur-3xl" />
              <div className="relative z-10 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="max-w-2xl">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-200">
                    BUSINESS OVERVIEW
                  </p>
                  <h2 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl">
                    Welcome to {businessName}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-200">
                    Here’s what’s happening in your business for {periodLabel.toLowerCase()}.
                    Review performance, inventory health and sales activity.
                  </p>
                </div>
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-blue-100">
                  <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                    <path d="M3 20h18M5 20V8l7-4 7 4v12M9 20v-6h6v6M9 9h.01M15 9h.01" />
                  </svg>
                </div>
              </div>
            </section>

            {!canViewFinancial && !analytics.inventory && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                Dashboard analytics are restricted for your workspace role.
              </div>
            )}

            {/* KPI cards */}
            {analytics.overview && (
              <section aria-label="Business key performance indicators">
                <SectionHeading
                  eyebrow="Performance snapshot"
                  title="Business at a glance"
                  description="Key figures for the selected reporting period."
                />
                <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <MetricCard label="Total Products" value={String(analytics.overview.productCount)} href="/products" icon="products" tone="blue" />
                  <MetricCard label="Estimated Inventory Value" value={formatMoney(analytics.overview.inventoryValue, currency)} note="Current purchase prices; not FIFO or average cost." href="/reports/inventory" icon="inventory" tone="teal" />
                  <MetricCard label="Sales Revenue" value={formatMoney(analytics.overview.totalSalesRevenue, currency)} note="Net of recorded returns and discounts; excludes tax." href="/reports/sales" icon="revenue" tone="violet" />
                  <MetricCard label="Received Purchase Value" value={formatMoney(analytics.overview.purchaseValue, currency)} note="Received goods; excludes damaged goods and tax." href="/reports/purchases" icon="purchases" tone="blue" />
                  <MetricCard label="Estimated Gross Profit" value={formatMoney(analytics.overview.estimatedGrossProfit, currency)} note={analytics.overview.estimatedGrossProfit === null ? `${analytics.overview.grossProfitCostCoverage.ordersWithMissingCostSnapshot} order(s) lack cost snapshots.` : "Excludes tax and operating expenses; not net profit."} href="/reports/sales" icon="profit" tone="teal" />
                  <MetricCard label="Low Stock Products" value={String(analytics.overview.lowStockCount)} href="/inventory/alerts" icon="low" tone="amber" />
                  <MetricCard label="Out of Stock Products" value={String(analytics.overview.outOfStockCount)} href="/inventory/alerts" icon="out" tone="rose" />
                  <MetricCard label="Pending Purchase Orders" value={String(analytics.overview.pendingPurchaseOrders)} href="/purchases" icon="pending" tone="violet" />
                </div>
              </section>
            )}

            {analytics.inventory && !analytics.overview && (
              <section aria-label="Inventory key performance indicators">
                <SectionHeading
                  eyebrow="Inventory snapshot"
                  title="Stock health"
                  description="Inventory metrics available for your workspace role."
                />
                <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <MetricCard label="Total Products" value={String(analytics.inventory.productCount)} href="/products" icon="products" tone="blue" />
                  <MetricCard label="Estimated Inventory Value" value={formatMoney(analytics.inventory.inventoryValue, currency)} note={analytics.inventory.valuationBasis} href="/reports/inventory" icon="inventory" tone="teal" />
                  <MetricCard label="Low Stock Products" value={String(analytics.inventory.lowStockCount)} href="/inventory/alerts" icon="low" tone="amber" />
                  <MetricCard label="Out of Stock Products" value={String(analytics.inventory.outOfStockCount)} href="/inventory/alerts" icon="out" tone="rose" />
                </div>
              </section>
            )}

            {/* Sales analytics */}
            {analytics.sales && (
              <section>
                <SectionHeading
                  eyebrow="Sales performance"
                  title="Revenue analytics"
                  description={`${periodLabel} · revenue excludes tax`}
                  action={
                    <Link to="/analytics" className="text-sm font-semibold text-blue-700 hover:text-blue-900">
                      View full analytics →
                    </Link>
                  }
                />
                <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)]">
                  <article className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="font-bold text-[#10213D]">Sales revenue trend</h3>
                        <p className="mt-1 text-xs text-slate-500">Daily performance for the selected period</p>
                      </div>
                      <span className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
                        {periodLabel}
                      </span>
                    </div>
                    {analytics.sales.trend.length === 0 ? (
                      <div className="mt-5 flex min-h-64 flex-col items-center justify-center rounded-xl bg-slate-50 px-5 text-center">
                        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-slate-400 shadow-sm">
                          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.7">
                            <path d="M4 19V5m0 14h16M7 15l4-4 3 2 5-6" />
                          </svg>
                        </span>
                        <p className="mt-3 text-sm font-semibold text-slate-700">No sales data yet</p>
                        <p className="mt-1 text-xs text-slate-500">No completed sales match this period.</p>
                      </div>
                    ) : (
                      <div className="mt-5 h-72 min-w-0">
                        <Suspense fallback={<div className="flex h-72 items-center justify-center text-sm text-slate-500">Loading sales chart…</div>}>
                          <SalesRevenueChart data={analytics.sales.trend} currency={currency} />
                        </Suspense>
                      </div>
                    )}
                  </article>

                  <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                    <h3 className="font-bold text-[#10213D]">Sales overview</h3>
                    <p className="mt-1 text-xs text-slate-500">Order status breakdown</p>
                    <div className="mt-5 space-y-4">
                      <div className="flex items-center justify-between gap-3 rounded-xl bg-emerald-50 p-3">
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-emerald-500" />
                          <span className="text-sm font-medium text-slate-700">Completed</span>
                        </div>
                        <span className="text-lg font-bold text-emerald-800">{analytics.sales.orderCounts.completed}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3">
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-slate-400" />
                          <span className="text-sm font-medium text-slate-700">Cancelled</span>
                        </div>
                        <span className="text-lg font-bold text-slate-800">{analytics.sales.orderCounts.cancelled}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3 rounded-xl bg-amber-50 p-3">
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-amber-500" />
                          <span className="text-sm font-medium text-slate-700">Returned</span>
                        </div>
                        <span className="text-lg font-bold text-amber-800">{analytics.sales.orderCounts.returned}</span>
                      </div>
                    </div>
                    <Link
                      to="/sales"
                      className="mt-5 inline-flex h-10 w-full items-center justify-center rounded-xl border border-slate-200 text-sm font-semibold text-blue-700 transition hover:border-blue-200 hover:bg-blue-50"
                    >
                      Manage sales →
                    </Link>
                  </article>
                </div>
              </section>
            )}

            {/* Top products */}
            {analytics.sales && analytics.sales.topProducts.length > 0 && (
              <section>
                <SectionHeading
                  eyebrow="Product performance"
                  title="Top-selling products"
                  description="Products ranked by net quantity sold in this period."
                  action={
                    <Link to="/products" className="text-sm font-semibold text-blue-700 hover:text-blue-900">
                      View products →
                    </Link>
                  }
                />
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[34rem] text-left text-sm">
                      <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-5 py-4 font-semibold">Product</th>
                          <th className="px-5 py-4 font-semibold">Net quantity</th>
                          <th className="px-5 py-4 text-right font-semibold">Sales revenue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analytics.sales.topProducts.map((product, index) => (
                          <tr key={product.productId} className="border-t border-slate-100 transition hover:bg-slate-50/70">
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-3">
                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-xs font-bold text-blue-700">
                                  {index + 1}
                                </span>
                                <div className="min-w-0">
                                  <p className="truncate font-semibold text-[#10213D]">{product.productName}</p>
                                  <p className="mt-0.5 text-xs text-slate-400">{product.sku}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-5 py-4 font-medium text-slate-700">{product.quantity}</td>
                            <td className="px-5 py-4 text-right font-semibold text-[#10213D]">
                              {formatMoney(product.salesRevenue, currency)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            )}

            {analytics.overview?.estimatedGrossProfit === null && (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">
                Gross profit is unavailable when included sales have no unit-cost snapshot. Inventory value is estimated using current product purchase prices.
              </p>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
