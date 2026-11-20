import mongoose from "mongoose";
import InAppNotification, {
  StockNotificationEvent,
} from "../models/InAppNotification";
import Membership from "../models/Membership";
import StockAlert, {
  StockAlertCondition,
  StockAlertStatus,
} from "../models/StockAlert";
import StockNotificationPreference from "../models/StockNotificationPreference";

interface StockProductSnapshot {
  _id: mongoose.Types.ObjectId;
  businessId: mongoose.Types.ObjectId;
  productName: string;
  sku: string;
  currentStock: number;
  minimumStockThreshold: number;
}

async function createStockNotifications(
  product: StockProductSnapshot,
  alertId: mongoose.Types.ObjectId,
  eventId: mongoose.Types.ObjectId,
  condition: StockAlertCondition,
  isResolved: boolean,
  session?: mongoose.ClientSession
): Promise<void> {
  const preferencesQuery = StockNotificationPreference.findOne({
    businessId: product.businessId,
  }).lean();
  const membershipQuery = Membership.find({
    businessId: product.businessId,
  })
    .select("userId")
    .lean();
  const [preferences, memberships] = await Promise.all([
    session
      ? preferencesQuery.session(session)
      : preferencesQuery,
    session ? membershipQuery.session(session) : membershipQuery,
  ]);
  if (
    (condition === "LOW_STOCK" &&
      preferences?.lowStockNotificationsEnabled === false) ||
    (condition === "OUT_OF_STOCK" &&
      preferences?.outOfStockNotificationsEnabled === false)
  ) {
    return;
  }

  const eventType: StockNotificationEvent = isResolved
    ? "STOCK_RESTORED"
    : condition;
  const severity = condition === "OUT_OF_STOCK" ? "Out of stock" : "Low stock";
  const title = isResolved ? `${severity} alert resolved` : `${severity} alert`;
  const message = isResolved
    ? `${product.productName} (${product.sku}) is no longer below its stock alert threshold. Current stock: ${product.currentStock}.`
    : condition === "OUT_OF_STOCK"
      ? `${product.productName} (${product.sku}) has no stock available.`
      : `${product.productName} (${product.sku}) has ${product.currentStock} in stock; the minimum threshold is ${product.minimumStockThreshold}.`;
  const eventKey = `stock-alert:${alertId.toString()}:${eventId.toString()}`;
  const notifications = memberships.map((membership) => ({
    businessId: product.businessId,
    recipientUserId: membership.userId,
    category: "STOCK_ALERT" as const,
    eventType,
    eventKey,
    alertId,
    productId: product._id,
    title,
    message,
  }));
  if (notifications.length) {
    await InAppNotification.create(
      notifications,
      session ? { session, ordered: true } : undefined
    );
  }
}

const isDuplicateKeyError = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  (error as { code?: unknown }).code === 11000;

export async function syncStockAlert(
  product: StockProductSnapshot,
  session?: mongoose.ClientSession
): Promise<void> {
  const conditions: StockAlertCondition[] = ["LOW_STOCK", "OUT_OF_STOCK"];
  const activeConditions = new Set<StockAlertCondition>();
  if (product.currentStock === 0) {
    activeConditions.add("OUT_OF_STOCK");
  } else if (
    product.minimumStockThreshold > 0 &&
    product.currentStock <= product.minimumStockThreshold
  ) {
    activeConditions.add("LOW_STOCK");
  }

  for (const condition of conditions) {
    const alertQuery = StockAlert.findOne({
      businessId: product.businessId,
      productId: product._id,
      condition,
    });
    const existing = session
      ? await alertQuery.session(session)
      : await alertQuery;
    const shouldBeActive = activeConditions.has(condition);
    const now = new Date();

    if (!existing && !shouldBeActive) {
      continue;
    }

    if (!existing) {
      const eventId = new mongoose.Types.ObjectId();
      let created: InstanceType<typeof StockAlert>;
      try {
        [created] = await StockAlert.create(
          [
            {
              businessId: product.businessId,
              productId: product._id,
              condition,
              status: "ACTIVE" satisfies StockAlertStatus,
              currentStock: product.currentStock,
              minimumStockThreshold: product.minimumStockThreshold,
              openedAt: now,
              lastEventId: eventId,
            },
          ],
          session ? { session } : undefined
        );
      } catch (error) {
        if (isDuplicateKeyError(error) && !session) continue;
        throw error;
      }
      await createStockNotifications(
        product,
        created._id,
        eventId,
        condition,
        false,
        session
      );
      continue;
    }

    if (shouldBeActive && existing.status === "RESOLVED") {
      const eventId = new mongoose.Types.ObjectId();
      const transitionedQuery = StockAlert.findOneAndUpdate(
        { _id: existing._id, status: "RESOLVED" },
        {
          $set: {
            status: "ACTIVE",
            currentStock: product.currentStock,
            minimumStockThreshold: product.minimumStockThreshold,
            openedAt: now,
            resolvedAt: null,
            lastEventId: eventId,
          },
        },
        { returnDocument: "after", runValidators: true, session }
      );
      const transitioned = session
        ? await transitionedQuery.session(session)
        : await transitionedQuery;
      if (!transitioned) continue;
      await createStockNotifications(
        product,
        transitioned._id,
        eventId,
        condition,
        false,
        session
      );
      continue;
    }

    if (!shouldBeActive && existing.status === "ACTIVE") {
      const eventId = new mongoose.Types.ObjectId();
      const transitionedQuery = StockAlert.findOneAndUpdate(
        { _id: existing._id, status: "ACTIVE" },
        {
          $set: {
            status: "RESOLVED",
            currentStock: product.currentStock,
            minimumStockThreshold: product.minimumStockThreshold,
            resolvedAt: now,
            lastEventId: eventId,
          },
        },
        { returnDocument: "after", runValidators: true, session }
      );
      const transitioned = session
        ? await transitionedQuery.session(session)
        : await transitionedQuery;
      if (!transitioned) continue;
      await createStockNotifications(
        product,
        transitioned._id,
        eventId,
        condition,
        true,
        session
      );
      continue;
    }

    if (
      existing.currentStock !== product.currentStock ||
      existing.minimumStockThreshold !== product.minimumStockThreshold
    ) {
      existing.currentStock = product.currentStock;
      existing.minimumStockThreshold = product.minimumStockThreshold;
      await existing.save(session ? { session } : undefined);
    }
  }
}
