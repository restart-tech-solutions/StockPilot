import { Router } from "express";
import {
  createMeasurementUnit,
  listMeasurementUnits,
  getMeasurementUnit,
  updateMeasurementUnit,
  deleteMeasurementUnit,
} from "./measurementUnit.controller";
import {
  authenticateUser,
  requireBusinessAccess,
} from "../../middleware/auth.middleware";

const router = Router();

router.post(
  "/",
  authenticateUser,
  requireBusinessAccess("BUSINESS_OWNER", "INVENTORY_MANAGER"),
  createMeasurementUnit
);
router.get(
  "/",
  authenticateUser,
  requireBusinessAccess(),
  listMeasurementUnits
);
router.get(
  "/:unitId",
  authenticateUser,
  requireBusinessAccess(),
  getMeasurementUnit
);
router.put(
  "/:unitId",
  authenticateUser,
  requireBusinessAccess("BUSINESS_OWNER", "INVENTORY_MANAGER"),
  updateMeasurementUnit
);
router.delete(
  "/:unitId",
  authenticateUser,
  requireBusinessAccess("BUSINESS_OWNER", "INVENTORY_MANAGER"),
  deleteMeasurementUnit
);

export default router;
