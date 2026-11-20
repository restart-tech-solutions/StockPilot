import { Router } from "express";

import {
  approvePurchaseOrder,
  cancelPurchaseOrder,
  createPurchaseOrder,
  getPurchaseOrder,
  listPurchaseOrders,
  receivePurchaseOrder,
  updatePurchaseOrder,
} from "./purchase.controller";
import {
  authenticateUser,
  requireBusinessAccess,
} from "../../middleware/auth.middleware";

const router = Router();
const readAccess = requireBusinessAccess();
const manageAccess = requireBusinessAccess(
  "BUSINESS_OWNER",
  "INVENTORY_MANAGER"
);

router.get("/", authenticateUser, readAccess, listPurchaseOrders);
router.post("/", authenticateUser, manageAccess, createPurchaseOrder);
router.get("/:purchaseOrderId", authenticateUser, readAccess, getPurchaseOrder);
router.put("/:purchaseOrderId", authenticateUser, manageAccess, updatePurchaseOrder);
router.post("/:purchaseOrderId/approve", authenticateUser, manageAccess, approvePurchaseOrder);
router.post("/:purchaseOrderId/cancel", authenticateUser, manageAccess, cancelPurchaseOrder);
router.post("/:purchaseOrderId/receive", authenticateUser, manageAccess, receivePurchaseOrder);

export default router;
