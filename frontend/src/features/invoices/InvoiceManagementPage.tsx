import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AppShell } from "../../components/layout/AppShell";
import {
  apiRequest,
  downloadApiFile,
  StockPilotApiError,
} from "../../services/api";
import { useWorkspace } from "../workspace/workspaceContext";

type PaymentStatus = "UNPAID" | "PARTIALLY_PAID" | "PAID";
type PaymentMethod = "CASH" | "CARD" | "BANK_TRANSFER" | "UPI" | "OTHER";

interface InvoiceSummary {
  _id: string;
  invoiceNumber: string;
  invoiceDate: string;
  customerName: string;
  salesOrderNumber: string;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  currency: string;
  paymentStatus: PaymentStatus;
}

interface InvoiceItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  discountPercentage: number;
  subtotal: number;
  discountAmount: number;
  taxableAmount: number;
  taxAmount: number;
  lineTotal: number;
}

interface InvoiceRecord extends InvoiceSummary {
  businessName: string;
  businessLocation: string;
  businessEmail?: string;
  businessPhone?: string;
  salesOrderId: string;
  customerEmail?: string;
  customerPhone?: string;
  customerAddress?: string;
  products: InvoiceItem[];
  subtotal: number;
  discountTotal: number;
  taxableAmount: number;
  taxName: string;
  taxPercentage: number;
  tax: number;
  createdAt: string;
  lastPaymentAt?: string;
  paidAt?: string;
}

interface InvoicePaymentRecord {
  _id: string;
  amount: number;
  paymentMethod: PaymentMethod;
  reference?: string;
  note?: string;
  createdAt: string;
  recordedBy: string | { name: string };
}

interface AvailableSale {
  _id: string;
  salesOrderNumber: string;
  customerName: string;
  completedAt: string;
  totalAmount: number;
  status: string;
}

interface InvoiceListResponse {
  success: boolean;
  invoices: InvoiceSummary[];
  pagination: { page: number; totalPages: number; total: number };
}

interface InvoiceDetailsResponse {
  success: boolean;
  invoice: InvoiceRecord;
  payments: InvoicePaymentRecord[];
}

interface AvailableSalesResponse {
  success: boolean;
  salesOrders: AvailableSale[];
  pagination: { page: number; totalPages: number; total: number };
}

const paymentStatuses: PaymentStatus[] = [
  "UNPAID",
  "PARTIALLY_PAID",
  "PAID",
];
const paymentMethods: PaymentMethod[] = [
  "CASH",
  "CARD",
  "BANK_TRANSFER",
  "UPI",
  "OTHER",
];

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof StockPilotApiError ? error.message : fallback;
}

function formatAmount(value: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency || "INR",
  }).format(value);
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(date);
}

function statusLabel(status: PaymentStatus): string {
  return status.replaceAll("_", " ");
}

function statusClass(status: PaymentStatus): string {
  if (status === "PAID") return "bg-emerald-50 text-emerald-700";
  if (status === "PARTIALLY_PAID") return "bg-amber-50 text-amber-800";
  return "bg-slate-100 text-slate-700";
}

