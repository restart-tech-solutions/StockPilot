import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AppShell } from "../../components/layout/AppShell";
import { apiRequest, StockPilotApiError } from "../../services/api";
import { useWorkspace } from "../workspace/workspaceContext";

interface CustomerOption {
  _id: string;
  customerName: string;
}

interface ProductOption {
  _id: string;
  productName: string;
  sku: string;
  sellingPrice: number;
}

interface WarehouseOption {
  _id: string;
  warehouseName: string;
  city: string;
}

interface SalesOrderItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  discountPercentage: number;
  subtotal: number;
  discountAmount: number;
  taxableAmount: number;
  returnedQuantity: number;
}

interface SalesOrderRecord {
  _id: string;
  salesOrderNumber: string;
  customerId: string | CustomerOption;
  customerName: string;
  warehouseId: string | WarehouseOption;
  products: SalesOrderItem[];
  subtotal: number;
  discountTotal: number;
  taxableAmount: number;
  taxPercentage: number;
  tax: number;
  totalAmount: number;
  status: string;
  invoiceId?: string | { _id: string };
  createdAt: string;
  completedAt?: string;
  cancelledAt?: string;
  returnedAt?: string;
}

interface SalesReturnRecord {
  _id: string;
  returnNumber: string;
  products: Array<{
    productId: string;
    productName: string;
    quantity: number;
  }>;
  createdAt: string;
}

interface SalesListResponse {
  success: boolean;
  salesOrders: SalesOrderRecord[];
  pagination: { page: number; totalPages: number; total: number };
}

interface SalesDetailsResponse {
  success: boolean;
  salesOrder: SalesOrderRecord;
  returns: SalesReturnRecord[];
}

interface CustomerResponse {
  success: boolean;
  customers: CustomerOption[];
}

interface ProductResponse {
  success: boolean;
  products: ProductOption[];
}

interface WarehouseResponse {
  success: boolean;
  warehouses: WarehouseOption[];
}

interface SalesLineDraft {
  productId: string;
  quantity: string;
  discountPercentage: string;
}

