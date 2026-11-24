
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import User, { UserRole } from "../models/User";
import Membership from "../models/Membership";
import { firebaseAuth } from "../config/firebaseAdmin";

export type BusinessRole =
  | "BUSINESS_OWNER"
  | "INVENTORY_MANAGER"
  | "SALES_EMPLOYEE"
  | "ACCOUNTANT";

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    role: UserRole;
  };
  businessMembership?: {
    businessId: string;
    role: BusinessRole;
  };
}

interface JwtPayload {
  userId: string;
  role: UserRole;
}

export const authenticateUser = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      res.status(401).json({
        success: false,
        message: "Authentication token is required",
      });
      return;
    }

    const token = authHeader.split(" ")[1];
    const jwtSecret = process.env.JWT_SECRET;

    // Legacy JWT authentication
    if (jwtSecret) {
      try {
        const decoded = jwt.verify(token, jwtSecret) as JwtPayload;

        if (decoded?.userId && decoded?.role) {
          req.user = {
            userId: decoded.userId,
            role: decoded.role,
          };

          next();
          return;
        }
      } catch {
        // Continue to Firebase verification.
      }
    }

    // Firebase authentication
    const decodedToken = await firebaseAuth.verifyIdToken(token);

    if (!decodedToken.uid || decodedToken.email_verified !== true) {
      res.status(403).json({
        success: false,
        message: "A verified Firebase email is required.",
      });
      return;
    }

    const user = await User.findOne({
      firebaseUid: decodedToken.uid,
    });

    if (!user) {
      res.status(403).json({
        success: false,
        message: "Firebase account is not linked to StockPilot.",
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
    console.error("Authentication error:", error);

    res.status(401).json({
      success: false,
      message: "Invalid or expired authentication token",
    });
  }
};

export const authorizeRoles = (...allowedRoles: UserRole[]) => {
  return (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): void => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: "You do not have permission to access this resource",
      });
      return;
    }

    next();
  };
};

export const requireBusinessAccess = (...allowedRoles: BusinessRole[]) => {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    if (!req.user?.userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const bodyBusinessId =
      typeof req.body?.businessId === "string"
        ? req.body.businessId
        : undefined;

    const queryBusinessId =
      typeof req.query.businessId === "string"
        ? req.query.businessId
        : undefined;

    const paramBusinessId =
      typeof req.params.businessId === "string"
        ? req.params.businessId
        : undefined;

    const businessId =
      paramBusinessId ?? bodyBusinessId ?? queryBusinessId;

    if (!businessId || !mongoose.Types.ObjectId.isValid(businessId)) {
      res.status(400).json({
        success: false,
        message: "A valid businessId is required",
      });
      return;
    }

    try {
      const membership = await Membership.findOne({
        userId: req.user.userId,
        businessId,
      });

      if (!membership) {
        res.status(403).json({
          success: false,
          message: "You do not have access to this business",
        });
        return;
      }

      if (
        membership.status === "INACTIVE" ||
        membership.isActive === false
      ) {
        res.status(403).json({
          success: false,
          message: "Your employee account in this business is deactivated",
        });
        return;
      }

      if (
        allowedRoles.length > 0 &&
        !allowedRoles.includes(membership.role as BusinessRole)
      ) {
        res.status(403).json({
          success: false,
          message: "You do not have permission to access this resource",
        });
        return;
      }

      req.businessMembership = {
        businessId: membership.businessId.toString(),
        role: membership.role as BusinessRole,
      };

      next();
    } catch (error) {
      console.error("Business Membership Authorization Error:", error);

      res.status(500).json({
        success: false,
        message: "Failed to authorize business access",
      });
    }
  };
};
export const authorizeSuperAdmin = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user?.userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
      return;
    }

    const user = await User.findById(req.user.userId)
      .select("_id role isActive")
      .lean();

    if (!user || !user.isActive) {
      res.status(403).json({
        success: false,
        message: "Your account is inactive or unavailable.",
      });
      return;
    }

    if (user.role !== "SUPER_ADMIN") {
      res.status(403).json({
        success: false,
        message: "Super Admin access is required.",
      });
      return;
    }

    req.user.role = user.role;
    next();
  } catch (error) {
    console.error("Super Admin Authorization Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to verify Super Admin permissions.",
    });
  }
};