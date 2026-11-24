import { Response } from "express";
import { AuthenticatedRequest } from "../../middleware/auth.middleware";
import Business from "../../models/Business";
import Subscription from "../../models/Subscription";
import Payment from "../../models/Payment";

export const getPlatformOverview = async (
  _req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const now = new Date();

    const [
      totalBusinesses,
      totalSubscriptions,
      activePaidSubscriptions,
      expiredSubscriptions,
      revenueResult,
      recentBusinesses,
    ] = await Promise.all([
      Business.countDocuments(),

      Subscription.countDocuments(),

      Subscription.countDocuments({
        plan: { $in: ["STARTER", "PRO", "ENTERPRISE"] },
        status: "ACTIVE",
        $or: [
          { endDate: { $exists: false } },
          { endDate: null },
          { endDate: { $gt: now } },
        ],
      }),

      Subscription.countDocuments({
        $or: [
          { status: "EXPIRED" },
          {
            status: "ACTIVE",
            plan: { $in: ["STARTER", "PRO", "ENTERPRISE"] },
            endDate: { $lte: now },
          },
        ],
      }),

      Payment.aggregate([
        { $match: { status: "CAPTURED" } },
        {
          $group: {
            _id: "$currency",
            totalRevenue: { $sum: "$amount" },
            totalPayments: { $sum: 1 },
          },
        },
      ]),

      Business.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .select(
          "businessName category location ownerId contactDetails createdAt"
        )
        .populate("ownerId", "name email")
        .lean(),
    ]);

    res.status(200).json({
      success: true,
      overview: {
        totalBusinesses,
        totalSubscriptions,
        activePaidSubscriptions,
        expiredSubscriptions,
        revenue: revenueResult,
      },
      recentBusinesses,
    });
  } catch (error) {
    console.error("Platform Overview Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to load platform overview.",
    });
  }
};
