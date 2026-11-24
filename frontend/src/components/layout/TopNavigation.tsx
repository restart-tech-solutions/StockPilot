
import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { apiRequest, StockPilotApiError } from "../../services/api";
import {
  useWorkspace,
  type Workspace,
} from "../../features/workspace/workspaceContext";
import { useAuth } from "../../features/auth/authContext";
import type { ShellMode } from "./AppShell";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from "firebase/auth";
import { auth } from "../../config/firebase";
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

interface BusinessListResponse {
  success: boolean;
  businesses: Workspace[];
  message?: string;
}

export function TopNavigation({ mode, onMenuClick }: TopNavigationProps) {
  const { workspace, setWorkspace } = useWorkspace();
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Notification state
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

  // Workspace switcher state
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [availableWorkspaces, setAvailableWorkspaces] = useState<Workspace[]>([]);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [workspaceError, setWorkspaceError] = useState("");

  const workspaceSwitcherRef = useRef<HTMLDivElement>(null);

  // User profile dropdown state
  const [profileOpen, setProfileOpen] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
const [currentPassword, setCurrentPassword] = useState("");
const [newPassword, setNewPassword] = useState("");
const [confirmNewPassword, setConfirmNewPassword] = useState("");
const [passwordError, setPasswordError] = useState("");
const [passwordSuccess, setPasswordSuccess] = useState("");
const [passwordSaving, setPasswordSaving] = useState(false);

const [profilePanel, setProfilePanel] = useState<
  "profile" | "account" | null
>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  // User profile
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

  // Refresh notifications from other components
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

  // Load available workspaces when dropdown opens
  useEffect(() => {
    if (!workspaceOpen || mode !== "business") return;

    let active = true;

    setWorkspaceLoading(true);
    setWorkspaceError("");

    apiRequest<BusinessListResponse>("/business")
      .then((response) => {
        if (!response.success || !Array.isArray(response.businesses)) {
          throw new Error(
            response.message || "Unable to load workspaces."
          );
        }

        if (active) {
          setAvailableWorkspaces(response.businesses);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setWorkspaceError(
            error instanceof StockPilotApiError
              ? error.message
              : error instanceof Error
                ? error.message
                : "Unable to load workspaces."
          );
        }
      })
      .finally(() => {
        if (active) {
          setWorkspaceLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [workspaceOpen, mode]);

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

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;

      if (searchRef.current && !searchRef.current.contains(target)) {
        setSearchOpen(false);
      }

      if (
        workspaceSwitcherRef.current &&
        !workspaceSwitcherRef.current.contains(target)
      ) {
        setWorkspaceOpen(false);
      }

      if (profileRef.current && !profileRef.current.contains(target)) {
        setProfileOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSearchOpen(false);
        setWorkspaceOpen(false);
        setProfileOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  // Mark notification as read
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

  // Clear product search
  const clearSearch = () => {
    setSearchQuery("");
    setSearchResults([]);
    setSearchError("");
    setSearchOpen(false);
  };
  const handleChangePassword = async (
  event: React.FormEvent<HTMLFormElement>
) => {
  event.preventDefault();

  setPasswordError("");
  setPasswordSuccess("");

  if (!currentPassword || !newPassword || !confirmNewPassword) {
    setPasswordError("Please fill in all password fields.");
    return;
  }

  if (newPassword.length < 8) {
    setPasswordError("New password must be at least 8 characters.");
    return;
  }

  if (newPassword !== confirmNewPassword) {
    setPasswordError("New password and confirm password do not match.");
    return;
  }

  if (currentPassword === newPassword) {
    setPasswordError(
      "New password must be different from your current password."
    );
    return;
  }

  setPasswordSaving(true);

  try {
    const firebaseUser = auth.currentUser;

    if (firebaseUser) {
      const hasPasswordProvider = firebaseUser.providerData.some(
        (provider) => provider.providerId === "password"
      );

      if (!firebaseUser.email || !hasPasswordProvider) {
        throw new Error(
          "This account does not support email/password authentication."
        );
      }

      const credential = EmailAuthProvider.credential(
        firebaseUser.email,
        currentPassword
      );

      await reauthenticateWithCredential(firebaseUser, credential);
      await updatePassword(firebaseUser, newPassword);
    } else {
      const response = await apiRequest<{
        success: boolean;
        message?: string;
      }>("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      if (!response.success) {
        throw new Error(response.message || "Unable to change password.");
      }
    }

    setPasswordSuccess("Password changed successfully!");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmNewPassword("");
  } catch (error) {
    setPasswordError(
      error instanceof StockPilotApiError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Unable to change password. Please try again."
    );
  } finally {
    setPasswordSaving(false);
  }
};
  // Logout from the user profile menu
  const handleProfileLogout = () => {
    setProfileOpen(false);
    logout();
    navigate("/login", { replace: true });
  };

  // Switch workspace and return to dashboard
  const handleWorkspaceSwitch = (selected: Workspace) => {
    if (selected.id === workspace?.id) {
      setWorkspaceOpen(false);
      return;
    }

    setWorkspace(selected);
    setWorkspaceOpen(false);
    setSearchQuery("");
    setSearchResults([]);
    setSearchOpen(false);
    setNotificationsOpen(false);

    navigate("/", { replace: true });
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

      {/* Workspace switcher */}
      {mode === "business" ? (
        <div ref={workspaceSwitcherRef} className="relative min-w-0">
          <button
            type="button"
            aria-expanded={workspaceOpen}
            aria-haspopup="menu"
            onClick={() => setWorkspaceOpen((open) => !open)}
            className="flex max-w-[210px] items-center gap-2 rounded-lg border border-stock-border bg-white px-3 py-2 text-left transition hover:bg-stock-light-grey sm:max-w-[260px]"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-sm font-bold text-stock-primary-blue">
              {(workspace?.businessName || "B").trim().charAt(0).toUpperCase()}
            </span>

            <span className="min-w-0 flex-1">
              <span className="block text-[10px] font-medium uppercase tracking-wide text-stock-secondary-text">
                Current workspace
              </span>
              <span className="block truncate text-sm font-semibold text-stock-deep-navy">
                {workspace?.businessName || "Select workspace"}
              </span>
            </span>

            <svg
              viewBox="0 0 24 24"
              className={`h-4 w-4 shrink-0 text-stock-secondary-text transition-transform ${
                workspaceOpen ? "rotate-180" : ""
              }`}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>

          {workspaceOpen && (
            <div
              role="menu"
              className="absolute left-0 top-14 z-50 w-[min(340px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-stock-border bg-white shadow-xl"
            >
              <div className="border-b border-stock-border px-4 py-3">
                <p className="text-sm font-semibold text-stock-deep-navy">
                  Switch workspace
                </p>
                <p className="mt-0.5 text-xs text-stock-secondary-text">
                  Choose a business environment
                </p>
              </div>

              <div className="max-h-80 overflow-y-auto p-2">
                {workspaceLoading ? (
                  <p className="px-3 py-5 text-center text-sm text-stock-secondary-text">
                    Loading workspaces...
                  </p>
                ) : workspaceError ? (
                  <div className="p-3">
                    <p role="alert" className="text-sm text-red-700">
                      {workspaceError}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setWorkspaceOpen(false);
                        setWorkspaceOpen(true);
                      }}
                      className="mt-2 text-xs font-semibold text-stock-primary-blue hover:underline"
                    >
                      Try again
                    </button>
                  </div>
                ) : availableWorkspaces.length === 0 ? (
                  <p className="px-3 py-5 text-center text-sm text-stock-secondary-text">
                    No workspaces available.
                  </p>
                ) : (
                  availableWorkspaces.map((item) => {
                    const isCurrent = item.id === workspace?.id;

                    return (
                      <button
                        key={item.id}
                        type="button"
                        role="menuitem"
                        onClick={() => handleWorkspaceSwitch(item)}
                        className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition ${
                          isCurrent
                            ? "bg-blue-50"
                            : "hover:bg-stock-light-grey"
                        }`}
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-stock-light-grey text-sm font-bold text-stock-primary-blue">
                          {(item.businessName || "B").trim().charAt(0).toUpperCase()}
                        </span>

                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-stock-primary-text">
                            {item.businessName}
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-stock-secondary-text">
                            {item.category || "Business workspace"}
                            {item.location ? ` · ${item.location}` : ""}
                          </span>
                        </span>

                        {isCurrent && (
                          <svg
                            viewBox="0 0 24 24"
                            className="h-5 w-5 shrink-0 text-emerald-600"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                          >
                            <path d="m5 12 4 4L19 6" />
                          </svg>
                        )}
                      </button>
                    );
                  })
                )}
              </div>

              <div className="border-t border-stock-border p-2">
                <Link
                  to="/workspaces"
                  onClick={() => setWorkspaceOpen(false)}
                  className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-semibold text-stock-primary-blue transition hover:bg-stock-light-grey"
                >
                  View all workspaces
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M5 12h14m-6-6 6 6-6 6" />
                  </svg>
                </Link>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="hidden min-w-32 sm:block">
          <p className="text-sm font-semibold text-stock-deep-navy">
            Super Admin
          </p>
        </div>
      )}

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
              if (event.key === "Escape") clearSearch();
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

        {/* User profile dropdown */}
        <div ref={profileRef} className="relative">
          <button
            type="button"
            aria-label="Open user profile menu"
            aria-expanded={profileOpen}
            aria-haspopup="menu"
            onClick={() => setProfileOpen((current) => !current)}
            className="flex h-10 items-center gap-2 rounded-lg border border-stock-border px-2 text-sm text-stock-primary-text transition hover:bg-stock-light-grey"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-stock-accent-teal text-xs font-semibold text-white">
              {initials || "U"}
            </span>

            <span className="hidden max-w-36 truncate sm:inline">
              {displayName}
            </span>

            <svg
              viewBox="0 0 24 24"
              className={`h-4 w-4 text-stock-secondary-text transition-transform ${
                profileOpen ? "rotate-180" : ""
              }`}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>

          {profileOpen && (
  <div
    role="menu"
    className="absolute right-0 top-12 z-50 w-64 overflow-hidden rounded-xl border border-stock-border bg-white shadow-xl"
  >
    <div className="border-b border-stock-border p-4">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-stock-accent-teal text-sm font-semibold text-white">
          {initials || "U"}
        </span>

        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-stock-deep-navy">
            {displayName}
          </p>
          <p className="truncate text-xs text-stock-secondary-text">
            {user?.email || "Account"}
          </p>
        </div>
      </div>
    </div>

    <div className="p-2">
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          setProfilePanel("profile");
          setProfileOpen(false);
        }}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-stock-primary-text transition hover:bg-stock-light-grey"
      >
        <span>👤</span>
        My Profile
      </button>

      <button
        type="button"
        role="menuitem"
        onClick={() => {
          setProfilePanel("account");
          setProfileOpen(false);
        }}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-stock-primary-text transition hover:bg-stock-light-grey"
      >
        <span>⚙️</span>
        Account Information
      </button>

      <button
        type="button"
        role="menuitem"
        onClick={() => {
          setPasswordError("");
          setPasswordSuccess("");
          setCurrentPassword("");
          setNewPassword("");
          setConfirmNewPassword("");
          setPasswordModalOpen(true);
          setProfileOpen(false);
        }}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-stock-primary-text transition hover:bg-stock-light-grey"
      >
        <span>🔒</span>
        Change Password
      </button>

      <div className="my-2 border-t border-stock-border" />

      <button
        type="button"
        role="menuitem"
        onClick={handleProfileLogout}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50"
      >
        <span>↪</span>
        Logout
      </button>
    </div>
  </div>
)}
        {/* Profile and Account Information Modal */}
        {profilePanel && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-stock-deep-navy">
                  {profilePanel === "profile"
                    ? "My Profile"
                    : "Account Information"}
                </h2>

                <button
                  type="button"
                  onClick={() => setProfilePanel(null)}
                  className="rounded-lg px-3 py-1 text-xl text-stock-secondary-text hover:bg-stock-light-grey"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-xs text-stock-secondary-text">Full Name</p>
                  <p className="mt-1 text-sm font-medium text-stock-primary-text">
                    {user?.name || "Not available"}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-stock-secondary-text">Email Address</p>
                  <p className="mt-1 text-sm font-medium text-stock-primary-text">
                    {user?.email || "Not available"}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-stock-secondary-text">Account Role</p>
                  <p className="mt-1 text-sm font-medium text-stock-primary-text">
                    {user?.role?.replaceAll("_", " ") || "Not available"}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setProfilePanel(null)}
                className="mt-6 w-full rounded-lg bg-stock-primary-blue px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* Change Password Modal */}
        {passwordModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-stock-deep-navy">
                    Change Password
                  </h2>
                  <p className="mt-1 text-xs text-stock-secondary-text">
                    Update your account password securely.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setPasswordModalOpen(false)}
                  className="rounded-lg px-3 py-1 text-xl text-stock-secondary-text hover:bg-stock-light-grey"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleChangePassword} className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-stock-primary-text">
                    Current Password
                  </label>
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    className="w-full rounded-lg border border-stock-border px-3 py-2.5 text-sm outline-none focus:border-stock-primary-blue"
                    placeholder="Enter current password"
                    required
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-stock-primary-text">
                    New Password
                  </label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    className="w-full rounded-lg border border-stock-border px-3 py-2.5 text-sm outline-none focus:border-stock-primary-blue"
                    placeholder="Minimum 8 characters"
                    minLength={8}
                    required
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-stock-primary-text">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={confirmNewPassword}
                    onChange={(event) =>
                      setConfirmNewPassword(event.target.value)
                    }
                    className="w-full rounded-lg border border-stock-border px-3 py-2.5 text-sm outline-none focus:border-stock-primary-blue"
                    placeholder="Confirm new password"
                    required
                  />
                </div>

                {passwordError && (
                  <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                    {passwordError}
                  </p>
                )}

                {passwordSuccess && (
                  <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-700">
                    {passwordSuccess}
                  </p>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setPasswordModalOpen(false)}
                    className="flex-1 rounded-lg border border-stock-border px-4 py-2.5 text-sm font-semibold text-stock-primary-text hover:bg-stock-light-grey"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={passwordSaving}
                    className="flex-1 rounded-lg bg-stock-primary-blue px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {passwordSaving ? "Saving..." : "Update Password"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        </div>
      </div>
    </header>
  );
}
