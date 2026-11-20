import { Response } from "express";
import { AuthenticatedRequest } from "../../middleware/auth.middleware";
import {
  AnalyticsFilters,
  AnalyticsPeriod,
  getInventoryAnalytics,
  getOverviewAnalytics,
  getPurchaseAnalytics,
  getSalesAnalytics,
} from "./analytics.service";

type DateRangeResult =
  | { valid: true; from?: Date; to?: Date }
  | { valid: false };

function parseDate(value: unknown, endOfDay: boolean): Date | null {
  if (value === undefined || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(Number.NaN);
  }
  const date = new Date(
    `${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`
  );
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value
    ? new Date(Number.NaN)
    : date;
}


function parseDateRange(req: AuthenticatedRequest): DateRangeResult {
  const from = parseDate(req.query.from, false);
  const to = parseDate(req.query.to, true);

  if (
    (req.query.from !== undefined &&
      (!from || Number.isNaN(from.getTime()))) ||
    (req.query.to !== undefined &&
      (!to || Number.isNaN(to.getTime()))) ||
    (from &&
      to &&
      !Number.isNaN(from.getTime()) &&
      !Number.isNaN(to.getTime()) &&
      from > to)
  ) {
    return { valid: false };
  }

  return {
    valid: true,
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
  };
}

function getFilters(
  req: AuthenticatedRequest,
  res: Response
): AnalyticsFilters | null {
  const businessId = req.businessMembership?.businessId;
  const dateRange = parseDateRange(req);
  if (!businessId) {
    res.status(403).json({
      success: false,
      message: "You do not have access to this business.",
    });
    return null;
  }
  if (!dateRange.valid) {
    res.status(400).json({
      success: false,
      message: "Date filters must be valid YYYY-MM-DD values with from before to.",
    });
    return null;
  }
  return {
    businessId,
    ...(dateRange.from ? { from: dateRange.from } : {}),
    ...(dateRange.to ? { to: dateRange.to } : {}),
  };
}

function getPeriod(req: AuthenticatedRequest): AnalyticsPeriod | null {
  const value = req.query.period;
  if (value === undefined || value === "daily") return "day";
  if (value === "weekly") return "week";
  if (value === "monthly") return "month";
  return null;
}

export async function readAnalyticsOverview(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const filters = getFilters(req, res);
  if (!filters) return;
  try {
    const analytics = await getOverviewAnalytics(filters);
    res.status(200).json({ success: true, analytics });
  } catch (error) {
    console.error("Analytics Overview Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to load business analytics.",
    });
  }
}

export async function readSalesAnalytics(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const filters = getFilters(req, res);
  if (!filters) return;
  const period = getPeriod(req);
  if (!period) {
    res.status(400).json({
      success: false,
      message: "Period must be daily, weekly or monthly.",
    });
    return;
  }
  try {
    const analytics = await getSalesAnalytics(filters, period);
    res.status(200).json({ success: true, analytics });
  } catch (error) {
    console.error("Sales Analytics Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to load sales analytics.",
    });
  }
}

export async function readPurchaseAnalytics(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const filters = getFilters(req, res);
  if (!filters) return;
  const period = getPeriod(req);
  if (!period) {
    res.status(400).json({
      success: false,
      message: "Period must be daily, weekly or monthly.",
    });
    return;
  }
  try {
    const analytics = await getPurchaseAnalytics(filters, period);
    res.status(200).json({ success: true, analytics });
  } catch (error) {
    console.error("Purchase Analytics Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to load purchase analytics.",
    });
  }
}

export async function readInventoryAnalytics(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const filters = getFilters(req, res);
  if (!filters) return;
  try {
    const analytics = await getInventoryAnalytics(filters);
    res.status(200).json({ success: true, analytics });
  } catch (error) {
    console.error("Inventory Analytics Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to load inventory analytics.",
    });
  }
}
