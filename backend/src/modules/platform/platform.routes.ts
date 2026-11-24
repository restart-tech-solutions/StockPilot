import { Router } from "express";
import {
  authenticateUser,
  authorizeSuperAdmin,
} from "../../middleware/auth.middleware";
import { getPlatformOverview } from "./platform.controller";

const router = Router();

router.use(authenticateUser);
router.use(authorizeSuperAdmin);

router.get("/overview", getPlatformOverview);

export default router;