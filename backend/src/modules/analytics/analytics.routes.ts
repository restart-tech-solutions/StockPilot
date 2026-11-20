import { Router } from "express";
import {
  authenticateUser,
  requireBusinessAccess,
} from "../../middleware/auth.middleware";
import {
  readAnalyticsOverview,
  readInventoryAnalytics,
  readPurchaseAnalytics,
  readSalesAnalytics,
} from "./analytics.controller";

const router = Router();
const financialRead = requireBusinessAccess("BUSINESS_OWNER", "ACCOUNTANT");
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

router.get(
  "/overview",
  authenticateUser,
  financialRead,
  readAnalyticsOverview
);
router.get("/sales", authenticateUser, financialRead, readSalesAnalytics);
router.get(
  "/purchases",
  authenticateUser,
  purchaseRead,
  readPurchaseAnalytics
);
router.get(
  "/inventory",
  authenticateUser,
  inventoryRead,
  readInventoryAnalytics
);

export default router;
