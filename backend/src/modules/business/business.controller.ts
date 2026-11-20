import { Response } from "express";
import mongoose from "mongoose";
import Business, { IBusiness } from "../../models/Business";
import Membership, { IMembership } from "../../models/Membership";
import { AuthenticatedRequest } from "../../middleware/auth.middleware";

export const createBusiness = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  let session: mongoose.ClientSession | undefined;

  try {
    const { businessName, contactDetails, category, location, currency } =
      req.body;

    if (
      typeof businessName !== "string" ||
      !businessName.trim() ||
      typeof category !== "string" ||
      !category.trim() ||
      typeof location !== "string" ||
      !location.trim() ||
      typeof currency !== "string" ||
      !currency.trim()
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Business name, category, location and currency are required",
      });
    }

    if (!req.user?.userId || req.user.role !== "BUSINESS_OWNER") {
      return res.status(403).json({
        success: false,
        message: "Only business owners can create a business workspace",
      });
    }

    if (
      contactDetails !== undefined &&
      (typeof contactDetails !== "object" ||
        contactDetails === null ||
        Array.isArray(contactDetails))
    ) {
      return res.status(400).json({
        success: false,
        message: "Contact details must be an object",
      });
    }

    const normalizedContactDetails =
      contactDetails &&
      typeof contactDetails === "object"
        ? {
            email:
              typeof contactDetails.email === "string"
                ? contactDetails.email.trim()
                : undefined,
            phone:
              typeof contactDetails.phone === "string"
                ? contactDetails.phone.trim()
                : undefined,
          }
        : undefined;

    if (
      contactDetails?.email !== undefined &&
      (typeof contactDetails.email !== "string" ||
        !contactDetails.email.trim())
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid contact email",
      });
    }

    if (
      normalizedContactDetails?.email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedContactDetails.email)
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid contact email",
      });
    }

    if (
      contactDetails?.phone !== undefined &&
      (typeof contactDetails.phone !== "string" ||
        !contactDetails.phone.trim())
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid contact phone",
      });
    }

    session = await mongoose.startSession();
    const transactionSession = session;
    let business: IBusiness | undefined;
    let membership: IMembership | undefined;

    await transactionSession.withTransaction(async () => {
      [business] = await Business.create(
        [
          {
            businessName: businessName.trim(),
            ownerId: req.user!.userId,
            contactDetails: normalizedContactDetails,
            category: category.trim(),
            location: location.trim(),
            currency: currency.trim().toUpperCase(),
          },
        ],
        { session: transactionSession }
      );

      [membership] = await Membership.create(
        [
          {
            userId: req.user!.userId,
            businessId: business._id,
            role: "BUSINESS_OWNER",
          },
        ],
        { session: transactionSession }
      );
    });

    await transactionSession.endSession();
    session = undefined;

    if (!business || !membership) {
      return res.status(500).json({
        success: false,
        message: "Failed to create business workspace",
      });
    }

    return res.status(201).json({
      success: true,
      message: "Business workspace created successfully",
      business: {
        id: business._id,
        businessName: business.businessName,
        ownerId: business.ownerId,
        contactDetails: business.contactDetails,
        category: business.category,
        location: business.location,
        currency: business.currency,
        membershipRole: membership.role,
      },
      membership: {
        id: membership._id,
        userId: membership.userId,
        role: membership.role,
      },
    });
  } catch (error) {
    console.error("Business Workspace Creation Error:", error);
    if (session) {
      await session.endSession().catch((cleanupError) => {
        console.error("Business transaction session cleanup failed:", cleanupError);
      });
    }
    return res.status(500).json({
      success: false,
      message: "Failed to create business workspace",
    });
  }
};

export const listBusinesses = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    if (!req.user?.userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const memberships = await Membership.find({
      userId: req.user.userId,
    }).lean();

    const businessIds = memberships.map(
      (membership) => membership.businessId
    );
    const businesses = await Business.find({
      _id: { $in: businessIds },
    }).lean();

    const membershipByBusinessId = new Map(
      memberships.map((membership) => [
        membership.businessId.toString(),
        membership.role,
      ])
    );

    return res.status(200).json({
      success: true,
      businesses: businesses.map((business) => ({
        id: business._id,
        businessName: business.businessName,
        ownerId: business.ownerId,
        contactDetails: business.contactDetails,
        category: business.category,
        location: business.location,
        currency: business.currency,
        membershipRole: membershipByBusinessId.get(
          business._id.toString()
        ),
      })),
    });
  } catch (error) {
    console.error("Business Workspace List Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to list business workspaces",
    });
  }
};

