
import express, { Application } from "express";
import cors from "cors";

import authRoutes from "./modules/auth/auth.routes";
import businessRoutes from "./modules/business/business.routes";
import warehouseRoutes from "./modules/warehouses/warehouse.routes";
import categoryRoutes from "./modules/categories/category.routes";
import measurementUnitRoutes from "./modules/business/measurementUnit.routes";
import taxInvoiceSettingsRoutes from "./modules/business/taxInvoiceSettings.routes";
import employeeInvitationRoutes from "./modules/employees/employeeInvitation.routes";
import employeeRoutes from "./modules/employees/employee.routes";
import stockNotificationPreferenceRoutes from "./modules/business/stockNotificationPreference.routes";
import productRoutes from "./modules/products/product.routes";
import supplierRoutes from "./modules/suppliers/supplier.routes";
import customerRoutes from "./modules/customers/customer.routes";
import inventoryRoutes from "./modules/inventory/inventory.routes";
import purchaseRoutes from "./modules/purchases/purchase.routes";
import warehouseInventoryRoutes from "./modules/inventory/warehouseInventory.routes";
import salesRoutes from "./modules/sales/sales.routes";
import invoiceRoutes from "./modules/invoices/invoice.routes";
import stockAlertRoutes from "./modules/inventory/stockAlert.routes";
import notificationRoutes from "./modules/notifications/notification.routes";
import auditLogRoutes from "./modules/audit/auditLog.routes";
import analyticsRoutes from "./modules/analytics/analytics.routes";
import reportRoutes from "./modules/reports/report.routes";
import forecastingRoutes from "./modules/forecasting/forecasting.routes";
import subscriptionRoutes from "./modules/subscriptions/subscription.routes";
import platformRoutes from "./modules/platform/platform.routes";
const app: Application = express();

// Middleware
// Middleware
// Middleware
app.use(cors());

// Razorpay webhook must receive the original raw request body.
app.use(
  "/api/subscriptions/webhook",
  express.raw({ type: "application/json" })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/api/forecasting", forecastingRoutes);
// Health Check
app.get("/api/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "StockPilot API is running",
  });
});

// Authentication & Business
app.use("/api/auth", authRoutes);
app.use("/api/subscriptions", subscriptionRoutes);
app.use("/api/platform", platformRoutes);
// Business Management sub-resources (mounted before /api/business to prevent :businessId shadowing)
app.use("/api/business/tax-invoice-settings", taxInvoiceSettingsRoutes);
app.use("/api/business/measurement-units", measurementUnitRoutes);
app.use(
  "/api/business/stock-notification-preferences",
  stockNotificationPreferenceRoutes
);
app.use("/api/business", businessRoutes);

// Business Management
app.use("/api/warehouses", warehouseRoutes);
app.use("/api/categories", categoryRoutes);

// Employee Management
app.use("/api/employees/invitations", employeeInvitationRoutes);
app.use("/api/employees", employeeRoutes);

// Products & Parties
app.use("/api/products", productRoutes);
app.use("/api/suppliers", supplierRoutes);
app.use("/api/customers", customerRoutes);

// Inventory & Purchasing
app.use("/api/inventory/movements", inventoryRoutes);
app.use("/api/inventory/alerts", stockAlertRoutes);
app.use("/api/inventory", warehouseInventoryRoutes);
app.use("/api/purchases", purchaseRoutes);

// Sales & Invoices
app.use("/api/sales", salesRoutes);
app.use("/api/invoices", invoiceRoutes);

// Notifications, Audit & Reporting
app.use("/api/notifications", notificationRoutes);
app.use("/api/audit-logs", auditLogRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/reports", reportRoutes);

export default app;
