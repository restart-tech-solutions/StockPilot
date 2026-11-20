import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AppShell } from "../../components/layout/AppShell";
import { apiRequest, StockPilotApiError } from "../../services/api";
import { useWorkspace } from "../workspace/workspaceContext";

interface NotificationRecord {
  _id: string;
  category: "STOCK_ALERT" | "SYSTEM";
  eventType: string;
  title: string;
  message: string;
  readAt: string | null;
  createdAt: string;
  productId?: { _id: string; productName: string; sku: string } | null;
}

interface NotificationResponse {
  success: boolean;
  notifications: NotificationRecord[];
  pagination: { page: number; totalPages: number; total: number };
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof StockPilotApiError ? error.message : fallback;
}

export function NotificationsPage() {
  const { workspace } = useWorkspace();
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [category, setCategory] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState("");
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    if (!workspace?.id) {
      setNotifications([]);
      return;
    }
    let active = true;
    setLoading(true);
    setError("");
    const params = new URLSearchParams({
      businessId: workspace.id,
      page: String(page),
      limit: "20",
      unreadOnly: String(unreadOnly),
    });
    if (category) params.set("category", category);
    apiRequest<NotificationResponse>(`/notifications?${params.toString()}`)
      .then((response) => {
        if (!response.success || !Array.isArray(response.notifications)) {
          throw new Error("Notifications could not be loaded.");
        }
        if (active) {
          setNotifications(response.notifications);
          setTotalPages(response.pagination.totalPages);
        }
      })
      .catch((loadError: unknown) => {
        if (active) setError(errorMessage(loadError, "Unable to load notifications."));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [workspace?.id, page, category, unreadOnly]);

  const markRead = async (notification: NotificationRecord) => {
    if (!workspace?.id || notification.readAt) return;
    setSavingId(notification._id);
    setActionError("");
    try {
      await apiRequest(`/notifications/${notification._id}/read`, {
        method: "POST",
        body: JSON.stringify({ businessId: workspace.id }),
      });
      setNotifications((current) =>
        current.map((item) =>
          item._id === notification._id
            ? { ...item, readAt: new Date().toISOString() }
            : item
        )
      );
      window.dispatchEvent(new Event("stockpilot:notifications-updated"));
      if (unreadOnly) {
        setNotifications((current) =>
          current.filter((item) => item._id !== notification._id)
        );
      }
    } catch (actionFailure: unknown) {
      setActionError(errorMessage(actionFailure, "Unable to mark this notification as read."));
    } finally {
      setSavingId("");
    }
  };

  return (
    <AppShell
      mode="business"
      title="Notifications"
      description="Workspace notifications for stock events. No email, SMS, or push delivery is configured."
    >
      <section className="rounded-xl border border-stock-border bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <label className="text-sm font-medium text-stock-primary-text">
            Category
            <select
              value={category}
              onChange={(event) => {
                setCategory(event.target.value);
                setPage(1);
              }}
              className="mt-1 h-10 w-full rounded-lg border border-stock-border bg-white px-3 sm:w-56"
            >
              <option value="">All categories</option>
              <option value="STOCK_ALERT">Stock alerts</option>
              <option value="SYSTEM">System</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-stock-primary-text">
            <input
              type="checkbox"
              checked={unreadOnly}
              onChange={(event) => {
                setUnreadOnly(event.target.checked);
                setPage(1);
              }}
            />
            Unread only
          </label>
        </div>

        {error && (
          <div role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        )}
        {actionError && (
          <div role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">
            {actionError}
          </div>
        )}

        {loading ? (
          <p className="py-12 text-center text-sm text-stock-secondary-text">
            Loading notifications...
          </p>
        ) : !error && notifications.length === 0 ? (
          <p className="py-12 text-center text-sm text-stock-secondary-text">
            No notifications.
          </p>
        ) : (
          <ul className="mt-5 divide-y divide-stock-border">
            {notifications.map((notification) => (
              <li
                key={notification._id}
                className={[
                  "flex flex-col gap-4 py-4 sm:flex-row sm:items-start sm:justify-between",
                  notification.readAt ? "bg-white" : "bg-blue-50/60",
                ].join(" ")}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-stock-accent-teal">
                      {notification.category.replace("_", " ")}
                    </span>
                    {!notification.readAt && (
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                        Unread
                      </span>
                    )}
                  </div>
                  <h2 className="mt-1 font-semibold text-stock-deep-navy">
                    {notification.title}
                  </h2>
                  <p className="mt-1 text-sm text-stock-secondary-text">
                    {notification.message}
                  </p>
                  <time className="mt-2 block text-xs text-stock-secondary-text">
                    {new Date(notification.createdAt).toLocaleString()}
                  </time>
                  {notification.productId && (
                    <Link
                      className="mt-2 inline-block text-sm font-medium text-stock-primary-blue hover:underline"
                      to="/inventory/alerts"
                    >
                      View stock alerts
                    </Link>
                  )}
                </div>
                {!notification.readAt && (
                  <button
                    type="button"
                    disabled={savingId === notification._id}
                    onClick={() => void markRead(notification)}
                    className="shrink-0 rounded-lg border border-stock-border px-3 py-2 text-sm font-medium text-stock-primary-blue disabled:opacity-60"
                  >
                    {savingId === notification._id ? "Saving..." : "Mark as read"}
                  </button>
                )}
              </li>
            ))}
          </ul>
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
