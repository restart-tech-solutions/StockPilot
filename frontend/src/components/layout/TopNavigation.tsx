import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { apiRequest, StockPilotApiError } from "../../services/api";
import { useWorkspace } from "../../features/workspace/workspaceContext";
import type { ShellMode } from "./AppShell";

interface TopNavigationProps {
  mode: ShellMode;
  onMenuClick: () => void;
}

export function TopNavigation({ mode, onMenuClick }: TopNavigationProps) {
  const { workspace } = useWorkspace();
  const location = useLocation();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<
    Array<{
      _id: string;
      title: string;
      message: string;
      createdAt: string;
      readAt: string | null;
    }>
  >([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationError, setNotificationError] = useState("");
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [notificationRefresh, setNotificationRefresh] = useState(0);

  useEffect(() => {
    const refresh = () => setNotificationRefresh((current) => current + 1);
    window.addEventListener("stockpilot:notifications-updated", refresh);
    return () =>
      window.removeEventListener("stockpilot:notifications-updated", refresh);
  }, []);

  useEffect(() => {
    if (mode !== "business" || !workspace?.id) {
      setNotifications([]);
      setUnreadCount(0);
      setNotificationLoading(false);
      return;
    }
    setNotifications([]);
    setUnreadCount(0);
    setNotificationError("");
    setNotificationLoading(true);
    let active = true;
    const params = new URLSearchParams({
      businessId: workspace.id,
      unreadOnly: "true",
      page: "1",
      limit: "5",
    });
    apiRequest<{
      success: boolean;
      notifications: Array<{
        _id: string;
        title: string;
        message: string;
        createdAt: string;
        readAt: string | null;
      }>;
      unreadCount: number;
    }>(`/notifications?${params.toString()}`)
      .then((response) => {
        if (!response.success || !Array.isArray(response.notifications)) {
          throw new Error("Notifications could not be loaded.");
        }
        if (active) {
          setNotifications(response.notifications);
          setUnreadCount(response.unreadCount);
          setNotificationError("");
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setNotificationError(
            error instanceof StockPilotApiError
              ? error.message
              : "Notifications could not be loaded."
          );
        }
      })
      .finally(() => {
        if (active) setNotificationLoading(false);
      });
    return () => {
      active = false;
    };
  }, [
    mode,
    workspace?.id,
    location.pathname,
    notificationsOpen,
    notificationRefresh,
  ]);

  const markRead = async (notificationId: string) => {
    if (!workspace?.id) return;
    try {
      await apiRequest(`/notifications/${notificationId}/read`, {
        method: "POST",
        body: JSON.stringify({ businessId: workspace.id }),
      });
      setNotifications((current) =>
        current.filter((notification) => notification._id !== notificationId)
      );
      setUnreadCount((current) => Math.max(0, current - 1));
    } catch (error) {
      setNotificationError(
        error instanceof StockPilotApiError
          ? error.message
          : "Unable to mark the notification as read."
      );
    }
  };

  return (
    <header className="fixed left-0 right-0 top-0 z-30 flex h-16 items-center border-b border-stock-border bg-stock-white px-4 lg:left-64 lg:px-6">
      <button
        type="button"
        aria-label="Open navigation"
        className="mr-3 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-stock-border text-stock-primary-text lg:hidden"
        onClick={onMenuClick}
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>

      <div className="hidden min-w-32 sm:block">
        <p className="text-sm font-semibold text-stock-deep-navy">
          {mode === "business" ? "Business Workspace" : "Super Admin"}
        </p>
      </div>

      <div className="mx-3 hidden min-w-0 flex-1 md:block">
        <label className="relative block max-w-md">
          <span className="sr-only">Search</span>
          <svg
            viewBox="0 0 24 24"
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stock-secondary-text"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-4-4" />
          </svg>
          <input
            readOnly
            type="search"
            placeholder="Search"
            className="h-10 w-full rounded-lg border border-stock-border bg-stock-white pl-9 pr-3 text-sm text-stock-primary-text outline-none"
          />
        </label>
      </div>

      <div className="ml-auto flex items-center gap-2">
        {mode === "business" && (
          <div className="relative">
            <button
              type="button"
              aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
              aria-expanded={notificationsOpen}
              onClick={() => setNotificationsOpen((open) => !open)}
              className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-stock-border text-stock-secondary-text"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 8a6 6 0 10-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
                <path d="M10 21h4" />
              </svg>
              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-red-600 px-1 text-[10px] font-bold leading-5 text-white">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>
            {notificationsOpen && (
              <div className="absolute right-0 top-12 z-50 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-stock-border bg-white p-3 shadow-xl">
                <div className="flex items-center justify-between border-b border-stock-border pb-2">
                  <h2 className="font-semibold text-stock-deep-navy">
                    Notifications
                  </h2>
                  <Link
                    to="/notifications"
                    onClick={() => setNotificationsOpen(false)}
                    className="text-xs font-medium text-stock-primary-blue hover:underline"
                  >
                    View all
                  </Link>
                </div>
                {notificationError ? (
                  <p role="alert" className="py-4 text-sm text-red-700">
                    {notificationError}
                  </p>
                ) : notificationLoading ? (
                  <p className="py-4 text-sm text-stock-secondary-text">
                    Loading notifications...
                  </p>
                ) : notifications.length === 0 ? (
                  <p className="py-4 text-sm text-stock-secondary-text">
                    No unread notifications.
                  </p>
                ) : (
                  <ul className="max-h-80 divide-y divide-stock-border overflow-y-auto">
                    {notifications.map((notification) => (
                      <li key={notification._id} className="py-3">
                        <p className="text-sm font-semibold text-stock-primary-text">
                          {notification.title}
                        </p>
                        <p className="mt-1 line-clamp-2 text-xs text-stock-secondary-text">
                          {notification.message}
                        </p>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <time className="text-[11px] text-stock-secondary-text">
                            {new Date(notification.createdAt).toLocaleString()}
                          </time>
                          {!notification.readAt && (
                            <button
                              type="button"
                              onClick={() => void markRead(notification._id)}
                              className="text-xs font-medium text-stock-primary-blue hover:underline"
                            >
                              Mark read
                            </button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
        <button
          type="button"
          aria-label="User profile"
          className="flex h-10 items-center gap-2 rounded-lg border border-stock-border px-2 text-sm text-stock-primary-text"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-stock-accent-teal text-xs font-semibold text-white">
            SP
          </span>
          <span className="hidden sm:inline">User</span>
        </button>
      </div>
    </header>
  );
}
