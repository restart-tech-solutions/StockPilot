
import { Router } from "express";
import {
  getStockNotificationPreferences,
  saveStockNotificationPreferences,
} from "./stockNotificationPreference.controller";
import {
  authenticateUser,
  requireBusinessAccess,
} from "../../middleware/auth.middleware";

const router = Router();

router.get(
  "/",
  authenticateUser,
  requireBusinessAccess(),
  getStockNotificationPreferences
);
router.post(
  "/",
  authenticateUser,
  requireBusinessAccess("BUSINESS_OWNER"),
  saveStockNotificationPreferences
);

export default router;
