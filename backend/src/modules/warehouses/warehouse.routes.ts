import { Router } from "express";
import {
  createWarehouse,
  listWarehouses,
  getWarehouse,
  updateWarehouse,
  deleteWarehouse,
} from "./warehouse.controller";
import {
  authenticateUser,
  requireBusinessAccess,
} from "../../middleware/auth.middleware";

const router = Router();

router.post(
  "/",
  authenticateUser,
  requireBusinessAccess("BUSINESS_OWNER", "INVENTORY_MANAGER"),
  createWarehouse
);
router.get(
  "/",
  authenticateUser,
  requireBusinessAccess(),
  listWarehouses
);
router.get(
  "/:warehouseId",
  authenticateUser,
  requireBusinessAccess(),
  getWarehouse
);
router.put(
  "/:warehouseId",
  authenticateUser,
  requireBusinessAccess("BUSINESS_OWNER", "INVENTORY_MANAGER"),
  updateWarehouse
);
router.delete(
  "/:warehouseId",
  authenticateUser,
  requireBusinessAccess("BUSINESS_OWNER", "INVENTORY_MANAGER"),
  deleteWarehouse
);

export default router;
