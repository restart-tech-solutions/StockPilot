import { Router } from "express";
import {
  createSupplier,
  deleteSupplier,
  getSupplier,
  listSuppliers,
  updateSupplier,
} from "./supplier.controller";
import {
  authenticateUser,
  requireBusinessAccess,
} from "../../middleware/auth.middleware";

const router = Router();
const ownerOnly = requireBusinessAccess("BUSINESS_OWNER");
const memberAccess = requireBusinessAccess();

router.post("/", authenticateUser, ownerOnly, createSupplier);
router.get("/", authenticateUser, memberAccess, listSuppliers);
router.get("/:supplierId", authenticateUser, memberAccess, getSupplier);
router.put("/:supplierId", authenticateUser, ownerOnly, updateSupplier);
router.delete("/:supplierId", authenticateUser, ownerOnly, deleteSupplier);

export default router;
