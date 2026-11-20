import { useEffect, useState } from "react";
import { AppShell } from "../../components/layout/AppShell";
import { apiRequest, StockPilotApiError } from "../../services/api";
import { useWorkspace } from "../workspace/workspaceContext";

interface EmployeeUser {
  _id: string;
  name: string;
  email: string;
  isActive: boolean;
}

interface EmployeeRecord {
  _id: string;
  userId: EmployeeUser;
  businessId: string;
  role: "BUSINESS_OWNER" | "INVENTORY_MANAGER" | "SALES_EMPLOYEE" | "ACCOUNTANT";
  status?: "ACTIVE" | "INACTIVE";
  isActive?: boolean;
  createdAt: string;
  updatedAt: string;
}

interface EmployeeListResponse {
  success: boolean;
  employees: EmployeeRecord[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

interface InvitationResponse {
  success: boolean;
  message: string;
  invitation: {
    id: string;
    email: string;
    role: string;
    status: string;
    expiresAt: string;
  };
  invitationToken: string;
}

const EMPLOYEE_ROLES = [
  { value: "INVENTORY_MANAGER", label: "Inventory Manager" },
  { value: "SALES_EMPLOYEE", label: "Sales Employee" },
  { value: "ACCOUNTANT", label: "Accountant" },
] as const;

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof StockPilotApiError ? error.message : fallback;
}

function formatRoleName(role: string): string {
  switch (role) {
    case "BUSINESS_OWNER":
      return "Business Owner";
    case "INVENTORY_MANAGER":
      return "Inventory Manager";
    case "SALES_EMPLOYEE":
      return "Sales Employee";
    case "ACCOUNTANT":
      return "Accountant";
    default:
      return role;
  }
}

function getRoleBadgeClass(role: string): string {
  switch (role) {
    case "BUSINESS_OWNER":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "INVENTORY_MANAGER":
      return "bg-purple-50 text-purple-700 border-purple-200";
    case "SALES_EMPLOYEE":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "ACCOUNTANT":
      return "bg-teal-50 text-teal-700 border-teal-200";
    default:
      return "bg-slate-50 text-slate-700 border-slate-200";
  }
}

export function EmployeeManagementPage() {
  const { workspace } = useWorkspace();

  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");
  const [actionError, setActionError] = useState("");
  const [refresh, setRefresh] = useState(0);

  // Invite Modal state
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<string>("INVENTORY_MANAGER");
  const [isInviting, setIsInviting] = useState(false);
  const [inviteModalError, setInviteModalError] = useState("");
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [tokenCopied, setTokenCopied] = useState(false);

  // Role Update Modal state
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeRecord | null>(null);
  const [newRole, setNewRole] = useState<string>("INVENTORY_MANAGER");
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);
  const [roleModalError, setRoleModalError] = useState("");

  // Deactivate/Reactivate Confirmation Dialog state
  const [confirmEmployee, setConfirmEmployee] = useState<EmployeeRecord | null>(null);
  const [confirmAction, setConfirmAction] = useState<"deactivate" | "reactivate" | null>(null);
  const [isActionSubmitting, setIsActionSubmitting] = useState(false);

  const isOwner =
    !workspace?.membershipRole || workspace.membershipRole === "BUSINESS_OWNER";

  // Reset pagination when workspace changes
  useEffect(() => {
    setEmployees([]);
    setPage(1);
    setTotalPages(0);
    setError("");
  }, [workspace?.id]);

