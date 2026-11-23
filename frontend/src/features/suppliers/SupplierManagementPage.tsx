import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";
import { AppShell } from "../../components/layout/AppShell";
import { FormField } from "../../components/ui/FormField";
import { apiRequest, StockPilotApiError } from "../../services/api";
import { useWorkspace } from "../workspace/workspaceContext";

interface SupplierRecord {
  _id: string;
  supplierName: string;
  companyName?: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  taxIdentification?: string;
  paymentTerms?: string;
}

interface AssociatedProduct {
  _id: string;
  productName: string;
  sku: string;
  currentStock: number;
}

interface SupplierListResponse {
  success: boolean;
  suppliers: SupplierRecord[];
  pagination: { page: number; totalPages: number; total: number };
}

interface SupplierDetailsResponse {
  success: boolean;
  supplier: SupplierRecord;
  associatedProducts: AssociatedProduct[];
}

interface SupplierMutationResponse {
  success: boolean;
  supplier: SupplierRecord;
}

const optionalEmail = z
  .string()
  .trim()
  .optional()
  .refine((value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), {
    message: "Enter a valid email address",
  });
const optionalPhone = z
  .string()
  .trim()
  .optional()
  .refine((value) => !value || /^\+?[0-9][0-9\s().-]{5,19}$/.test(value), {
    message: "Enter a valid phone number",
  });
const supplierSchema = z.object({
  supplierName: z.string().trim().min(1, "Supplier name is required"),
  companyName: z.string().optional(),
  contactPerson: z.string().optional(),
  email: optionalEmail,
  phone: optionalPhone,
  address: z.string().optional(),
  taxIdentification: z.string().optional(),
  paymentTerms: z.string().optional(),
});
type SupplierFormValues = z.infer<typeof supplierSchema>;

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof StockPilotApiError ? error.message : fallback;
}

