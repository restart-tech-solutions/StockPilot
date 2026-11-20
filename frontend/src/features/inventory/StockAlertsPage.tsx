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

export function StockAlertsPage() {
  const { workspace } = useWorkspace();
  const [alerts, setAlerts] = useState<StockAlertRecord[]>([]);
  const [search, setSearch] = useState("");
  const [condition, setCondition] = useState("");
  const [status, setStatus] = useState("ACTIVE");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!workspace?.id) {
      setAlerts([]);
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
    if (condition) params.set("condition", condition);
    if (search.trim()) params.set("search", search.trim());
    apiRequest<StockAlertResponse>(`/inventory/alerts?${params.toString()}`)
      .then((response) => {
        if (!response.success || !Array.isArray(response.alerts)) {
          throw new Error("Stock alerts could not be loaded.");
        }
        if (active) {
          setAlerts(response.alerts);
          setTotalPages(response.pagination.totalPages);
        }
      })
      .catch((loadError: unknown) => {
        if (active) setError(getErrorMessage(loadError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [workspace?.id, page, condition, status, search]);

  return (
    <AppShell
      mode="business"
      title="Stock Alerts"
      description="Review products at or below their configured minimum stock threshold."
    >
      <section className="rounded-xl border border-stock-border bg-white p-4 shadow-sm sm:p-6">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_12rem_12rem]">
          <label className="text-sm font-medium text-stock-primary-text">
            Search products
            <input
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Product name or SKU"
              className="mt-1 h-10 w-full rounded-lg border border-stock-border px-3 font-normal"
            />
          </label>
          <label className="text-sm font-medium text-stock-primary-text">
            Alert type
            <select
              value={condition}
              onChange={(event) => {
                setCondition(event.target.value);
                setPage(1);
              }}
              className="mt-1 h-10 w-full rounded-lg border border-stock-border bg-white px-3 font-normal"
            >
              <option value="">All alert types</option>
              <option value="LOW_STOCK">Low stock</option>
              <option value="OUT_OF_STOCK">Out of stock</option>
            </select>
          </label>
          <label className="text-sm font-medium text-stock-primary-text">
            State
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
              className="mt-1 h-10 w-full rounded-lg border border-stock-border bg-white px-3 font-normal"
            >
              <option value="ACTIVE">Active</option>
              <option value="RESOLVED">Resolved</option>
            </select>
          </label>
        </div>

        {error && (
          <div
            role="alert"
            className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
          >
            {error}
          </div>
        )}

        {loading ? (
          <p className="py-12 text-center text-sm text-stock-secondary-text">
            Loading stock alerts...
          </p>
        ) : !error && alerts.length === 0 ? (
          <p className="py-12 text-center text-sm text-stock-secondary-text">
            {status === "ACTIVE"
              ? "No active stock alerts."
              : "No stock alerts match these filters."}
          </p>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-stock-border text-xs uppercase text-stock-secondary-text">
                <tr>
                  <th className="px-3 py-3">Product</th>
                  <th className="px-3 py-3">SKU</th>
                  <th className="px-3 py-3">Available stock</th>
                  <th className="px-3 py-3">Minimum</th>
                  <th className="px-3 py-3">Severity</th>
                  <th className="px-3 py-3">Updated</th>
                  <th className="px-3 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stock-border">
                {alerts.map((alert) => (
                  <tr key={alert._id}>
                    <td className="px-3 py-4 font-medium">
                      {alert.productId?.productName ?? "Product unavailable"}
                    </td>
                    <td className="px-3 py-4">
                      {alert.productId?.sku ?? "—"}
                    </td>
                    <td className="px-3 py-4">{alert.currentStock}</td>
                    <td className="px-3 py-4">
                      {alert.minimumStockThreshold}
                    </td>
                    <td className="px-3 py-4">
                      <span
                        className={[
                          "rounded-full px-2.5 py-1 text-xs font-semibold",
                          alert.condition === "OUT_OF_STOCK"
                            ? "bg-red-100 text-red-800"
                            : "bg-amber-100 text-amber-900",
                        ].join(" ")}
                      >
                        {alert.condition === "OUT_OF_STOCK"
                          ? "Out of stock"
                          : "Low stock"}
                      </span>
                      {alert.status === "RESOLVED" && (
                        <span className="ml-2 text-xs text-stock-secondary-text">
                          Resolved
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-4 text-stock-secondary-text">
                      {new Date(alert.updatedAt).toLocaleString()}
                    </td>
                    <td className="px-3 py-4">
                      {alert.productId && (
                        <Link
                          className="font-medium text-stock-primary-blue hover:underline"
                          to={`/purchases/new?productId=${encodeURIComponent(alert.productId._id)}`}
                        >
                          Create purchase
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between border-t border-stock-border pt-4 text-sm">
            <span className="text-stock-secondary-text">
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((value) => value - 1)}
                className="rounded-lg border border-stock-border px-3 py-2 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((value) => value + 1)}
                className="rounded-lg border border-stock-border px-3 py-2 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>
    </AppShell>
  );
}
