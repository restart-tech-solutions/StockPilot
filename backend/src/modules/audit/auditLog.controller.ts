import { Response } from "express";
import mongoose from "mongoose";
import AuditLog from "../../models/AuditLog";
import User from "../../models/User";
import { AuthenticatedRequest } from "../../middleware/auth.middleware";
import { parsePagination } from "../../utils/resourceQuery";

const parseDate = (value: unknown, endOfDay: boolean): Date | null => {
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
};

export const listAuditLogs = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const businessId = req.businessMembership?.businessId;
    if (!businessId) {
      res.status(403).json({
        success: false,
        message: "You do not have access to this business.",
      });
      return;
    }
    const pagination = parsePagination(req.query.page, req.query.limit);
    if (!pagination) {
      res.status(400).json({
        success: false,
        message: "Invalid pagination values.",
      });
      return;
    }
    const { from, to, userId, resourceType, action, resourceId } = req.query;
    if (
      (from !== undefined && typeof from !== "string") ||
      (to !== undefined && typeof to !== "string") ||
      (userId !== undefined &&
        (typeof userId !== "string" ||
          !mongoose.Types.ObjectId.isValid(userId))) ||
      (resourceType !== undefined &&
        (typeof resourceType !== "string" || resourceType.length > 80)) ||
      (action !== undefined &&
        (typeof action !== "string" || action.length > 100)) ||
      (resourceId !== undefined &&
        (typeof resourceId !== "string" || resourceId.length > 120))
    ) {
      res.status(400).json({
        success: false,
        message: "Invalid audit log filters.",
      });
      return;
    }
    const fromDate = parseDate(from, false);
    const toDate = parseDate(to, true);
    if (
      (from !== undefined && !fromDate) ||
      (to !== undefined && !toDate) ||
      (fromDate && toDate && fromDate > toDate)
    ) {
      res.status(400).json({
        success: false,
        message: "Audit log dates are invalid.",
      });
      return;
    }

    const filter: Record<string, unknown> = { businessId };
    if (userId) filter.actorUserId = userId;
    if (resourceType) filter.resourceType = resourceType;
    if (action) filter.action = action;
    if (resourceId) filter.resourceId = resourceId;
    if (fromDate || toDate) {
      filter.createdAt = {
        ...(fromDate ? { $gte: fromDate } : {}),
        ...(toDate ? { $lte: toDate } : {}),
      };
    }
    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .populate({ path: "actorUserId", model: User, select: "name email" })
        .sort({ createdAt: -1, _id: -1 })
        .skip(pagination.skip)
        .limit(pagination.limit)
        .lean(),
      AuditLog.countDocuments(filter),
    ]);
    res.status(200).json({
      success: true,
      auditLogs: logs,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit),
      },
    });
  } catch (error) {
    console.error("List Audit Logs Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve audit logs.",
    });
  }
};
