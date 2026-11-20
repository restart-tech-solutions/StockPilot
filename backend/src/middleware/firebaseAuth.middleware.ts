
import { Response, NextFunction } from "express";
import { firebaseAuth } from "../config/firebaseAdmin";
import User from "../models/User";
import { AuthenticatedRequest } from "./auth.middleware";

export interface FirebaseAuthenticatedRequest extends AuthenticatedRequest {
  firebaseUser?: {
    uid: string;
    email?: string;
    emailVerified?: boolean;
    name?: string;
  };
}

export const authenticateFirebaseUser = async (
  req: FirebaseAuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      res.status(401).json({
        success: false,
        message: "Firebase authentication token is required",
      });
      return;
    }

    const token = authHeader.split(" ")[1];
    const decodedToken = await firebaseAuth.verifyIdToken(token);

    if (
      process.env.NODE_ENV === "production" &&
      decodedToken.email_verified !== true
    ) {
      res.status(403).json({
        success: false,
        message: "Please verify your email address first.",
      });
      return;
    }

    req.firebaseUser = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      emailVerified: decodedToken.email_verified,
      name: decodedToken.name,
    };

    const user = await User.findOne({
      firebaseUid: decodedToken.uid,
    });

    if (!user) {
      res.status(403).json({
        success: false,
        code: "MIGRATION_REQUIRED",
        message:
          "This Firebase account is not linked to a StockPilot account. Please complete account migration first.",
      });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({
        success: false,
        message: "This StockPilot account is inactive.",
      });
      return;
    }

    req.user = {
      userId: user._id.toString(),
      role: user.role,
    };

    next();
  } catch (error) {
    console.error("Firebase authentication error:", error);

    res.status(401).json({
      success: false,
      message: "Invalid or expired Firebase authentication token",
    });
  }
};
