import { useEffect, useState } from "react";
import { AppShell } from "../../components/layout/AppShell";
import { apiRequest, StockPilotApiError } from "../../services/api";
import { useWorkspace } from "../workspace/workspaceContext";

type RiskLevel = "HIGH" | "MEDIUM" | "LOW" | "NO_DATA";
type Confidence = "HIGH" | "MEDIUM" | "LOW";

interface ForecastProduct {
  productId: string;
  productName: string;
  sku: string;
  currentStock: number;
  minimumStockThreshold: number;
  totalSalesLast30Days: number;
  averageDailyDemand: number;
  predictedDemand: number;
  forecastPeriodDays: number;
  stockCoverDays: number | null;
  estimatedStockOutDate: string | null;
  riskLevel: RiskLevel;
  reorderQuantity: number;
  suggestedPurchaseValue: number;
  confidence: Confidence;
  activeSalesDays: number;
}

interface ForecastData {
  generatedAt: string;
  forecastPeriodDays: number;
  historyPeriodDays: number;
  summary: {
    totalProducts: number;
    highRisk: number;
    mediumRisk: number;
    reorderRequired: number;
  };
  forecasts: ForecastProduct[];
}

interface ForecastResponse {
  success: boolean;
  message: string;
  data: ForecastData;
}

