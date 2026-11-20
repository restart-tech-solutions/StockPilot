
import { Response } from "express";
import mongoose from "mongoose";
import { createHash } from "crypto";

import User from "../../models/User";
import Membership from "../../models/Membership";
import EmployeeInvitation from "../../models/EmployeeInvitation";
import { AuthenticatedRequest } from "../../middleware/auth.middleware";

export const acceptEmployeeInvitation = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const token = req.body?.token;

  if (typeof token !== "string" || !/^[a-f0-9]{64}$/i.test(token)) {
    res.status(400).json({
      success: false,
      message: "A valid invitation token is required",
    });
    return;
  }

  if (
    !req.user?.userId ||
    !mongoose.Types.ObjectId.isValid(req.user.userId)
  ) {
    res.status(401).json({
      success: false,
      message: "Authentication required",
    });
    return;
  }

  const tokenHash = createHash("sha256").update(token).digest("hex");
  const session = await mongoose.startSession();

  try {
    let acceptedMembership: {
      businessId: string;
      role: string;
    } | null = null;

    let invitationExpired = false;

    await session.withTransaction(async () => {
      const user = await User.findById(req.user!.userId)
        .select("email isActive")
        .session(session);

      if (!user || !user.isActive) {
        throw new Error("ACTIVE_USER_REQUIRED");
      }

      const invitation = await EmployeeInvitation.findOne({
        tokenHash,
      }).session(session);

      if (!invitation) {
        throw new Error("INVITATION_NOT_FOUND");
      }

      if (invitation.status !== "PENDING") {
        throw new Error("INVITATION_NOT_PENDING");
      }

      const now = new Date();

      if (invitation.expiresAt <= now) {
        const updateResult = await EmployeeInvitation.updateOne(
          {
            _id: invitation._id,
            status: "PENDING",
          },
          {
            $set: { status: "EXPIRED" },
          },
          { session }
        );

        if (updateResult.modifiedCount === 1) {
          invitationExpired = true;
          return;
        }

        throw new Error("INVITATION_ALREADY_USED");
      }

      if (user.email.toLowerCase() !== invitation.email.toLowerCase()) {
        throw new Error("INVITATION_EMAIL_MISMATCH");
      }

      const existingMembership = await Membership.findOne({
        userId: user._id,
        businessId: invitation.businessId,
      }).session(session);

      if (existingMembership) {
        throw new Error("MEMBERSHIP_ALREADY_EXISTS");
      }

      await Membership.create(
        [
          {
            userId: user._id,
            businessId: invitation.businessId,
            role: invitation.role,
          },
        ],
        { session }
      );

      const updateResult = await EmployeeInvitation.updateOne(
        {
          _id: invitation._id,
          status: "PENDING",
          expiresAt: { $gt: now },
        },
        {
          $set: {
            status: "ACCEPTED",
            acceptedAt: now,
            acceptedBy: user._id,
          },
        },
        { session }
      );

      if (updateResult.modifiedCount !== 1) {
        throw new Error("INVITATION_ALREADY_USED");
      }

      acceptedMembership = {
        businessId: invitation.businessId.toString(),
        role: invitation.role,
      };
    });

    if (invitationExpired) {
      res.status(410).json({
        success: false,
        message: "This invitation has expired",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Employee invitation accepted successfully",
      membership: acceptedMembership,
    });
  } catch (error) {
    const errorCode = error instanceof Error ? error.message : "";

    const errors: Record<string, { status: number; message: string }> = {
      ACTIVE_USER_REQUIRED: {
        status: 403,
        message: "An active user account is required",
      },
      INVITATION_NOT_FOUND: {
        status: 404,
        message: "Invitation not found or invalid",
      },
      INVITATION_NOT_PENDING: {
        status: 409,
        message: "This invitation is no longer pending",
      },
      INVITATION_EMAIL_MISMATCH: {
        status: 403,
        message: "Your account email does not match the invitation",
      },
      MEMBERSHIP_ALREADY_EXISTS: {
        status: 409,
        message: "You are already a member of this business",
      },
      INVITATION_ALREADY_USED: {
        status: 409,
        message: "This invitation has already been used",
      },
    };

    const knownError = errors[errorCode];

    if (knownError) {
      res.status(knownError.status).json({
        success: false,
        message: knownError.message,
      });
      return;
    }

    if (
      error instanceof mongoose.mongo.MongoServerError &&
      error.code === 11000
    ) {
      res.status(409).json({
        success: false,
        message: "Membership or invitation already exists",
      });
      return;
    }

    console.error("Accept Employee Invitation Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to accept employee invitation",
    });
  } finally {
    await session.endSession();
  }
};