export function SupplierManagementPage() {
  const { workspace } = useWorkspace();
  const location = useLocation();
  const navigate = useNavigate();
  const [suppliers, setSuppliers] = useState<SupplierRecord[]>([]);
  const [supplier, setSupplier] = useState<SupplierRecord | null>(null);
  const [associatedProducts, setAssociatedProducts] = useState<AssociatedProduct[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const canManage =
    !workspace?.membershipRole || workspace.membershipRole === "BUSINESS_OWNER";

  const segments = location.pathname.split("/").filter(Boolean);
  const isList = segments.length === 1;
  const isCreate = segments[1] === "new";
  const isEdit = segments[2] === "edit";
  const supplierId = segments[1] && segments[1] !== "new" ? segments[1] : "";
  const isDetails = Boolean(supplierId) && !isEdit;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors: validationErrors },
  } = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierSchema),
    defaultValues: {
      supplierName: "",
      companyName: "",
      contactPerson: "",
      email: "",
      phone: "",
      address: "",
      taxIdentification: "",
      paymentTerms: "",
    },
  });

  useEffect(() => {
    setSuppliers([]);
    setPage(1);
    setTotalPages(0);
    setError("");
  }, [workspace?.id]);

  useEffect(() => {
    if (!isList || !workspace?.id) {
      return;
    }
    let active = true;
    const timer = window.setTimeout(() => {
      const query = new URLSearchParams({
        businessId: workspace.id,
        page: String(page),
        limit: "10",
      });
      if (search.trim()) query.set("search", search.trim());
      setLoading(true);
      setError("");
      apiRequest<SupplierListResponse>(`/suppliers?${query.toString()}`)
        .then((response) => {
          if (!response.success || !Array.isArray(response.suppliers)) {
            throw new Error("The supplier list could not be loaded.");
          }
          if (!active) return;
          if (page > response.pagination.totalPages && response.pagination.totalPages > 0) {
            setPage(response.pagination.totalPages);
            return;
          }
          setSuppliers(response.suppliers);
          setTotalPages(response.pagination.totalPages);
        })
        .catch((loadError: unknown) => {
          if (active) setError(getErrorMessage(loadError, "Unable to load suppliers."));
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [isList, workspace?.id, page, search, refresh]);

  useEffect(() => {
    if (!supplierId || !workspace?.id) {
      setSupplier(null);
      setAssociatedProducts([]);
      return;
    }
    let active = true;
    setSupplier(null);
    setAssociatedProducts([]);
    setLoading(true);
    setError("");
    apiRequest<SupplierDetailsResponse>(
      `/suppliers/${encodeURIComponent(supplierId)}?businessId=${encodeURIComponent(workspace.id)}`
    )
      .then((response) => {
        if (!response.success || !response.supplier) {
          throw new Error("The supplier could not be loaded.");
        }
        if (!active) return;
        setSupplier(response.supplier);
        setAssociatedProducts(response.associatedProducts ?? []);
        if (isEdit) {
          reset({
            supplierName: response.supplier.supplierName,
            companyName: response.supplier.companyName ?? "",
            contactPerson: response.supplier.contactPerson ?? "",
            email: response.supplier.email ?? "",
            phone: response.supplier.phone ?? "",
            address: response.supplier.address ?? "",
            taxIdentification: response.supplier.taxIdentification ?? "",
            paymentTerms: response.supplier.paymentTerms ?? "",
          });
        }
      })
      .catch((loadError: unknown) => {
        if (active) setError(getErrorMessage(loadError, "Unable to load this supplier."));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [supplierId, workspace?.id, isEdit, reset, refresh]);

  useEffect(() => {
    if (isCreate) {
      reset({
        supplierName: "",
        companyName: "",
        contactPerson: "",
        email: "",
        phone: "",
        address: "",
        taxIdentification: "",
        paymentTerms: "",
      });
      setFormError("");
    }
  }, [isCreate, reset]);

  const onSubmit = async (values: SupplierFormValues) => {
    if (!workspace?.id) return;
    setFormError("");
    setIsSubmitting(true);
    try {
      const response = await apiRequest<SupplierMutationResponse>(
        isEdit && supplierId
          ? `/suppliers/${encodeURIComponent(supplierId)}`
          : "/suppliers",
        {
          method: isEdit ? "PUT" : "POST",
          body: JSON.stringify({ ...values, businessId: workspace.id }),
        }
      );
      if (!response.success || !response.supplier?._id) {
        throw new Error("The server did not confirm the supplier.");
      }
      navigate(`/suppliers/${response.supplier._id}`);
    } catch (submitError) {
      setFormError(getErrorMessage(submitError, "Unable to save this supplier."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteSupplier = async (target: SupplierRecord) => {
    if (
      !workspace?.id ||
      !window.confirm(`Delete "${target.supplierName}"? This cannot be undone.`)
    ) {
      return;
    }
    setActionError("");
    try {
      await apiRequest(`/suppliers/${encodeURIComponent(target._id)}`, {
        method: "DELETE",
        body: JSON.stringify({ businessId: workspace.id }),
      });
      if (supplier?._id === target._id) {
        navigate("/suppliers", { replace: true });
      } else {
        setRefresh((value) => value + 1);
      }
    } catch (deleteError) {
      setActionError(getErrorMessage(deleteError, "Unable to delete this supplier."));
    }
  };

  const title = isList
    ? "Suppliers"
    : isCreate
      ? "Add Supplier"
      : isEdit
        ? "Edit Supplier"
        : "Supplier Details";

  return (
    <AppShell
      mode="business"
      title={title}
      description="Manage supplier relationships and procurement contacts for your business."
      action={
        isList && canManage ? (
          <Link
            to="/suppliers/new"
            className="inline-flex h-11 items-center justify-center rounded-xl bg-stock-primary-blue px-5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
          >
            + Add Supplier
          </Link>
        ) : !isList ? (
          <Link
            to="/suppliers"
            className="inline-flex h-11 items-center justify-center rounded-xl border border-stock-border bg-white px-5 text-sm font-semibold text-stock-primary-text transition hover:bg-slate-50"
          >
            ← Back to Suppliers
          </Link>
        ) : null
      }
    >
      {!workspace?.id ? (
        <section className="rounded-2xl border border-stock-border bg-white p-6 shadow-sm">
          <p className="text-sm text-stock-secondary-text">
            Select a business workspace to manage suppliers.
          </p>
        </section>
      ) : isList ? (
        <div className="space-y-6">
          {/* Hero */}
          <section className="overflow-hidden rounded-2xl border border-stock-border bg-white shadow-sm">
            <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-stock-primary-blue">
                  SUPPLIER RELATIONSHIPS
                </span>
                <h2 className="mt-4 text-2xl font-bold tracking-tight text-stock-deep-navy sm:text-3xl">
                  Manage your supplier network.
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-stock-secondary-text">
                  Organize supplier contacts, company information and
                  procurement relationships in one central workspace.
                </p>
              </div>

              <div className="rounded-2xl bg-slate-50 p-5 lg:min-w-48">
                <p className="text-xs font-semibold uppercase tracking-wide text-stock-secondary-text">
                  Suppliers on this page
                </p>
                <p className="mt-2 text-3xl font-bold text-stock-deep-navy">
                  {suppliers.length}
                </p>
                <p className="mt-1 text-xs text-stock-secondary-text">
                  Showing up to 10 records
                </p>
              </div>
            </div>
          </section>

          {/* Alerts */}
          {error && (
            <div
              role="alert"
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
            >
              <span>{error}</span>
              <button
                type="button"
                onClick={() => setRefresh((value) => value + 1)}
                className="font-semibold underline"
              >
                Retry
              </button>
            </div>
          )}

          {actionError && (
            <p
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
            >
              {actionError}
            </p>
          )}

          {/* Supplier Directory */}
          <section className="overflow-hidden rounded-2xl border border-stock-border bg-white shadow-sm">
            <div className="flex flex-col gap-4 border-b border-stock-border p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
              <div>
                <h3 className="text-lg font-bold text-stock-deep-navy">
                  Supplier Directory
                </h3>
                <p className="mt-1 text-sm text-stock-secondary-text">
                  Search and manage your supplier records.
                </p>
              </div>

              <label className="relative block w-full sm:max-w-sm">
                <span className="sr-only">Search suppliers</span>
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stock-secondary-text">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    className="h-5 w-5"
                    aria-hidden="true"
                  >
                    <circle cx="11" cy="11" r="7" />
                    <path d="m16 16 4 4" />
                  </svg>
                </span>
                <input
                  type="search"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Search supplier or contact..."
                  className="h-11 w-full rounded-xl border border-stock-border bg-slate-50 pl-10 pr-4 text-sm text-stock-primary-text outline-none transition placeholder:text-slate-400 focus:border-stock-primary-blue focus:bg-white focus:ring-2 focus:ring-blue-100"
                />
              </label>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-stock-secondary-text">
                  <tr>
                    <th scope="col" className="px-6 py-4 font-semibold">
                      Supplier
                    </th>
                    <th scope="col" className="px-6 py-4 font-semibold">
                      Contact Person
                    </th>
                    <th scope="col" className="px-6 py-4 font-semibold">
                      Contact Information
                    </th>
                    <th scope="col" className="px-6 py-4 font-semibold">
                      Company
                    </th>
                    <th scope="col" className="px-6 py-4 text-right font-semibold">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-stock-border">
                  {loading ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-6 py-16 text-center text-stock-secondary-text"
                      >
                        Loading suppliers...
                      </td>
                    </tr>
                  ) : suppliers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-16 text-center">
                        <div className="mx-auto max-w-sm">
                          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-xl">
                            <span aria-hidden="true">🏢</span>
                          </div>
                          <p className="mt-4 font-semibold text-stock-primary-text">
                            {search
                              ? "No matching suppliers found"
                              : "No suppliers added yet"}
                          </p>
                          <p className="mt-1 text-sm text-stock-secondary-text">
                            {search
                              ? "Try another supplier name or contact."
                              : "Supplier records will appear here once added."}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    suppliers.map((entry) => (
                      <tr
                        key={entry._id}
                        className="transition hover:bg-slate-50/80"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 font-bold text-stock-primary-blue">
                              {entry.supplierName
                                .trim()
                                .charAt(0)
                                .toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-stock-primary-text">
                                {entry.supplierName}
                              </p>
                              <p className="mt-1 text-xs text-stock-secondary-text">
                                Supplier
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-4 text-stock-primary-text">
                          {entry.contactPerson || "—"}
                        </td>

                        <td className="px-6 py-4">
                          <p className="break-all text-stock-primary-text">
                            {entry.email || "No email provided"}
                          </p>
                          <p className="mt-1 text-xs text-stock-secondary-text">
                            {entry.phone || "No phone provided"}
                          </p>
                        </td>

                        <td className="px-6 py-4 text-stock-secondary-text">
                          {entry.companyName || "—"}
                        </td>

                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-3 whitespace-nowrap">
                            <Link
                              to={`/suppliers/${entry._id}`}
                              className="font-semibold text-stock-primary-blue hover:underline"
                            >
                              View
                            </Link>

                            {canManage && (
                              <>
                                <Link
                                  to={`/suppliers/${entry._id}/edit`}
                                  className="font-semibold text-stock-primary-text hover:text-stock-primary-blue"
                                >
                                  Edit
                                </Link>
                                <button
                                  type="button"
                                  onClick={() => void deleteSupplier(entry)}
                                  className="font-semibold text-red-600 hover:text-red-800"
                                >
                                  Delete
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex flex-col gap-3 border-t border-stock-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <p className="text-sm text-stock-secondary-text">
                {totalPages > 0
                  ? `Page ${page} of ${totalPages}`
                  : "No pages available"}
              </p>

              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={loading || page <= 1}
                  onClick={() =>
                    setPage((value) => Math.max(1, value - 1))
                  }
                  className="h-10 rounded-xl border border-stock-border bg-white px-4 text-sm font-medium text-stock-primary-text transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={loading || page >= totalPages}
                  onClick={() => setPage((value) => value + 1)}
                  className="h-10 rounded-xl border border-stock-border bg-white px-4 text-sm font-medium text-stock-primary-text transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : isCreate || isEdit ? (
        <div className="mx-auto max-w-4xl space-y-6">
          <section className="rounded-2xl border border-stock-border bg-white p-6 shadow-sm sm:p-8">
            <div className="mb-7 border-b border-stock-border pb-6">
              <span className="text-xs font-bold uppercase tracking-wider text-stock-primary-blue">
                SUPPLIER INFORMATION
              </span>
              <h2 className="mt-2 text-xl font-bold text-stock-deep-navy">
                {isEdit ? "Update supplier details" : "Add a new supplier"}
              </h2>
              <p className="mt-2 text-sm leading-6 text-stock-secondary-text">
                {isEdit
                  ? "Update company and contact information for this supplier."
                  : "Add supplier information to organize your procurement network."}
              </p>
            </div>

            {loading && isEdit && (
              <p role="status" className="mb-5 text-sm text-stock-secondary-text">
                Loading supplier...
              </p>
            )}

            {error && (
              <p
                role="alert"
                className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
              >
                {error}
              </p>
            )}

            {formError && (
              <p
                role="alert"
                className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
              >
                {formError}
              </p>
            )}

            <form
              className="space-y-7"
              onSubmit={handleSubmit(onSubmit)}
            >
              <div>
                <h3 className="mb-4 text-sm font-bold text-stock-primary-text">
                  Basic Details
                </h3>
                <div className="space-y-5">
                  <FormField
                    id="supplierName"
                    label="Supplier name"
                    error={validationErrors.supplierName?.message}
                    {...register("supplierName")}
                  />
                  <FormField
                    id="companyName"
                    label="Company name"
                    {...register("companyName")}
                  />
                  <div className="grid gap-5 sm:grid-cols-2">
                    <FormField
                      id="contactPerson"
                      label="Contact person"
                      {...register("contactPerson")}
                    />
                    <FormField
                      id="email"
                      label="Email address"
                      type="email"
                      error={validationErrors.email?.message}
                      {...register("email")}
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-stock-border pt-6">
                <h3 className="mb-4 text-sm font-bold text-stock-primary-text">
                  Business & Payment Details
                </h3>
                <div className="grid gap-5 sm:grid-cols-2">
                  <FormField
                    id="phone"
                    label="Phone number"
                    error={validationErrors.phone?.message}
                    {...register("phone")}
                  />
                  <FormField
                    id="taxIdentification"
                    label="Tax identification"
                    {...register("taxIdentification")}
                  />
                </div>

                <div className="mt-5">
                  <FormField id="paymentTerms" label="Payment terms">
                    <input
                      id="paymentTerms"
                      type="text"
                      placeholder="Enter payment terms"
                      className="h-11 w-full rounded-xl border border-stock-border bg-white px-4 text-sm text-stock-primary-text outline-none transition placeholder:text-slate-400 focus:border-stock-primary-blue focus:ring-2 focus:ring-blue-100"
                      {...register("paymentTerms")}
                    />
                  </FormField>
                </div>
              </div>

              <div className="border-t border-stock-border pt-6">
                <h3 className="mb-4 text-sm font-bold text-stock-primary-text">
                  Address Information
                </h3>
                <FormField id="address" label="Address">
                  <textarea
                    id="address"
                    rows={4}
                    placeholder="Enter supplier's full address"
                    className="w-full rounded-xl border border-stock-border bg-white px-4 py-3 text-sm text-stock-primary-text outline-none transition placeholder:text-slate-400 focus:border-stock-primary-blue focus:ring-2 focus:ring-blue-100"
                    {...register("address")}
                  />
                </FormField>
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-stock-border pt-6 sm:flex-row sm:justify-end">
                <Link
                  to="/suppliers"
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-stock-border bg-white px-5 text-sm font-semibold text-stock-primary-text transition hover:bg-slate-50"
                >
                  Cancel
                </Link>

                <button
                  type="submit"
                  disabled={
                    isSubmitting ||
                    (isEdit && (loading || !supplier)) ||
                    Boolean(error)
                  }
                  className="h-11 rounded-xl bg-stock-primary-blue px-6 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSubmitting
                    ? "Saving..."
                    : isEdit
                      ? "Update Supplier"
                      : "Save Supplier"}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : (
        <div className="space-y-6">
          {loading && (
            <p
              role="status"
              className="rounded-xl border border-stock-border bg-white p-5 text-sm text-stock-secondary-text"
            >
              Loading supplier...
            </p>
          )}

          {error && (
            <p
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
            >
              {error}
            </p>
          )}

          {actionError && (
            <p
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
            >
              {actionError}
            </p>
          )}

          {supplier && (
            <>
              {/* Supplier Profile */}
              <section className="overflow-hidden rounded-2xl border border-stock-border bg-white shadow-sm">
                <div className="flex flex-col gap-5 border-b border-stock-border p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-xl font-bold text-stock-primary-blue">
                      {supplier.supplierName.trim().charAt(0).toUpperCase()}
                    </div>

                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-stock-primary-blue">
                        SUPPLIER PROFILE
                      </span>
                      <h2 className="mt-1 text-xl font-bold text-stock-deep-navy sm:text-2xl">
                        {supplier.supplierName}
                      </h2>
                      <p className="mt-1 text-sm text-stock-secondary-text">
                        {supplier.companyName || "Supplier details"}
                      </p>
                    </div>
                  </div>

                  {canManage && (
                    <div className="flex flex-wrap gap-2">
                      <Link
                        to={`/suppliers/${supplier._id}/edit`}
                        className="inline-flex h-10 items-center justify-center rounded-xl bg-stock-primary-blue px-5 text-sm font-semibold text-white transition hover:opacity-90"
                      >
                        Edit Supplier
                      </Link>
                      <button
                        type="button"
                        onClick={() => void deleteSupplier(supplier)}
                        className="h-10 rounded-xl border border-red-200 bg-white px-4 text-sm font-semibold text-red-600 transition hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>

                <div className="p-6 sm:p-8">
                  <h3 className="text-sm font-bold text-stock-primary-text">
                    Supplier Information
                  </h3>

                  <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {[
                      ["Company name", supplier.companyName],
                      ["Contact person", supplier.contactPerson],
                      ["Email address", supplier.email],
                      ["Phone number", supplier.phone],
                      ["Tax identification", supplier.taxIdentification],
                      ["Payment terms", supplier.paymentTerms],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-xl bg-slate-50 p-4">
                        <dt className="text-xs font-medium text-stock-secondary-text">
                          {label}
                        </dt>
                        <dd className="mt-2 break-words text-sm font-semibold text-stock-primary-text">
                          {value || "Not provided"}
                        </dd>
                      </div>
                    ))}
                  </dl>

                  <div className="mt-5 rounded-xl bg-slate-50 p-4">
                    <h3 className="text-xs font-medium text-stock-secondary-text">
                      Address
                    </h3>
                    <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-6 text-stock-primary-text">
                      {supplier.address || "No address recorded."}
                    </p>
                  </div>
                </div>
              </section>

              {/* Associated Products */}
              <section className="overflow-hidden rounded-2xl border border-stock-border bg-white shadow-sm">
                <div className="border-b border-stock-border p-5 sm:p-6">
                  <span className="text-xs font-bold uppercase tracking-wider text-stock-primary-blue">
                    INVENTORY RELATIONSHIPS
                  </span>
                  <h3 className="mt-2 text-lg font-bold text-stock-deep-navy">
                    Associated Products
                  </h3>
                  <p className="mt-1 text-sm text-stock-secondary-text">
                    Products linked to this supplier.
                  </p>
                </div>

                {associatedProducts.length === 0 ? (
                  <div className="p-8 text-center">
                    <p className="font-semibold text-stock-primary-text">
                      No associated products
                    </p>
                    <p className="mt-1 text-sm text-stock-secondary-text">
                      No products are associated with this supplier.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[540px] text-left text-sm">
                      <thead className="bg-slate-50 text-xs uppercase tracking-wide text-stock-secondary-text">
                        <tr>
                          <th scope="col" className="px-6 py-4 font-semibold">
                            Product
                          </th>
                          <th scope="col" className="px-6 py-4 font-semibold">
                            SKU
                          </th>
                          <th scope="col" className="px-6 py-4 font-semibold">
                            Current Stock
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stock-border">
                        {associatedProducts.map((product) => (
                          <tr
                            key={product._id}
                            className="transition hover:bg-slate-50/80"
                          >
                            <td className="px-6 py-4">
                              <Link
                                to={`/products/${product._id}`}
                                className="font-semibold text-stock-primary-blue hover:underline"
                              >
                                {product.productName}
                              </Link>
                            </td>
                            <td className="px-6 py-4 text-stock-secondary-text">
                              {product.sku}
                            </td>
                            <td className="px-6 py-4 font-semibold text-stock-primary-text">
                              {product.currentStock}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              {/* Purchase History */}
              <section className="rounded-2xl border border-stock-border bg-white p-6 shadow-sm sm:p-8">
                <span className="text-xs font-bold uppercase tracking-wider text-stock-primary-blue">
                  PROCUREMENT ACTIVITY
                </span>
                <h3 className="mt-2 text-lg font-bold text-stock-deep-navy">
                  Purchase History
                </h3>
                <p className="mt-3 text-sm leading-6 text-stock-secondary-text">
                  Purchase history is unavailable because Purchase Management
                  and purchase-order data are not implemented.
                </p>
              </section>
            </>
          )}
        </div>
      )}
    </AppShell>
  );
}
