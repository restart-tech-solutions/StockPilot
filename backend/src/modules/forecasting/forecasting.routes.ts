import { Router } from "express";
import {
  authenticateUser,
  requireBusinessAccess,
} from "../../middleware/auth.middleware";
import { getInventoryForecast } from "./forecasting.controller";

const router = Router();

router.get(
  "/",
  authenticateUser,
  requireBusinessAccess(),
  getInventoryForecast
);

export default router;
