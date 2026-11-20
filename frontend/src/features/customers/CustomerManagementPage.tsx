import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";
import { AppShell } from "../../components/layout/AppShell";
import { FormField } from "../../components/ui/FormField";
import { apiRequest, StockPilotApiError } from "../../services/api";
import { useWorkspace } from "../workspace/workspaceContext";

interface CustomerRecord {
  _id: string;
  customerName: string;
  email?: string;
  phone?: string;
  address?: string;
}

interface CustomerListResponse {
  success: boolean;
  customers: CustomerRecord[];
  pagination: { page: number; totalPages: number; total: number };
}

interface CustomerDetailsResponse {
  success: boolean;
  customer: CustomerRecord;
}

interface CustomerMutationResponse {
  success: boolean;
  customer: CustomerRecord;
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
const customerSchema = z.object({
  customerName: z.string().trim().min(1, "Customer name is required"),
  email: optionalEmail,
  phone: optionalPhone,
  address: z.string().optional(),
});
type CustomerFormValues = z.infer<typeof customerSchema>;

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof StockPilotApiError ? error.message : fallback;
}

export function CustomerManagementPage() {
  const { workspace } = useWorkspace();
  const location = useLocation();
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [customer, setCustomer] = useState<CustomerRecord | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [actionError, setActionError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const canManage =
    !workspace?.membershipRole || workspace.membershipRole === "BUSINESS_OWNER";

  const segments = location.pathname.split("/").filter(Boolean);
  const isList = segments.length === 1;
  const isCreate = segments[1] === "new";
  const isEdit = segments[2] === "edit";
  const customerId = segments[1] && segments[1] !== "new" ? segments[1] : "";

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors: validationErrors },
  } = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      customerName: "",
      email: "",
      phone: "",
      address: "",
    },
  });

  useEffect(() => {
    setCustomers([]);
    setPage(1);
    setTotalPages(0);
    setError("");
  }, [workspace?.id]);

  useEffect(() => {
    if (!isList || !workspace?.id) return;
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
      apiRequest<CustomerListResponse>(`/customers?${query.toString()}`)
        .then((response) => {
          if (!response.success || !Array.isArray(response.customers)) {
            throw new Error("The customer list could not be loaded.");
          }
          if (!active) return;
          if (page > response.pagination.totalPages && response.pagination.totalPages > 0) {
            setPage(response.pagination.totalPages);
            return;
          }
          setCustomers(response.customers);
          setTotalPages(response.pagination.totalPages);
        })
        .catch((loadError: unknown) => {
          if (active) setError(getErrorMessage(loadError, "Unable to load customers."));
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
    if (!customerId || !workspace?.id) {
      setCustomer(null);
      return;
    }
    let active = true;
    setCustomer(null);
    setLoading(true);
    setError("");
    apiRequest<CustomerDetailsResponse>(
      `/customers/${encodeURIComponent(customerId)}?businessId=${encodeURIComponent(workspace.id)}`
    )
      .then((response) => {
        if (!response.success || !response.customer) {
          throw new Error("The customer could not be loaded.");
        }
        if (!active) return;
        setCustomer(response.customer);
        if (isEdit) {
          reset({
            customerName: response.customer.customerName,
            email: response.customer.email ?? "",
            phone: response.customer.phone ?? "",
            address: response.customer.address ?? "",
          });
        }
      })
      .catch((loadError: unknown) => {
        if (active) setError(getErrorMessage(loadError, "Unable to load this customer."));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [customerId, workspace?.id, isEdit, reset, refresh]);

  useEffect(() => {
    if (isCreate) {
      reset({ customerName: "", email: "", phone: "", address: "" });
      setFormError("");
    }
  }, [isCreate, reset]);

  const onSubmit = async (values: CustomerFormValues) => {
    if (!workspace?.id) return;
    setFormError("");
    setIsSubmitting(true);
    try {
      const response = await apiRequest<CustomerMutationResponse>(
        isEdit && customerId
          ? `/customers/${encodeURIComponent(customerId)}`
          : "/customers",
        {
          method: isEdit ? "PUT" : "POST",
          body: JSON.stringify({ ...values, businessId: workspace.id }),
        }
      );
      if (!response.success || !response.customer?._id) {
        throw new Error("The server did not confirm the customer.");
      }
      navigate(`/customers/${response.customer._id}`);
    } catch (submitError) {
      setFormError(getErrorMessage(submitError, "Unable to save this customer."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteCustomer = async (target: CustomerRecord) => {
    if (
      !workspace?.id ||
      !window.confirm(`Delete "${target.customerName}"? This cannot be undone.`)
    ) {
      return;
    }
    setActionError("");
    try {
      await apiRequest(`/customers/${encodeURIComponent(target._id)}`, {
        method: "DELETE",
        body: JSON.stringify({ businessId: workspace.id }),
      });
      if (customer?._id === target._id) {
        navigate("/customers", { replace: true });
      } else {
        setRefresh((value) => value + 1);
      }
    } catch (deleteError) {
      setActionError(getErrorMessage(deleteError, "Unable to delete this customer."));
    }
  };

  const title = isList
    ? "Customers"
    : isCreate
      ? "Add Customer"
      : isEdit
        ? "Edit Customer"
        : "Customer Details";

  return (
    <AppShell
      mode="business"
      title={title}
      description="Manage customers for the selected business workspace."
      action={
        isList && canManage ? (
          <Link
            to="/customers/new"
            className="inline-flex h-11 items-center justify-center rounded-lg bg-stock-primary-blue px-4 text-sm font-semibold text-white"
          >
            Add Customer
          </Link>
        ) : !isList ? (
          <Link
            to="/customers"
            className="inline-flex h-10 items-center justify-center rounded-lg border border-stock-border bg-white px-4 text-sm font-medium text-stock-primary-text"
          >
            Back to Customers
          </Link>
        ) : null
      }
    >
      {!workspace?.id ? (
        <p className="rounded-xl border border-stock-border bg-white p-5 text-sm text-stock-secondary-text">
          Select a business workspace to manage customers.
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
            <span className="sr-only">Search customers</span>
            <input
              type="search"
              value={search}
              onChange={(event) => { setSearch(event.target.value); setPage(1); }}
              placeholder="Search customer name, email or phone..."
              className="h-11 w-full rounded-lg border border-stock-border bg-white px-3 text-sm text-stock-primary-text sm:max-w-xl"
            />
          </label>
          <section className="min-w-0 overflow-hidden rounded-xl border border-stock-border bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[36rem] text-left text-sm">
                <thead className="bg-stock-light-grey text-stock-secondary-text">
                  <tr>{["Customer Name", "Contact Information", "Actions"].map((heading) => <th key={heading} scope="col" className="px-4 py-3 font-medium">{heading}</th>)}</tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={3} className="px-4 py-12 text-center text-stock-secondary-text">Loading customers...</td></tr>
                  ) : customers.length === 0 ? (
                    <tr><td colSpan={3} className="px-4 py-12 text-center text-stock-secondary-text">{search ? "No customers match this search." : "No customers have been added to this workspace yet."}</td></tr>
                  ) : customers.map((entry) => (
                    <tr key={entry._id} className="border-t border-stock-border">
                      <td className="px-4 py-3 font-medium text-stock-primary-text">{entry.customerName}</td>
                      <td className="px-4 py-3"><span className="block">{entry.email || "—"}</span><span className="mt-1 block text-stock-secondary-text">{entry.phone || "—"}</span></td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-x-3 gap-y-1">
                          <Link to={`/customers/${entry._id}`} className="font-medium text-stock-primary-blue hover:underline">View</Link>
                          {canManage && <><Link to={`/customers/${entry._id}/edit`} className="font-medium text-stock-primary-blue hover:underline">Edit</Link><button type="button" onClick={() => void deleteCustomer(entry)} className="font-medium text-red-700 hover:underline">Delete</button></>}
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
          {loading && isEdit && <p role="status" className="mb-5 text-sm text-stock-secondary-text">Loading customer...</p>}
          {error && <p role="alert" className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
          {formError && <p role="alert" className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{formError}</p>}
          <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
            <FormField id="customerName" label="Customer name" error={validationErrors.customerName?.message} {...register("customerName")} />
            <div className="grid gap-5 sm:grid-cols-2">
              <FormField id="email" label="Email" type="email" error={validationErrors.email?.message} {...register("email")} />
              <FormField id="phone" label="Phone" error={validationErrors.phone?.message} {...register("phone")} />
            </div>
            <FormField id="address" label="Address">
              <textarea id="address" rows={4} className="w-full rounded-lg border border-stock-border bg-white px-3 py-2.5 text-sm text-stock-primary-text" {...register("address")} />
            </FormField>
            <div className="flex flex-col-reverse gap-3 border-t border-stock-border pt-5 sm:flex-row sm:justify-end">
              <Link to="/customers" className="inline-flex h-11 items-center justify-center rounded-lg border border-stock-border px-4 text-sm font-medium text-stock-primary-text">Cancel</Link>
              <button type="submit" disabled={isSubmitting || (isEdit && (loading || !customer)) || Boolean(error)} className="h-11 rounded-lg bg-stock-primary-blue px-4 text-sm font-semibold text-white disabled:opacity-60">{isSubmitting ? "Saving..." : isEdit ? "Update Customer" : "Save Customer"}</button>
            </div>
          </form>
        </section>
      ) : (
        <div className="space-y-5">
          {loading && <p role="status" className="rounded-lg border border-stock-border bg-white p-5 text-sm text-stock-secondary-text">Loading customer...</p>}
          {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
          {actionError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{actionError}</p>}
          {customer && (
            <>
              <section className="rounded-xl border border-stock-border bg-white p-5 shadow-sm sm:p-8">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <h2 className="text-xl font-semibold text-stock-deep-navy">{customer.customerName}</h2>
                  {canManage && <div className="flex gap-2"><Link to={`/customers/${customer._id}/edit`} className="inline-flex h-10 items-center rounded-lg bg-stock-primary-blue px-4 text-sm font-semibold text-white">Edit</Link><button type="button" onClick={() => void deleteCustomer(customer)} className="h-10 rounded-lg border border-red-300 px-4 text-sm font-semibold text-red-700">Delete</button></div>}
                </div>
                <dl className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div><dt className="text-sm text-stock-secondary-text">Email</dt><dd className="mt-1 break-words text-sm font-medium text-stock-primary-text">{customer.email || "—"}</dd></div>
                  <div><dt className="text-sm text-stock-secondary-text">Phone</dt><dd className="mt-1 text-sm font-medium text-stock-primary-text">{customer.phone || "—"}</dd></div>
                  <div className="sm:col-span-2"><dt className="text-sm text-stock-secondary-text">Address</dt><dd className="mt-1 whitespace-pre-wrap text-sm leading-6 text-stock-primary-text">{customer.address || "No address recorded."}</dd></div>
                </dl>
              </section>
              <section className="rounded-xl border border-stock-border bg-white p-5 shadow-sm sm:p-6">
                <h2 className="text-base font-semibold text-stock-deep-navy">Sales Order History</h2>
                <p className="mt-3 text-sm leading-6 text-stock-secondary-text">Sales history is unavailable because Sales Management and sales-order data are not implemented.</p>
              </section>
            </>
          )}
        </div>
      )}
    </AppShell>
  );
}