export function InvoiceManagementPage() {
  const { workspace } = useWorkspace();
  const location = useLocation();
  const navigate = useNavigate();
  const segments = location.pathname.split("/").filter(Boolean);
  const isList = segments.length === 1;
  const isCreate = segments[1] === "new";
  const invoiceId = segments[1] && segments[1] !== "new" ? segments[1] : "";
  const isDetails = Boolean(invoiceId);
  const requestedSalesOrderId = new URLSearchParams(location.search).get(
    "salesOrderId"
  );
  const canGenerate =
    !workspace?.membershipRole ||
    ["BUSINESS_OWNER", "SALES_EMPLOYEE"].includes(
      workspace.membershipRole
    );
  const canRecordPayment =
    !workspace?.membershipRole ||
    ["BUSINESS_OWNER", "ACCOUNTANT", "SALES_EMPLOYEE"].includes(
      workspace.membershipRole
    );

  const [invoices, setInvoices] = useState<InvoiceSummary[]>([]);
  const [invoice, setInvoice] = useState<InvoiceRecord | null>(null);
  const [payments, setPayments] = useState<InvoicePaymentRecord[]>([]);
  const [availableSales, setAvailableSales] = useState<AvailableSale[]>([]);
  const [selectedSalesOrderId, setSelectedSalesOrderId] = useState("");
  const [salesSearch, setSalesSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [salesLoading, setSalesLoading] = useState(false);
  const [error, setError] = useState("");
  const [salesError, setSalesError] = useState("");
  const [formError, setFormError] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [pdfDownloading, setPdfDownloading] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentNote, setPaymentNote] = useState("");
  const [paymentIdempotencyKey, setPaymentIdempotencyKey] = useState(() =>
    window.crypto.randomUUID()
  );

  useEffect(() => {
    setPage(1);
    setInvoices([]);
    setInvoice(null);
    setPayments([]);
    setError("");
    setPaymentError("");
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
      if (statusFilter) query.set("status", statusFilter);
      if (fromDate) query.set("from", fromDate);
      if (toDate) query.set("to", toDate);
      setLoading(true);
      setError("");
      apiRequest<InvoiceListResponse>(`/invoices?${query.toString()}`)
        .then((response) => {
          if (!response.success || !Array.isArray(response.invoices)) {
            throw new Error("The invoice list could not be loaded.");
          }
          if (!active) return;
          if (
            page > response.pagination.totalPages &&
            response.pagination.totalPages > 0
          ) {
            setPage(response.pagination.totalPages);
            return;
          }
          setInvoices(response.invoices);
          setTotalPages(response.pagination.totalPages);
        })
        .catch((loadError: unknown) => {
          if (active) {
            setError(
              getErrorMessage(loadError, "Unable to load invoices.")
            );
          }
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 200);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [
    isList,
    workspace?.id,
    page,
    search,
    statusFilter,
    fromDate,
    toDate,
    refresh,
  ]);

  useEffect(() => {
    if (!isCreate || !workspace?.id) return;
    let active = true;
    const timer = window.setTimeout(() => {
      const query = new URLSearchParams({
        businessId: workspace.id,
        page: "1",
        limit: "100",
      });
      if (salesSearch.trim()) query.set("search", salesSearch.trim());
      if (requestedSalesOrderId) {
        query.set("salesOrderId", requestedSalesOrderId);
      }
      setSalesLoading(true);
      setSalesError("");
      apiRequest<AvailableSalesResponse>(
        `/invoices/available-sales?${query.toString()}`
      )
        .then((response) => {
          if (!response.success || !Array.isArray(response.salesOrders)) {
            throw new Error("Sales orders available for invoicing could not be loaded.");
          }
          if (!active) return;
          setAvailableSales(response.salesOrders);
          if (
            requestedSalesOrderId &&
            response.salesOrders.some(
              (sale) => sale._id === requestedSalesOrderId
            )
          ) {
            setSelectedSalesOrderId(requestedSalesOrderId);
          }
        })
        .catch((loadError: unknown) => {
          if (active) {
            setSalesError(
              getErrorMessage(
                loadError,
                "Unable to load completed sales orders."
              )
            );
          }
        })
        .finally(() => {
          if (active) setSalesLoading(false);
        });
    }, 200);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [isCreate, workspace?.id, salesSearch, requestedSalesOrderId, refresh]);

  useEffect(() => {
    if (!isDetails || !workspace?.id) {
      setInvoice(null);
      setPayments([]);
      return;
    }
    let active = true;
    setLoading(true);
    setError("");
    apiRequest<InvoiceDetailsResponse>(
      `/invoices/${encodeURIComponent(invoiceId)}?businessId=${encodeURIComponent(workspace.id)}`
    )
      .then((response) => {
        if (!response.success || !response.invoice) {
          throw new Error("The invoice could not be loaded.");
        }
        if (!active) return;
        setInvoice(response.invoice);
        setPayments(response.payments);
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(
            getErrorMessage(loadError, "Unable to load this invoice.")
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [isDetails, invoiceId, workspace?.id, refresh]);

  const retryLoad = () => setRefresh((value) => value + 1);

  const generateInvoice = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!workspace?.id || !selectedSalesOrderId) {
      setFormError("Select a completed sales order to generate an invoice.");
      return;
    }
    setFormSubmitting(true);
    setFormError("");
    try {
      const response = await apiRequest<{
        success: boolean;
        invoice: InvoiceRecord;
      }>(
        `/invoices/from-sales/${encodeURIComponent(selectedSalesOrderId)}`,
        {
          method: "POST",
          body: JSON.stringify({ businessId: workspace.id }),
        }
      );
      if (!response.success || !response.invoice?._id) {
        throw new Error("The server did not confirm invoice generation.");
      }
      navigate(`/invoices/${response.invoice._id}`);
    } catch (submitError) {
      setFormError(
        getErrorMessage(submitError, "Unable to generate this invoice.")
      );
    } finally {
      setFormSubmitting(false);
    }
  };

  const downloadInvoice = async () => {
    if (!workspace?.id || !invoice) return;
    setPdfDownloading(true);
    setPaymentError("");
    try {
      const filename = `${invoice.invoiceNumber.replace(/[^A-Za-z0-9._-]/g, "_")}.pdf`;
      await downloadApiFile(
        `/invoices/${encodeURIComponent(invoice._id)}/pdf?businessId=${encodeURIComponent(workspace.id)}`,
        filename
      );
    } catch (downloadError) {
      setPaymentError(
        getErrorMessage(downloadError, "Unable to download this invoice.")
      );
    } finally {
      setPdfDownloading(false);
    }
  };

  const recordPayment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!workspace?.id || !invoice) return;
    const amount = Number(paymentAmount);
    if (
      !Number.isFinite(amount) ||
      amount <= 0 ||
      Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-7
    ) {
      setPaymentError("Enter a positive payment amount with up to two decimals.");
      return;
    }
    setPaymentSubmitting(true);
    setPaymentError("");
    try {
      await apiRequest(`/invoices/${encodeURIComponent(invoice._id)}/payments`, {
        method: "POST",
        headers: { "Idempotency-Key": paymentIdempotencyKey },
        body: JSON.stringify({
          businessId: workspace.id,
          amount,
          paymentMethod,
          reference: paymentReference.trim() || undefined,
          note: paymentNote.trim() || undefined,
        }),
      });
      setPaymentIdempotencyKey(window.crypto.randomUUID());
      setPaymentAmount("");
      setPaymentReference("");
      setPaymentNote("");
      retryLoad();
    } catch (recordError) {
      setPaymentError(
        getErrorMessage(recordError, "Unable to record this payment.")
      );
    } finally {
      setPaymentSubmitting(false);
    }
  };

  if (!workspace?.id) {
    return (
      <AppShell
        mode="business"
        title="Invoices"
        description="Invoices and payment history."
      >
        <section className="rounded-xl border border-stock-border bg-white p-5">
          <p className="text-sm text-stock-secondary-text">
            Select a workspace to manage invoices.
          </p>
          <Link
            to="/workspaces"
            className="mt-4 inline-flex h-10 items-center rounded-lg bg-stock-primary-blue px-4 text-sm font-semibold text-white"
          >
            Select workspace
          </Link>
        </section>
      </AppShell>
    );
  }

  const title = isCreate
    ? "Generate Invoice"
    : isDetails
      ? "Invoice Details"
      : "Invoices";

  return (
    <AppShell
      mode="business"
      title={title}
      description="Generate invoices from completed sales and track payments."
      action={
        isList && canGenerate ? (
          <Link
            to="/invoices/new"
            className="inline-flex h-11 items-center rounded-lg bg-stock-primary-blue px-4 text-sm font-semibold text-white"
          >
            Generate Invoice
          </Link>
        ) : (
          <Link
            to="/invoices"
            className="inline-flex h-10 items-center rounded-lg border border-stock-border bg-white px-4 text-sm font-medium text-stock-primary-text"
          >
            Back to Invoices
          </Link>
        )
      }
    >
      {error && (
        <div
          role="alert"
          className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
          <button
            type="button"
            onClick={retryLoad}
            className="ml-3 font-semibold underline"
          >
            Retry
          </button>
        </div>
      )}

      {isList && (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <input
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search invoice or customer..."
              aria-label="Search invoices"
              className="h-11 rounded-lg border border-stock-border bg-white px-3 text-sm xl:col-span-2"
            />
            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value);
                setPage(1);
              }}
              aria-label="Filter by payment status"
              className="h-11 rounded-lg border border-stock-border bg-white px-3 text-sm"
            >
              <option value="">All payment statuses</option>
              {paymentStatuses.map((status) => (
                <option key={status} value={status}>
                  {statusLabel(status)}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1 text-xs text-stock-secondary-text">
                From
                <input
                  type="date"
                  value={fromDate}
                  max={toDate || undefined}
                  onChange={(event) => {
                    setFromDate(event.target.value);
                    setPage(1);
                  }}
                  className="h-11 w-full rounded-lg border border-stock-border bg-white px-2 text-sm text-stock-primary-text"
                />
              </label>
              <label className="space-y-1 text-xs text-stock-secondary-text">
                To
                <input
                  type="date"
                  value={toDate}
                  min={fromDate || undefined}
                  onChange={(event) => {
                    setToDate(event.target.value);
                    setPage(1);
                  }}
                  className="h-11 w-full rounded-lg border border-stock-border bg-white px-2 text-sm text-stock-primary-text"
                />
              </label>
            </div>
          </div>
          <section className="overflow-hidden rounded-xl border border-stock-border bg-white">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[54rem] text-left text-sm">
                <thead className="bg-stock-light-grey text-stock-secondary-text">
                  <tr>
                    {[
                      "Invoice",
                      "Date",
                      "Customer",
                      "Total payable",
                      "Payment status",
                      "Actions",
                    ].map((heading) => (
                      <th
                        key={heading}
                        scope="col"
                        className="px-4 py-3 font-medium"
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-12 text-center text-stock-secondary-text"
                      >
                        Loading invoices...
                      </td>
                    </tr>
                  ) : invoices.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-12 text-center text-stock-secondary-text"
                      >
                        No invoices match this workspace and filter.
                      </td>
                    </tr>
                  ) : (
                    invoices.map((item) => (
                      <tr key={item._id} className="border-t border-stock-border">
                        <td className="px-4 py-3 font-medium">
                          {item.invoiceNumber}
                        </td>
                        <td className="px-4 py-3">
                          {formatDate(item.invoiceDate)}
                        </td>
                        <td className="px-4 py-3">{item.customerName}</td>
                        <td className="px-4 py-3">
                          {formatAmount(item.totalAmount, item.currency)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(item.paymentStatus)}`}
                          >
                            {statusLabel(item.paymentStatus)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            className="font-medium text-stock-primary-blue hover:underline"
                            to={`/invoices/${item._id}`}
                          >
                            View / Download
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
          <div className="flex items-center justify-between text-sm text-stock-secondary-text">
            <span>
              Page {page} of {totalPages || 1}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={loading || page <= 1}
                onClick={() => setPage((value) => value - 1)}
                className="h-10 rounded-lg border border-stock-border bg-white px-3 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={loading || page >= totalPages}
                onClick={() => setPage((value) => value + 1)}
                className="h-10 rounded-lg border border-stock-border bg-white px-3 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {isCreate && (
        <section className="mx-auto max-w-3xl space-y-5 rounded-xl border border-stock-border bg-white p-5 shadow-sm sm:p-8">
          <div>
            <h2 className="text-lg font-semibold text-stock-primary-text">
              Select a completed sale
            </h2>
            <p className="mt-1 text-sm text-stock-secondary-text">
              Invoice amounts and line items are copied from the completed sale. Existing invoices cannot be duplicated.
            </p>
          </div>
          {salesError && (
            <p
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              {salesError}
              <button
                type="button"
                onClick={retryLoad}
                className="ml-3 font-semibold underline"
              >
                Retry
              </button>
            </p>
          )}
          {formError && (
            <p
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              {formError}
            </p>
          )}
          <label className="block space-y-1.5 text-sm font-medium">
            Search sales orders
            <input
              type="search"
              value={salesSearch}
              onChange={(event) => setSalesSearch(event.target.value)}
              placeholder="Sale number or customer..."
              className="h-11 w-full rounded-lg border border-stock-border px-3 font-normal"
            />
          </label>
          {salesLoading ? (
            <p role="status" className="text-sm text-stock-secondary-text">
              Loading completed sales...
            </p>
          ) : availableSales.length === 0 ? (
            <p className="rounded-lg bg-stock-light-grey p-4 text-sm text-stock-secondary-text">
              No eligible sales orders are available. Only completed sales without an invoice can be selected.
            </p>
          ) : (
            <form
              onSubmit={(event) => void generateInvoice(event)}
              className="space-y-5"
            >
              <label className="block space-y-1.5 text-sm font-medium">
                Sales order *
                <select
                  required
                  value={selectedSalesOrderId}
                  onChange={(event) =>
                    setSelectedSalesOrderId(event.target.value)
                  }
                  className="h-11 w-full rounded-lg border border-stock-border bg-white px-3 font-normal"
                >
                  <option value="">Select a completed sale</option>
                  {availableSales.map((sale) => (
                    <option key={sale._id} value={sale._id}>
                      {sale.salesOrderNumber} · {sale.customerName} ·{" "}
                      {formatAmount(sale.totalAmount, workspace.currency)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex flex-col-reverse gap-3 border-t border-stock-border pt-5 sm:flex-row sm:justify-end">
                <Link
                  to="/invoices"
                  className="inline-flex h-11 items-center justify-center rounded-lg border border-stock-border px-4 text-sm font-medium"
                >
                  Cancel
                </Link>
                <button
                  type="submit"
                  disabled={
                    formSubmitting ||
                    salesLoading ||
                    !selectedSalesOrderId ||
                    !canGenerate
                  }
                  className="h-11 rounded-lg bg-stock-primary-blue px-4 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {formSubmitting ? "Generating..." : "Generate Invoice"}
                </button>
              </div>
            </form>
          )}
        </section>
      )}

      {isDetails && (
        <div className="space-y-5">
          {loading && (
            <p role="status" className="text-sm text-stock-secondary-text">
              Loading invoice...
            </p>
          )}
          {!loading && !invoice && !error && (
            <p className="rounded-xl border border-stock-border bg-white p-6 text-sm text-stock-secondary-text">
              Invoice not found.
            </p>
          )}
          {invoice && (
            <>
              {(paymentError || error) && (
                <p
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                >
                  {paymentError || error}
                  {error && (
                    <button
                      type="button"
                      onClick={retryLoad}
                      className="ml-3 font-semibold underline"
                    >
                      Retry
                    </button>
                  )}
                </p>
              )}
              <article className="invoice-printable mx-auto max-w-5xl rounded-xl border border-stock-border bg-white p-5 shadow-sm sm:p-8 print:border-0 print:shadow-none">
                <div className="flex flex-col gap-5 border-b border-stock-border pb-5 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-wide text-stock-accent-teal">
                      StockPilot · Invoice
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold text-stock-deep-navy">
                      {invoice.businessName}
                    </h2>
                    <p className="mt-1 text-sm text-stock-secondary-text">
                      {invoice.businessLocation}
                    </p>
                    {invoice.businessEmail && (
                      <p className="text-sm text-stock-secondary-text">
                        {invoice.businessEmail}
                      </p>
                    )}
                    {invoice.businessPhone && (
                      <p className="text-sm text-stock-secondary-text">
                        {invoice.businessPhone}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={pdfDownloading}
                      onClick={() => void downloadInvoice()}
                      className="h-10 rounded-lg bg-stock-primary-blue px-3 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {pdfDownloading ? "Preparing PDF..." : "Download PDF"}
                    </button>
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="h-10 rounded-lg border border-stock-border px-3 text-sm font-medium print:hidden"
                    >
                      Print
                    </button>
                  </div>
                </div>
                <div className="grid gap-5 border-b border-stock-border py-5 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-stock-secondary-text">
                      Bill to
                    </p>
                    <p className="mt-2 font-semibold">{invoice.customerName}</p>
                    {invoice.customerAddress && (
                      <p className="mt-1 text-sm text-stock-secondary-text">
                        {invoice.customerAddress}
                      </p>
                    )}
                    {invoice.customerEmail && (
                      <p className="text-sm text-stock-secondary-text">
                        {invoice.customerEmail}
                      </p>
                    )}
                    {invoice.customerPhone && (
                      <p className="text-sm text-stock-secondary-text">
                        {invoice.customerPhone}
                      </p>
                    )}
                  </div>
                  <div className="sm:text-right">
                    <h3 className="text-lg font-semibold text-stock-deep-navy">
                      {invoice.invoiceNumber}
                    </h3>
                    <p className="mt-1 text-sm text-stock-secondary-text">
                      Invoice date: {formatDate(invoice.invoiceDate)}
                    </p>
                    <p className="text-sm text-stock-secondary-text">
                      Sales order: {invoice.salesOrderNumber}
                    </p>
                    <span
                      className={`mt-3 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(invoice.paymentStatus)}`}
                    >
                      {statusLabel(invoice.paymentStatus)}
                    </span>
                  </div>
                </div>
                <div className="overflow-x-auto py-5">
                  <table className="w-full min-w-[52rem] text-left text-sm">
                    <thead className="bg-stock-light-grey text-stock-secondary-text">
                      <tr>
                        {[
                          "Product",
                          "Qty",
                          "Unit price",
                          "Discount",
                          "Tax",
                          "Amount",
                        ].map((heading) => (
                          <th
                            key={heading}
                            scope="col"
                            className="px-3 py-3 font-medium"
                          >
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {invoice.products.map((item) => (
                        <tr
                          key={item.productId}
                          className="border-b border-stock-border"
                        >
                          <td className="px-3 py-3">
                            <span className="font-medium">{item.productName}</span>
                            <span className="block text-xs text-stock-secondary-text">
                              {item.sku}
                            </span>
                          </td>
                          <td className="px-3 py-3">{item.quantity}</td>
                          <td className="px-3 py-3">
                            {formatAmount(item.unitPrice, invoice.currency)}
                          </td>
                          <td className="px-3 py-3">
                            {item.discountPercentage}% ·{" "}
                            {formatAmount(item.discountAmount, invoice.currency)}
                          </td>
                          <td className="px-3 py-3">
                            {formatAmount(item.taxAmount, invoice.currency)}
                          </td>
                          <td className="px-3 py-3 font-medium">
                            {formatAmount(item.lineTotal, invoice.currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="ml-auto max-w-sm space-y-2 border-t border-stock-border pt-4 text-sm">
                  <div className="flex justify-between gap-4">
                    <span>Subtotal</span>
                    <span>{formatAmount(invoice.subtotal, invoice.currency)}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span>Discount</span>
                    <span>
                      {formatAmount(invoice.discountTotal, invoice.currency)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span>
                      {invoice.taxName} ({invoice.taxPercentage}%)
                    </span>
                    <span>{formatAmount(invoice.tax, invoice.currency)}</span>
                  </div>
                  <div className="flex justify-between gap-4 border-t border-stock-border pt-2 text-base font-semibold">
                    <span>Total payable</span>
                    <span>
                      {formatAmount(invoice.totalAmount, invoice.currency)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span>Amount paid</span>
                    <span>
                      {formatAmount(invoice.amountPaid, invoice.currency)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4 font-semibold text-stock-deep-navy">
                    <span>Balance due</span>
                    <span>
                      {formatAmount(invoice.balanceDue, invoice.currency)}
                    </span>
                  </div>
                </div>
              </article>

              {canRecordPayment && invoice.balanceDue > 0 && (
                <section className="rounded-xl border border-stock-border bg-white p-5 shadow-sm sm:p-7">
                  <h2 className="text-lg font-semibold">Record Payment</h2>
                  <p className="mt-1 text-sm text-stock-secondary-text">
                    Outstanding balance:{" "}
                    {formatAmount(invoice.balanceDue, invoice.currency)}. Payments are recorded manually; no payment gateway is connected.
                  </p>
                  {paymentError && (
                    <p
                      role="alert"
                      className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                    >
                      {paymentError}
                    </p>
                  )}
                  <form
                    onSubmit={(event) => void recordPayment(event)}
                    className="mt-4 grid gap-4 sm:grid-cols-2"
                  >
                    <label className="space-y-1.5 text-sm font-medium">
                      Amount *
                      <input
                        type="number"
                        min="0.01"
                        max={invoice.balanceDue}
                        step="0.01"
                        required
                        value={paymentAmount}
                        onChange={(event) =>
                          setPaymentAmount(event.target.value)
                        }
                        className="h-11 w-full rounded-lg border border-stock-border px-3 font-normal"
                      />
                    </label>
                    <label className="space-y-1.5 text-sm font-medium">
                      Method *
                      <select
                        value={paymentMethod}
                        onChange={(event) =>
                          setPaymentMethod(event.target.value as PaymentMethod)
                        }
                        className="h-11 w-full rounded-lg border border-stock-border bg-white px-3 font-normal"
                      >
                        {paymentMethods.map((method) => (
                          <option key={method} value={method}>
                            {method.replaceAll("_", " ")}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1.5 text-sm font-medium">
                      Reference (optional)
                      <input
                        maxLength={100}
                        value={paymentReference}
                        onChange={(event) =>
                          setPaymentReference(event.target.value)
                        }
                        className="h-11 w-full rounded-lg border border-stock-border px-3 font-normal"
                      />
                    </label>
                    <label className="space-y-1.5 text-sm font-medium">
                      Note (optional)
                      <input
                        maxLength={500}
                        value={paymentNote}
                        onChange={(event) => setPaymentNote(event.target.value)}
                        className="h-11 w-full rounded-lg border border-stock-border px-3 font-normal"
                      />
                    </label>
                    <div className="sm:col-span-2">
                      <button
                        type="submit"
                        disabled={paymentSubmitting}
                        className="h-11 rounded-lg bg-stock-primary-blue px-4 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        {paymentSubmitting ? "Recording..." : "Record Payment"}
                      </button>
                    </div>
                  </form>
                </section>
              )}

              <section className="rounded-xl border border-stock-border bg-white p-5 shadow-sm sm:p-7">
                <h2 className="text-lg font-semibold">Payment History</h2>
                {payments.length === 0 ? (
                  <p className="mt-3 text-sm text-stock-secondary-text">
                    No payments recorded.
                  </p>
                ) : (
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full min-w-[40rem] text-left text-sm">
                      <thead className="bg-stock-light-grey text-stock-secondary-text">
                        <tr>
                          {["Date", "Method", "Reference", "Recorded by", "Amount"].map(
                            (heading) => (
                              <th
                                key={heading}
                                scope="col"
                                className="px-3 py-3 font-medium"
                              >
                                {heading}
                              </th>
                            )
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {payments.map((payment) => (
                          <tr
                            key={payment._id}
                            className="border-t border-stock-border"
                          >
                            <td className="px-3 py-3">
                              {new Date(payment.createdAt).toLocaleString()}
                            </td>
                            <td className="px-3 py-3">
                              {payment.paymentMethod.replaceAll("_", " ")}
                            </td>
                            <td className="px-3 py-3">
                              {payment.reference || "—"}
                            </td>
                            <td className="px-3 py-3">
                              {typeof payment.recordedBy === "string"
                                ? "—"
                                : payment.recordedBy.name}
                            </td>
                            <td className="px-3 py-3 font-medium">
                              {formatAmount(payment.amount, invoice.currency)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      )}
    </AppShell>
  );
}