export const getBusiness = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const membership = req.businessMembership;
    const businessId = membership?.businessId;

    if (!businessId) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this business",
      });
    }

    const business = await Business.findById(businessId).lean();

    if (!business) {
      return res.status(404).json({
        success: false,
        message: "Business workspace not found",
      });
    }

    return res.status(200).json({
      success: true,
      business: {
        id: business._id,
        businessName: business.businessName,
        ownerId: business.ownerId,
        contactDetails: business.contactDetails,
        category: business.category,
        location: business.location,
        currency: business.currency,
        membershipRole: membership.role,
      },
    });
  } catch (error) {
    console.error("Business Workspace Retrieval Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve business workspace",
    });
  }
};

export const updateBusiness = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const membership = req.businessMembership;
    const businessId = membership?.businessId;

    if (!businessId) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this business",
      });
    }

    const allowedFields = [
      "businessName",
      "contactDetails",
      "category",
      "location",
      "currency",
    ];
    const providedFields = Object.keys(req.body ?? {});
    const unsupportedFields = providedFields.filter(
      (field) => !allowedFields.includes(field)
    );

    if (unsupportedFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Unsupported business workspace fields",
      });
    }

    if (providedFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one business workspace field is required",
      });
    }

    const updates: Record<string, unknown> = {};

    for (const field of [
      "businessName",
      "category",
      "location",
      "currency",
    ]) {
      if (req.body[field] !== undefined) {
        if (
          typeof req.body[field] !== "string" ||
          !req.body[field].trim()
        ) {
          return res.status(400).json({
            success: false,
            message: `${field} must be a non-empty string`,
          });
        }

        updates[field] =
          field === "currency"
            ? req.body[field].trim().toUpperCase()
            : req.body[field].trim();
      }
    }

    if (req.body.contactDetails !== undefined) {
      if (
        typeof req.body.contactDetails !== "object" ||
        req.body.contactDetails === null ||
        Array.isArray(req.body.contactDetails)
      ) {
        return res.status(400).json({
          success: false,
          message: "Contact details must be an object",
        });
      }

      const contactDetails: { email?: string; phone?: string } = {};

      if (req.body.contactDetails.email !== undefined) {
        if (
          typeof req.body.contactDetails.email !== "string" ||
          !req.body.contactDetails.email.trim()
        ) {
          return res.status(400).json({
            success: false,
            message: "Contact email must be a non-empty string",
          });
        }

        if (
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
            req.body.contactDetails.email.trim()
          )
        ) {
          return res.status(400).json({
            success: false,
            message: "Please provide a valid contact email",
          });
        }

        contactDetails.email =
          req.body.contactDetails.email.trim();
      }

      if (req.body.contactDetails.phone !== undefined) {
        if (
          typeof req.body.contactDetails.phone !== "string" ||
          !req.body.contactDetails.phone.trim()
        ) {
          return res.status(400).json({
            success: false,
            message: "Contact phone must be a non-empty string",
          });
        }

        contactDetails.phone =
          req.body.contactDetails.phone.trim();
      }

      updates.contactDetails = contactDetails;
    }

    const business = await Business.findOneAndUpdate(
      {
        _id: businessId,
      },
      { $set: updates },
      { new: true, runValidators: true }
    ).lean();

    if (!business) {
      return res.status(403).json({
        success: false,
        message: "Only the business owner can update this workspace",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Business workspace updated successfully",
      business: {
        id: business._id,
        businessName: business.businessName,
        ownerId: business.ownerId,
        contactDetails: business.contactDetails,
        category: business.category,
        location: business.location,
        currency: business.currency,
        membershipRole: membership.role,
      },
    });
  } catch (error) {
    console.error("Business Workspace Update Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update business workspace",
    });
  }
};
