
import { Router } from "express";
import {
  authenticateUser,
  requireBusinessAccess,
} from "../../middleware/auth.middleware";

import {
  getSubscriptionPlans,
  getCurrentSubscription,
} from "./subscription.controller";

import {
  createSubscriptionOrder,
  verifySubscriptionPayment,
  handleRazorpayWebhook,
} from "./razorpay.controller";

const router = Router();

const ownerAccess = requireBusinessAccess("BUSINESS_OWNER");

// Razorpay webhook — signature verified in controller
router.post("/webhook", handleRazorpayWebhook);

// Subscription plans
router.get("/plans", authenticateUser, getSubscriptionPlans);

// Current subscription
router.get(
  "/current",
  authenticateUser,
  requireBusinessAccess(),
  getCurrentSubscription
);

// Create Razorpay order
router.post(
  "/create-order",
  authenticateUser,
  ownerAccess,
  createSubscriptionOrder
);

// Verify Razorpay payment
router.post(
  "/verify-payment",
  authenticateUser,
  ownerAccess,
  verifySubscriptionPayment
);

export default router;