  // Fetch employees list
  useEffect(() => {
    if (!workspace?.id) return;

    let active = true;
    const timer = window.setTimeout(() => {
      const query = new URLSearchParams({
        businessId: workspace.id,
        page: String(page),
        limit: "10",
      });

      if (search.trim()) query.set("search", search.trim());
      if (roleFilter) query.set("role", roleFilter);
      if (statusFilter) query.set("status", statusFilter);

      setLoading(true);
      setError("");

      apiRequest<EmployeeListResponse>(`/employees?${query.toString()}`)
        .then((response) => {
          if (!active) return;
          if (!response.success || !Array.isArray(response.employees)) {
            throw new Error("Failed to load employee list.");
          }
          setEmployees(response.employees);
          setTotalPages(response.pagination.totalPages);
          setTotalCount(response.pagination.total);
          if (
            page > response.pagination.totalPages &&
            response.pagination.totalPages > 0
          ) {
            setPage(response.pagination.totalPages);
          }
        })
        .catch((loadError: unknown) => {
          if (active) setError(getErrorMessage(loadError, "Unable to load employees."));
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [workspace?.id, page, search, roleFilter, statusFilter, refresh]);

  // Handle invitation submission
  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspace?.id) return;

    setInviteModalError("");
    setCreatedToken(null);
    setTokenCopied(false);

    const emailTrimmed = inviteEmail.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailTrimmed)) {
      setInviteModalError("Please provide a valid email address.");
      return;
    }

    setIsInviting(true);
    try {
      const response = await apiRequest<InvitationResponse>("/employees/invitations", {
        method: "POST",
        body: JSON.stringify({
          businessId: workspace.id,
          email: emailTrimmed,
          role: inviteRole,
        }),
      });

      if (response.success && response.invitationToken) {
        setCreatedToken(response.invitationToken);
        setActionSuccess(`Invitation created for ${emailTrimmed}.`);
        setRefresh((v) => v + 1);
      } else {
        throw new Error(response.message || "Failed to create invitation.");
      }
    } catch (err) {
      setInviteModalError(getErrorMessage(err, "Failed to create employee invitation."));
    } finally {
      setIsInviting(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setTokenCopied(true);
      setTimeout(() => setTokenCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  // Handle Role Update
  const handleUpdateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspace?.id || !selectedEmployee) return;

    setRoleModalError("");
    setIsUpdatingRole(true);

    try {
      await apiRequest(`/employees/${encodeURIComponent(selectedEmployee._id)}/role`, {
        method: "PATCH",
        body: JSON.stringify({
          businessId: workspace.id,
          role: newRole,
        }),
      });

      setActionSuccess(
        `Role updated for ${selectedEmployee.userId?.name || "employee"} to ${formatRoleName(newRole)}.`
      );
      setSelectedEmployee(null);
      setRefresh((v) => v + 1);
    } catch (err) {
      setRoleModalError(getErrorMessage(err, "Failed to update employee role."));
    } finally {
      setIsUpdatingRole(false);
    }
  };

  // Handle Deactivation / Reactivation
  const handleConfirmAction = async () => {
    if (!workspace?.id || !confirmEmployee || !confirmAction) return;

    setActionError("");
    setIsActionSubmitting(true);

    try {
      const endpoint =
        confirmAction === "deactivate"
          ? `/employees/${encodeURIComponent(confirmEmployee._id)}/deactivate`
          : `/employees/${encodeURIComponent(confirmEmployee._id)}/reactivate`;

      await apiRequest(endpoint, {
        method: "PATCH",
        body: JSON.stringify({ businessId: workspace.id }),
      });

      setActionSuccess(
        `Employee ${confirmEmployee.userId?.name || "employee"} was ${
          confirmAction === "deactivate" ? "deactivated" : "reactivated"
        } successfully.`
      );
      setConfirmEmployee(null);
      setConfirmAction(null);
      setRefresh((v) => v + 1);
    } catch (err) {
      setActionError(getErrorMessage(err, `Failed to ${confirmAction} employee.`));
    } finally {
      setIsActionSubmitting(false);
    }
  };

  return (
    <AppShell
      mode="business"
      title="Employees"
      description="Manage business team members, assign workspace roles, and control access."
      action={
        isOwner ? (
          <button
            type="button"
            onClick={() => {
              setInviteEmail("");
              setInviteRole("INVENTORY_MANAGER");
              setInviteModalError("");
              setCreatedToken(null);
              setIsInviteOpen(true);
            }}
            className="inline-flex h-11 items-center justify-center rounded-lg bg-stock-primary-blue px-4 text-sm font-semibold text-white shadow-sm hover:opacity-95"
          >
            Invite Employee
          </button>
        ) : null
      }
    >
      {!workspace?.id ? (
        <p className="rounded-xl border border-stock-border bg-white p-5 text-sm text-stock-secondary-text">
          Select a business workspace to view and manage team members.
        </p>
      ) : (
        <div className="space-y-5">
          {/* Status Banners */}
          {error && (
            <div
              role="alert"
              className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
            >
              <span>{error}</span>
              <button
                type="button"
                onClick={() => setRefresh((v) => v + 1)}
                className="font-semibold underline"
              >
                Retry
              </button>
            </div>
          )}

          {actionSuccess && (
            <div
              role="status"
              className="flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
            >
              <span>{actionSuccess}</span>
              <button
                type="button"
                onClick={() => setActionSuccess("")}
                className="text-xs font-semibold hover:underline"
              >
                Dismiss
              </button>
            </div>
          )}

          {actionError && (
            <div
              role="alert"
              className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
            >
              <span>{actionError}</span>
              <button
                type="button"
                onClick={() => setActionError("")}
                className="text-xs font-semibold hover:underline"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Filter Bar */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
              <label className="block w-full sm:max-w-xs">
                <span className="sr-only">Search employees</span>
                <input
                  type="search"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Search name or email..."
                  className="h-11 w-full rounded-lg border border-stock-border bg-white px-3 text-sm text-stock-primary-text"
                />
              </label>

              <label className="block w-full sm:w-48">
                <span className="sr-only">Filter by role</span>
                <select
                  value={roleFilter}
                  onChange={(e) => {
                    setRoleFilter(e.target.value);
                    setPage(1);
                  }}
                  className="h-11 w-full rounded-lg border border-stock-border bg-white px-3 text-sm text-stock-primary-text"
                >
                  <option value="">All Roles</option>
                  {EMPLOYEE_ROLES.map((role) => (
                    <option key={role.value} value={role.value}>
                      {role.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block w-full sm:w-40">
                <span className="sr-only">Filter by status</span>
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPage(1);
                  }}
                  className="h-11 w-full rounded-lg border border-stock-border bg-white px-3 text-sm text-stock-primary-text"
                >
                  <option value="">All Statuses</option>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </label>
            </div>

            <div className="text-xs text-stock-secondary-text">
              Total: <span className="font-semibold text-stock-primary-text">{totalCount}</span>
            </div>
          </div>

          {/* Employee Table */}
          <section className="min-w-0 overflow-hidden rounded-xl border border-stock-border bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[50rem] text-left text-sm">
                <thead className="bg-stock-light-grey text-stock-secondary-text">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Employee
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Email
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Role
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Status
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Joined
                    </th>
                    {isOwner && (
                      <th scope="col" className="px-4 py-3 text-right font-medium">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td
                        colSpan={isOwner ? 6 : 5}
                        className="px-4 py-12 text-center text-stock-secondary-text"
                      >
                        Loading employees...
                      </td>
                    </tr>
                  ) : employees.length === 0 ? (
                    <tr>
                      <td
                        colSpan={isOwner ? 6 : 5}
                        className="px-4 py-12 text-center text-stock-secondary-text"
                      >
                        {search || roleFilter || statusFilter
                          ? "No employees match the current filters."
                          : "No employees added yet. Use the Invite Employee button to add team members."}
                      </td>
                    </tr>
                  ) : (
                    employees.map((emp) => {
                      const isEmpActive = emp.status !== "INACTIVE" && emp.isActive !== false;
                      const isOwnerRole = emp.role === "BUSINESS_OWNER";

                      return (
                        <tr
                          key={emp._id}
                          className="border-t border-stock-border hover:bg-slate-50/50"
                        >
                          <td className="px-4 py-3 font-medium text-stock-primary-text">
                            {emp.userId?.name || "Unnamed"}
                          </td>
                          <td className="px-4 py-3 text-stock-secondary-text">
                            {emp.userId?.email || "—"}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getRoleBadgeClass(
                                emp.role
                              )}`}
                            >
                              {formatRoleName(emp.role)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {isEmpActive ? (
                              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                                Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700">
                                Inactive
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs text-stock-secondary-text">
                            {emp.createdAt ? new Date(emp.createdAt).toLocaleDateString() : "—"}
                          </td>
                          {isOwner && (
                            <td className="px-4 py-3 text-right">
                              {isOwnerRole ? (
                                <span className="text-xs italic text-stock-secondary-text">
                                  Owner
                                </span>
                              ) : (
                                <div className="flex items-center justify-end gap-3">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedEmployee(emp);
                                      setNewRole(emp.role);
                                      setRoleModalError("");
                                    }}
                                    className="font-medium text-stock-primary-blue hover:underline"
                                  >
                                    Change Role
                                  </button>

                                  {isEmpActive ? (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setConfirmEmployee(emp);
                                        setConfirmAction("deactivate");
                                      }}
                                      className="font-medium text-rose-600 hover:underline"
                                    >
                                      Deactivate
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setConfirmEmployee(emp);
                                        setConfirmAction("reactivate");
                                      }}
                                      className="font-medium text-emerald-600 hover:underline"
                                    >
                                      Reactivate
                                    </button>
                                  )}
                                </div>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Pagination */}
          <div className="flex items-center justify-between text-sm text-stock-secondary-text">
            <span>{totalPages > 0 ? `Page ${page} of ${totalPages}` : "No pages"}</span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={loading || page <= 1}
                onClick={() => setPage((v) => Math.max(1, v - 1))}
                className="h-10 rounded-lg border border-stock-border bg-white px-3 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={loading || page >= totalPages}
                onClick={() => setPage((v) => v + 1)}
                className="h-10 rounded-lg border border-stock-border bg-white px-3 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {isInviteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-stock-border bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-stock-primary-text">Invite Team Member</h2>
            <p className="mt-1 text-sm text-stock-secondary-text">
              Send an invitation to join this business workspace.
            </p>

            {inviteModalError && (
              <p
                role="alert"
                className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
              >
                {inviteModalError}
              </p>
            )}

            {createdToken ? (
              <div className="mt-4 space-y-4">
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                  <p className="font-semibold">Invitation Created Successfully!</p>
                  <p className="mt-1 text-xs">
                    Share this invitation token with <strong>{inviteEmail}</strong>. They can use
                    it to accept the invitation and join your workspace. It expires in 7 days.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-stock-secondary-text">
                    Invitation Token (one-time display)
                  </label>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={createdToken}
                      className="h-10 flex-1 rounded-lg border border-stock-border bg-slate-50 px-3 font-mono text-xs text-stock-primary-text"
                    />
                    <button
                      type="button"
                      onClick={() => copyToClipboard(createdToken)}
                      className="inline-flex h-10 items-center justify-center rounded-lg bg-stock-primary-blue px-3 text-xs font-semibold text-white"
                    >
                      {tokenCopied ? "Copied!" : "Copy"}
                    </button>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsInviteOpen(false);
                      setCreatedToken(null);
                    }}
                    className="h-10 rounded-lg bg-slate-100 px-4 text-sm font-semibold text-stock-primary-text hover:bg-slate-200"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSendInvite} className="mt-4 space-y-4">
                <div>
                  <label
                    htmlFor="invite-email"
                    className="block text-sm font-medium text-stock-primary-text"
                  >
                    Email Address
                  </label>
                  <input
                    id="invite-email"
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="colleague@example.com"
                    className="mt-1 h-11 w-full rounded-lg border border-stock-border px-3 text-sm text-stock-primary-text"
                  />
                </div>

                <div>
                  <label
                    htmlFor="invite-role"
                    className="block text-sm font-medium text-stock-primary-text"
                  >
                    Workspace Role
                  </label>
                  <select
                    id="invite-role"
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    className="mt-1 h-11 w-full rounded-lg border border-stock-border bg-white px-3 text-sm text-stock-primary-text"
                  >
                    {EMPLOYEE_ROLES.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsInviteOpen(false)}
                    className="h-10 rounded-lg border border-stock-border px-4 text-sm font-medium text-stock-primary-text hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isInviting}
                    className="h-10 rounded-lg bg-stock-primary-blue px-4 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {isInviting ? "Creating..." : "Create Invitation"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Role Update Modal */}
      {selectedEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-stock-border bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-stock-primary-text">Update Employee Role</h2>
            <p className="mt-1 text-sm text-stock-secondary-text">
              Change workspace role for{" "}
              <strong>{selectedEmployee.userId?.name || selectedEmployee.userId?.email}</strong>.
            </p>

            {roleModalError && (
              <p
                role="alert"
                className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
              >
                {roleModalError}
              </p>
            )}

            <form onSubmit={handleUpdateRole} className="mt-4 space-y-4">
              <div>
                <label
                  htmlFor="change-role-select"
                  className="block text-sm font-medium text-stock-primary-text"
                >
                  Select New Role
                </label>
                <select
                  id="change-role-select"
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="mt-1 h-11 w-full rounded-lg border border-stock-border bg-white px-3 text-sm text-stock-primary-text"
                >
                  {EMPLOYEE_ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedEmployee(null)}
                  className="h-10 rounded-lg border border-stock-border px-4 text-sm font-medium text-stock-primary-text hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingRole || newRole === selectedEmployee.role}
                  className="h-10 rounded-lg bg-stock-primary-blue px-4 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {isUpdatingRole ? "Saving..." : "Update Role"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Dialog (Deactivate/Reactivate) */}
      {confirmEmployee && confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-stock-border bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-stock-primary-text">
              {confirmAction === "deactivate" ? "Deactivate Employee" : "Reactivate Employee"}
            </h2>
            <p className="mt-2 text-sm text-stock-secondary-text">
              {confirmAction === "deactivate" ? (
                <>
                  Are you sure you want to deactivate{" "}
                  <strong>
                    {confirmEmployee.userId?.name || confirmEmployee.userId?.email}
                  </strong>
                  ? They will lose access to this workspace until reactivated. Historical records,
                  sales, and invoices will be preserved.
                </>
              ) : (
                <>
                  Are you sure you want to reactivate{" "}
                  <strong>
                    {confirmEmployee.userId?.name || confirmEmployee.userId?.email}
                  </strong>
                  ? Their workspace access will be restored immediately.
                </>
              )}
            </p>

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setConfirmEmployee(null);
                  setConfirmAction(null);
                }}
                className="h-10 rounded-lg border border-stock-border px-4 text-sm font-medium text-stock-primary-text hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isActionSubmitting}
                onClick={handleConfirmAction}
                className={`h-10 rounded-lg px-4 text-sm font-semibold text-white ${
                  confirmAction === "deactivate"
                    ? "bg-rose-600 hover:bg-rose-700"
                    : "bg-emerald-600 hover:bg-emerald-700"
                } disabled:opacity-50`}
              >
                {isActionSubmitting
                  ? "Processing..."
                  : confirmAction === "deactivate"
                  ? "Deactivate Employee"
                  : "Reactivate Employee"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
export default EmployeeManagementPage;
