import { Router } from "express";

import {
  createInventoryMovement,
  listInventoryMovements,
} from "./inventory.controller";
import {
  authenticateUser,
  requireBusinessAccess,
} from "../../middleware/auth.middleware";

const router = Router();

router.get("/", authenticateUser, requireBusinessAccess(), listInventoryMovements);
router.post(
  "/",
  authenticateUser,
  requireBusinessAccess("BUSINESS_OWNER", "INVENTORY_MANAGER"),
  createInventoryMovement
);

export default router;
