
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { AppShell } from "../../components/layout/AppShell";
import { FormField } from "../../components/ui/FormField";
import { apiRequest, StockPilotApiError } from "../../services/api";
import { useWorkspace, type Workspace } from "./workspaceContext";

const setupSchema = z.object({
  businessName: z.string().trim().min(1, "Business name is required"),
  contactEmail: z
    .string()
    .trim()
    .email("Enter a valid contact email")
    .optional()
    .or(z.literal("")),
  contactPhone: z.string().trim().optional(),
  category: z.string().trim().min(1, "Business category is required"),
  location: z.string().trim().min(1, "Business location is required"),
  currency: z
    .string()
    .trim()
    .regex(
      /^(INR|USD|EUR|GBP)$/,
      "Please select a valid currency"
    ),
});

type SetupValues = z.infer<typeof setupSchema>;

interface CreateBusinessResponse {
  success: boolean;
  business: Workspace;
  membership: {
    id: string;
    userId: string;
    role: string;
  };
  message?: string;
}

export function BusinessSetupPage() {
  const navigate = useNavigate();
  const { setWorkspace } = useWorkspace();
  const [serverError, setServerError] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SetupValues>({
    resolver: zodResolver(setupSchema),
    defaultValues: {
      currency: "INR",
    },
  });

  const onSubmit = async (values: SetupValues) => {
    setServerError("");

    try {
      const response = await apiRequest<CreateBusinessResponse>("/business", {
        method: "POST",
        body: JSON.stringify({
          businessName: values.businessName,
          contactDetails: {
            email: values.contactEmail || undefined,
            phone: values.contactPhone || undefined,
          },
          category: values.category,
          location: values.location,
          currency: values.currency,
        }),
      });

      setWorkspace({
        ...response.business,
        membershipRole:
          response.business.membershipRole ||
          response.membership?.role ||
          "BUSINESS_OWNER",
      });

      navigate("/", { replace: true });
    } catch (error) {
      setServerError(
        error instanceof StockPilotApiError
          ? error.message
          : "Unable to create the business workspace."
      );
    }
  };

  return (
    <AppShell
      mode="business"
      title="Business Setup"
      description="Complete the initial workspace information."
    >
      <div className="mx-auto max-w-2xl rounded-xl border border-stock-border bg-white p-6 shadow-sm sm:p-8">
        {serverError && (
          <div
            role="alert"
            className="mb-5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {serverError}
          </div>
        )}

        <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
          <FormField
            id="businessName"
            label="Business name"
            error={errors.businessName?.message}
            {...register("businessName")}
          />

          <div className="grid gap-5 sm:grid-cols-2">
            <FormField
              id="contactEmail"
              label="Contact email"
              type="email"
              error={errors.contactEmail?.message}
              {...register("contactEmail")}
            />

            <FormField
              id="contactPhone"
              label="Contact phone"
              type="tel"
              error={errors.contactPhone?.message}
              {...register("contactPhone")}
            />
          </div>

          <FormField
            id="category"
            label="Business category"
            error={errors.category?.message}
            {...register("category")}
          />

          <FormField
            id="location"
            label="Business location"
            error={errors.location?.message}
            {...register("location")}
          />

          <FormField
            id="currency"
            label="Currency"
            error={errors.currency?.message}
          >
            <select
              id="currency"
              className={[
                "h-11 w-full rounded-lg border bg-white px-3 text-sm text-stock-primary-text outline-none transition",
                "focus:border-stock-primary-blue focus:ring-2 focus:ring-stock-primary-blue/15",
                errors.currency
                  ? "border-red-500"
                  : "border-stock-border",
              ].join(" ")}
              {...register("currency")}
            >
              <option value="INR">INR — Indian Rupee (₹)</option>
              <option value="USD">USD — US Dollar ($)</option>
              <option value="EUR">EUR — Euro (€)</option>
              <option value="GBP">GBP — British Pound (£)</option>
            </select>
          </FormField>

          <div className="flex justify-end gap-3 border-t border-stock-border pt-5">
            <button
              type="button"
              onClick={() => navigate("/workspaces")}
              className="h-11 rounded-lg border border-stock-border px-4 text-sm font-medium text-stock-primary-text"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="h-11 rounded-lg bg-stock-primary-blue px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Creating..." : "Create workspace"}
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
