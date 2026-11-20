
import { lazy, Suspense } from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import { AppShell } from "../components/layout/AppShell";
import { ProtectedRoute } from "../features/auth/ProtectedRoute";

// Lazy-loaded pages
const LoginPage = lazy(() =>
  import("../features/auth/LoginPage").then((module) => ({
    default: module.LoginPage,
  }))
);

const RegisterPage = lazy(() =>
  import("../features/auth/RegisterPage").then((module) => ({
    default: module.RegisterPage,
  }))
);

const ProductCreatePage = lazy(() =>
  import("../features/products/ProductFormPage").then((module) => ({
    default: module.ProductCreatePage,
  }))
);

const ProductListPage = lazy(() =>
  import("../features/products/ProductManagementPage").then((module) => ({
    default: module.ProductListPage,
  }))
);

const ProductImportPage = lazy(() =>
  import("../features/products/ProductImportPage").then((module) => ({
    default: module.ProductImportPage,
  }))
);
const CategoryManagementPage = lazy(() =>
  import("../features/categories/CategoryManagementPage").then((module) => ({
    default: module.CategoryManagementPage,
  }))
);
const ProductDetailsPage = lazy(() =>
  import("../features/products/ProductDetailsPage").then((module) => ({
    default: module.ProductDetailsPage,
  }))
);

const CustomerManagementPage = lazy(() =>
  import("../features/customers/CustomerManagementPage").then((module) => ({
    default: module.CustomerManagementPage,
  }))
);

const SupplierManagementPage = lazy(() =>
  import("../features/suppliers/SupplierManagementPage").then((module) => ({
    default: module.SupplierManagementPage,
  }))
);

const BusinessDashboardPage = lazy(() =>
  import("../features/dashboard/BusinessDashboardPage").then((module) => ({
    default: module.BusinessDashboardPage,
  }))
);

const BusinessSetupPage = lazy(() =>
  import("../features/workspace/BusinessSetupPage").then((module) => ({
    default: module.BusinessSetupPage,
  }))
);

const WorkspaceSelectionPage = lazy(() =>
  import("../features/workspace/WorkspaceSelectionPage").then((module) => ({
    default: module.WorkspaceSelectionPage,
  }))
);

const PurchaseManagementPage = lazy(() =>
  import("../features/purchases/PurchaseManagementPage").then((module) => ({
    default: module.PurchaseManagementPage,
  }))
);

const WarehouseInventoryPage = lazy(() =>
  import("../features/inventory/WarehouseInventoryPage").then((module) => ({
    default: module.WarehouseInventoryPage,
  }))
);

const SalesManagementPage = lazy(() =>
  import("../features/sales/SalesManagementPage").then((module) => ({
    default: module.SalesManagementPage,
  }))
);

const InvoiceManagementPage = lazy(() =>
  import("../features/invoices/InvoiceManagementPage").then((module) => ({
    default: module.InvoiceManagementPage,
  }))
);

const StockAlertsPage = lazy(() =>
  import("../features/inventory/StockAlertsPage").then((module) => ({
    default: module.StockAlertsPage,
  }))
);

const NotificationsPage = lazy(() =>
  import("../features/notifications/NotificationsPage").then((module) => ({
    default: module.NotificationsPage,
  }))
);

const AuditLogsPage = lazy(() =>
  import("../features/audit/AuditLogsPage").then((module) => ({
    default: module.AuditLogsPage,
  }))
);

const NotificationPreferencesPage = lazy(() =>
  import("../features/notifications/NotificationPreferencesPage").then(
    (module) => ({
      default: module.NotificationPreferencesPage,
    })
  )
);

const AnalyticsPage = lazy(() =>
  import("../features/analytics/AnalyticsPage").then((module) => ({
    default: module.AnalyticsPage,
  }))
);

const ReportsPage = lazy(() =>
  import("../features/analytics/ReportsPage").then((module) => ({
    default: module.ReportsPage,
  }))
);

const EmployeeManagementPage = lazy(() =>
  import("../features/employees/EmployeeManagementPage").then((module) => ({
    default: module.EmployeeManagementPage,
  }))
);
const ForecastingPage = lazy(() =>
  import("../features/forecasting/ForecastingPage").then((module) => ({
    default: module.ForecastingPage,
  }))
);
function BusinessPlaceholder() {
  return (
    <AppShell
      mode="business"
      title="Dashboard"
      description="Business workspace"
    >
      <div className="rounded-xl border border-stock-border bg-stock-white p-6 text-sm text-stock-secondary-text">
        Application content area
      </div>
    </AppShell>
  );
}

function PlatformPlaceholder() {
  return (
    <AppShell
      mode="platform"
      title="Platform Dashboard"
      description="Super Admin platform workspace"
    >
      <div className="rounded-xl border border-stock-border bg-stock-white p-6 text-sm text-stock-secondary-text">
        Platform content area
      </div>
    </AppShell>
  );
}

function PageLoader() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="text-sm text-stock-secondary-text">
        Loading StockPilot...
      </div>
    </div>
  );
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<BusinessDashboardPage />} />
            <Route path="/workspaces" element={<WorkspaceSelectionPage />} />
            <Route path="/business/setup" element={<BusinessSetupPage />} />
            <Route path="/products" element={<ProductListPage />} />
            <Route path="/products/new" element={<ProductCreatePage />} />
            <Route path="/products/import" element={<ProductImportPage />} />
            <Route
              path="/products/:productId/edit"
              element={<ProductCreatePage />}
            />
            <Route
              path="/products/:productId"
              element={<ProductDetailsPage />}
            />
            <Route
              path="/products/*"
              element={<Navigate to="/products" replace />}
            />
<Route
  path="/categories/*"
  element={<CategoryManagementPage />}
/>            <Route path="/warehouses/*" element={<BusinessPlaceholder />} />
            <Route path="/inventory/alerts" element={<StockAlertsPage />} />
            <Route path="/inventory/*" element={<WarehouseInventoryPage />} />
            <Route path="/suppliers/*" element={<SupplierManagementPage />} />
            <Route path="/purchases/*" element={<PurchaseManagementPage />} />
            <Route path="/customers/*" element={<CustomerManagementPage />} />
            <Route path="/sales/*" element={<SalesManagementPage />} />
            <Route path="/invoices/*" element={<InvoiceManagementPage />} />
            <Route path="/analytics/*" element={<AnalyticsPage />} />
            <Route path="/reports/*" element={<ReportsPage />} />
<Route path="/forecasting/*" element={<ForecastingPage />} />            <Route path="/employees/*" element={<EmployeeManagementPage />} />
            <Route
              path="/settings/notifications"
              element={<NotificationPreferencesPage />}
            />
            <Route path="/settings/*" element={<BusinessPlaceholder />} />
            <Route path="/subscription/*" element={<BusinessPlaceholder />} />
            <Route path="/notifications/*" element={<NotificationsPage />} />
            <Route path="/audit-logs/*" element={<AuditLogsPage />} />
            <Route path="/platform/*" element={<PlatformPlaceholder />} />
          </Route>

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
