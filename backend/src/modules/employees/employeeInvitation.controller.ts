
import { Response } from "express";
import mongoose from "mongoose";
import { randomBytes, createHash } from "crypto";

import EmployeeInvitation from "../../models/EmployeeInvitation";
import { AuthenticatedRequest } from "../../middleware/auth.middleware";

const allowedRoles = [
  "INVENTORY_MANAGER",
  "SALES_EMPLOYEE",
  "ACCOUNTANT",
] as const;

export const createEmployeeInvitation = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { email, role } = req.body;
    const businessId = req.businessMembership?.businessId;

    if (!businessId || !email || !role) {
      res.status(400).json({
        success: false,
        message: "Business ID, email and role are required",
      });
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(businessId)) {
      res.status(400).json({
        success: false,
        message: "Invalid business ID",
      });
      return;
    }

    if (typeof email !== "string") {
      res.status(400).json({
        success: false,
        message: "Email must be a string",
      });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(normalizedEmail)) {
      res.status(400).json({
        success: false,
        message: "Please provide a valid email address",
      });
      return;
    }

    if (
      typeof role !== "string" ||
      !allowedRoles.includes(role as (typeof allowedRoles)[number])
    ) {
      res.status(400).json({
        success: false,
        message: "Invalid employee role",
      });
      return;
    }

    const validatedRole = role as (typeof allowedRoles)[number];
    const now = new Date();

    // Mark an expired pending invitation before creating a new one.
    await EmployeeInvitation.updateOne(
      {
        businessId,
        email: normalizedEmail,
        status: "PENDING",
        expiresAt: { $lte: now },
      },
      {
        $set: { status: "EXPIRED" },
      }
    );

    const existingInvitation = await EmployeeInvitation.findOne({
      businessId,
      email: normalizedEmail,
      status: "PENDING",
      expiresAt: { $gt: now },
    });

    if (existingInvitation) {
      res.status(409).json({
        success: false,
        message: "A pending invitation already exists for this email",
      });
      return;
    }

    // Generate a random token; store only its SHA-256 hash.
    const invitationToken = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256")
      .update(invitationToken)
      .digest("hex");

    const expiresAt = new Date(
      now.getTime() + 7 * 24 * 60 * 60 * 1000
    );

    const invitation = await EmployeeInvitation.create({
      businessId,
      email: normalizedEmail,
      role: validatedRole,
      tokenHash,
      expiresAt,
      status: "PENDING",
    });

    res.status(201).json({
      success: true,
      message: "Employee invitation created successfully",
      invitation: {
        id: invitation._id,
        email: invitation.email,
        role: invitation.role,
        status: invitation.status,
        expiresAt: invitation.expiresAt,
      },
      invitationToken,
    });
  } catch (error) {
    if (
      error instanceof mongoose.mongo.MongoServerError &&
      error.code === 11000
    ) {
      res.status(409).json({
        success: false,
        message: "A pending invitation already exists for this email",
      });
      return;
    }

    console.error("Employee Invitation Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to create employee invitation",
    });
  }
};
