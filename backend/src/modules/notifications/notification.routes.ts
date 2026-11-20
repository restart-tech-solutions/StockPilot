import { Router } from "express";
import {
  authenticateUser,
  requireBusinessAccess,
} from "../../middleware/auth.middleware";
import {
  listNotifications,
  markNotificationRead,
} from "./notification.controller";

const router = Router();

router.get("/", authenticateUser, requireBusinessAccess(), listNotifications);
router.post(
  "/:notificationId/read",
  authenticateUser,
  requireBusinessAccess(),
  markNotificationRead
);

export default router;
