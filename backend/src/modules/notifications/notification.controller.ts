import { Response } from "express";
import mongoose from "mongoose";
import InAppNotification, {
  NotificationCategory,
} from "../../models/InAppNotification";
import { AuthenticatedRequest } from "../../middleware/auth.middleware";
import { parsePagination } from "../../utils/resourceQuery";

const categories: NotificationCategory[] = ["STOCK_ALERT", "SYSTEM"];

export const listNotifications = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const businessId = req.businessMembership?.businessId;
    const recipientUserId = req.user?.userId;
    if (!businessId || !recipientUserId) {
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
    const { category, unreadOnly } = req.query;
    if (
      (category !== undefined &&
        (typeof category !== "string" ||
          !categories.includes(category as NotificationCategory))) ||
      (unreadOnly !== undefined &&
        unreadOnly !== "true" &&
        unreadOnly !== "false")
    ) {
      res.status(400).json({
        success: false,
        message: "Invalid notification filters.",
      });
      return;
    }

    const filter: Record<string, unknown> = {
      businessId,
      recipientUserId,
    };
    if (typeof category === "string") filter.category = category;
    if (unreadOnly === "true") filter.readAt = null;

    const [notifications, total, unreadCount] = await Promise.all([
      InAppNotification.find(filter)
        .populate({
          path: "productId",
          select: "productName sku",
          match: { businessId },
        })
        .sort({ createdAt: -1, _id: -1 })
        .skip(pagination.skip)
        .limit(pagination.limit)
        .lean(),
      InAppNotification.countDocuments(filter),
      InAppNotification.countDocuments({
        businessId,
        recipientUserId,
        readAt: null,
      }),
    ]);
    res.status(200).json({
      success: true,
      notifications,
      unreadCount,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit),
      },
    });
  } catch (error) {
    console.error("List Notifications Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve notifications.",
    });
  }
};

export const markNotificationRead = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const businessId = req.businessMembership?.businessId;
  const recipientUserId = req.user?.userId;
  const notificationId =
    typeof req.params.notificationId === "string"
      ? req.params.notificationId
      : "";
  if (!businessId || !recipientUserId) {
    res.status(403).json({
      success: false,
      message: "You do not have access to this business.",
    });
    return;
  }
  if (!mongoose.Types.ObjectId.isValid(notificationId)) {
    res.status(400).json({
      success: false,
      message: "Invalid notification ID.",
    });
    return;
  }

  try {
    const notification = await InAppNotification.findOneAndUpdate(
      { _id: notificationId, businessId, recipientUserId },
      { $set: { readAt: new Date() } },
      { returnDocument: "after", runValidators: true }
    ).lean();
    if (!notification) {
      res.status(404).json({
        success: false,
        message: "Notification not found in this workspace.",
      });
      return;
    }
    res.status(200).json({
      success: true,
      message: "Notification marked as read.",
      notification,
    });
  } catch (error) {
    console.error("Mark Notification Read Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to mark notification as read.",
    });
  }
};
