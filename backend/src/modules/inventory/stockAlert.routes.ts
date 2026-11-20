import { Router } from "express";
import {
  authenticateUser,
  requireBusinessAccess,
} from "../../middleware/auth.middleware";
import { listStockAlerts } from "./stockAlert.controller";

const router = Router();

router.get("/", authenticateUser, requireBusinessAccess(), listStockAlerts);

export default router;
