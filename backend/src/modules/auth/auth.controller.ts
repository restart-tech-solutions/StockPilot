
import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import User from "../../models/User";
import { firebaseAuth } from "../../config/firebaseAdmin";
import { AuthenticatedRequest } from "../../middleware/auth.middleware";

// Extract Firebase bearer token
function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  return authHeader.split(" ")[1] || null;
}

// Verify Firebase token and require verified email
async function verifyFirebaseToken(req: Request) {
  const token = extractBearerToken(req);

  if (!token) {
    throw new Error("FIREBASE_TOKEN_REQUIRED");
  }

  const decodedToken = await firebaseAuth.verifyIdToken(token);

  if (decodedToken.email_verified !== true) {
    throw new Error("FIREBASE_EMAIL_NOT_VERIFIED");
  }

  const email = decodedToken.email?.trim().toLowerCase();

  if (!email) {
    throw new Error("FIREBASE_EMAIL_MISSING");
  }

  return { decodedToken, email };
}

// --------------------------------------------------
// LEGACY REGISTRATION (JWT COMPATIBILITY)
// --------------------------------------------------

export const registerUser = async (req: Request, res: Response) => {
  try {
    const { name, email, password } = req.body;

    if (
      typeof name !== "string" ||
      typeof email !== "string" ||
      typeof password !== "string" ||
      !name.trim() ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message: "Name, email and password are required",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters long",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: "BUSINESS_OWNER",
    });

    return res.status(201).json({
      success: true,
      message: "Business owner account created successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error: any) {
    console.error("Registration Error:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error during registration",
    });
  }
};

// --------------------------------------------------
// LEGACY LOGIN (KEEP UNTIL FIREBASE MIGRATION VERIFIED)
// --------------------------------------------------

export const loginUser = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const user = await User.findOne({
      email: normalizedEmail,
    }).select("+password");

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const isPasswordValid = await bcrypt.compare(
      password,
      user.password
    );

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
      return res.status(500).json({
        success: false,
        message: "JWT secret is not configured",
      });
    }

    const token = jwt.sign(
      {
        userId: user._id.toString(),
        role: user.role,
      },
      jwtSecret,
      { expiresIn: "1d" }
    );

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Login Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error during login",
    });
  }
};

// --------------------------------------------------
// GET CURRENT USER
// --------------------------------------------------

export const getMe = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const user = await User.findById(userId).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      user: {
        id: user._id,
        userId: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("GetMe Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error fetching user profile",
    });
  }
};

// --------------------------------------------------
// FIREBASE REGISTRATION
// --------------------------------------------------

export const firebaseRegisterUser = async (
  req: Request,
  res: Response
) => {
  try {
    const { decodedToken, email } = await verifyFirebaseToken(req);

    const existingByUid = await User.findOne({
      firebaseUid: decodedToken.uid,
    });

    if (existingByUid) {
      if (!existingByUid.isActive) {
        return res.status(403).json({
          success: false,
          message: "This StockPilot account is inactive.",
        });
      }

      return res.status(200).json({
        success: true,
        message: "User already registered",
        user: {
          id: existingByUid._id,
          name: existingByUid.name,
          email: existingByUid.email,
          role: existingByUid.role,
        },
      });
    }

    const existingByEmail = await User.findOne({ email });

    if (existingByEmail) {
      return res.status(409).json({
        success: false,
        code: "MIGRATION_REQUIRED",
        message:
          "An account with this email already exists. Please migrate using your existing StockPilot password.",
      });
    }

    const name =
      typeof req.body.name === "string" && req.body.name.trim()
        ? req.body.name.trim()
        : decodedToken.name || email.split("@")[0];

    const randomPassword = crypto.randomBytes(32).toString("hex");
    const hashedPassword = await bcrypt.hash(randomPassword, 12);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      firebaseUid: decodedToken.uid,
      role: "BUSINESS_OWNER",
      isActive: true,
    });

    return res.status(201).json({
      success: true,
      message: "Firebase account registered successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error: any) {
    console.error("Firebase Registration Error:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "This email or Firebase account is already registered.",
      });
    }

    if (error.message === "FIREBASE_TOKEN_REQUIRED") {
      return res.status(401).json({
        success: false,
        message: "Firebase authentication token is required",
      });
    }

    if (error.message === "FIREBASE_EMAIL_NOT_VERIFIED") {
      return res.status(403).json({
        success: false,
        message: "Please verify your Firebase email first.",
      });
    }

    if (error.message === "FIREBASE_EMAIL_MISSING") {
      return res.status(400).json({
        success: false,
        message: "Firebase account must have a valid email address.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error during Firebase registration",
    });
  }
};

// --------------------------------------------------
// SECURE LEGACY ACCOUNT MIGRATION
// --------------------------------------------------

