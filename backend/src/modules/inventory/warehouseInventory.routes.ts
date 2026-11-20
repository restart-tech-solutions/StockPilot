import { Router } from "express";

import {
  createInventoryTransfer,
  listInventoryBalances,
  listInventoryTransfers,
} from "./warehouseInventory.controller";
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

router.get("/balances", authenticateUser, readAccess, listInventoryBalances);
router.get("/transfers", authenticateUser, readAccess, listInventoryTransfers);
router.post("/transfers", authenticateUser, manageAccess, createInventoryTransfer);

export default router;
