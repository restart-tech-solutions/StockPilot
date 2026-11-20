import { SubscriptionPlan } from "../../models/Subscription";

export interface PlanConfiguration {
  name: string;
  monthlyPrice: number;
  yearlyPrice: number;
  limits: {
    products: number;
    employees: number;
    warehouses: number;
  };
  features: string[];
}

export const SUBSCRIPTION_PLANS: Record<
  SubscriptionPlan,
  PlanConfiguration
> = {
  FREE: {
    name: "Free",
    monthlyPrice: 0,
    yearlyPrice: 0,
    limits: {
      products: 50,
      employees: 1,
      warehouses: 1,
    },
    features: ["Basic inventory", "Sales management"],
  },

  STARTER: {
    name: "Starter",
    monthlyPrice: 499,
    yearlyPrice: 4990,
    limits: {
      products: 500,
      employees: 5,
      warehouses: 2,
    },
    features: [
      "Inventory management",
      "Sales and purchases",
      "Basic reports",
    ],
  },

  PRO: {
    name: "Pro",
    monthlyPrice: 999,
    yearlyPrice: 9990,
    limits: {
      products: 5000,
      employees: 20,
      warehouses: 10,
    },
    features: [
      "Advanced inventory",
      "AI demand forecasting",
      "Advanced analytics",
      "Priority support",
    ],
  },

  ENTERPRISE: {
    name: "Enterprise",
    monthlyPrice: 0,
    yearlyPrice: 0,
    limits: {
      products: -1,
      employees: -1,
      warehouses: -1,
    },
    features: [
      "Unlimited inventory",
      "Unlimited employees",
      "Advanced analytics",
      "Custom integrations",
      "Dedicated support",
    ],
  },
};
