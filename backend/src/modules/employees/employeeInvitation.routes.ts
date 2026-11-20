
import { Router } from "express";
import {
  authenticateUser,
  requireBusinessAccess,
} from "../../middleware/auth.middleware";
import { createEmployeeInvitation } from "./employeeInvitation.controller";
import { acceptEmployeeInvitation } from "./employeeAcceptance.controller";

const router = Router();

// Create invitation
router.post(
  "/",
  authenticateUser,
  requireBusinessAccess("BUSINESS_OWNER"),
  createEmployeeInvitation
);

// Accept invitation
router.post(
  "/accept",
  authenticateUser,
  acceptEmployeeInvitation
);

export default router;
