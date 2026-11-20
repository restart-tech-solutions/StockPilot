import { NavLink } from "react-router-dom";
import type { ShellMode } from "./AppShell";

interface SidebarProps {
  mode: ShellMode;
  open: boolean;
  onClose: () => void;
}

interface NavigationItem {
  label: string;
  path: string;
}

interface NavigationGroup {
  label: string;
  items: NavigationItem[];
}

const businessNavigation: NavigationGroup[] = [
  {
    label: "",
    items: [{ label: "Dashboard", path: "/" }],
  },
  {
    label: "Inventory",
    items: [
      { label: "Products", path: "/products" },
      { label: "Categories", path: "/categories" },
      { label: "Warehouses", path: "/warehouses" },
      { label: "Stock Movements", path: "/inventory/movements" },
      { label: "Warehouse Stock", path: "/inventory/balances" },
      { label: "Stock Transfers", path: "/inventory/transfers" },
      { label: "Stock Alerts", path: "/inventory/alerts" },
    ],
  },
  {
    label: "Operations",
    items: [
      { label: "Suppliers", path: "/suppliers" },
      { label: "Purchases", path: "/purchases" },
      { label: "Customers", path: "/customers" },
      { label: "Sales", path: "/sales" },
      { label: "Invoices", path: "/invoices" },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { label: "Analytics", path: "/analytics" },
      { label: "Reports", path: "/reports" },
      { label: "Demand Forecasting", path: "/forecasting" },
    ],
  },
  {
    label: "Administration",
    items: [
      { label: "Employees", path: "/employees" },
      { label: "Tax & Invoice Settings", path: "/settings/tax-invoice" },
      { label: "Notification Preferences", path: "/settings/notifications" },
      { label: "Notifications", path: "/notifications" },
      { label: "Subscription & Billing", path: "/subscription" },
      { label: "Audit Logs", path: "/audit-logs" },
    ],
  },
];

const platformNavigation: NavigationGroup[] = [
  {
    label: "",
    items: [{ label: "Platform Dashboard", path: "/platform" }],
  },
  {
    label: "Platform",
    items: [
      { label: "Business Accounts", path: "/platform/businesses" },
      { label: "Subscriptions", path: "/platform/subscriptions" },
      { label: "Platform Usage", path: "/platform/usage" },
      { label: "Support Requests", path: "/platform/support" },
      { label: "System Configuration", path: "/platform/configuration" },
      { label: "Platform Analytics", path: "/platform/analytics" },
    ],
  },
];

export function Sidebar({ mode, open, onClose }: SidebarProps) {
  const groups = mode === "business" ? businessNavigation : platformNavigation;

  return (
    <aside
      className={[
        "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-white/10",
        "bg-stock-deep-navy text-white transition-transform duration-200",
        open ? "translate-x-0" : "-translate-x-full",
        "lg:translate-x-0",
      ].join(" ")}
      aria-label={mode === "business" ? "Business navigation" : "Platform navigation"}
    >
      <div className="flex h-16 shrink-0 items-center justify-between px-5">
        <NavLink
          to={mode === "business" ? "/" : "/platform"}
          className="text-lg font-semibold tracking-tight text-white"
        >
          StockPilot
        </NavLink>
        <button
          type="button"
          aria-label="Close sidebar"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-white/80 hover:bg-white/10 lg:hidden"
          onClick={onClose}
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-6">
        {groups.map((group, groupIndex) => (
          <div key={`${group.label}-${groupIndex}`} className={groupIndex === 0 ? "pb-2" : "border-t border-white/10 py-3"}>
            {group.label && (
              <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-white/55">
                {group.label}
              </p>
            )}
            <div className="space-y-1">
              {group.items.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === "/" || item.path === "/platform"}
                  className={({ isActive }) =>
                    [
                      "flex min-h-10 items-center rounded-lg px-3 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-white/[0.12] text-white"
                        : "text-white/75 hover:bg-white/10 hover:text-white",
                    ].join(" ")
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/10 px-5 py-4">
        <p className="text-xs text-white/55">
          {mode === "business" ? "Business Workspace" : "Super Admin"}
        </p>
      </div>
    </aside>
  );
}
