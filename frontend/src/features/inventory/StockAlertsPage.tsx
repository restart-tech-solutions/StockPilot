
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AppShell } from "../../components/layout/AppShell";
import { apiRequest, StockPilotApiError } from "../../services/api";
import { useWorkspace } from "../workspace/workspaceContext";

interface ProductSummary {
  _id: string;
  productName: string;
  sku: string;
  currentStock: number;
  minimumStockThreshold: number;
}

interface StockAlertRecord {
  _id: string;
  condition: "LOW_STOCK" | "OUT_OF_STOCK";
  status: "ACTIVE" | "RESOLVED";
  currentStock: number;
  minimumStockThreshold: number;
  updatedAt: string;
  productId: ProductSummary | null;
}

interface StockAlertResponse {
  success: boolean;
  alerts: StockAlertRecord[];
  pagination: { page: number; totalPages: number; total: number };
}

function getErrorMessage(error: unknown): string {
  return error instanceof StockPilotApiError
    ? error.message
    : "Unable to load stock alerts.";
}

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function AlertBadge({ condition }: { condition: StockAlertRecord["condition"] }) {
  const isOutOfStock = condition === "OUT_OF_STOCK";

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${
        isOutOfStock
          ? "bg-red-50 text-red-700"
          : "bg-amber-50 text-amber-700"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          isOutOfStock ? "bg-red-500" : "bg-amber-500"
        }`}
      />
      {isOutOfStock ? "Out of stock" : "Low stock"}
    </span>
  );
}

function SummaryCard({
  label,
  value,
  description,
  icon,
  iconClass,
}: {
  label: string;
  value: number;
  description: string;
  icon: string;
  iconClass: string;
}) {
  return (
    <div className="rounded-2xl border border-stock-border bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-stock-secondary-text">
            {label}
          </p>
          <p className="mt-3 text-3xl font-bold tracking-tight text-stock-primary-text">
            {value}
          </p>
          <p className="mt-2 text-xs text-stock-secondary-text">
            {description}
          </p>
        </div>

        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl font-bold ${iconClass}`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

export function StockAlertsPage() {
  const { workspace } = useWorkspace();

  const [alerts, setAlerts] = useState<StockAlertRecord[]>([]);
  const [search, setSearch] = useState("");
  const [condition, setCondition] = useState("");
  const [status, setStatus] = useState("ACTIVE");

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalAlerts, setTotalAlerts] = useState(0);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    if (!workspace?.id) {
      setAlerts([]);
      setTotalPages(0);
      setTotalAlerts(0);
      setLoading(false);
      return;
    }

    let active = true;

    setLoading(true);
    setError("");

    const params = new URLSearchParams({
      businessId: workspace.id,
      page: String(page),
      limit: "20",
      status,
    });

    if (condition) {
      params.set("condition", condition);
    }

    if (search.trim()) {
      params.set("search", search.trim());
    }

    apiRequest<StockAlertResponse>(
      `/inventory/alerts?${params.toString()}`
    )
      .then((response) => {
        if (!response.success || !Array.isArray(response.alerts)) {
          throw new Error("Stock alerts could not be loaded.");
        }

        if (active) {
          setAlerts(response.alerts);
          setTotalPages(response.pagination.totalPages);
          setTotalAlerts(response.pagination.total);
        }
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(getErrorMessage(loadError));
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [workspace?.id, page, condition, status, search, refresh]);

  const lowStockCount = alerts.filter(
    (alert) => alert.condition === "LOW_STOCK"
  ).length;

  const outOfStockCount = alerts.filter(
    (alert) => alert.condition === "OUT_OF_STOCK"
  ).length;

  const resetFilters = () => {
    setSearch("");
    setCondition("");
    setStatus("ACTIVE");
    setPage(1);
  };

  return (
    <AppShell
      mode="business"
      title="Stock Alerts"
      description="Monitor products that need attention and keep your inventory healthy."
    >
      {!workspace?.id ? (
        <section className="rounded-2xl border border-stock-border bg-white p-6 shadow-sm">
          <p className="text-sm text-stock-secondary-text">
            Select a business workspace to view stock alerts.
          </p>
        </section>
      ) : (
        <div className="space-y-6">
          {/* Hero section */}
          <section className="rounded-2xl border border-stock-border bg-white p-5 shadow-sm sm:p-7">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <span className="inline-flex rounded-lg bg-blue-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-stock-primary-blue">
                  Inventory monitoring
                </span>

                <h2 className="mt-3 text-xl font-bold tracking-tight text-stock-primary-text sm:text-2xl">
                  Stay ahead of stock shortages
                </h2>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-stock-secondary-text">
                  Identify low-stock and unavailable products before they
                  affect your business operations.
                </p>
              </div>

              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-2xl text-stock-primary-blue">
                !
              </div>
            </div>
          </section>

          {/* Summary cards */}
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <SummaryCard
              label="Total matching alerts"
              value={totalAlerts}
              description="Based on the selected filters"
              icon="▦"
              iconClass="bg-blue-50 text-blue-700"
            />

            <SummaryCard
              label="Low stock"
              value={lowStockCount}
              description="On the current page"
              icon="!"
              iconClass="bg-amber-50 text-amber-700"
            />

            <SummaryCard
              label="Out of stock"
              value={outOfStockCount}
              description="On the current page"
              icon="×"
              iconClass="bg-red-50 text-red-700"
            />
          </section>

          {/* Filters */}
          <section className="rounded-2xl border border-stock-border bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-stock-primary-blue">
                  ALERT MANAGEMENT
                </p>
                <h3 className="mt-2 text-lg font-bold text-stock-primary-text">
                  Find stock alerts
                </h3>
                <p className="mt-1 text-sm text-stock-secondary-text">
                  Search products and refine your alert list.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setRefresh((value) => value + 1)}
                disabled={loading}
                className="h-10 rounded-xl border border-stock-border px-4 text-sm font-semibold text-stock-primary-text transition hover:bg-slate-50 disabled:opacity-50"
              >
                ↻ Refresh
              </button>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_12rem_12rem]">
              <label className="block text-sm font-medium text-stock-primary-text">
                Search products
                <input
                  type="search"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Search by product name or SKU..."
                  className="mt-2 h-12 w-full rounded-xl border border-stock-border bg-white px-4 text-sm font-normal outline-none transition placeholder:text-slate-400 focus:border-stock-primary-blue focus:ring-2 focus:ring-blue-100"
                />
              </label>

              <label className="block text-sm font-medium text-stock-primary-text">
                Alert type
                <select
                  value={condition}
                  onChange={(event) => {
                    setCondition(event.target.value);
                    setPage(1);
                  }}
                  className="mt-2 h-12 w-full rounded-xl border border-stock-border bg-white px-3 text-sm font-normal outline-none transition focus:border-stock-primary-blue focus:ring-2 focus:ring-blue-100"
                >
                  <option value="">All alert types</option>
                  <option value="LOW_STOCK">Low stock</option>
                  <option value="OUT_OF_STOCK">Out of stock</option>
                </select>
              </label>

              <label className="block text-sm font-medium text-stock-primary-text">
                Alert status
                <select
                  value={status}
                  onChange={(event) => {
                    setStatus(event.target.value);
                    setPage(1);
                  }}
                  className="mt-2 h-12 w-full rounded-xl border border-stock-border bg-white px-3 text-sm font-normal outline-none transition focus:border-stock-primary-blue focus:ring-2 focus:ring-blue-100"
                >
                  <option value="ACTIVE">Active</option>
                  <option value="RESOLVED">Resolved</option>
                </select>
              </label>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-stock-border pt-4">
              <p className="text-xs text-stock-secondary-text">
                Showing {alerts.length} records on this page
              </p>

              <button
                type="button"
                onClick={resetFilters}
                className="text-sm font-semibold text-stock-primary-blue transition hover:underline"
              >
                Clear filters
              </button>
            </div>
          </section>

          {/* Error state */}
          {error && (
            <div
              role="alert"
              className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between"
            >
              <p>{error}</p>
              <button
                type="button"
                onClick={() => setRefresh((value) => value + 1)}
                className="shrink-0 font-semibold underline"
              >
                Try again
              </button>
            </div>
          )}

          {/* Alerts table */}
          <section className="overflow-hidden rounded-2xl border border-stock-border bg-white shadow-sm">
            <div className="flex flex-col gap-2 border-b border-stock-border p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-bold text-stock-primary-text">
                  Stock alert records
                </h3>
                <p className="mt-1 text-xs text-stock-secondary-text">
                  Review product availability and take action.
                </p>
              </div>

              <span className="text-xs font-medium text-stock-secondary-text">
                Page {page} of {totalPages || 1}
              </span>
            </div>

            {loading ? (
              <div
                role="status"
                className="flex flex-col items-center justify-center px-5 py-16"
              >
                <span className="h-8 w-8 animate-spin rounded-full border-2 border-blue-200 border-t-stock-primary-blue" />
                <p className="mt-4 text-sm text-stock-secondary-text">
                  Loading stock alerts...
                </p>
              </div>
            ) : !error && alerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-5 py-16 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-2xl font-bold text-emerald-600">
                  ✓
                </div>

                <h3 className="mt-4 font-bold text-stock-primary-text">
                  {status === "ACTIVE"
                    ? "No active stock alerts"
                    : "No matching stock alerts"}
                </h3>

                <p className="mt-2 max-w-md text-sm leading-6 text-stock-secondary-text">
                  {status === "ACTIVE"
                    ? "Your current filters have no active stock alerts. Your inventory is clear of matching alerts."
                    : "Try changing the search term or filters to find other stock alerts."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[850px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-stock-secondary-text">
                    <tr>
                      <th className="px-5 py-4 font-semibold">Product</th>
                      <th className="px-5 py-4 font-semibold">SKU</th>
                      <th className="px-5 py-4 font-semibold">Available</th>
                      <th className="px-5 py-4 font-semibold">Minimum</th>
                      <th className="px-5 py-4 font-semibold">Severity</th>
                      <th className="px-5 py-4 font-semibold">Updated</th>
                      <th className="px-5 py-4 font-semibold">Action</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-stock-border">
                    {alerts.map((alert) => (
                      <tr
                        key={alert._id}
                        className="transition hover:bg-slate-50/70"
                      >
                        <td className="px-5 py-4">
                          <p className="font-semibold text-stock-primary-text">
                            {alert.productId?.productName ??
                              "Product unavailable"}
                          </p>
                          <p className="mt-1 text-xs text-stock-secondary-text">
                            Product inventory
                          </p>
                        </td>

                        <td className="px-5 py-4 text-stock-secondary-text">
                          {alert.productId?.sku ?? "—"}
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`font-bold ${
                              alert.condition === "OUT_OF_STOCK"
                                ? "text-red-600"
                                : "text-amber-700"
                            }`}
                          >
                            {alert.currentStock.toLocaleString("en-IN")}
                          </span>
                        </td>

                        <td className="px-5 py-4 font-medium text-stock-primary-text">
                          {alert.minimumStockThreshold.toLocaleString("en-IN")}
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex flex-col items-start gap-2">
                            <AlertBadge condition={alert.condition} />

                            {alert.status === "RESOLVED" && (
                              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                                Resolved
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="whitespace-nowrap px-5 py-4 text-xs text-stock-secondary-text">
                          {formatDate(alert.updatedAt)}
                        </td>

                        <td className="px-5 py-4">
                          {alert.productId ? (
                            <Link
                              className="inline-flex h-9 items-center justify-center whitespace-nowrap rounded-lg bg-blue-50 px-3 text-xs font-semibold text-stock-primary-blue transition hover:bg-blue-100"
                              to={`/purchases/new?productId=${encodeURIComponent(alert.productId._id)}`}
                            >
                              Create purchase →
                            </Link>
                          ) : (
                            <span className="text-xs text-stock-secondary-text">
                              Unavailable
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Pagination */}
          {!loading && totalPages > 1 && (
            <section className="flex flex-col gap-3 rounded-2xl border border-stock-border bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-stock-secondary-text">
                Page{" "}
                <strong className="text-stock-primary-text">{page}</strong>{" "}
                of{" "}
                <strong className="text-stock-primary-text">
                  {totalPages}
                </strong>
              </p>

              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((value) => value - 1)}
                  className="h-10 rounded-xl border border-stock-border px-4 text-sm font-semibold text-stock-primary-text transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  ← Previous
                </button>

                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((value) => value + 1)}
                  className="h-10 rounded-xl border border-stock-border px-4 text-sm font-semibold text-stock-primary-text transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next →
                </button>
              </div>
            </section>
          )}
        </div>
      )}
    </AppShell>
  );
}
