import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "../../components/layout/AppShell";
import { apiRequest, StockPilotApiError } from "../../services/api";
import { useWorkspace, type Workspace } from "./workspaceContext";

interface BusinessListResponse {
  success: boolean;
  businesses: Workspace[];
  message?: string;
}

interface BusinessUpdateResponse {
  success: boolean;
  business: Workspace;
  message?: string;
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

export function WorkspaceSelectionPage() {
  const navigate = useNavigate();
  const { workspace, setWorkspace } = useWorkspace();

  const [businesses, setBusinesses] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [updatingBusinessId, setUpdatingBusinessId] = useState<string | null>(null);
  const [currencyMessage, setCurrencyMessage] = useState("");
  const [currencyError, setCurrencyError] = useState("");

  useEffect(() => {
    let active = true;

    setLoading(true);
    setError("");

    apiRequest<BusinessListResponse>("/business")
      .then((response) => {
        if (!active) return;

        if (!response.success || !Array.isArray(response.businesses)) {
          throw new Error("Unable to load business workspaces.");
        }

        setBusinesses(response.businesses);
      })
      .catch((requestError: unknown) => {
        if (!active) return;

        setError(
          requestError instanceof StockPilotApiError
            ? requestError.message
            : requestError instanceof Error
              ? requestError.message
              : "Unable to load business workspaces."
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [refresh]);

  const repairKiranaCurrency = async (business: Workspace) => {
    if (business.membershipRole !== "BUSINESS_OWNER") {
      setCurrencyError("Only the workspace owner can update its currency.");
      return;
    }

    setUpdatingBusinessId(business.id);
    setCurrencyMessage("");
    setCurrencyError("");

    try {
      const response = await apiRequest<BusinessUpdateResponse>(
        `/business/${business.id}`,
        {
          method: "PUT",
          body: JSON.stringify({ currency: "INR" }),
        }
      );

      if (!response.success || !response.business) {
        throw new Error(response.message || "Unable to update workspace currency.");
      }

      setBusinesses((current) =>
        current.map((item) => item.id === business.id ? response.business : item)
      );

      if (workspace?.id === business.id) {
        setWorkspace(response.business);
      }

      setCurrencyMessage("Kirana currency updated to INR successfully.");
    } catch (requestError: unknown) {
      setCurrencyError(
        requestError instanceof StockPilotApiError
          ? requestError.message
          : requestError instanceof Error
            ? requestError.message
            : "Unable to update workspace currency."
      );
    } finally {
      setUpdatingBusinessId(null);
    }
  };

  const selectWorkspace = (selected: Workspace) => {
    setWorkspace(selected);
    navigate("/", { replace: true });
  };

  return (
    <AppShell
      mode="business"
      title="Select Workspace"
      description="Choose a business workspace available to your account."
      action={
        <button
          type="button"
          onClick={() => navigate("/business/setup")}
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#174A91] px-5 text-sm font-semibold text-white shadow-md shadow-blue-900/10 transition hover:bg-[#123B77] focus:outline-none focus:ring-4 focus:ring-blue-600/20"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          Create workspace
        </button>
      }
    >
      <div className="space-y-7">
        {/* Page introduction */}
        <section className="relative overflow-hidden rounded-2xl bg-[#10213D] p-6 shadow-sm sm:p-8">
          <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-blue-500/15 blur-3xl" />
          <div className="absolute -bottom-24 right-1/3 h-48 w-48 rounded-full bg-cyan-400/10 blur-3xl" />

          <div className="relative z-10 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-xl">
              <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-blue-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Your business environment
              </span>

              <h2 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl">
                Choose where you want to work.
              </h2>

              <p className="mt-3 max-w-lg text-sm leading-6 text-slate-300">
                Access your business operations, inventory, sales and reports
                from your selected workspace.
              </p>
            </div>

            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-blue-200">
              <svg
                viewBox="0 0 24 24"
                className="h-8 w-8"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6M9 9h.01M15 9h.01" />
              </svg>
            </div>
          </div>
        </section>

        {currencyMessage && (
          <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {currencyMessage}
          </div>
        )}
        {currencyError && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {currencyError}
          </div>
        )}

        {/* Workspace heading */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-[#10213D]">
              Your workspaces
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Select a workspace to continue.
            </p>
          </div>

          {!loading && !error && (
            <span className="inline-flex w-fit items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600">
              {businesses.length}{" "}
              {businesses.length === 1 ? "workspace" : "workspaces"}
            </span>
          )}
        </div>

        {/* Loading state */}
        {loading && (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className="animate-pulse rounded-2xl border border-slate-200 bg-white p-5"
              >
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-xl bg-slate-200" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-3/4 rounded bg-slate-200" />
                    <div className="h-3 w-1/2 rounded bg-slate-100" />
                  </div>
                </div>

                <div className="mt-7 h-3 w-full rounded bg-slate-100" />
                <div className="mt-3 h-3 w-2/3 rounded bg-slate-100" />
                <div className="mt-7 h-10 rounded-lg bg-slate-100" />
              </div>
            ))}
          </div>
        )}

        {/* Error state */}
        {!loading && error && (
          <section
            role="alert"
            className="rounded-2xl border border-red-200 bg-white p-6"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 8v5m0 3h.01" />
                </svg>
              </div>

              <div>
                <h3 className="font-semibold text-slate-900">
                  Unable to load workspaces
                </h3>
                <p className="mt-1 text-sm text-slate-500">{error}</p>

                <button
                  type="button"
                  onClick={() => setRefresh((value) => value + 1)}
                  className="mt-4 rounded-lg bg-[#174A91] px-4 py-2 text-sm font-semibold text-white hover:bg-[#123B77]"
                >
                  Try again
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Empty state */}
        {!loading && !error && businesses.length === 0 && (
          <section className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-[#174A91]">
              <svg
                viewBox="0 0 24 24"
                className="h-8 w-8"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6" />
                <path d="M12 8v5m-2.5-2.5h5" />
              </svg>
            </div>

            <h3 className="mt-5 text-lg font-bold text-[#10213D]">
              No workspaces yet
            </h3>

            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">
              Create your first business workspace to start managing your
              products, inventory and sales.
            </p>

            <button
              type="button"
              onClick={() => navigate("/business/setup")}
              className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-[#174A91] px-5 text-sm font-semibold text-white hover:bg-[#123B77]"
            >
              <span className="text-lg leading-none">+</span>
              Create your first workspace
            </button>
          </section>
        )}

        {/* Workspace cards */}
        {!loading && !error && businesses.length > 0 && (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {businesses.map((business) => {
              const isSelected = workspace?.id === business.id;

              return (
                <div
                  key={business.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => selectWorkspace(business)}
                  onKeyDown={(event) => {
                    if (event.target !== event.currentTarget) return;
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      selectWorkspace(business);
                    }
                  }}
                  aria-pressed={isSelected}
                  className={[
                    "group relative flex min-h-64 flex-col overflow-hidden rounded-2xl border bg-white p-5 text-left transition duration-200 hover:-translate-y-1 hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-blue-600/15",
                    isSelected
                      ? "border-blue-500 shadow-lg shadow-blue-900/5 ring-2 ring-blue-500/10"
                      : "border-slate-200 shadow-sm hover:border-blue-300",
                  ].join(" ")}
                >
                  {/* Top section */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#174A91] to-[#2673CA] text-base font-bold text-white shadow-md shadow-blue-900/15">
                      {getInitials(business.businessName || "Business")}
                    </div>

                    {isSelected ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        Current workspace
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-500">
                        Available
                      </span>
                    )}
                  </div>

                  {/* Business information */}
                  <div className="mt-5">
                    <h3 className="text-base font-bold tracking-tight text-[#10213D] transition group-hover:text-blue-700">
                      {business.businessName}
                    </h3>

                    <p className="mt-1 text-sm text-slate-500">
                      {business.category || "Business workspace"}
                    </p>
                  </div>

                  {/* Location and currency */}
                  <div className="mt-5 space-y-2 border-t border-slate-100 pt-4">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <svg
                        viewBox="0 0 24 24"
                        className="h-4 w-4 shrink-0 text-slate-400"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                      >
                        <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" />
                        <circle cx="12" cy="10" r="2.5" />
                      </svg>
                      <span className="truncate">
                        {business.location || "Location not specified"}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <svg
                        viewBox="0 0 24 24"
                        className="h-4 w-4 shrink-0 text-slate-400"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                      >
                        <circle cx="12" cy="12" r="9" />
                        <path d="M15 8.5c-.7-.6-1.6-1-3-1-1.5 0-2.5.8-2.5 2s1 2 2.5 2 2.5.8 2.5 2-1 2-2.5 2c-1.2 0-2.2-.4-3-1M12 5.5v13" />
                      </svg>
                      <span>{business.currency || "Currency not specified"}</span>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="mt-auto flex items-center justify-between gap-3 pt-5">
                    {business.membershipRole ? (
                      <span className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600">
                        {business.membershipRole.replace(/_/g, " ")}
                      </span>
                    ) : (
                      <span />
                    )}

                    <span
                      className={[
                        "inline-flex items-center gap-2 text-xs font-semibold",
                        isSelected
                          ? "text-emerald-700"
                          : "text-[#174A91] group-hover:text-blue-700",
                      ].join(" ")}
                    >
                      {isSelected ? "Selected" : "Open workspace"}
                      <svg
                        viewBox="0 0 24 24"
                        className="h-4 w-4 transition group-hover:translate-x-1"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M5 12h14m-6-6 6 6-6 6" />
                      </svg>
                    </span>
                  </div>

                  {business.businessName.trim().toLowerCase() === "kirana" &&
                    business.currency !== "INR" &&
                    business.membershipRole === "BUSINESS_OWNER" && (
                      <button
                        type="button"
                        disabled={updatingBusinessId === business.id}
                        onClick={(event) => {
                          event.stopPropagation();
                          void repairKiranaCurrency(business);
                        }}
                        className="mt-4 w-full rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-[#174A91] transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {updatingBusinessId === business.id ? "Updating currency..." : "Correct currency to INR"}
                      </button>
                    )}
                </div>
              );
            })}
          </div>
        )}

        {/* Bottom information */}
        {!loading && !error && businesses.length > 0 && (
          <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4">
            <svg
              viewBox="0 0 24 24"
              className="mt-0.5 h-5 w-5 shrink-0 text-blue-600"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 11v5m0-8h.01" />
            </svg>

            <p className="text-xs leading-5 text-slate-500">
              Each workspace maintains its own business data, inventory,
              customers and transactions. Choose the correct workspace before
              continuing.
            </p>
          </div>
        )}
      </div>
    </AppShell>
  );
}