
import { Router } from "express";
import multer from "multer";

import {
  createProduct,
  deleteProduct,
  getProduct,
  listProducts,
  updateProduct,
} from "./product.controller";
import { importProducts } from "./product-import.controller";
import {
  authenticateUser,
  requireBusinessAccess,
} from "../../middleware/auth.middleware";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
});

const ownerOrInventoryManager = requireBusinessAccess(
  "BUSINESS_OWNER",
  "INVENTORY_MANAGER"
);
const memberAccess = requireBusinessAccess();

router.post("/", authenticateUser, ownerOrInventoryManager, createProduct);
router.get("/", authenticateUser, memberAccess, listProducts);

router.post(
  "/import",
  authenticateUser,
  upload.single("file"),
  ownerOrInventoryManager,
  importProducts
);

router.get("/:productId", authenticateUser, memberAccess, getProduct);
router.put("/:productId", authenticateUser, ownerOrInventoryManager, updateProduct);
router.delete("/:productId", authenticateUser, ownerOrInventoryManager, deleteProduct);

export default router;