function formatMoney(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currency || "INR",
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency || "INR"} ${value.toFixed(2)}`;
  }
}

function formatDate(value: string | null): string {
  if (!value) return "Not available";

  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function riskStyle(risk: RiskLevel): string {
  switch (risk) {
    case "HIGH":
      return "bg-red-50 text-red-700 border-red-200";
    case "MEDIUM":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "LOW":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    default:
      return "bg-slate-100 text-slate-600 border-slate-200";
  }
}

function confidenceStyle(confidence: Confidence): string {
  if (confidence === "HIGH") return "text-emerald-700";
  if (confidence === "MEDIUM") return "text-amber-700";
  return "text-slate-500";
}

function MetricCard({
  label,
  value,
  description,
  color,
}: {
  label: string;
  value: number;
  description: string;
  color: string;
}) {
  return (
    <article className="rounded-xl border border-stock-border bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-stock-secondary-text">
            {label}
          </p>
          <p className="mt-3 text-3xl font-bold text-stock-deep-navy">
            {value}
          </p>
          <p className="mt-2 text-xs text-stock-secondary-text">
            {description}
          </p>
        </div>
        <span className={`mt-1 h-3 w-3 rounded-full ${color}`} />
      </div>
    </article>
  );
}

export function ForecastingPage() {
  const { workspace } = useWorkspace();

  const [horizon, setHorizon] = useState<7 | 30>(7);
  const [data, setData] = useState<ForecastData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState("ALL");

  useEffect(() => {
    if (!workspace?.id) {
      setData(null);
      return;
    }

    let active = true;

    const loadForecast = async () => {
      setLoading(true);
      setError("");

      try {
        const params = new URLSearchParams({
          businessId: workspace.id,
          horizon: String(horizon),
        });

        const response = await apiRequest<ForecastResponse>(
          `/forecasting?${params.toString()}`
        );

        if (!response.success || !response.data) {
          throw new Error("Invalid forecasting response.");
        }

        if (active) {
          setData(response.data);
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof StockPilotApiError
              ? err.message
              : "Unable to load inventory forecasting."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    loadForecast();

    return () => {
      active = false;
    };
  }, [workspace?.id, horizon]);

  const filteredForecasts = (data?.forecasts ?? []).filter((item) => {
    const matchesSearch =
      item.productName.toLowerCase().includes(search.toLowerCase()) ||
      item.sku.toLowerCase().includes(search.toLowerCase());

    const matchesRisk =
      riskFilter === "ALL" || item.riskLevel === riskFilter;

    return matchesSearch && matchesRisk;
  });

  const summary = data?.summary;

  return (
    <AppShell
      mode="business"
      title="Demand Forecasting"
      description="Inventory intelligence and predictive stock planning"
    >
      <div className="space-y-6 pb-8">

        {/* Header */}
        <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-xl font-bold text-stock-deep-navy">
              AI Inventory Forecasting
            </h2>
            <p className="mt-1 text-sm text-stock-secondary-text">
              Understand product demand, stock-out risks and reorder
              recommendations.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <label
              htmlFor="forecast-horizon"
              className="text-sm font-medium text-stock-secondary-text"
            >
              Forecast period
            </label>
            <select
              id="forecast-horizon"
              value={horizon}
              onChange={(event) =>
                setHorizon(Number(event.target.value) as 7 | 30)
              }
              className="rounded-lg border border-stock-border bg-white px-4 py-2.5 text-sm font-medium text-stock-deep-navy outline-none focus:border-stock-primary-blue"
            >
              <option value={7}>Next 7 days</option>
              <option value={30}>Next 30 days</option>
            </select>
          </div>
        </section>

        {/* Error */}
        {error && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <p>{error}</p>
            <button
              onClick={() => setHorizon((current) => current)}
              className="font-semibold underline"
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="rounded-xl border border-stock-border bg-white p-8 text-center text-sm text-stock-secondary-text">
            Generating inventory forecast...
          </div>
        )}

        {/* Summary cards */}
        {!loading && data && (
          <>
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label="Total Products"
                value={summary?.totalProducts ?? 0}
                description="Products analysed"
                color="bg-blue-600"
              />
              <MetricCard
                label="High Stock-out Risk"
                value={summary?.highRisk ?? 0}
                description="Requires immediate attention"
                color="bg-red-500"
              />
              <MetricCard
                label="Medium Stock-out Risk"
                value={summary?.mediumRisk ?? 0}
                description="Monitor upcoming stock needs"
                color="bg-amber-500"
              />
              <MetricCard
                label="Reorder Required"
                value={summary?.reorderRequired ?? 0}
                description="Products with suggested reorder"
                color="bg-emerald-600"
              />
            </section>

            {/* Forecast information */}
            <section className="rounded-xl border border-stock-border bg-white p-5 shadow-sm">
              <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                <div>
                  <h3 className="font-semibold text-stock-deep-navy">
                    Forecast Overview
                  </h3>
                  <p className="mt-1 text-sm text-stock-secondary-text">
                    Demand estimates based on the previous 30 days of
                    completed sales.
                  </p>
                </div>
                <span className="w-fit rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
                  {horizon}-Day Forecast
                </span>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-lg bg-slate-50 p-4">
                  <p className="text-xs text-stock-secondary-text">
                    Historical period
                  </p>
                  <p className="mt-2 text-lg font-semibold text-stock-deep-navy">
                    {data.historyPeriodDays} Days
                  </p>
                </div>
                <div className="rounded-lg bg-slate-50 p-4">
                  <p className="text-xs text-stock-secondary-text">
                    Forecast horizon
                  </p>
                  <p className="mt-2 text-lg font-semibold text-stock-deep-navy">
                    {data.forecastPeriodDays} Days
                  </p>
                </div>
                <div className="rounded-lg bg-slate-50 p-4">
                  <p className="text-xs text-stock-secondary-text">
                    Last generated
                  </p>
                  <p className="mt-2 text-lg font-semibold text-stock-deep-navy">
                    {new Date(data.generatedAt).toLocaleString("en-IN")}
                  </p>
                </div>
              </div>
            </section>

            {/* Recommendations */}
            <section className="overflow-hidden rounded-xl border border-stock-border bg-white shadow-sm">
              <div className="border-b border-stock-border p-5">
                <div>
                  <h3 className="font-semibold text-stock-deep-navy">
                    Product Demand & Reorder Recommendations
                  </h3>
                  <p className="mt-1 text-sm text-stock-secondary-text">
                    Product-wise forecast, stock coverage and suggested
                    replenishment.
                  </p>
                </div>

                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                  <input
                    type="search"
                    placeholder="Search product or SKU..."
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    className="w-full rounded-lg border border-stock-border px-3 py-2.5 text-sm outline-none focus:border-stock-primary-blue sm:max-w-xs"
                  />

                  <select
                    value={riskFilter}
                    onChange={(event) => setRiskFilter(event.target.value)}
                    className="rounded-lg border border-stock-border bg-white px-3 py-2.5 text-sm outline-none focus:border-stock-primary-blue"
                  >
                    <option value="ALL">All risk levels</option>
                    <option value="HIGH">High risk</option>
                    <option value="MEDIUM">Medium risk</option>
                    <option value="LOW">Low risk</option>
                    <option value="NO_DATA">No sales data</option>
                  </select>
                </div>
              </div>

              {filteredForecasts.length === 0 ? (
                <div className="px-5 py-14 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-2xl">
                    {data.forecasts.length === 0 ? "📦" : "🔎"}
                  </div>
                  <h4 className="mt-4 font-semibold text-stock-deep-navy">
                    {data.forecasts.length === 0
                      ? "No products available for forecasting"
                      : "No matching products"}
                  </h4>
                  <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-stock-secondary-text">
                    {data.forecasts.length === 0
                      ? "Add products to your workspace to start generating demand forecasts and inventory recommendations."
                      : "Try changing your search or risk filter to see more products."}
                  </p>
                  {data.forecasts.length === 0 && (
                    <a
                      href="/products/new"
                      className="mt-5 inline-flex rounded-lg bg-stock-primary-blue px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
                    >
                      Add Your First Product
                    </a>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1050px] text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-stock-secondary-text">
                      <tr>
                        <th className="px-5 py-4">Product</th>
                        <th className="px-4 py-4">Current Stock</th>
                        <th className="px-4 py-4">Daily Demand</th>
                        <th className="px-4 py-4">Predicted Demand</th>
                        <th className="px-4 py-4">Stock Cover</th>
                        <th className="px-4 py-4">Stock-out Date</th>
                        <th className="px-4 py-4">Risk</th>
                        <th className="px-4 py-4">Reorder Qty.</th>
                        <th className="px-5 py-4">Confidence</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stock-border">
                      {filteredForecasts.map((item) => (
                        <tr key={item.productId} className="hover:bg-slate-50/70">
                          <td className="px-5 py-4">
                            <p className="font-semibold text-stock-deep-navy">
                              {item.productName}
                            </p>
                            <p className="mt-1 text-xs text-stock-secondary-text">
                              SKU: {item.sku}
                            </p>
                          </td>
                          <td className="px-4 py-4 font-medium text-stock-deep-navy">
                            {item.currentStock}
                            <p className="mt-1 text-xs text-stock-secondary-text">
                              Min: {item.minimumStockThreshold}
                            </p>
                          </td>
                          <td className="px-4 py-4">
                            {item.averageDailyDemand.toFixed(2)}
                          </td>
                          <td className="px-4 py-4 font-semibold text-stock-deep-navy">
                            {item.predictedDemand}
                          </td>
                          <td className="px-4 py-4">
                            {item.stockCoverDays === null
                              ? "N/A"
                              : `${item.stockCoverDays} days`}
                          </td>
                          <td className="px-4 py-4">
                            {formatDate(item.estimatedStockOutDate)}
                          </td>
                          <td className="px-4 py-4">
                            <span
                              className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${riskStyle(item.riskLevel)}`}
                            >
                              {item.riskLevel.replace("_", " ")}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <div className="font-semibold text-stock-deep-navy">
                              {item.reorderQuantity}
                            </div>
                            <p className="mt-1 text-xs text-stock-secondary-text">
                              {formatMoney(
                                item.suggestedPurchaseValue,
                                workspace?.currency || "INR"
                              )}
                            </p>
                          </td>
                          <td className="px-5 py-4">
                            <span
                              className={`text-xs font-semibold ${confidenceStyle(item.confidence)}`}
                            >
                              {item.confidence}
                            </span>
                            <p className="mt-1 text-xs text-stock-secondary-text">
                              {item.activeSalesDays}/30 active days
                            </p>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {filteredForecasts.length > 0 && (
                <div className="border-t border-stock-border px-5 py-3 text-xs text-stock-secondary-text">
                  Showing {filteredForecasts.length} of {data.forecasts.length} products
                </div>
              )}
            </section>

            {/* Methodology */}
            <section className="rounded-xl border border-blue-100 bg-blue-50/60 p-5">
              <h3 className="font-semibold text-stock-deep-navy">
                How StockPilot Forecasts Demand
              </h3>
              <p className="mt-2 text-sm leading-6 text-stock-secondary-text">
                The forecasting engine analyses the previous 30 days of
                completed sales, excluding returned quantities. It combines
                recent 7-day demand (70% weight) and 30-day average demand
                (30% weight) to estimate future product demand. Reorder
                recommendations target approximately 14 days of projected
                demand or the product's minimum stock threshold, whichever
                is higher.
              </p>
              <p className="mt-2 text-xs text-stock-secondary-text">
                Forecasts are statistical estimates, not guaranteed future sales.
                Confidence reflects the number of active sales days in the
                historical period.
              </p>
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
