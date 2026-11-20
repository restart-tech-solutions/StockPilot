import { Router } from "express";
import {
  authenticateUser,
  requireBusinessAccess,
} from "../../middleware/auth.middleware";
import {
  getEmployees,
  getEmployeeById,
  updateEmployeeRole,
  updateEmployeeStatus,
  deactivateEmployee,
  reactivateEmployee,
  deleteEmployee,
} from "./employee.controller";

const router = Router();

// List employees
router.get(
  "/",
  authenticateUser,
  requireBusinessAccess("BUSINESS_OWNER"),
  getEmployees
);

// Get employee details
router.get(
  "/:employeeId",
  authenticateUser,
  requireBusinessAccess("BUSINESS_OWNER"),
  getEmployeeById
);

// Update employee role
router.patch(
  "/:employeeId/role",
  authenticateUser,
  requireBusinessAccess("BUSINESS_OWNER"),
  updateEmployeeRole
);
router.put(
  "/:employeeId/role",
  authenticateUser,
  requireBusinessAccess("BUSINESS_OWNER"),
  updateEmployeeRole
);

// Update employee status (activate/deactivate)
router.patch(
  "/:employeeId/status",
  authenticateUser,
  requireBusinessAccess("BUSINESS_OWNER"),
  updateEmployeeStatus
);
router.put(
  "/:employeeId/status",
  authenticateUser,
  requireBusinessAccess("BUSINESS_OWNER"),
  updateEmployeeStatus
);

// Explicit deactivate/reactivate endpoints
router.patch(
  "/:employeeId/deactivate",
  authenticateUser,
  requireBusinessAccess("BUSINESS_OWNER"),
  deactivateEmployee
);
router.post(
  "/:employeeId/deactivate",
  authenticateUser,
  requireBusinessAccess("BUSINESS_OWNER"),
  deactivateEmployee
);

router.patch(
  "/:employeeId/reactivate",
  authenticateUser,
  requireBusinessAccess("BUSINESS_OWNER"),
  reactivateEmployee
);
router.post(
  "/:employeeId/reactivate",
  authenticateUser,
  requireBusinessAccess("BUSINESS_OWNER"),
  reactivateEmployee
);

// Soft delete / remove employee
router.delete(
  "/:employeeId",
  authenticateUser,
  requireBusinessAccess("BUSINESS_OWNER"),
  deleteEmployee
);

export default router;
