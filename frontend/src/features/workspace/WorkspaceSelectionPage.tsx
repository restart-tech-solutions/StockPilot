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

export function WorkspaceSelectionPage() {
  const navigate = useNavigate();
  const { workspace, setWorkspace } = useWorkspace();
  const [businesses, setBusinesses] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    apiRequest<BusinessListResponse>("/business")
      .then((response) => {
        if (!active) {
          return;
        }
        setBusinesses(response.businesses);
      })
      .catch((requestError) => {
        if (!active) {
          return;
        }
        setError(
          requestError instanceof StockPilotApiError
            ? requestError.message
            : "Unable to load business workspaces."
        );
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

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
          className="h-11 rounded-lg bg-stock-primary-blue px-4 text-sm font-semibold text-white"
        >
          Create workspace
        </button>
      }
    >
      {loading && (
        <div className="rounded-xl border border-stock-border bg-white p-6 text-sm text-stock-secondary-text">
          Loading workspaces...
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      {!loading && !error && businesses.length === 0 && (
        <div className="rounded-xl border border-stock-border bg-white p-6">
          <p className="text-sm text-stock-secondary-text">
            No business workspaces are available.
          </p>
        </div>
      )}

      {!loading && businesses.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {businesses.map((business) => (
            <button
              key={business.id}
              type="button"
              onClick={() => selectWorkspace(business)}
              className={[
                "rounded-xl border bg-white p-5 text-left shadow-sm transition",
                workspace?.id === business.id
                  ? "border-stock-accent-teal ring-2 ring-stock-accent-teal/15"
                  : "border-stock-border hover:border-stock-primary-blue",
              ].join(" ")}
            >
              <div className="text-base font-semibold text-stock-deep-navy">
                {business.businessName}
              </div>
              <div className="mt-2 text-sm text-stock-secondary-text">
                {business.category}
              </div>
              <div className="mt-1 text-sm text-stock-secondary-text">
                {business.location} · {business.currency}
              </div>
              {business.membershipRole && (
                <div className="mt-4 inline-flex rounded-full bg-stock-light-grey px-2.5 py-1 text-xs font-medium text-stock-primary-text">
                  {business.membershipRole}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </AppShell>
  );
}
