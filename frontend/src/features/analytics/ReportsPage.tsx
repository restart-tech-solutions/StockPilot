import { useEffect, useState } from "react";
import { AppShell } from "../../components/layout/AppShell";
import {
  apiRequest,
  downloadApiFile,
  StockPilotApiError,
} from "../../services/api";
import { useWorkspace } from "../workspace/workspaceContext";
import type { ReportResponse } from "./analytics.types";

type ReportType = "sales" | "purchases" | "inventory" | "products";

const reportLabels: Record<ReportType, string> = {
  sales: "Sales",
  purchases: "Purchases",
  inventory: "Inventory",
  products: "Product Performance",
};

function currentMonthRange(): { from: string; to: string } {
  const now = new Date();
  return {
    from: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
      .toISOString()
      .slice(0, 10),
    to: now.toISOString().slice(0, 10),
  };
}

function errorMessage(error: unknown): string {
  return error instanceof StockPilotApiError
    ? error.message
    : "The report could not be loaded.";
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined) return "Unavailable";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return new Date(value).toLocaleString();
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function columnLabel(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (letter) => letter.toUpperCase());
}

export function ReportsPage() {
  const { workspace } = useWorkspace();
  const role = workspace?.membershipRole;
  const availableReports: ReportType[] =
    role === "INVENTORY_MANAGER"
      ? ["purchases", "inventory"]
      : role === "SALES_EMPLOYEE"
        ? []
        : ["sales", "purchases", "inventory", "products"];
  const initialReport = availableReports[0] ?? "sales";
  const availableReportKey = availableReports.join(",");
  const [type, setType] = useState<ReportType>(initialReport);
  const [range, setRange] = useState(currentMonthRange);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [exportError, setExportError] = useState("");

  useEffect(() => {
    if (availableReports.length > 0 && !availableReports.includes(type)) {
      setType(initialReport);
    }
  }, [availableReportKey, initialReport, type]);

  useEffect(() => {
    if (!workspace?.id) {
      setReport(null);
      return;
    }
    if (!availableReports.includes(type)) {
      setReport(null);
      setLoading(false);
      setError("");
      return;
    }
    if (range.from && range.to && range.from > range.to) {
      setError("Start date must be on or before end date.");
      return;
    }

    let active = true;
    setLoading(true);
    setError("");
    const params = new URLSearchParams({
      businessId: workspace.id,
      page: String(page),
      limit: "20",
      search,
      from: range.from,
      to: range.to,
    });
    apiRequest<ReportResponse>(
      `/reports/${type}?${params.toString()}`
    )
      .then((response) => {
        if (!response.success || !Array.isArray(response.rows)) {
          throw new Error("The report response was not valid.");
        }
        if (active) setReport(response);
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
  }, [workspace?.id, type, range.from, range.to, search, page, availableReportKey]);

  const exportReport = async (format: "csv" | "xlsx") => {
    if (!workspace?.id || !availableReports.includes(type)) return;
    setExporting(true);
    setExportError("");
    const params = new URLSearchParams({
      businessId: workspace.id,
      from: range.from,
      to: range.to,
      search,
      format,
    });
    try {
      await downloadApiFile(
        `/reports/${type}/export?${params.toString()}`,
        `stockpilot-${type}-report.${format}`
      );
    } catch (exportFailure: unknown) {
      setExportError(errorMessage(exportFailure));
    } finally {
      setExporting(false);
    }
  };

  const rows = report?.rows ?? [];
  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

  return (
    <AppShell
      mode="business"
      title="Reports"
      description="Preview workspace records and export filtered reports as CSV or Excel."
    >
      <div className="space-y-5">
        {!workspace && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Select a business workspace to view its reports.
          </div>
        )}
        {workspace && availableReports.length === 0 && (
          <div
            role="alert"
            className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
          >
            Report access is restricted for your workspace role.
          </div>
        )}

        <section className="rounded-xl border border-stock-border bg-white p-4 shadow-sm sm:p-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <label className="flex flex-col gap-1 text-sm font-medium text-stock-primary-text">
              Report
              <select
                value={type}
                disabled={availableReports.length === 0}
                onChange={(event) => {
                  setType(event.target.value as ReportType);
                  setPage(1);
                }}
                className="h-10 rounded-lg border border-stock-border bg-white px-3"
              >
                {availableReports.map((reportType) => (
                  <option key={reportType} value={reportType}>
                    {reportLabels[reportType]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-stock-primary-text">
              From
              <input
                type="date"
                value={range.from}
                onChange={(event) => {
                  setRange((current) => ({ ...current, from: event.target.value }));
                  setPage(1);
                }}
                className="h-10 rounded-lg border border-stock-border px-3"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-stock-primary-text">
              To
              <input
                type="date"
                value={range.to}
                onChange={(event) => {
                  setRange((current) => ({ ...current, to: event.target.value }));
                  setPage(1);
                }}
                className="h-10 rounded-lg border border-stock-border px-3"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-stock-primary-text md:col-span-2 xl:col-span-1">
              Search
              <input
                type="search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Search report records"
                className="h-10 rounded-lg border border-stock-border px-3"
              />
            </label>
            <div className="flex items-end gap-2">
              <button
                type="button"
                disabled={exporting || !workspace || availableReports.length === 0}
                onClick={() => void exportReport("csv")}
                className="h-10 flex-1 rounded-lg border border-stock-border px-3 text-sm font-semibold text-stock-deep-navy hover:bg-stock-light-grey disabled:opacity-50"
              >
                CSV
              </button>
              <button
                type="button"
                disabled={exporting || !workspace || availableReports.length === 0}
                onClick={() => void exportReport("xlsx")}
                className="h-10 flex-1 rounded-lg bg-stock-primary-blue px-3 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
              >
                Excel
              </button>
            </div>
          </div>
          {type === "inventory" && (
            <p className="mt-4 text-xs leading-5 text-stock-secondary-text">
              Inventory rows are a current snapshot; date filters do not reconstruct historical stock.
            </p>
          )}
          {type === "sales" && (
            <p className="mt-2 text-xs leading-5 text-stock-secondary-text">
              Sales are net of recorded returns and discounts, excluding tax. Estimated gross profit is unavailable for rows without a cost snapshot.
            </p>
          )}
          {type === "purchases" && (
            <p className="mt-2 text-xs leading-5 text-stock-secondary-text">
              Purchase rows represent goods receipts; received value uses purchase-order unit prices and excludes damaged units and tax.
            </p>
          )}
          {exporting && (
            <p role="status" className="mt-3 text-sm text-stock-secondary-text">
              Preparing export…
            </p>
          )}
          {exportError && (
            <p role="alert" className="mt-3 text-sm text-red-700">
              {exportError}
            </p>
          )}
        </section>

        <section className="overflow-hidden rounded-xl border border-stock-border bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stock-border px-4 py-4 sm:px-6">
            <div>
              <h2 className="font-semibold text-stock-deep-navy">
                {reportLabels[type]} Report
              </h2>
              {report && (
                <p className="mt-1 text-xs text-stock-secondary-text">
                  {report.pagination.total} matching row(s)
                  {report.inventorySnapshot
                    ? ` · Snapshot as of ${new Date(
                        report.inventorySnapshot.asOf
                      ).toLocaleString()}`
                    : ""}
                </p>
              )}
            </div>
            {report && report.pagination.totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  className="h-9 rounded-lg border border-stock-border px-3 text-sm disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-sm text-stock-secondary-text">
                  {page} / {report.pagination.totalPages}
                </span>
                <button
                  type="button"
                  disabled={page >= report.pagination.totalPages || loading}
                  onClick={() => setPage((current) => current + 1)}
                  className="h-9 rounded-lg border border-stock-border px-3 text-sm disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </div>

          {loading && (
            <div role="status" className="p-8 text-center text-sm text-stock-secondary-text">
              Loading report…
            </div>
          )}
          {error && (
            <div role="alert" className="m-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              {error}
            </div>
          )}
          {!loading && !error && rows.length === 0 && (
            <div className="p-10 text-center">
              <p className="font-medium text-stock-primary-text">No report data</p>
              <p className="mt-1 text-sm text-stock-secondary-text">
                No records match the selected report filters.
              </p>
            </div>
          )}
          {!loading && !error && rows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[48rem] border-collapse text-left text-sm">
                <thead className="bg-stock-light-grey text-stock-secondary-text">
                  <tr>
                    {columns.map((column) => (
                      <th
                        key={column}
                        scope="col"
                        className="whitespace-nowrap px-4 py-3 font-medium"
                      >
                        {columnLabel(column)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, rowIndex) => (
                    <tr
                      key={String(row._id ?? row.receiptId ?? row.productId ?? rowIndex)}
                      className="border-t border-stock-border"
                    >
                      {columns.map((column) => (
                        <td
                          key={column}
                          className="max-w-72 px-4 py-3 text-stock-primary-text"
                        >
                          {displayValue(row[column])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