const statuses = [
  "DRAFT",
  "COMPLETED",
  "PARTIALLY_RETURNED",
  "RETURNED",
  "CANCELLED",
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

function relationName(
  value: string | CustomerOption | WarehouseOption,
  fallback: string
): string {
  return typeof value === "string"
    ? fallback
    : "customerName" in value
      ? value.customerName
      : value.warehouseName;
}

function relationId(value: string | { _id: string }): string {
  return typeof value === "string" ? value : value._id;
}

export function SalesManagementPage() {
  const { workspace } = useWorkspace();
  const location = useLocation();
  const navigate = useNavigate();
  const segments = location.pathname.split("/").filter(Boolean);
  const isList = segments.length === 1;
  const isCreate = segments[1] === "new";
  const isEdit = segments[2] === "edit";
  const salesOrderId =
    segments[1] && segments[1] !== "new" ? segments[1] : "";
  const isDetails = Boolean(salesOrderId) && !isEdit;
  const canManage =
    !workspace?.membershipRole ||
    ["BUSINESS_OWNER", "SALES_EMPLOYEE"].includes(
      workspace.membershipRole
    );

  const [salesOrders, setSalesOrders] = useState<SalesOrderRecord[]>([]);
  const [salesOrder, setSalesOrder] = useState<SalesOrderRecord | null>(null);
  const [returns, setReturns] = useState<SalesReturnRecord[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [error, setError] = useState("");
  const [optionsError, setOptionsError] = useState("");
  const [formError, setFormError] = useState("");
  const [actionError, setActionError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [actionSubmitting, setActionSubmitting] = useState(false);
  const [returnSubmitting, setReturnSubmitting] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [lines, setLines] = useState<SalesLineDraft[]>([
    { productId: "", quantity: "", discountPercentage: "0" },
  ]);
  const [returnQuantities, setReturnQuantities] = useState<
    Record<string, string>
  >({});
  const [returnError, setReturnError] = useState("");
  const [returnIdempotencyKey, setReturnIdempotencyKey] = useState(() =>
    window.crypto.randomUUID()
  );

  const estimate = useMemo(
    () =>
      lines.reduce(
        (total, line) => {
          const product = products.find((item) => item._id === line.productId);
          const quantity = Number(line.quantity);
          const discount = Number(line.discountPercentage);
          if (
            !product ||
            !Number.isFinite(quantity) ||
            quantity <= 0 ||
            !Number.isFinite(discount) ||
            discount < 0 ||
            discount > 100
          ) {
            return total;
          }
          const subtotal = product.sellingPrice * quantity;
          return {
            subtotal: total.subtotal + subtotal,
            discount:
              total.discount + (subtotal * discount) / 100,
          };
        },
        { subtotal: 0, discount: 0 }
      ),
    [lines, products]
  );

  useEffect(() => {
    setPage(1);
    setSalesOrders([]);
    setSalesOrder(null);
    setReturns([]);
    setError("");
    setActionError("");
  }, [workspace?.id]);

  useEffect(() => {
    if (isCreate) {
      setCustomerId("");
      setWarehouseId("");
      setLines([{ productId: "", quantity: "", discountPercentage: "0" }]);
      setFormError("");
    }
  }, [isCreate]);

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
      setLoading(true);
      setError("");
      apiRequest<SalesListResponse>(`/sales?${query.toString()}`)
        .then((response) => {
          if (!response.success || !Array.isArray(response.salesOrders)) {
            throw new Error("The sales order list could not be loaded.");
          }
          if (!active) return;
          if (
            page > response.pagination.totalPages &&
            response.pagination.totalPages > 0
          ) {
            setPage(response.pagination.totalPages);
            return;
          }
          setSalesOrders(response.salesOrders);
          setTotalPages(response.pagination.totalPages);
        })
        .catch((loadError: unknown) => {
          if (active) {
            setError(
              getErrorMessage(loadError, "Unable to load sales orders.")
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
  }, [isList, workspace?.id, page, search, statusFilter, refresh]);

  useEffect(() => {
    if (!workspace?.id || (!isCreate && !isEdit)) return;
    let active = true;
    setOptionsLoading(true);
    setOptionsError("");
    const businessQuery = `businessId=${encodeURIComponent(workspace.id)}&limit=100`;
    Promise.all([
      apiRequest<CustomerResponse>(`/customers?${businessQuery}`),
      apiRequest<ProductResponse>(`/products?${businessQuery}`),
      apiRequest<WarehouseResponse>(
        `/warehouses?businessId=${encodeURIComponent(workspace.id)}`
      ),
    ])
      .then(([customerResponse, productResponse, warehouseResponse]) => {
        if (
          !customerResponse.success ||
          !productResponse.success ||
          !warehouseResponse.success
        ) {
          throw new Error("Sales form options could not be loaded.");
        }
        if (!active) return;
        setCustomers(customerResponse.customers);
        setProducts(productResponse.products);
        setWarehouses(warehouseResponse.warehouses);
      })
      .catch((loadError: unknown) => {
        if (active) {
          setOptionsError(
            getErrorMessage(
              loadError,
              "Unable to load customers, products or warehouses."
            )
          );
        }
      })
      .finally(() => {
        if (active) setOptionsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [workspace?.id, isCreate, isEdit, refresh]);

  useEffect(() => {
    if (!salesOrderId || !workspace?.id || (!isDetails && !isEdit)) {
      setSalesOrder(null);
      setReturns([]);
      return;
    }
    let active = true;
    setLoading(true);
    setError("");
    apiRequest<SalesDetailsResponse>(
      `/sales/${encodeURIComponent(salesOrderId)}?businessId=${encodeURIComponent(workspace.id)}`
    )
      .then((response) => {
        if (!response.success || !response.salesOrder) {
          throw new Error("The sales order could not be loaded.");
        }
        if (!active) return;
        setSalesOrder(response.salesOrder);
        setReturns(response.returns);
        if (isEdit) {
          setCustomerId(relationId(response.salesOrder.customerId));
          setWarehouseId(relationId(response.salesOrder.warehouseId));
          setLines(
            response.salesOrder.products.map((item) => ({
              productId: item.productId,
              quantity: String(item.quantity),
              discountPercentage: String(item.discountPercentage),
            }))
          );
        }
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(
            getErrorMessage(loadError, "Unable to load this sales order.")
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [salesOrderId, workspace?.id, isDetails, isEdit, refresh]);

  const retryLoad = () => setRefresh((value) => value + 1);

  const submitSalesOrder = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!workspace?.id) {
      setFormError("Select a business workspace before saving.");
      return;
    }
    const normalizedLines = lines.map((line) => ({
      productId: line.productId,
      quantity: Number(line.quantity),
      discountPercentage: Number(line.discountPercentage || "0"),
    }));
    if (
      !customerId ||
      !warehouseId ||
      normalizedLines.length === 0 ||
      normalizedLines.some(
        (line) =>
          !line.productId ||
          !Number.isFinite(line.quantity) ||
          line.quantity <= 0 ||
          !Number.isFinite(line.discountPercentage) ||
          line.discountPercentage < 0 ||
          line.discountPercentage > 100
      ) ||
      new Set(normalizedLines.map((line) => line.productId)).size !==
        normalizedLines.length
    ) {
      setFormError(
        "Select a customer and warehouse, then enter unique products, positive quantities and discounts from 0 to 100%."
      );
      return;
    }

    setFormSubmitting(true);
    setFormError("");
    try {
      const response = await apiRequest<{
        success: boolean;
        salesOrder: SalesOrderRecord;
      }>(
        isEdit && salesOrderId
          ? `/sales/${encodeURIComponent(salesOrderId)}`
          : "/sales",
        {
          method: isEdit ? "PUT" : "POST",
          body: JSON.stringify({
            businessId: workspace.id,
            customerId,
            warehouseId,
            products: normalizedLines,
          }),
        }
      );
      if (!response.success || !response.salesOrder?._id) {
        throw new Error("The server did not confirm the sales order.");
      }
      navigate(`/sales/${response.salesOrder._id}`);
    } catch (submitError) {
      setFormError(
        getErrorMessage(submitError, "Unable to save the sales order.")
      );
    } finally {
      setFormSubmitting(false);
    }
  };

  const performOrderAction = async (action: "complete" | "cancel") => {
    if (!workspace?.id || !salesOrder) return;
    setActionSubmitting(true);
    setActionError("");
    try {
      await apiRequest(
        `/sales/${encodeURIComponent(salesOrder._id)}/${action}`,
        {
          method: "POST",
          body: JSON.stringify({ businessId: workspace.id }),
        }
      );
      retryLoad();
    } catch (actionFailure) {
      setActionError(
        getErrorMessage(actionFailure, `Unable to ${action} this sale.`)
      );
    } finally {
      setActionSubmitting(false);
    }
  };

  const submitReturn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!workspace?.id || !salesOrder) return;
    const returnProducts = Object.entries(returnQuantities)
      .filter(([, value]) => value.trim() !== "")
      .map(([productId, value]) => ({
        productId,
        quantity: Number(value),
      }));
    if (
      returnProducts.length === 0 ||
      returnProducts.some(
        (item) => !Number.isFinite(item.quantity) || item.quantity <= 0
      )
    ) {
      setReturnError("Enter at least one valid return quantity.");
      return;
    }
    setReturnSubmitting(true);
    setReturnError("");
    try {
      await apiRequest(
        `/sales/${encodeURIComponent(salesOrder._id)}/returns`,
        {
          method: "POST",
          headers: { "Idempotency-Key": returnIdempotencyKey },
          body: JSON.stringify({
            businessId: workspace.id,
            products: returnProducts,
          }),
        }
      );
      setReturnIdempotencyKey(window.crypto.randomUUID());
      setReturnQuantities({});
      retryLoad();
    } catch (returnFailure) {
      setReturnError(
        getErrorMessage(returnFailure, "Unable to record this sales return.")
      );
    } finally {
      setReturnSubmitting(false);
    }
  };

  if (!workspace?.id) {
    return (
      <AppShell
        mode="business"
        title="Sales"
        description="Sales orders and stock fulfillment."
      >
        <section className="rounded-xl border border-stock-border bg-white p-5">
          <p className="text-sm text-stock-secondary-text">
            Select a workspace to manage sales.
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
    ? "Create Sale"
    : isEdit
      ? "Edit Sale"
      : isDetails
        ? "Sales Details"
        : "Sales";

  return (
    <AppShell
      mode="business"
      title={title}
      description="Create sales orders, fulfill them from a warehouse and manage returns."
      action={
        isList && canManage ? (
          <Link
            to="/sales/new"
            className="inline-flex h-11 items-center rounded-lg bg-stock-primary-blue px-4 text-sm font-semibold text-white"
          >
            Create Sale
          </Link>
        ) : (
          <Link
            to="/sales"
            className="inline-flex h-10 items-center rounded-lg border border-stock-border bg-white px-4 text-sm font-medium text-stock-primary-text"
          >
            Back to Sales
          </Link>
        )
      }
    >
      {(error || actionError) && (
        <div
          role="alert"
          className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error || actionError}
          {(error || (isList && !salesOrder)) && (
            <button
              type="button"
              onClick={retryLoad}
              className="ml-3 font-semibold underline"
            >
              Retry
            </button>
          )}
        </div>
      )}

      {isList && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_15rem]">
            <input
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search sale number or customer..."
              aria-label="Search sales"
              className="h-11 rounded-lg border border-stock-border bg-white px-3 text-sm"
            />
            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value);
                setPage(1);
              }}
              aria-label="Filter by sales status"
              className="h-11 rounded-lg border border-stock-border bg-white px-3 text-sm"
            >
              <option value="">All statuses</option>
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </div>
          <section className="overflow-hidden rounded-xl border border-stock-border bg-white">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[52rem] text-left text-sm">
                <thead className="bg-stock-light-grey text-stock-secondary-text">
                  <tr>
                    {["Sale Number", "Customer", "Date", "Total", "Status", "Actions"].map(
                      (heading) => (
                        <th
                          key={heading}
                          scope="col"
                          className="px-4 py-3 font-medium"
                        >
                          {heading}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-12 text-center text-stock-secondary-text"
                      >
                        Loading sales orders...
                      </td>
                    </tr>
                  ) : salesOrders.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-12 text-center text-stock-secondary-text"
                      >
                        No sales orders match this workspace and filter.
                      </td>
                    </tr>
                  ) : (
                    salesOrders.map((order) => (
                      <tr key={order._id} className="border-t border-stock-border">
                        <td className="px-4 py-3 font-medium">
                          {order.salesOrderNumber}
                        </td>
                        <td className="px-4 py-3">{order.customerName}</td>
                        <td className="px-4 py-3">
                          {new Date(order.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          {formatAmount(order.totalAmount, workspace.currency)}
                        </td>
                        <td className="px-4 py-3">
                          {order.status.replaceAll("_", " ")}
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            className="font-medium text-stock-primary-blue hover:underline"
                            to={`/sales/${order._id}`}
                          >
                            View
                          </Link>
                          {canManage && order.status === "DRAFT" && (
                            <Link
                              className="ml-3 font-medium text-stock-primary-blue hover:underline"
                              to={`/sales/${order._id}/edit`}
                            >
                              Edit
                            </Link>
                          )}
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

      {(isCreate || isEdit) && (
        <section className="mx-auto max-w-4xl space-y-5 rounded-xl border border-stock-border bg-white p-5 shadow-sm sm:p-8">
          {loading && (
            <p role="status" className="text-sm text-stock-secondary-text">
              Loading sales order...
            </p>
          )}
          {optionsLoading && (
            <p role="status" className="text-sm text-stock-secondary-text">
              Loading customers, products and warehouses...
            </p>
          )}
          {(formError || error || optionsError) && (
            <p
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {formError || error || optionsError}
              {optionsError && (
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
          <form
            onSubmit={(event) => void submitSalesOrder(event)}
            className="space-y-5"
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="space-y-1.5 text-sm font-medium">
                Customer *
                <select
                  required
                  value={customerId}
                  onChange={(event) => setCustomerId(event.target.value)}
                  className="h-11 w-full rounded-lg border border-stock-border bg-white px-3 font-normal"
                >
                  <option value="">Select customer</option>
                  {customers.map((customer) => (
                    <option key={customer._id} value={customer._id}>
                      {customer.customerName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1.5 text-sm font-medium">
                Fulfillment warehouse *
                <select
                  required
                  value={warehouseId}
                  onChange={(event) => setWarehouseId(event.target.value)}
                  className="h-11 w-full rounded-lg border border-stock-border bg-white px-3 font-normal"
                >
                  <option value="">Select warehouse</option>
                  {warehouses.map((warehouse) => (
                    <option key={warehouse._id} value={warehouse._id}>
                      {warehouse.warehouseName} · {warehouse.city}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-stock-primary-text">
                  Products
                </h2>
                <button
                  type="button"
                  onClick={() =>
                    setLines((current) => [
                      ...current,
                      {
                        productId: "",
                        quantity: "",
                        discountPercentage: "0",
                      },
                    ])
                  }
                  className="h-9 rounded-lg border border-stock-border px-3 text-sm font-medium"
                >
                  Add item
                </button>
              </div>
              {lines.map((line, index) => {
                const product = products.find(
                  (item) => item._id === line.productId
                );
                return (
                  <div
                    key={index}
                    className="grid gap-3 rounded-lg border border-stock-border p-3 sm:grid-cols-[minmax(12rem,1fr)_8rem_8rem_auto]"
                  >
                    <label className="space-y-1 text-sm">
                      Product *
                      <select
                        required
                        value={line.productId}
                        onChange={(event) =>
                          setLines((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, productId: event.target.value }
                                : item
                            )
                          )
                        }
                        className="h-10 w-full rounded-lg border border-stock-border bg-white px-2"
                      >
                        <option value="">Select product</option>
                        {products.map((option) => (
                          <option key={option._id} value={option._id}>
                            {option.productName} · {option.sku}
                          </option>
                        ))}
                      </select>
                      {product && (
                        <span className="block text-xs text-stock-secondary-text">
                          Unit price:{" "}
                          {formatAmount(product.sellingPrice, workspace.currency)}
                        </span>
                      )}
                    </label>
                    <label className="space-y-1 text-sm">
                      Quantity *
                      <input
                        type="number"
                        min="0.000001"
                        step="any"
                        required
                        value={line.quantity}
                        onChange={(event) =>
                          setLines((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, quantity: event.target.value }
                                : item
                            )
                          )
                        }
                        className="h-10 w-full rounded-lg border border-stock-border px-2"
                      />
                    </label>
                    <label className="space-y-1 text-sm">
                      Discount %
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="any"
                        value={line.discountPercentage}
                        onChange={(event) =>
                          setLines((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index
                                ? {
                                    ...item,
                                    discountPercentage: event.target.value,
                                  }
                                : item
                            )
                          )
                        }
                        className="h-10 w-full rounded-lg border border-stock-border px-2"
                      />
                    </label>
                    <button
                      type="button"
                      disabled={lines.length === 1}
                      onClick={() =>
                        setLines((current) =>
                          current.filter((_, itemIndex) => itemIndex !== index)
                        )
                      }
                      className="self-end h-10 rounded-lg px-2 text-sm text-red-700 disabled:opacity-40"
                    >
                      Remove
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="rounded-lg bg-stock-light-grey p-4 text-sm text-stock-secondary-text">
              <p>Estimated subtotal: {formatAmount(estimate.subtotal, workspace.currency)}</p>
              <p className="mt-1">
                Estimated discount: {formatAmount(estimate.discount, workspace.currency)}
              </p>
              <p className="mt-1">
                Workspace tax settings and final totals are applied by the server.
                Warehouse availability is checked again when the sale is completed.
              </p>
            </div>
            <div className="flex flex-col-reverse gap-3 border-t border-stock-border pt-5 sm:flex-row sm:justify-end">
              <Link
                to="/sales"
                className="inline-flex h-11 items-center justify-center rounded-lg border border-stock-border px-4 text-sm font-medium"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={formSubmitting || optionsLoading || !canManage}
                className="h-11 rounded-lg bg-stock-primary-blue px-4 text-sm font-semibold text-white disabled:opacity-60"
              >
                {formSubmitting
                  ? "Saving..."
                  : isEdit
                    ? "Save Changes"
                    : "Create Draft Sale"}
              </button>
            </div>
          </form>
        </section>
      )}

      {isDetails && (
        <div className="space-y-5">
          {loading && (
            <p role="status" className="text-sm text-stock-secondary-text">
              Loading sales order...
            </p>
          )}
          {!loading && !salesOrder && !error && (
            <p className="rounded-xl border border-stock-border bg-white p-6 text-sm text-stock-secondary-text">
              Sales order not found.
            </p>
          )}
          {salesOrder && (
            <>
              <section className="rounded-xl border border-stock-border bg-white p-5 shadow-sm sm:p-7">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-stock-primary-text">
                      {salesOrder.salesOrderNumber}
                    </h2>
                    <p className="mt-2 text-sm text-stock-secondary-text">
                      Customer: {salesOrder.customerName}
                    </p>
                    <p className="mt-1 text-sm text-stock-secondary-text">
                      Warehouse:{" "}
                      {relationName(salesOrder.warehouseId, "Warehouse")}
                    </p>
                    <p className="mt-1 text-sm text-stock-secondary-text">
                      Status: {salesOrder.status.replaceAll("_", " ")}
                    </p>
                  </div>
                  {canManage && (
                    <div className="flex flex-wrap gap-2">
                      {["COMPLETED", "PARTIALLY_RETURNED", "RETURNED"].includes(
                        salesOrder.status
                      ) &&
                        (salesOrder.invoiceId ? (
                          <Link
                            to={`/invoices/${relationId(salesOrder.invoiceId)}`}
                            className="inline-flex h-10 items-center rounded-lg border border-stock-border px-3 text-sm font-medium"
                          >
                            View Invoice
                          </Link>
                        ) : (
                          <Link
                            to={`/invoices/new?salesOrderId=${encodeURIComponent(salesOrder._id)}`}
                            className="inline-flex h-10 items-center rounded-lg bg-stock-primary-blue px-3 text-sm font-semibold text-white"
                          >
                            Generate Invoice
                          </Link>
                        ))}
                      {salesOrder.status === "DRAFT" && (
                        <>
                          <Link
                            to={`/sales/${salesOrder._id}/edit`}
                            className="inline-flex h-10 items-center rounded-lg border border-stock-border px-3 text-sm font-medium"
                          >
                            Edit
                          </Link>
                          <button
                            type="button"
                            disabled={actionSubmitting}
                            onClick={() => void performOrderAction("complete")}
                            className="h-10 rounded-lg bg-stock-primary-blue px-3 text-sm font-semibold text-white disabled:opacity-60"
                          >
                            {actionSubmitting ? "Completing..." : "Complete Sale"}
                          </button>
                        </>
                      )}
                      {["DRAFT", "COMPLETED"].includes(salesOrder.status) && (
                        <button
                          type="button"
                          disabled={actionSubmitting}
                          onClick={() => void performOrderAction("cancel")}
                          className="h-10 rounded-lg border border-red-300 px-3 text-sm font-medium text-red-700 disabled:opacity-60"
                        >
                          Cancel Sale
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <div className="mt-6 overflow-x-auto">
                  <table className="w-full min-w-[48rem] text-left text-sm">
                    <thead className="text-stock-secondary-text">
                      <tr>
                        {[
                          "Product",
                          "Quantity",
                          "Returned",
                          "Unit price",
                          "Discount",
                          "Line subtotal",
                        ].map((heading) => (
                          <th
                            key={heading}
                            className="border-b border-stock-border px-3 py-2 font-medium"
                          >
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {salesOrder.products.map((item) => (
                        <tr
                          key={item.productId}
                          className="border-b border-stock-border"
                        >
                          <td className="px-3 py-3">
                            {item.productName}{" "}
                            <span className="text-stock-secondary-text">
                              ({item.sku})
                            </span>
                          </td>
                          <td className="px-3 py-3">{item.quantity}</td>
                          <td className="px-3 py-3">{item.returnedQuantity}</td>
                          <td className="px-3 py-3">
                            {formatAmount(item.unitPrice, workspace.currency)}
                          </td>
                          <td className="px-3 py-3">
                            {item.discountPercentage}% (
                            {formatAmount(item.discountAmount, workspace.currency)})
                          </td>
                          <td className="px-3 py-3">
                            {formatAmount(item.subtotal, workspace.currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-5 space-y-1 text-right text-sm">
                  <p>
                    Subtotal: {formatAmount(salesOrder.subtotal, workspace.currency)}
                  </p>
                  <p>
                    Discount: {formatAmount(salesOrder.discountTotal, workspace.currency)}
                  </p>
                  <p>
                    Tax ({salesOrder.taxPercentage}%):{" "}
                    {formatAmount(salesOrder.tax, workspace.currency)}
                  </p>
                  <p className="font-semibold">
                    Total: {formatAmount(salesOrder.totalAmount, workspace.currency)}
                  </p>
                </div>
              </section>

              {canManage &&
                ["COMPLETED", "PARTIALLY_RETURNED"].includes(salesOrder.status) && (
                  <section className="rounded-xl border border-stock-border bg-white p-5 shadow-sm sm:p-7">
                    <h2 className="text-lg font-semibold">Record a Return</h2>
                    <p className="mt-1 text-sm text-stock-secondary-text">
                      Returned quantities are restored to the original warehouse and cannot exceed the unreturned quantity.
                    </p>
                    {returnError && (
                      <p
                        role="alert"
                        className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                      >
                        {returnError}
                      </p>
                    )}
                    <form
                      onSubmit={(event) => void submitReturn(event)}
                      className="mt-4 space-y-4"
                    >
                      <div className="space-y-3">
                        {salesOrder.products
                          .filter(
                            (item) => item.returnedQuantity < item.quantity
                          )
                          .map((item) => {
                            const remaining =
                              item.quantity - item.returnedQuantity;
                            return (
                              <label
                                key={item.productId}
                                className="grid items-center gap-3 rounded-lg border border-stock-border p-3 text-sm sm:grid-cols-[1fr_10rem]"
                              >
                                <span>
                                  {item.productName}
                                  <span className="ml-2 text-stock-secondary-text">
                                    Remaining: {remaining}
                                  </span>
                                </span>
                                <input
                                  type="number"
                                  min="0"
                                  max={remaining}
                                  step="any"
                                  value={returnQuantities[item.productId] ?? ""}
                                  onChange={(event) =>
                                    setReturnQuantities((current) => ({
                                      ...current,
                                      [item.productId]: event.target.value,
                                    }))
                                  }
                                  aria-label={`Return quantity for ${item.productName}`}
                                  className="h-10 rounded-lg border border-stock-border px-3"
                                />
                              </label>
                            );
                          })}
                      </div>
                      <button
                        type="submit"
                        disabled={returnSubmitting}
                        className="h-11 rounded-lg bg-stock-primary-blue px-4 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        {returnSubmitting ? "Recording..." : "Record Return"}
                      </button>
                    </form>
                  </section>
                )}

              <section className="rounded-xl border border-stock-border bg-white p-5 shadow-sm sm:p-7">
                <h2 className="text-lg font-semibold">Return History</h2>
                {returns.length === 0 ? (
                  <p className="mt-3 text-sm text-stock-secondary-text">
                    No returns recorded.
                  </p>
                ) : (
                  <div className="mt-3 space-y-3">
                    {returns.map((salesReturn) => (
                      <article
                        key={salesReturn._id}
                        className="rounded-lg border border-stock-border p-4"
                      >
                        <div className="flex flex-wrap justify-between gap-2 text-sm">
                          <strong>{salesReturn.returnNumber}</strong>
                          <span>
                            {new Date(salesReturn.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <ul className="mt-2 list-inside list-disc text-sm">
                          {salesReturn.products.map((item) => (
                            <li key={item.productId}>
                              {item.productName}: {item.quantity} returned
                            </li>
                          ))}
                        </ul>
                      </article>
                    ))}
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
