import { Router } from "express";
import {
  getTaxInvoiceSettings,
  createOrUpdateTaxInvoiceSettings,
} from "./taxInvoiceSettings.controller";
import {
  authenticateUser,
  requireBusinessAccess,
} from "../../middleware/auth.middleware";

const router = Router();

router.get(
  "/",
  authenticateUser,
  requireBusinessAccess(),
  getTaxInvoiceSettings
);
router.post(
  "/",
  authenticateUser,
  requireBusinessAccess("BUSINESS_OWNER"),
  createOrUpdateTaxInvoiceSettings
);

export default router;
