import { Router } from "express";
import {
  authenticateUser,
  requireBusinessAccess,
} from "../../middleware/auth.middleware";
import { listAuditLogs } from "./auditLog.controller";

const router = Router();

router.get(
  "/",
  authenticateUser,
  requireBusinessAccess("BUSINESS_OWNER", "ACCOUNTANT"),
  listAuditLogs
);

export default router;
