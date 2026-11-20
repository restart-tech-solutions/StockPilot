import { Router } from "express";
import {
  authenticateUser,
  requireBusinessAccess,
} from "../../middleware/auth.middleware";
import {
  exportInventoryReport,
  exportProductPerformanceReport,
  exportPurchaseReport,
  exportSalesReport,
  readInventoryReport,
  readProductPerformanceReport,
  readPurchaseReport,
  readSalesReport,
} from "./report.controller";

const router = Router();
const salesRead = requireBusinessAccess("BUSINESS_OWNER", "ACCOUNTANT");
const purchaseRead = requireBusinessAccess(
  "BUSINESS_OWNER",
  "ACCOUNTANT",
  "INVENTORY_MANAGER"
);
const inventoryRead = requireBusinessAccess(
  "BUSINESS_OWNER",
  "ACCOUNTANT",
  "INVENTORY_MANAGER"
);
const productRead = requireBusinessAccess(
  "BUSINESS_OWNER",
  "ACCOUNTANT"
);

router.get("/sales/export", authenticateUser, salesRead, exportSalesReport);
router.get("/sales", authenticateUser, salesRead, readSalesReport);
router.get("/purchases/export", authenticateUser, purchaseRead, exportPurchaseReport);
router.get("/purchases", authenticateUser, purchaseRead, readPurchaseReport);
router.get("/inventory/export", authenticateUser, inventoryRead, exportInventoryReport);
router.get("/inventory", authenticateUser, inventoryRead, readInventoryReport);
router.get(
  "/products/export",
  authenticateUser,
  productRead,
  exportProductPerformanceReport
);
router.get(
  "/products",
  authenticateUser,
  productRead,
  readProductPerformanceReport
);

export default router;
