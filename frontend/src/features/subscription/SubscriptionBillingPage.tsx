import { useCallback, useEffect, useState } from "react";
import { AppShell } from "../../components/layout/AppShell";
import { apiRequest, StockPilotApiError } from "../../services/api";
import { useWorkspace } from "../workspace/workspaceContext";

type PlanId = "FREE" | "STARTER" | "PRO" | "ENTERPRISE";
type BillingCycle = "MONTHLY" | "YEARLY";

interface Plan {
  id: PlanId;
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

interface Subscription {
  plan: PlanId;
  status: string;
  billingCycle: BillingCycle;
  amount: number;
  currency: string;
  startDate?: string;
  endDate?: string;
  nextBillingDate?: string;
}

interface PlansResponse {
  success: boolean;
  plans: Plan[];
}

interface CurrentResponse {
  success: boolean;
  subscription: Subscription;
  plan: Plan;
}

interface OrderResponse {
  success: boolean;
  message: string;
  order: {
    id: string;
    amount: number;
    currency: string;
  };
  keyId: string;
}

interface VerifyResponse {
  success: boolean;
  message: string;
  subscription: Subscription;
}

interface RazorpayResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  theme: { color: string };
  handler: (response: RazorpayResponse) => void | Promise<void>;
  modal?: { ondismiss?: () => void };
}

