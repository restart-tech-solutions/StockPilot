import { Response } from "express";
import mongoose from "mongoose";

import Membership from "../../models/Membership";
import User from "../../models/User";
import { AuthenticatedRequest } from "../../middleware/auth.middleware";
import { recordAuditLog } from "../../services/auditLog.service";

const employeeRoles = [
  "INVENTORY_MANAGER",
  "SALES_EMPLOYEE",
  "ACCOUNTANT",
] as const;

const getRouteParam = (req: AuthenticatedRequest, name: string): string =>
  typeof req.params[name] === "string" ? req.params[name] : "";

export const getEmployees = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const businessId = req.businessMembership?.businessId;

    if (!businessId || !mongoose.Types.ObjectId.isValid(businessId)) {
      res.status(400).json({
        success: false,
        message: "Valid business context is required",
      });
      return;
    }

    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 10);
    const search =
      typeof req.query.search === "string"
        ? req.query.search.trim()
        : "";
    const role =
      typeof req.query.role === "string" ? req.query.role : undefined;
    const status =
      typeof req.query.status === "string" ? req.query.status.toUpperCase() : undefined;

    if (
      !Number.isInteger(page) ||
      page < 1 ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 100
    ) {
      res.status(400).json({
        success: false,
        message: "Invalid pagination parameters",
      });
      return;
    }

    if (
      role &&
      !employeeRoles.includes(role as (typeof employeeRoles)[number])
    ) {
      res.status(400).json({
        success: false,
        message: "Invalid employee role filter",
      });
      return;
    }

    if (status && !["ACTIVE", "INACTIVE", "ALL"].includes(status)) {
      res.status(400).json({
        success: false,
        message: "Invalid employee status filter",
      });
      return;
    }

    const membershipFilter: Record<string, unknown> = {
      businessId,
      role: role ? role : { $in: employeeRoles },
    };

    if (status && status !== "ALL") {
      if (status === "ACTIVE") {
        membershipFilter.$or = [
          { status: "ACTIVE" },
          { status: { $exists: false } },
        ];
      } else {
        membershipFilter.status = "INACTIVE";
      }
    }

    if (search) {
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

      const businessMemberships = await Membership.find({
        businessId,
        role: { $in: employeeRoles },
      }).select("userId");

      const businessUserIds = businessMemberships.map(
        (membership) => membership.userId
      );

      const matchingUsers = await User.find({
        _id: { $in: businessUserIds },
        $or: [
          { name: { $regex: escapedSearch, $options: "i" } },
          { email: { $regex: escapedSearch, $options: "i" } },
        ],
      }).select("_id");

      const userIds = matchingUsers.map((user) => user._id);

      if (userIds.length === 0) {
        res.status(200).json({
          success: true,
          employees: [],
          pagination: {
            total: 0,
            page,
            limit,
            totalPages: 0,
          },
        });
        return;
      }

      membershipFilter.userId = { $in: userIds };
    }

    const total = await Membership.countDocuments(membershipFilter);

    const employees = await Membership.find(membershipFilter)
      .populate({
        path: "userId",
        select: "name email isActive",
      })
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    res.status(200).json({
      success: true,
      employees,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get Employees Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch employees",
    });
  }
};

export const getEmployeeById = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const businessId = req.businessMembership?.businessId;
    const employeeId = getRouteParam(req, "employeeId");

    if (!businessId || !mongoose.Types.ObjectId.isValid(businessId)) {
      res.status(400).json({
        success: false,
        message: "Valid business context is required",
      });
      return;
    }

    if (!employeeId || !mongoose.Types.ObjectId.isValid(employeeId)) {
      res.status(400).json({
        success: false,
        message: "Invalid employee ID",
      });
      return;
    }

    const employee = await Membership.findOne({
      $or: [{ _id: employeeId }, { userId: employeeId }],
      businessId,
    })
      .populate({
        path: "userId",
        select: "name email isActive",
      })
      .lean();

    if (!employee) {
      res.status(404).json({
        success: false,
        message: "Employee not found in this business",
      });
      return;
    }

    res.status(200).json({
      success: true,
      employee,
    });
  } catch (error) {
    console.error("Get Employee By ID Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve employee",
    });
  }
};

export const updateEmployeeRole = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const businessId = req.businessMembership?.businessId;
    const employeeId = getRouteParam(req, "employeeId");
    const { role } = req.body;

    if (!businessId || !mongoose.Types.ObjectId.isValid(businessId)) {
      res.status(400).json({
        success: false,
        message: "Valid business context is required",
      });
      return;
    }

    if (!employeeId || !mongoose.Types.ObjectId.isValid(employeeId)) {
      res.status(400).json({
        success: false,
        message: "Invalid employee ID",
      });
      return;
    }

    if (
      !role ||
      typeof role !== "string" ||
      !employeeRoles.includes(role as (typeof employeeRoles)[number])
    ) {
      res.status(400).json({
        success: false,
        message: "Invalid employee role",
      });
      return;
    }

    const membership = await Membership.findOne({
      $or: [{ _id: employeeId }, { userId: employeeId }],
      businessId,
    });

    if (!membership) {
      res.status(404).json({
        success: false,
        message: "Employee not found in this business",
      });
      return;
    }

    if (membership.role === "BUSINESS_OWNER") {
      res.status(400).json({
        success: false,
        message: "Cannot change role of a business owner",
      });
      return;
    }

    const previousRole = membership.role;
    membership.role = role;
    await membership.save();

    const populated = await Membership.findById(membership._id)
      .populate({
        path: "userId",
        select: "name email isActive",
      })
      .lean();

    if (req.user?.userId) {
      await recordAuditLog({
        businessId,
        actorUserId: req.user.userId,
        action: "EMPLOYEE_ROLE_UPDATED",
        resourceType: "EMPLOYEE",
        resourceId: membership._id.toString(),
        description: `Updated employee role from ${previousRole} to ${role}`,
      });
    }

    res.status(200).json({
      success: true,
      message: "Employee role updated successfully",
      employee: populated,
    });
  } catch (error) {
    console.error("Update Employee Role Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update employee role",
    });
  }
};

