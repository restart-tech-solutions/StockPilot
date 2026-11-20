import { Router } from "express";
import {
  createCustomer,
  deleteCustomer,
  getCustomer,
  listCustomers,
  updateCustomer,
} from "./customer.controller";
import {
  authenticateUser,
  requireBusinessAccess,
} from "../../middleware/auth.middleware";

const router = Router();
const ownerOnly = requireBusinessAccess("BUSINESS_OWNER");
const memberAccess = requireBusinessAccess();

router.post("/", authenticateUser, ownerOnly, createCustomer);
router.get("/", authenticateUser, memberAccess, listCustomers);
router.get("/:customerId", authenticateUser, memberAccess, getCustomer);
router.put("/:customerId", authenticateUser, ownerOnly, updateCustomer);
router.delete("/:customerId", authenticateUser, ownerOnly, deleteCustomer);

export default router;