interface RazorpayInstance {
  open: () => void;
  on: (event: string, callback: (response: unknown) => void) => void;
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

const loadRazorpay = (): Promise<boolean> =>
  new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }

    const existing = document.querySelector(
      'script[src="https://checkout.razorpay.com/v1/checkout.js"]'
    );

    if (existing) {
      existing.addEventListener("load", () => resolve(true), { once: true });
      existing.addEventListener("error", () => resolve(false), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

const money = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);

const limitLabel = (value: number) =>
  value === -1 ? "Unlimited" : value.toLocaleString("en-IN");

const getError = (error: unknown, fallback: string) =>
  error instanceof StockPilotApiError ? error.message : fallback;

export function SubscriptionBillingPage() {
  const { workspace } = useWorkspace();

  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [cycle, setCycle] = useState<BillingCycle>("MONTHLY");
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<PlanId | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadData = useCallback(async () => {
    if (!workspace?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const [plansResponse, currentResponse] = await Promise.all([
        apiRequest<PlansResponse>("/subscriptions/plans"),
        apiRequest<CurrentResponse>(`/subscriptions/current?businessId=${encodeURIComponent(workspace.id)}`),
      ]);

      if (!plansResponse.success || !currentResponse.success) {
        throw new Error("Unable to load subscription details.");
      }

      setPlans(plansResponse.plans);
      setSubscription(currentResponse.subscription);
    } catch (err) {
      setError(getError(err, "Unable to load billing information."));
    } finally {
      setLoading(false);
    }
  }, [workspace?.id]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handlePurchase = async (plan: Plan) => {
    if (!workspace?.id || processing) return;

    if (plan.id === "ENTERPRISE" || plan.id === "FREE") return;

    setProcessing(plan.id);
    setError("");
    setSuccess("");

    try {
      const checkoutReady = await loadRazorpay();

      if (!checkoutReady || !window.Razorpay) {
        throw new Error("Unable to load Razorpay Checkout. Please try again.");
      }

      const orderResponse = await apiRequest<OrderResponse>(
        "/subscriptions/create-order",
        {
          method: "POST",
          body: JSON.stringify({
            businessId: workspace.id,
            plan: plan.id,
            billingCycle: cycle,
          }),
        }
      );

      if (
        !orderResponse.success ||
        !orderResponse.order?.id ||
        !orderResponse.keyId
      ) {
        throw new Error(orderResponse.message || "Unable to create payment order.");
      }

      const options: RazorpayOptions = {
        key: orderResponse.keyId,
        amount: orderResponse.order.amount,
        currency: orderResponse.order.currency,
        name: "StockPilot",
        description: `${plan.name} - ${cycle.toLowerCase()} subscription`,
        order_id: orderResponse.order.id,
        theme: { color: "#2563EB" },

        handler: async (response) => {
          try {
            const verified = await apiRequest<VerifyResponse>(
              "/subscriptions/verify-payment",
              {
                method: "POST",
                body: JSON.stringify({
                  ...response,
                  businessId: workspace.id,
                }),
              }
            );

            if (!verified.success || !verified.subscription) {
              throw new Error("Payment verification was not confirmed.");
            }

            setSubscription(verified.subscription);
            setSuccess(
              "Payment verified successfully. Your subscription is now active."
            );
            setError("");
            await loadData();
          } catch (err) {
            setError(
              getError(
                err,
                "Payment was received, but verification could not be confirmed. Please contact support with your payment ID."
              )
            );
          } finally {
            setProcessing(null);
          }
        },

        modal: {
          ondismiss: () => setProcessing(null),
        },
      };

      const checkout = new window.Razorpay(options);

      checkout.on("payment.failed", (response) => {
        const details = response as {
          error?: { description?: string };
        };
        setError(
          details.error?.description || "Payment failed. Please try again."
        );
        setProcessing(null);
      });

      checkout.open();
    } catch (err) {
      setError(getError(err, "Unable to start checkout."));
      setProcessing(null);
    }
  };

  const currentPlan = subscription?.plan || "FREE";

  const cardClass =
    "rounded-xl border border-stock-border bg-white p-5 shadow-sm sm:p-6";

  return (
    <AppShell
      mode="business"
      title="Subscription & Billing"
      description="Manage your StockPilot plan, usage limits and payments."
    >
      {!workspace?.id ? (
        <div className={cardClass}>
          <p className="text-sm text-stock-secondary-text">
            Select a business workspace to manage your subscription.
          </p>
        </div>
      ) : loading ? (
        <div className={cardClass} role="status">
          Loading subscription details...
        </div>
      ) : (
        <div className="mx-auto max-w-6xl space-y-6">
          {error && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
            >
              {error}
            </div>
          )}

          {success && (
            <div
              role="status"
              className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800"
            >
              {success}
            </div>
          )}

          <section className={cardClass}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm text-stock-secondary-text">
                  Current subscription
                </p>
                <h2 className="mt-1 text-2xl font-bold text-stock-deep-navy">
                  {currentPlan}
                </h2>
                <p className="mt-2 text-sm text-stock-secondary-text">
                  Status:{" "}
                  <span className="font-semibold text-green-700">
                    {subscription?.status || "UNKNOWN"}
                  </span>
                </p>
              </div>

              <div className="rounded-lg bg-stock-light-grey px-4 py-3">
                <p className="text-xs text-stock-secondary-text">
                  Current billing
                </p>
                <p className="mt-1 font-semibold text-stock-deep-navy">
                  {subscription
                    ? money(subscription.amount)
                    : money(0)}
                  {subscription?.amount
                    ? ` / ${subscription.billingCycle.toLowerCase()}`
                    : ""}
                </p>
              </div>
            </div>

            {subscription?.endDate && (
              <p className="mt-4 text-xs text-stock-secondary-text">
                Subscription end date:{" "}
                {new Date(subscription.endDate).toLocaleDateString("en-IN")}
              </p>
            )}
          </section>

          <section>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-stock-deep-navy">
                  Choose your plan
                </h2>
                <p className="mt-1 text-sm text-stock-secondary-text">
                  Select the plan that fits your business.
                </p>
              </div>

              <div className="inline-flex rounded-lg border border-stock-border bg-white p-1">
                <button
                  type="button"
                  onClick={() => setCycle("MONTHLY")}
                  className={`rounded-md px-4 py-2 text-sm font-medium ${
                    cycle === "MONTHLY"
                      ? "bg-stock-primary-blue text-white"
                      : "text-stock-secondary-text"
                  }`}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  onClick={() => setCycle("YEARLY")}
                  className={`rounded-md px-4 py-2 text-sm font-medium ${
                    cycle === "YEARLY"
                      ? "bg-stock-primary-blue text-white"
                      : "text-stock-secondary-text"
                  }`}
                >
                  Yearly
                </button>
              </div>
            </div>

            <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              {plans.map((plan) => {
                const price =
                  cycle === "YEARLY"
                    ? plan.yearlyPrice
                    : plan.monthlyPrice;
                const isCurrent = currentPlan === plan.id;
                const isEnterprise = plan.id === "ENTERPRISE";
                const isFree = plan.id === "FREE";

                return (
                  <article
                    key={plan.id}
                    className={`flex flex-col rounded-xl border bg-white p-5 shadow-sm ${
                      plan.id === "PRO"
                        ? "border-stock-primary-blue ring-1 ring-stock-primary-blue"
                        : "border-stock-border"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-lg font-bold text-stock-deep-navy">
                        {plan.name}
                      </h3>
                      {plan.id === "PRO" && (
                        <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">
                          Popular
                        </span>
                      )}
                    </div>

                    <div className="mt-5">
                      {isEnterprise ? (
                        <p className="text-2xl font-bold text-stock-deep-navy">
                          Custom
                        </p>
                      ) : (
                        <>
                          <span className="text-3xl font-bold text-stock-deep-navy">
                            {money(price)}
                          </span>
                          <span className="text-sm text-stock-secondary-text">
                            /{cycle === "YEARLY" ? "year" : "month"}
                          </span>
                        </>
                      )}
                    </div>

                    {cycle === "YEARLY" && !isFree && !isEnterprise && (
                      <p className="mt-1 text-xs text-green-700">
                        {money(price / 12)} per month, billed yearly
                      </p>
                    )}

                    <div className="mt-5 space-y-3 text-sm text-stock-primary-text">
                      <p>
                        <strong>{limitLabel(plan.limits.products)}</strong>{" "}
                        products
                      </p>
                      <p>
                        <strong>{limitLabel(plan.limits.employees)}</strong>{" "}
                        employees
                      </p>
                      <p>
                        <strong>{limitLabel(plan.limits.warehouses)}</strong>{" "}
                        warehouses
                      </p>
                    </div>

                    <div className="my-5 border-t border-stock-border" />

                    <ul className="flex-1 space-y-3 text-sm text-stock-secondary-text">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex gap-2">
                          <span className="font-bold text-green-600">✓</span>
                          {feature}
                        </li>
                      ))}
                    </ul>

                    <button
                      type="button"
                      disabled={isCurrent || isFree || isEnterprise || !!processing}
                      onClick={() => void handlePurchase(plan)}
                      className={`mt-6 flex h-11 w-full items-center justify-center rounded-lg px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${
                        isCurrent
                          ? "border border-stock-border bg-stock-light-grey text-stock-secondary-text"
                          : "bg-stock-primary-blue text-white hover:opacity-90"
                      }`}
                    >
                      {processing === plan.id
                        ? "Processing..."
                        : isCurrent
                          ? "Current Plan"
                          : isFree
                            ? "Included"
                            : isEnterprise
                              ? "Contact Sales"
                              : "Upgrade Plan"}
                    </button>
                  </article>
                );
              })}
            </div>
          </section>

          <section className={cardClass}>
            <h2 className="font-semibold text-stock-deep-navy">
              Payment information
            </h2>
            <p className="mt-2 text-sm text-stock-secondary-text">
              Payments are processed securely through Razorpay. Your paid plan
              is activated only after the server verifies the payment.
              Subscriptions currently have a fixed monthly or yearly term;
              automatic recurring renewal is not enabled.
            </p>
          </section>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void loadData()}
              className="rounded-lg border border-stock-border bg-white px-4 py-2 text-sm font-medium text-stock-primary-text hover:bg-stock-light-grey"
            >
              Refresh subscription
            </button>
          </div>
        </div>
      )}
    </AppShell>
  );
}
