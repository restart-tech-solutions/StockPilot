import { Response } from "express";
import ExcelJS from "exceljs";
import { AuthenticatedRequest } from "../../middleware/auth.middleware";
import { parsePagination } from "../../utils/resourceQuery";
import {
  AnalyticsFilters,
  ReportRow,
  ReportType,
  getReportPage,
} from "../analytics/analytics.service";

const maxExportRows = 5000;

const reportColumns: Record<ReportType, string[]> = {
  sales: [
    "salesOrderNumber",
    "customerName",
    "status",
    "completedAt",
    "salesRevenue",
    "returnedQuantity",
    "estimatedGrossProfit",
    "missingCostSnapshot",
  ],
  purchases: [
    "receiptNumber",
    "purchaseOrderNumber",
    "receivedAt",
    "supplierName",
    "productName",
    "sku",
    "receivedQuantity",
    "damagedQuantity",
    "goodQuantity",
    "unitPrice",
    "receivedValue",
  ],
  inventory: [
    "productName",
    "sku",
    "currentStock",
    "minimumStockThreshold",
    "currentPurchasePrice",
    "estimatedStockValue",
  ],
  products: [
    "productName",
    "sku",
    "quantitySold",
    "salesRevenue",
    "estimatedGrossProfit",
    "missingCostSnapshot",
  ],
};

function parseDate(value: unknown, endOfDay: boolean): Date | null {
  if (value === undefined || value === "") return null;

  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(Number.NaN);
  }

  const date = new Date(
    `${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`
  );

  return Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
    ? new Date(Number.NaN)
    : date;
}

function readFilters(
  req: AuthenticatedRequest,
  res: Response
): AnalyticsFilters | null {
  const businessId = req.businessMembership?.businessId;
  const from = parseDate(req.query.from, false);
  const to = parseDate(req.query.to, true);

  if (!businessId) {
    res.status(403).json({
      success: false,
      message: "You do not have access to this business.",
    });
    return null;
  }

  if (
    (req.query.from !== undefined && !from) ||
    (req.query.to !== undefined && !to) ||
    (from && to && from > to)
  ) {
    res.status(400).json({
      success: false,
      message: "Date filters must be valid YYYY-MM-DD values with from before to.",
    });
    return null;
  }

  return {
    businessId,
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
  };
}

function getSearch(req: AuthenticatedRequest, res: Response): string | null {
  const search = req.query.search;

  if (search === undefined) return "";

  if (typeof search !== "string" || search.length > 120) {
    res.status(400).json({
      success: false,
      message: "Search must be a string of at most 120 characters.",
    });
    return null;
  }

  return search.trim();
}

function normalizeCell(value: unknown): string | number | boolean | null {
  if (value === null || value === undefined) return null;

  if (value instanceof Date) return value.toISOString();

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    if (typeof value === "string" && /^[=+\-@\t\r]/.test(value)) {
      return `'${value}`;
    }

    return value;
  }

  if (
    typeof value === "object" &&
    "toHexString" in value &&
    typeof value.toHexString === "function"
  ) {
    return value.toHexString();
  }

  return JSON.stringify(value);
}

function csvCell(value: string | number | boolean | null): string {
  const text = value === null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

async function sendExport(
  res: Response,
  type: ReportType,
  format: "csv" | "xlsx",
  rows: ReportRow[]
): Promise<void> {
  const columns = reportColumns[type];
  const filename = `stockpilot-${type}-report.${format}`;

  if (format === "csv") {
    const lines = [
      columns.map(csvCell).join(","),
      ...rows.map((row) =>
        columns
          .map((column) => csvCell(normalizeCell(row[column])))
          .join(",")
      ),
    ];

    res
      .status(200)
      .setHeader("Content-Type", "text/csv; charset=utf-8");

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}"`
    );

    res.send(lines.join("\r\n"));
    return;
  }

  const safeRows = rows.map((row) =>
    Object.fromEntries(
      columns.map((column) => [column, normalizeCell(row[column])])
    )
  );

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Report");

  worksheet.columns = columns.map((column) => ({
    header: column,
    key: column,
  }));

  for (const row of safeRows) {
    worksheet.addRow(row);
  }

  const file = Buffer.from(await workbook.xlsx.writeBuffer());

  res
    .status(200)
    .setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${filename}"`
  );

  res.send(file);
}

async function readReport(
  req: AuthenticatedRequest,
  res: Response,
  type: ReportType
): Promise<void> {
  const filters = readFilters(req, res);
  const search = getSearch(req, res);
  const pagination = parsePagination(req.query.page, req.query.limit);

  if (!filters || search === null) return;

  if (!pagination) {
    res.status(400).json({
      success: false,
      message: "Invalid pagination values.",
    });
    return;
  }

  try {
    const page = await getReportPage(type, filters, search, pagination);

    res.status(200).json({
      success: true,
      reportType: type,
      rows: page.rows,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: page.total,
        totalPages: Math.ceil(page.total / pagination.limit),
      },
      inventorySnapshot:
        type === "inventory"
          ? {
              asOf: new Date().toISOString(),
              dateFiltersApplyTo: "not applied to current product balances",
            }
          : undefined,
    });
  } catch (error) {
    console.error("Report Listing Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to generate the report.",
    });
  }
}

async function exportReport(
  req: AuthenticatedRequest,
  res: Response,
  type: ReportType
): Promise<void> {
  const filters = readFilters(req, res);
  const search = getSearch(req, res);
  const format = req.query.format;

  if (!filters || search === null) return;

  if (format !== "csv" && format !== "xlsx") {
    res.status(400).json({
      success: false,
      message: "Export format must be csv or xlsx.",
    });
    return;
  }

  try {
    const page = await getReportPage(type, filters, search, {
      skip: 0,
      limit: maxExportRows + 1,
    });

    if (page.total > maxExportRows) {
      res.status(413).json({
        success: false,
        message: `This report contains ${page.total} rows; narrow the filters to export at most ${maxExportRows}.`,
      });
      return;
    }

    await sendExport(res, type, format, page.rows);
  } catch (error) {
    console.error("Report Export Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to export the report.",
    });
  }
}

export const readSalesReport = (req: AuthenticatedRequest, res: Response) =>
  readReport(req, res, "sales");

export const readPurchaseReport = (req: AuthenticatedRequest, res: Response) =>
  readReport(req, res, "purchases");

export const readInventoryReport = (req: AuthenticatedRequest, res: Response) =>
  readReport(req, res, "inventory");

export const readProductPerformanceReport = (
  req: AuthenticatedRequest,
  res: Response
) => readReport(req, res, "products");

export const exportSalesReport = (req: AuthenticatedRequest, res: Response) =>
  exportReport(req, res, "sales");

export const exportPurchaseReport = (req: AuthenticatedRequest, res: Response) =>
  exportReport(req, res, "purchases");

export const exportInventoryReport = (
  req: AuthenticatedRequest,
  res: Response
) => exportReport(req, res, "inventory");

export const exportProductPerformanceReport = (
  req: AuthenticatedRequest,
  res: Response
) => exportReport(req, res, "products");
