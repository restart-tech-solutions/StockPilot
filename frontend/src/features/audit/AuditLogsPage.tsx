import { useEffect, useState } from "react";
import { AppShell } from "../../components/layout/AppShell";
import { apiRequest, StockPilotApiError } from "../../services/api";
import { useWorkspace } from "../workspace/workspaceContext";

interface AuditActor {
  _id: string;
  name?: string;
  email?: string;
}

interface AuditLogRecord {
  _id: string;
  actorUserId: AuditActor | string;
  action: string;
  resourceType: string;
  resourceId?: string;
  description: string;
  createdAt: string;
}

interface AuditLogResponse {
  success: boolean;
  auditLogs: AuditLogRecord[];
  pagination: { page: number; totalPages: number; total: number };
}

function getErrorMessage(error: unknown): string {
  return error instanceof StockPilotApiError
    ? error.message
    : "Unable to load audit activity.";
}

function actorName(actor: AuditActor | string): string {
  if (typeof actor === "string") return actor;
  return actor.name || actor.email || actor._id;
}

export function AuditLogsPage() {
  const { workspace } = useWorkspace();
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [userId, setUserId] = useState("");
  const [appliedFilters, setAppliedFilters] = useState({
    from: "",
    to: "",
    userId: "",
  });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!workspace?.id) {
      setAuditLogs([]);
      return;
    }
    let active = true;
    setLoading(true);
    setError("");
    const params = new URLSearchParams({
      businessId: workspace.id,
      page: String(page),
      limit: "20",
    });
    if (appliedFilters.from) params.set("from", appliedFilters.from);
    if (appliedFilters.to) params.set("to", appliedFilters.to);
    if (appliedFilters.userId.trim()) {
      params.set("userId", appliedFilters.userId.trim());
    }
    apiRequest<AuditLogResponse>(`/audit-logs?${params.toString()}`)
      .then((response) => {
        if (!response.success || !Array.isArray(response.auditLogs)) {
          throw new Error("Audit activity could not be loaded.");
        }
        if (active) {
          setAuditLogs(response.auditLogs);
          setTotalPages(response.pagination.totalPages);
        }
      })
      .catch((loadError: unknown) => {
        if (active) setError(getErrorMessage(loadError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [workspace?.id, page, appliedFilters]);

  const applyFilters = () => {
    setPage(1);
    setAppliedFilters({ from, to, userId });
  };

  const resetFilters = () => {
    setFrom("");
    setTo("");
    setUserId("");
    setPage(1);
    setAppliedFilters({ from: "", to: "", userId: "" });
  };

  return (
    <AppShell
      mode="business"
      title="Audit Logs"
      description="Read-only business activity for purchases, inventory, sales, invoices, and payments."
    >
      <section className="rounded-xl border border-stock-border bg-white p-4 shadow-sm sm:p-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_minmax(14rem,1.5fr)_auto_auto] lg:items-end">
          <label className="text-sm font-medium">
            From
            <input
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              className="mt-1 h-10 w-full rounded-lg border border-stock-border px-3 font-normal"
            />
          </label>
          <label className="text-sm font-medium">
            To
            <input
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              className="mt-1 h-10 w-full rounded-lg border border-stock-border px-3 font-normal"
            />
          </label>
          <label className="text-sm font-medium">
            User ID
            <input
              value={userId}
              onChange={(event) => setUserId(event.target.value)}
              placeholder="Filter by workspace user ID"
              className="mt-1 h-10 w-full rounded-lg border border-stock-border px-3 font-normal"
            />
          </label>
          <button
            type="button"
            onClick={applyFilters}
            className="h-10 rounded-lg bg-stock-primary-blue px-4 text-sm font-semibold text-white"
          >
            Apply
          </button>
          <button
            type="button"
            onClick={resetFilters}
            className="h-10 rounded-lg border border-stock-border px-4 text-sm font-medium"
          >
            Reset
          </button>
        </div>

        {error && (
          <div role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        )}
        {loading ? (
          <p className="py-12 text-center text-sm text-stock-secondary-text">
            Loading audit activity...
          </p>
        ) : !error && auditLogs.length === 0 ? (
          <p className="py-12 text-center text-sm text-stock-secondary-text">
            No audit records available for these filters.
          </p>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="border-b border-stock-border text-xs uppercase text-stock-secondary-text">
                <tr>
                  <th className="px-3 py-3">Time</th>
                  <th className="px-3 py-3">User</th>
                  <th className="px-3 py-3">Action</th>
                  <th className="px-3 py-3">Module</th>
                  <th className="px-3 py-3">Record</th>
                  <th className="px-3 py-3">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stock-border">
                {auditLogs.map((entry) => (
                  <tr key={entry._id}>
                    <td className="whitespace-nowrap px-3 py-4 text-stock-secondary-text">
                      {new Date(entry.createdAt).toLocaleString()}
                    </td>
                    <td className="px-3 py-4">{actorName(entry.actorUserId)}</td>
                    <td className="px-3 py-4 font-medium">{entry.action}</td>
                    <td className="px-3 py-4">{entry.resourceType}</td>
                    <td className="px-3 py-4 font-mono text-xs">
                      {entry.resourceId ?? "—"}
                    </td>
                    <td className="px-3 py-4">{entry.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between border-t border-stock-border pt-4 text-sm">
            <span className="text-stock-secondary-text">
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((value) => value - 1)}
                className="rounded-lg border border-stock-border px-3 py-2 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((value) => value + 1)}
                className="rounded-lg border border-stock-border px-3 py-2 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>
    </AppShell>
  );
}
