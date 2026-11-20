import { Router } from "express";

import {
  cancelSalesOrder,
  completeSalesOrder,
  createSalesOrder,
  getSalesOrder,
  listSalesOrders,
  returnSalesOrder,
  updateSalesOrder,
} from "./sales.controller";
import {
  authenticateUser,
  requireBusinessAccess,
} from "../../middleware/auth.middleware";

const router = Router();
const readAccess = requireBusinessAccess();
const manageAccess = requireBusinessAccess(
  "BUSINESS_OWNER",
  "SALES_EMPLOYEE"
);

router.get("/", authenticateUser, readAccess, listSalesOrders);
router.post("/", authenticateUser, manageAccess, createSalesOrder);
router.get("/:salesOrderId", authenticateUser, readAccess, getSalesOrder);
router.put("/:salesOrderId", authenticateUser, manageAccess, updateSalesOrder);
router.post(
  "/:salesOrderId/complete",
  authenticateUser,
  manageAccess,
  completeSalesOrder
);
router.post(
  "/:salesOrderId/cancel",
  authenticateUser,
  manageAccess,
  cancelSalesOrder
);
router.post(
  "/:salesOrderId/returns",
  authenticateUser,
  manageAccess,
  returnSalesOrder
);

export default router;
