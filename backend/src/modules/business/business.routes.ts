import { Router } from "express";
import {
  createBusiness,
  listBusinesses,
  getBusiness,
  updateBusiness,
} from "./business.controller";
import {
  authenticateUser,
  requireBusinessAccess,
} from "../../middleware/auth.middleware";

const router = Router();

router.post("/", authenticateUser, createBusiness);
router.get("/", authenticateUser, listBusinesses);
router.get(
  "/:businessId",
  authenticateUser,
  requireBusinessAccess(),
  getBusiness
);
router.put(
  "/:businessId",
  authenticateUser,
  requireBusinessAccess("BUSINESS_OWNER"),
  updateBusiness
);

export default router;