export const updateEmployeeStatus = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const businessId = req.businessMembership?.businessId;
    const employeeId = getRouteParam(req, "employeeId");
    const { status, isActive } = req.body;

    if (!businessId || !mongoose.Types.ObjectId.isValid(businessId)) {
      res.status(400).json({
        success: false,
        message: "Valid business context is required",
      });
      return;
    }

    if (!employeeId || !mongoose.Types.ObjectId.isValid(employeeId)) {
      res.status(400).json({
        success: false,
        message: "Invalid employee ID",
      });
      return;
    }

    let targetStatus: "ACTIVE" | "INACTIVE";

    if (status !== undefined) {
      if (
        typeof status !== "string" ||
        !["ACTIVE", "INACTIVE"].includes(status.toUpperCase())
      ) {
        res.status(400).json({
          success: false,
          message: "Invalid employee status. Allowed values: ACTIVE, INACTIVE",
        });
        return;
      }
      targetStatus = status.toUpperCase() as "ACTIVE" | "INACTIVE";
    } else if (isActive !== undefined) {
      if (typeof isActive !== "boolean") {
        res.status(400).json({
          success: false,
          message: "isActive must be a boolean",
        });
        return;
      }
      targetStatus = isActive ? "ACTIVE" : "INACTIVE";
    } else {
      res.status(400).json({
        success: false,
        message: "status or isActive is required",
      });
      return;
    }

    const membership = await Membership.findOne({
      $or: [{ _id: employeeId }, { userId: employeeId }],
      businessId,
    });

    if (!membership) {
      res.status(404).json({
        success: false,
        message: "Employee not found in this business",
      });
      return;
    }

    if (membership.role === "BUSINESS_OWNER") {
      res.status(400).json({
        success: false,
        message: "Cannot deactivate or remove business owner",
      });
      return;
    }

    membership.status = targetStatus;
    membership.isActive = targetStatus === "ACTIVE";
    await membership.save();

    const populated = await Membership.findById(membership._id)
      .populate({
        path: "userId",
        select: "name email isActive",
      })
      .lean();

    if (req.user?.userId) {
      await recordAuditLog({
        businessId,
        actorUserId: req.user.userId,
        action:
          targetStatus === "ACTIVE"
            ? "EMPLOYEE_REACTIVATED"
            : "EMPLOYEE_DEACTIVATED",
        resourceType: "EMPLOYEE",
        resourceId: membership._id.toString(),
        description: `${
          targetStatus === "ACTIVE" ? "Reactivated" : "Deactivated"
        } employee`,
      });
    }

    res.status(200).json({
      success: true,
      message: `Employee ${
        targetStatus === "ACTIVE" ? "reactivated" : "deactivated"
      } successfully`,
      employee: populated,
    });
  } catch (error) {
    console.error("Update Employee Status Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update employee status",
    });
  }
};

export const deactivateEmployee = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  req.body = { ...req.body, status: "INACTIVE" };
  return updateEmployeeStatus(req, res);
};

export const reactivateEmployee = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  req.body = { ...req.body, status: "ACTIVE" };
  return updateEmployeeStatus(req, res);
};

export const deleteEmployee = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const businessId = req.businessMembership?.businessId;
    const employeeId = getRouteParam(req, "employeeId");

    if (!businessId || !mongoose.Types.ObjectId.isValid(businessId)) {
      res.status(400).json({
        success: false,
        message: "Valid business context is required",
      });
      return;
    }

    if (!employeeId || !mongoose.Types.ObjectId.isValid(employeeId)) {
      res.status(400).json({
        success: false,
        message: "Invalid employee ID",
      });
      return;
    }

    const membership = await Membership.findOne({
      $or: [{ _id: employeeId }, { userId: employeeId }],
      businessId,
    });

    if (!membership) {
      res.status(404).json({
        success: false,
        message: "Employee not found in this business",
      });
      return;
    }

    if (membership.role === "BUSINESS_OWNER") {
      res.status(400).json({
        success: false,
        message: "Cannot deactivate or remove business owner",
      });
      return;
    }

    // Soft deactivation preserves historical associations, sales, receipts, and audit trails
    membership.status = "INACTIVE";
    membership.isActive = false;
    await membership.save();

    const populated = await Membership.findById(membership._id)
      .populate({
        path: "userId",
        select: "name email isActive",
      })
      .lean();

    if (req.user?.userId) {
      await recordAuditLog({
        businessId,
        actorUserId: req.user.userId,
        action: "EMPLOYEE_DEACTIVATED",
        resourceType: "EMPLOYEE",
        resourceId: membership._id.toString(),
        description: "Removed (deactivated) employee to preserve historical records",
      });
    }

    res.status(200).json({
      success: true,
      message: "Employee removed successfully",
      employee: populated,
    });
  } catch (error) {
    console.error("Delete Employee Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to remove employee",
    });
  }
};
