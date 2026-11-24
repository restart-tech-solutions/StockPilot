import { Router } from "express";
import {
  registerUser,
  loginUser,
  getMe,
  firebaseRegisterUser,
  migrateLegacyAccount,
  firebaseSyncUser,
  changeLegacyPassword,
} from "./auth.controller";
import { authenticateUser } from "../../middleware/auth.middleware";

const router = Router();

// Legacy authentication (backward compatibility)
router.post("/register", registerUser);
router.post("/login", loginUser);

// Authenticated user profile
router.get("/me", authenticateUser, getMe);

// Change password
router.post("/change-password", authenticateUser, changeLegacyPassword);

// Firebase authentication
router.post("/firebase/register", firebaseRegisterUser);
router.post("/firebase/migrate", migrateLegacyAccount);
router.post("/firebase/sync", firebaseSyncUser);

export default router;