export const migrateLegacyAccount = async (
  req: Request,
  res: Response
) => {
  try {
    const { decodedToken, email } = await verifyFirebaseToken(req);

    // Find the existing account using the verified Firebase email.
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Existing StockPilot account not found.",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "This StockPilot account is inactive.",
      });
    }

    if (user.firebaseUid) {
      if (user.firebaseUid === decodedToken.uid) {
        return res.status(200).json({
          success: true,
          message: "Account already linked.",
          user: {
            id: user._id,
            userId: user._id.toString(),
            name: user.name,
            email: user.email,
            role: user.role,
          },
        });
      }

      return res.status(409).json({
        success: false,
        message: "Account is linked to another Firebase user.",
      });
    }

    // Atomically link the existing MongoDB user.
    const linkedUser = await User.findOneAndUpdate(
      {
        _id: user._id,
        isActive: true,
        $or: [
          { firebaseUid: { $exists: false } },
          { firebaseUid: null },
          { firebaseUid: "" },
        ],
      },
      {
        $set: {
          firebaseUid: decodedToken.uid,
        },
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!linkedUser) {
      return res.status(409).json({
        success: false,
        message: "Account linking conflict. Please try again.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Existing StockPilot account migrated successfully.",
      user: {
        id: linkedUser._id,
        userId: linkedUser._id.toString(),
        name: linkedUser.name,
        email: linkedUser.email,
        role: linkedUser.role,
      },
    });
  } catch (error: any) {
    console.error("Account migration error:", error);

    if (error.message === "FIREBASE_TOKEN_REQUIRED") {
      return res.status(401).json({
        success: false,
        message: "Firebase authentication required.",
      });
    }

    if (error.message === "FIREBASE_EMAIL_NOT_VERIFIED") {
      return res.status(403).json({
        success: false,
        message: "Verify your Firebase email first.",
      });
    }

    if (error.message === "FIREBASE_EMAIL_MISSING") {
      return res.status(400).json({
        success: false,
        message: "Firebase email is missing.",
      });
    }

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "This Firebase account is already linked elsewhere.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Account migration failed.",
    });
  }
};




    // Atomic linking prevents overwriting an existing Firebase UID.
    
// --------------------------------------------------
// FIREBASE USER SYNC
// --------------------------------------------------

export const firebaseSyncUser = async (
  req: Request,
  res: Response
) => {
  try {
    const { decodedToken, email } = await verifyFirebaseToken(req);

    const user = await User.findOne({
      firebaseUid: decodedToken.uid,
    });

    if (user) {
      if (!user.isActive) {
        return res.status(403).json({
          success: false,
          message: "This StockPilot account is inactive.",
        });
      }

      return res.status(200).json({
        success: true,
        user: {
          id: user._id,
          userId: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
        },
      });
    }

    const legacyUser = await User.findOne({ email });

    if (legacyUser) {
      return res.status(409).json({
        success: false,
        code: "MIGRATION_REQUIRED",
        message:
          "An existing StockPilot account was found. Please complete legacy account migration using your old password.",
      });
    }

    return res.status(404).json({
      success: false,
      code: "USER_NOT_FOUND",
      message: "Account not registered in StockPilot.",
    });
  } catch (error: any) {
    console.error("Firebase Sync Error:", error);

    if (error.message === "FIREBASE_TOKEN_REQUIRED") {
      return res.status(401).json({
        success: false,
        message: "Firebase authentication token is required",
      });
    }

    if (error.message === "FIREBASE_EMAIL_NOT_VERIFIED") {
      return res.status(403).json({
        success: false,
        message: "Please verify your Firebase email first.",
      });
    }

    if (error.message === "FIREBASE_EMAIL_MISSING") {
      return res.status(400).json({
        success: false,
        message: "Firebase account must have a valid email address.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error during Firebase sync",
    });
  }
};

export const changeLegacyPassword = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const userId = req.user?.userId;
    const { currentPassword, newPassword } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    if (
      typeof currentPassword !== "string" ||
      typeof newPassword !== "string" ||
      !currentPassword ||
      !newPassword
    ) {
      return res.status(400).json({
        success: false,
        message: "Current and new passwords are required.",
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 8 characters.",
      });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({
        success: false,
        message: "New password must be different from current password.",
      });
    }

    const user = await User.findById(userId).select("+password");

    if (!user || !user.isActive) {
      return res.status(404).json({
        success: false,
        message: "Active user account not found.",
      });
    }

    if (user.firebaseUid) {
      return res.status(400).json({
        success: false,
        message: "Use Firebase Authentication to change this account's password.",
      });
    }

    const passwordMatches = await bcrypt.compare(
      currentPassword,
      user.password
    );

    if (!passwordMatches) {
      return res.status(400).json({
        success: false,
        message: "Current password is incorrect.",
      });
    }

    user.password = await bcrypt.hash(newPassword, 12);
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Password changed successfully.",
    });
  } catch (error) {
    console.error("Change Password Error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to change password.",
    });
  }
};
