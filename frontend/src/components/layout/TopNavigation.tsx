
import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { apiRequest, StockPilotApiError } from "../../services/api";
import { useWorkspace } from "../../features/workspace/workspaceContext";
import { useAuth } from "../../features/auth/authContext";
import type { ShellMode } from "./AppShell";

interface TopNavigationProps {
  mode: ShellMode;
  onMenuClick: () => void;
}

interface NotificationItem {
  _id: string;
  title: string;
  message: string;
  createdAt: string;
  readAt: string | null;
}

interface ProductSearchResult {
  _id: string;
  productName: string;
  sku: string;
}

export function TopNavigation({ mode, onMenuClick }: TopNavigationProps) {
  const { workspace } = useWorkspace();
  const { user } = useAuth();
  const location = useLocation();

  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationError, setNotificationError] = useState("");
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [notificationRefresh, setNotificationRefresh] = useState(0);

  // Product search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ProductSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

  const searchRequestId = useRef(0);
  const searchRef = useRef<HTMLDivElement>(null);

  // Dynamic authenticated user profile
  const displayName =
    user?.name?.trim() ||
    user?.email?.split("@")[0] ||
    "Account";

  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");

  // Refresh notifications when another component updates them
  useEffect(() => {
    const refresh = () => {
      setNotificationRefresh((current) => current + 1);
    };

    window.addEventListener("stockpilot:notifications-updated", refresh);

    return () => {
      window.removeEventListener("stockpilot:notifications-updated", refresh);
    };
  }, []);

  // Load unread notifications
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
      notifications: NotificationItem[];
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
        if (active) {
          setNotificationLoading(false);
        }
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

  // Product search with debounce
  useEffect(() => {
    const query = searchQuery.trim();
    const requestId = ++searchRequestId.current;

    if (!query || mode !== "business" || !workspace?.id) {
      setSearchResults([]);
      setSearchLoading(false);
      setSearchError("");
      return;
    }

    setSearchOpen(true);
    setSearchLoading(true);
    setSearchError("");

    const timer = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          businessId: workspace.id,
          search: query,
          page: "1",
          limit: "5",
        });

        const response = await apiRequest<{
          success: boolean;
          products: ProductSearchResult[];
        }>(`/products?${params.toString()}`);

        if (requestId === searchRequestId.current) {
          setSearchResults(
            Array.isArray(response.products) ? response.products : []
          );
          setSearchError("");
        }
      } catch (error) {
        if (requestId === searchRequestId.current) {
          setSearchResults([]);
          setSearchError(
            error instanceof StockPilotApiError
              ? error.message
              : "Unable to search products. Please try again."
          );
        }
      } finally {
        if (requestId === searchRequestId.current) {
          setSearchLoading(false);
        }
      }
    }, 350);

    return () => {
      window.clearTimeout(timer);
    };
  }, [searchQuery, mode, workspace?.id]);

  // Close search dropdown when clicking outside
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (
        searchRef.current &&
        !searchRef.current.contains(event.target as Node)
      ) {
        setSearchOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

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

  const clearSearch = () => {
    setSearchQuery("");
    setSearchResults([]);
    setSearchError("");
    setSearchOpen(false);
  };

  return (
    <header className="fixed left-0 right-0 top-0 z-30 flex h-16 items-center border-b border-stock-border bg-stock-white px-4 lg:left-64 lg:px-6">
      {/* Mobile navigation */}
      <button
        type="button"
        aria-label="Open navigation"
        className="mr-3 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-stock-border text-stock-primary-text lg:hidden"
        onClick={onMenuClick}
      >
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>

      {/* Workspace heading */}
      <div className="hidden min-w-32 sm:block">
        <p className="text-sm font-semibold text-stock-deep-navy">
          {mode === "business" ? "Business Workspace" : "Super Admin"}
        </p>
      </div>

      {/* Functional product search */}
      <div
        ref={searchRef}
        className="relative mx-3 hidden min-w-0 flex-1 md:block"
      >
        <label className="relative block max-w-md">
          <span className="sr-only">Search products by name or SKU</span>

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
            type="search"
            value={searchQuery}
            onFocus={() => {
              if (searchQuery.trim()) setSearchOpen(true);
            }}
            onChange={(event) => {
              setSearchQuery(event.target.value);
              setSearchOpen(true);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                clearSearch();
              }
            }}
            placeholder="Search products by name or SKU..."
            autoComplete="off"
            className="h-10 w-full rounded-lg border border-stock-border bg-stock-white pl-9 pr-9 text-sm text-stock-primary-text outline-none transition focus:border-stock-primary-blue focus:ring-2 focus:ring-stock-primary-blue/10"
          />

          {searchQuery && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={clearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-stock-secondary-text hover:text-stock-primary-text"
            >
              ×
            </button>
          )}
        </label>

        {searchOpen && searchQuery.trim() && (
          <div className="absolute left-0 right-0 top-12 z-50 overflow-hidden rounded-xl border border-stock-border bg-white shadow-xl">
            <div className="border-b border-stock-border px-4 py-2">
              <p className="text-xs font-semibold text-stock-secondary-text">
                PRODUCT SEARCH
              </p>
            </div>

            {searchLoading ? (
              <div className="flex items-center gap-2 p-4 text-sm text-stock-secondary-text">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-stock-border border-t-stock-primary-blue" />
                Searching products...
              </div>
            ) : searchError ? (
              <p role="alert" className="p-4 text-sm text-red-700">
                {searchError}
              </p>
            ) : searchResults.length === 0 ? (
              <div className="p-4">
                <p className="text-sm font-medium text-stock-primary-text">
                  No products found
                </p>
                <p className="mt-1 text-xs text-stock-secondary-text">
                  Try another product name or SKU.
                </p>
              </div>
            ) : (
              <ul className="max-h-80 overflow-y-auto">
                {searchResults.map((product) => (
                  <li key={product._id}>
                    <Link
                      to={`/products/${product._id}`}
                      onClick={clearSearch}
                      className="flex items-center gap-3 px-4 py-3 transition hover:bg-stock-light-grey"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-stock-light-grey text-stock-primary-blue">
                        <svg
                          viewBox="0 0 24 24"
                          className="h-5 w-5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.7"
                        >
                          <path d="M4 7l8-4 8 4v10l-8 4-8-4V7z" />
                          <path d="M4 7l8 4 8-4M12 11v10" />
                        </svg>
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-stock-primary-text">
                          {product.productName}
                        </span>
                        <span className="mt-0.5 block text-xs text-stock-secondary-text">
                          SKU: {product.sku}
                        </span>
                      </span>

                      <svg
                        viewBox="0 0 24 24"
                        className="h-4 w-4 shrink-0 text-stock-secondary-text"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="m9 18 6-6-6-6" />
                      </svg>
                    </Link>
                  </li>
                ))}
              </ul>
            )}

            <div className="border-t border-stock-border px-4 py-2">
              <p className="text-[11px] text-stock-secondary-text">
                Search is limited to the selected business workspace.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Right navigation */}
      <div className="ml-auto flex items-center gap-2">
        {/* Notifications */}
        {mode === "business" && (
          <div className="relative">
            <button
              type="button"
              aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
              aria-expanded={notificationsOpen}
              onClick={() => setNotificationsOpen((open) => !open)}
              className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-stock-border text-stock-secondary-text transition hover:bg-stock-light-grey"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
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

        {/* Dynamic authenticated user profile */}
        <button
          type="button"
          aria-label={`User profile: ${displayName}`}
          title={user?.email || displayName}
          className="flex h-10 items-center gap-2 rounded-lg border border-stock-border px-2 text-sm text-stock-primary-text transition hover:bg-stock-light-grey"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-stock-accent-teal text-xs font-semibold text-white">
            {initials || "U"}
          </span>

          <span className="hidden max-w-36 truncate sm:inline">
            {displayName}
          </span>
        </button>
      </div>
    </header>
  );
}
