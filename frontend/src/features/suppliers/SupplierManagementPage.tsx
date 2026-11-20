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
      description="Manage suppliers for the selected business workspace."
      action={
        isList && canManage ? (
          <Link
            to="/suppliers/new"
            className="inline-flex h-11 items-center justify-center rounded-lg bg-stock-primary-blue px-4 text-sm font-semibold text-white"
          >
            Add Supplier
          </Link>
        ) : !isList ? (
          <Link
            to="/suppliers"
            className="inline-flex h-10 items-center justify-center rounded-lg border border-stock-border bg-white px-4 text-sm font-medium text-stock-primary-text"
          >
            Back to Suppliers
          </Link>
        ) : null
      }
    >
      {!workspace?.id ? (
        <p className="rounded-xl border border-stock-border bg-white p-5 text-sm text-stock-secondary-text">
          Select a business workspace to manage suppliers.
        </p>
      ) : isList ? (
        <div className="space-y-5">
          {error && (
            <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <span>{error}</span>
              <button type="button" onClick={() => setRefresh((value) => value + 1)} className="font-semibold underline">Retry</button>
            </div>
          )}
          {actionError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{actionError}</p>}
          <label className="block">
            <span className="sr-only">Search suppliers</span>
            <input
              type="search"
              value={search}
              onChange={(event) => { setSearch(event.target.value); setPage(1); }}
              placeholder="Search supplier name or contact..."
              className="h-11 w-full rounded-lg border border-stock-border bg-white px-3 text-sm text-stock-primary-text sm:max-w-xl"
            />
          </label>
          <section className="min-w-0 overflow-hidden rounded-xl border border-stock-border bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[44rem] text-left text-sm">
                <thead className="bg-stock-light-grey text-stock-secondary-text">
                  <tr>{["Supplier Name", "Contact Person", "Email", "Phone", "Actions"].map((heading) => <th key={heading} scope="col" className="px-4 py-3 font-medium">{heading}</th>)}</tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={5} className="px-4 py-12 text-center text-stock-secondary-text">Loading suppliers...</td></tr>
                  ) : suppliers.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-12 text-center text-stock-secondary-text">{search ? "No suppliers match this search." : "No suppliers have been added to this workspace yet."}</td></tr>
                  ) : suppliers.map((entry) => (
                    <tr key={entry._id} className="border-t border-stock-border">
                      <td className="px-4 py-3 font-medium text-stock-primary-text">{entry.supplierName}</td>
                      <td className="px-4 py-3">{entry.contactPerson || "—"}</td>
                      <td className="px-4 py-3">{entry.email || "—"}</td>
                      <td className="px-4 py-3">{entry.phone || "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-x-3 gap-y-1">
                          <Link to={`/suppliers/${entry._id}`} className="font-medium text-stock-primary-blue hover:underline">View</Link>
                          {canManage && <><Link to={`/suppliers/${entry._id}/edit`} className="font-medium text-stock-primary-blue hover:underline">Edit</Link><button type="button" onClick={() => void deleteSupplier(entry)} className="font-medium text-red-700 hover:underline">Delete</button></>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <div className="flex items-center justify-between text-sm text-stock-secondary-text">
            <span>{totalPages > 0 ? `Page ${page} of ${totalPages}` : "No pages"}</span>
            <div className="flex gap-2">
              <button type="button" disabled={loading || page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="h-10 rounded-lg border border-stock-border bg-white px-3 disabled:opacity-50">Previous</button>
              <button type="button" disabled={loading || page >= totalPages} onClick={() => setPage((value) => value + 1)} className="h-10 rounded-lg border border-stock-border bg-white px-3 disabled:opacity-50">Next</button>
            </div>
          </div>
        </div>
      ) : isCreate || isEdit ? (
        <section className="mx-auto max-w-3xl rounded-xl border border-stock-border bg-white p-5 shadow-sm sm:p-8">
          {loading && isEdit && <p role="status" className="mb-5 text-sm text-stock-secondary-text">Loading supplier...</p>}
          {error && <p role="alert" className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
          {formError && <p role="alert" className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{formError}</p>}
          <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
            <FormField id="supplierName" label="Supplier name" error={validationErrors.supplierName?.message} {...register("supplierName")} />
            <FormField id="companyName" label="Company name" {...register("companyName")} />
            <div className="grid gap-5 sm:grid-cols-2">
              <FormField id="contactPerson" label="Contact person" {...register("contactPerson")} />
              <FormField id="email" label="Email" type="email" error={validationErrors.email?.message} {...register("email")} />
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <FormField id="phone" label="Phone" error={validationErrors.phone?.message} {...register("phone")} />
              <FormField id="taxIdentification" label="Tax identification" {...register("taxIdentification")} />
            </div>
            <FormField id="address" label="Address">
              <textarea id="address" rows={3} className="w-full rounded-lg border border-stock-border bg-white px-3 py-2.5 text-sm text-stock-primary-text" {...register("address")} />
            </FormField>
            <FormField id="paymentTerms" label="Payment terms" {...register("paymentTerms")} />
            <div className="flex flex-col-reverse gap-3 border-t border-stock-border pt-5 sm:flex-row sm:justify-end">
              <Link to="/suppliers" className="inline-flex h-11 items-center justify-center rounded-lg border border-stock-border px-4 text-sm font-medium text-stock-primary-text">Cancel</Link>
              <button type="submit" disabled={isSubmitting || (isEdit && (loading || !supplier)) || Boolean(error)} className="h-11 rounded-lg bg-stock-primary-blue px-4 text-sm font-semibold text-white disabled:opacity-60">{isSubmitting ? "Saving..." : isEdit ? "Update Supplier" : "Save Supplier"}</button>
            </div>
          </form>
        </section>
      ) : (
        <div className="space-y-5">
          {loading && <p role="status" className="rounded-lg border border-stock-border bg-white p-5 text-sm text-stock-secondary-text">Loading supplier...</p>}
          {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
          {actionError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{actionError}</p>}
          {supplier && (
            <>
              <section className="rounded-xl border border-stock-border bg-white p-5 shadow-sm sm:p-8">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <h2 className="text-xl font-semibold text-stock-deep-navy">{supplier.supplierName}</h2>
                  {canManage && <div className="flex gap-2"><Link to={`/suppliers/${supplier._id}/edit`} className="inline-flex h-10 items-center rounded-lg bg-stock-primary-blue px-4 text-sm font-semibold text-white">Edit</Link><button type="button" onClick={() => void deleteSupplier(supplier)} className="h-10 rounded-lg border border-red-300 px-4 text-sm font-semibold text-red-700">Delete</button></div>}
                </div>
                <dl className="mt-6 grid gap-4 sm:grid-cols-2">
                  {[
                    ["Company name", supplier.companyName],
                    ["Contact person", supplier.contactPerson],
                    ["Email", supplier.email],
                    ["Phone", supplier.phone],
                    ["Tax identification", supplier.taxIdentification],
                    ["Payment terms", supplier.paymentTerms],
                  ].map(([label, value]) => <div key={label}><dt className="text-sm text-stock-secondary-text">{label}</dt><dd className="mt-1 break-words text-sm font-medium text-stock-primary-text">{value || "—"}</dd></div>)}
                </dl>
                <div className="mt-5">
                  <h3 className="text-sm font-semibold text-stock-primary-text">Address</h3>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-stock-secondary-text">{supplier.address || "No address recorded."}</p>
                </div>
              </section>
              <section className="rounded-xl border border-stock-border bg-white p-5 shadow-sm sm:p-6">
                <h2 className="text-base font-semibold text-stock-deep-navy">Associated Products</h2>
                {associatedProducts.length === 0 ? <p className="mt-3 text-sm text-stock-secondary-text">No products are associated with this supplier.</p> : <ul className="mt-3 divide-y divide-stock-border">{associatedProducts.map((product) => <li key={product._id} className="flex flex-wrap justify-between gap-2 py-3 text-sm"><Link to={`/products/${product._id}`} className="font-medium text-stock-primary-blue hover:underline">{product.productName}</Link><span className="text-stock-secondary-text">SKU {product.sku} · Stock {product.currentStock}</span></li>)}</ul>}
              </section>
              <section className="rounded-xl border border-stock-border bg-white p-5 shadow-sm sm:p-6">
                <h2 className="text-base font-semibold text-stock-deep-navy">Purchase History</h2>
                <p className="mt-3 text-sm leading-6 text-stock-secondary-text">Purchase history is unavailable because Purchase Management and purchase-order data are not implemented.</p>
              </section>
            </>
          )}
        </div>
      )}
    </AppShell>
  );
}
