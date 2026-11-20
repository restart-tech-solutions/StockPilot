
import { Router } from "express";
import {
  createCategory,
  listCategories,
  getCategory,
  updateCategory,
  deleteCategory,
} from "./category.controller";
import {
  authenticateUser,
  requireBusinessAccess,
} from "../../middleware/auth.middleware";

const router = Router();

router.post(
  "/",
  authenticateUser,
  requireBusinessAccess("BUSINESS_OWNER", "INVENTORY_MANAGER"),
  createCategory
);
router.get(
  "/",
  authenticateUser,
  requireBusinessAccess(),
  listCategories
);
router.get(
  "/:categoryId",
  authenticateUser,
  requireBusinessAccess(),
  getCategory
);
router.put(
  "/:categoryId",
  authenticateUser,
  requireBusinessAccess("BUSINESS_OWNER", "INVENTORY_MANAGER"),
  updateCategory
);
router.delete(
  "/:categoryId",
  authenticateUser,
  requireBusinessAccess("BUSINESS_OWNER", "INVENTORY_MANAGER"),
  deleteCategory
);

export default router;
