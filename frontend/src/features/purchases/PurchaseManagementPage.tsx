import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AppShell } from "../../components/layout/AppShell";
import { apiRequest, StockPilotApiError } from "../../services/api";
import { useWorkspace } from "../workspace/workspaceContext";

interface SupplierOption {
  _id: string;
  supplierName: string;
}

interface ProductOption {
  _id: string;
  productName: string;
  sku: string;
  purchasePrice: number;
}

interface WarehouseOption {
  _id: string;
  warehouseName: string;
  city: string;
}

interface PurchaseOrderItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  receivedQuantity: number;
}

interface PurchaseOrderRecord {
  _id: string;
  purchaseOrderNumber: string;
  supplierId: string | SupplierOption;
  products: PurchaseOrderItem[];
  subtotal: number;
  tax: number;
  totalAmount: number;
  status: string;
  expectedDeliveryDate?: string;
  createdAt: string;
}

interface GoodsReceiptRecord {
  _id: string;
  receiptNumber: string;
  warehouseId: string | WarehouseOption;
  products: Array<{
    productId: string;
    receivedQuantity: number;
    damagedQuantity: number;
  }>;
  discrepancies: string;
  receivedAt: string;
}

interface PurchaseListResponse {
  success: boolean;
  purchaseOrders: PurchaseOrderRecord[];
  pagination: { page: number; totalPages: number; total: number };
}

interface PurchaseDetailsResponse {
  success: boolean;
  purchaseOrder: PurchaseOrderRecord;
  receipts: GoodsReceiptRecord[];
}

interface SupplierResponse {
  success: boolean;
  suppliers: SupplierOption[];
}

interface ProductResponse {
  success: boolean;
  products: ProductOption[];
}

interface WarehouseResponse {
  success: boolean;
  warehouses: WarehouseOption[];
}

interface PurchaseLineDraft {
  productId: string;
  quantity: string;
}

const statuses = [
  "DRAFT",
  "APPROVED",
  "PARTIALLY_RECEIVED",
  "RECEIVED",
  "CANCELLED",
];

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof StockPilotApiError ? error.message : fallback;
}

function relationName<T extends { _id: string; supplierName?: string; warehouseName?: string }>(
  value: string | T
): string {
  return typeof value === "string"
    ? value
    : value.supplierName ?? value.warehouseName ?? "—";
}

function formatAmount(value: number, currency: string): string {
  const normalizedCurrency = currency?.trim().toUpperCase() ?? "";
  const currencyCode = /^[A-Z]{3}$/.test(normalizedCurrency)
    ? normalizedCurrency
    : "INR";

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currencyCode,
  }).format(value);
}

function relationId(value: string | { _id: string }): string {
  return typeof value === "string" ? value : value._id;
}

export function PurchaseManagementPage() {
  const { workspace } = useWorkspace();
  const location = useLocation();
  const navigate = useNavigate();
  const segments = location.pathname.split("/").filter(Boolean);
  const isList = segments.length === 1;
  const isCreate = segments[1] === "new";
  const isEdit = segments[2] === "edit";
  const purchaseOrderId =
    segments[1] && segments[1] !== "new" ? segments[1] : "";
  const isDetails = Boolean(purchaseOrderId) && !isEdit;
  const canManage =
    !workspace?.membershipRole ||
    ["BUSINESS_OWNER", "INVENTORY_MANAGER"].includes(
      workspace.membershipRole
    );

  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderRecord[]>([]);
  const [purchaseOrder, setPurchaseOrder] =
    useState<PurchaseOrderRecord | null>(null);
  const [receipts, setReceipts] = useState<GoodsReceiptRecord[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
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
  const [orderNumber, setOrderNumber] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState("");
  const [lines, setLines] = useState<PurchaseLineDraft[]>([
    { productId: "", quantity: "" },
  ]);
  const [selectedWarehouse, setSelectedWarehouse] = useState("");
  const [discrepancies, setDiscrepancies] = useState("");
  const [receiptLines, setReceiptLines] = useState<
    Record<string, { quantity: string; damaged: string }>
  >({});
  const [receiptError, setReceiptError] = useState("");
  const [receiptSubmitting, setReceiptSubmitting] = useState(false);
  const [receiptIdempotencyKey, setReceiptIdempotencyKey] = useState(() =>
    window.crypto.randomUUID()
  );

  const amountEstimate = useMemo(
    () =>
      lines.reduce((total, line) => {
        const product = products.find((item) => item._id === line.productId);
        const quantity = Number(line.quantity);
        return total +
          (product && Number.isFinite(quantity) && quantity > 0
            ? product.purchasePrice * quantity
            : 0);
      }, 0),
    [lines, products]
  );

  useEffect(() => {
    setPage(1);
    setPurchaseOrders([]);
    setPurchaseOrder(null);
    setReceipts([]);
    setError("");
  }, [workspace?.id]);

  useEffect(() => {
    if (isCreate) {
      const productId = new URLSearchParams(location.search).get("productId") ?? "";
      setOrderNumber("");
      setSupplierId("");
      setExpectedDeliveryDate("");
      setLines([{ productId, quantity: "" }]);
      setFormError("");
    }
  }, [isCreate, location.search]);

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
      if (statusFilter) query.set("status", statusFilter);
      setLoading(true);
      setError("");
      apiRequest<PurchaseListResponse>(`/purchases?${query.toString()}`)
        .then((response) => {
          if (!response.success || !Array.isArray(response.purchaseOrders)) {
            throw new Error("The purchase order list could not be loaded.");
          }
          if (!active) return;
          if (page > response.pagination.totalPages && response.pagination.totalPages > 0) {
            setPage(response.pagination.totalPages);
            return;
          }
          setPurchaseOrders(response.purchaseOrders);
          setTotalPages(response.pagination.totalPages);
        })
        .catch((loadError: unknown) => {
          if (active) {
            setError(
              getErrorMessage(loadError, "Unable to load purchase orders.")
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
    refresh,
  ]);

  useEffect(() => {
    if (!workspace?.id || (!isCreate && !isEdit && !isDetails)) {
      return;
    }
    let active = true;
    setOptionsLoading(true);
    setOptionsError("");
    const businessQuery = `businessId=${encodeURIComponent(workspace.id)}`;
    Promise.all([
      apiRequest<SupplierResponse>(`/suppliers?${businessQuery}&limit=100`),
      apiRequest<ProductResponse>(`/products?${businessQuery}&limit=100`),
      apiRequest<WarehouseResponse>(`/warehouses?${businessQuery}`),
    ])
      .then(([supplierResponse, productResponse, warehouseResponse]) => {
        if (
          !supplierResponse.success ||
          !productResponse.success ||
          !warehouseResponse.success
        ) {
          throw new Error("Purchase form options could not be loaded.");
        }
        if (!active) return;
        setSuppliers(supplierResponse.suppliers);
        setProducts(productResponse.products);
        setWarehouses(warehouseResponse.warehouses);
      })
      .catch((loadError: unknown) => {
        if (active) {
          setOptionsError(
            getErrorMessage(loadError, "Unable to load suppliers, products or warehouses.")
          );
        }
      })
      .finally(() => {
        if (active) setOptionsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [workspace?.id, isCreate, isEdit, isDetails]);

  useEffect(() => {
    if (!purchaseOrderId || !workspace?.id || (!isDetails && !isEdit)) {
      setPurchaseOrder(null);
      setReceipts([]);
      return;
    }
    let active = true;
    setLoading(true);
    setError("");
    apiRequest<PurchaseDetailsResponse>(
      `/purchases/${encodeURIComponent(purchaseOrderId)}?businessId=${encodeURIComponent(workspace.id)}`
    )
      .then((response) => {
        if (!response.success || !response.purchaseOrder) {
          throw new Error("The purchase order could not be loaded.");
        }
        if (!active) return;
        setPurchaseOrder(response.purchaseOrder);
        setReceipts(response.receipts);
        if (isEdit) {
          setOrderNumber(response.purchaseOrder.purchaseOrderNumber);
          setSupplierId(relationId(response.purchaseOrder.supplierId));
          setExpectedDeliveryDate(
            
            response.purchaseOrder.expectedDeliveryDate?.slice(0, 10) ?? ""
          );
          setLines(
            response.purchaseOrder.products.map((item) => ({
              productId: item.productId,
              quantity: String(item.quantity),
            }))
          );

        }
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(
            getErrorMessage(loadError, "Unable to load this purchase order.")
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [purchaseOrderId, workspace?.id, isDetails, isEdit, refresh]);

  const submitPurchaseOrder = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    if (!workspace?.id) {
      setFormError("Select a business workspace before saving.");
      return;
    }
    const normalizedLines = lines.map((line) => ({
      productId: line.productId,
      quantity: Number(line.quantity),
    }));
    if (
      !orderNumber.trim() ||
      !supplierId ||
      normalizedLines.length === 0 ||
      normalizedLines.some(
        (line) =>
          !line.productId ||
          !Number.isFinite(line.quantity) ||
          line.quantity <= 0
      ) ||
      new Set(normalizedLines.map((line) => line.productId)).size !==
        normalizedLines.length
    ) {
      setFormError(
        "Enter an order number, supplier, unique product lines and positive quantities."
      );
      return;
    }

    setFormSubmitting(true);
    setFormError("");
    try {
      const response = await apiRequest<{
        success: boolean;
        purchaseOrder: PurchaseOrderRecord;
      }>(
        isEdit && purchaseOrderId
          ? `/purchases/${encodeURIComponent(purchaseOrderId)}`
          : "/purchases",
        {
          method: isEdit ? "PUT" : "POST",
          body: JSON.stringify({
            businessId: workspace.id,
            purchaseOrderNumber: orderNumber.trim(),
            supplierId,
            expectedDeliveryDate: expectedDeliveryDate || undefined,
            products: normalizedLines,
          }),
        }
      );
      if (!response.success || !response.purchaseOrder?._id) {
        throw new Error("The server did not confirm the purchase order.");
      }
      navigate(`/purchases/${response.purchaseOrder._id}`);
    } catch (submitError) {
      setFormError(
        getErrorMessage(submitError, "Unable to save the purchase order.")
      );
    } finally {
      setFormSubmitting(false);
    }
  };

  const updatePurchaseStatus = async (action: "approve" | "cancel") => {
    if (!workspace?.id || !purchaseOrder) return;
    setActionError("");
    try {
      await apiRequest(
        `/purchases/${encodeURIComponent(purchaseOrder._id)}/${action}`,
        {
          method: "POST",
          body: JSON.stringify({ businessId: workspace.id }),
        }
      );
      setRefresh((value) => value + 1);
    } catch (actionFailure) {
      setActionError(
        getErrorMessage(actionFailure, `Unable to ${action} this purchase order.`)
      );
    }
  };

  const submitGoodsReceipt = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    if (!workspace?.id || !purchaseOrder || !selectedWarehouse) {
      setReceiptError("Select a warehouse before confirming receipt.");
      return;
    }
    const receivedProducts: Array<{
      productId: string;
      receivedQuantity: number;
      damagedQuantity: number;
    }> = [];
    for (const item of purchaseOrder.products) {
      const values = receiptLines[item.productId];
      if (!values?.quantity.trim()) continue;
      const receivedQuantity = Number(values?.quantity);
      const damagedQuantity = Number(values?.damaged || "0");
      const remaining = item.quantity - item.receivedQuantity;
      if (
        !Number.isFinite(receivedQuantity) ||
        receivedQuantity <= 0 ||
        receivedQuantity > remaining ||
        !Number.isFinite(damagedQuantity) ||
        damagedQuantity < 0 ||
        damagedQuantity > receivedQuantity
      ) {
        setReceiptError(
          `Check received and damaged quantities for ${item.productName}.`
        );
        return;
      }
      receivedProducts.push({
        productId: item.productId,
        receivedQuantity,
        damagedQuantity,
      });
    }
    if (receivedProducts.length === 0) {
      setReceiptError(
        "Enter at least one valid received quantity; damaged quantity cannot exceed received quantity."
      );
      return;
    }

    setReceiptSubmitting(true);
    setReceiptError("");
    try {
      await apiRequest(
        `/purchases/${encodeURIComponent(purchaseOrder._id)}/receive`,
        {
          method: "POST",
          headers: { "Idempotency-Key": receiptIdempotencyKey },
          body: JSON.stringify({
            businessId: workspace.id,
            warehouseId: selectedWarehouse,
            products: receivedProducts,
            discrepancies: discrepancies.trim(),
          }),
        }
      );
      setReceiptIdempotencyKey(window.crypto.randomUUID());
      setReceiptLines({});
      setDiscrepancies("");
      setRefresh((value) => value + 1);
    } catch (submitError) {
      setReceiptError(
        getErrorMessage(submitError, "Unable to confirm this goods receipt.")
      );
    } finally {
      setReceiptSubmitting(false);
    }
  };

  if (!workspace?.id) {
    return (
      <AppShell mode="business" title="Purchases" description="Purchase orders and goods receipts.">
        <section className="rounded-xl border border-stock-border bg-white p-5">
          <p className="text-sm text-stock-secondary-text">
            Select a workspace to manage purchases.
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
    ? "Create Purchase"
    : isEdit
      ? "Edit Purchase"
      : isDetails
        ? "Purchase Details"
        : "Purchases";

  return (
    <AppShell
      mode="business"
      title={title}
      description="Create purchase orders, receive goods and track warehouse stock."
      action={
        isList && canManage ? (
          <Link
            to="/purchases/new"
            className="inline-flex h-11 items-center rounded-lg bg-stock-primary-blue px-4 text-sm font-semibold text-white"
          >
            Create Purchase
          </Link>
        ) : (
          <Link
            to="/purchases"
            className="inline-flex h-10 items-center rounded-lg border border-stock-border bg-white px-4 text-sm font-medium text-stock-primary-text"
          >
            Back to Purchases
          </Link>
        )
      }
    >
      {(error || actionError || optionsError) && (
        <div
          role="alert"
          className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error || actionError || optionsError}
          {(error || optionsError) && (
            <button
              type="button"
              onClick={() => setRefresh((value) => value + 1)}
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
              placeholder="Search purchase number..."
              aria-label="Search purchases"
              className="h-11 rounded-lg border border-stock-border bg-white px-3 text-sm"
            />
            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value);
                setPage(1);
              }}
              aria-label="Filter by purchase status"
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
              <table className="w-full min-w-[48rem] text-left text-sm">
                <thead className="bg-stock-light-grey text-stock-secondary-text">
                  <tr>
                    {["PO Number", "Supplier", "Date", "Total", "Status", "Actions"].map((item) => (
                      <th key={item} scope="col" className="px-4 py-3 font-medium">
                        {item}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={6} className="px-4 py-12 text-center text-stock-secondary-text">Loading purchases...</td></tr>
                  ) : purchaseOrders.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-12 text-center text-stock-secondary-text">No purchase orders match this workspace and filter.</td></tr>
                  ) : purchaseOrders.map((order) => (
                    <tr key={order._id} className="border-t border-stock-border">
                      <td className="px-4 py-3 font-medium">{order.purchaseOrderNumber}</td>
                      <td className="px-4 py-3">{relationName(order.supplierId)}</td>
                      <td className="px-4 py-3">{new Date(order.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-3">{formatAmount(order.totalAmount, workspace.currency)}</td>
                      <td className="px-4 py-3">{order.status.replaceAll("_", " ")}</td>
                      <td className="px-4 py-3">
                        <Link className="font-medium text-stock-primary-blue hover:underline" to={`/purchases/${order._id}`}>View</Link>
                        {canManage && order.status === "DRAFT" && (
                          <Link className="ml-3 font-medium text-stock-primary-blue hover:underline" to={`/purchases/${order._id}/edit`}>Edit</Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <div className="flex items-center justify-between text-sm text-stock-secondary-text">
            <span>Page {page} of {totalPages || 1}</span>
            <div className="flex gap-2">
              <button type="button" disabled={loading || page <= 1} onClick={() => setPage((value) => value - 1)} className="h-10 rounded-lg border border-stock-border bg-white px-3 disabled:opacity-50">Previous</button>
              <button type="button" disabled={loading || page >= totalPages} onClick={() => setPage((value) => value + 1)} className="h-10 rounded-lg border border-stock-border bg-white px-3 disabled:opacity-50">Next</button>
            </div>
          </div>
        </div>
      )}

      {(isCreate || isEdit) && (
        <section className="mx-auto max-w-4xl space-y-5 rounded-xl border border-stock-border bg-white p-5 shadow-sm sm:p-8">
          {optionsLoading && <p role="status" className="text-sm text-stock-secondary-text">Loading suppliers, products and warehouses...</p>}
          {formError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{formError}</p>}
          {optionsError && <p role="alert" className="text-sm text-red-700">{optionsError}</p>}
          <form onSubmit={(event) => void submitPurchaseOrder(event)} className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="space-y-1.5 text-sm font-medium">
                Purchase order number *
                <input required maxLength={80} value={orderNumber} onChange={(event) => setOrderNumber(event.target.value)} className="h-11 w-full rounded-lg border border-stock-border px-3 font-normal" />
              </label>
              <label className="space-y-1.5 text-sm font-medium">
                Supplier *
                <select required value={supplierId} onChange={(event) => setSupplierId(event.target.value)} className="h-11 w-full rounded-lg border border-stock-border bg-white px-3 font-normal">
                  <option value="">Select supplier</option>
                  {suppliers.map((supplier) => <option key={supplier._id} value={supplier._id}>{supplier.supplierName}</option>)}
                </select>
              </label>
              <label className="space-y-1.5 text-sm font-medium">
                Expected delivery date
                <input type="date" value={expectedDeliveryDate} onChange={(event) => setExpectedDeliveryDate(event.target.value)} className="h-11 w-full rounded-lg border border-stock-border px-3 font-normal" />
              </label>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-stock-primary-text">Products</h2>
                <button type="button" onClick={() => setLines((current) => [...current, { productId: "", quantity: "" }])} className="h-9 rounded-lg border border-stock-border px-3 text-sm font-medium">Add item</button>
              </div>
              {lines.map((line, index) => (
                <div key={index} className="grid gap-3 rounded-lg border border-stock-border p-3 sm:grid-cols-[1fr_10rem_auto]">
                  <label className="space-y-1 text-sm">
                    Product *
                    <select required value={line.productId} onChange={(event) => setLines((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, productId: event.target.value } : item))} className="h-10 w-full rounded-lg border border-stock-border bg-white px-2">
                      <option value="">Select product</option>
                      {products.map((product) => <option key={product._id} value={product._id}>{product.productName} · {product.sku}</option>)}
                    </select>
                  </label>
                  <label className="space-y-1 text-sm">
                    Quantity *
                    <input type="number" min="0.000001" step="any" required value={line.quantity} onChange={(event) => setLines((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, quantity: event.target.value } : item))} className="h-10 w-full rounded-lg border border-stock-border px-2" />
                  </label>
                  <button type="button" disabled={lines.length === 1} onClick={() => setLines((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="self-end h-10 rounded-lg px-2 text-sm text-red-700 disabled:opacity-40">Remove</button>
                </div>
              ))}
            </div>
            <div className="rounded-lg bg-stock-light-grey p-4 text-sm text-stock-secondary-text">
              <p>Estimated subtotal: {formatAmount(amountEstimate, workspace.currency)}</p>
              <p className="mt-1">Tax and final totals use the product prices and workspace tax settings when saved.</p>
            </div>
            <div className="flex flex-col-reverse gap-3 border-t border-stock-border pt-5 sm:flex-row sm:justify-end">
              <Link to="/purchases" className="inline-flex h-11 items-center justify-center rounded-lg border border-stock-border px-4 text-sm font-medium">Cancel</Link>
              <button type="submit" disabled={formSubmitting || optionsLoading || !canManage} className="h-11 rounded-lg bg-stock-primary-blue px-4 text-sm font-semibold text-white disabled:opacity-60">
                {formSubmitting ? "Saving..." : isEdit ? "Save Changes" : "Create Purchase"}
              </button>
            </div>
          </form>
        </section>
      )}

      {isDetails && (
        <div className="space-y-5">
          {loading && <p role="status" className="text-sm text-stock-secondary-text">Loading purchase details...</p>}
          {purchaseOrder && (
            <>
              <section className="rounded-xl border border-stock-border bg-white p-5 shadow-sm sm:p-7">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-stock-primary-text">{purchaseOrder.purchaseOrderNumber}</h2>
                    <p className="mt-2 text-sm text-stock-secondary-text">Supplier: {relationName(purchaseOrder.supplierId)}</p>
                    <p className="mt-1 text-sm text-stock-secondary-text">Status: {purchaseOrder.status.replaceAll("_", " ")}</p>
                    {purchaseOrder.expectedDeliveryDate && <p className="mt-1 text-sm text-stock-secondary-text">Expected: {new Date(purchaseOrder.expectedDeliveryDate).toLocaleDateString()}</p>}
                  </div>
                  {canManage && <div className="flex flex-wrap gap-2">
                    {purchaseOrder.status === "DRAFT" && <>
                      <Link to={`/purchases/${purchaseOrder._id}/edit`} className="inline-flex h-10 items-center rounded-lg border border-stock-border px-3 text-sm font-medium">Edit</Link>
                      <button type="button" onClick={() => void updatePurchaseStatus("approve")} className="h-10 rounded-lg bg-stock-primary-blue px-3 text-sm font-semibold text-white">Approve</button>
                    </>}
                    {["DRAFT", "APPROVED"].includes(purchaseOrder.status) && <button type="button" onClick={() => void updatePurchaseStatus("cancel")} className="h-10 rounded-lg border border-red-300 px-3 text-sm font-medium text-red-700">Cancel Purchase</button>}
                  </div>}
                </div>
                <div className="mt-6 overflow-x-auto">
                  <table className="w-full min-w-[40rem] text-left text-sm">
                    <thead className="text-stock-secondary-text"><tr>{["Product", "Ordered", "Received", "Unit cost", "Line total"].map((heading) => <th key={heading} className="border-b border-stock-border px-3 py-2 font-medium">{heading}</th>)}</tr></thead>
                    <tbody>{purchaseOrder.products.map((item) => <tr key={item.productId} className="border-b border-stock-border">
                      <td className="px-3 py-3">{item.productName} <span className="text-stock-secondary-text">({item.sku})</span></td>
                      <td className="px-3 py-3">{item.quantity}</td>
                      <td className="px-3 py-3">{item.receivedQuantity}</td>
                      <td className="px-3 py-3">{formatAmount(item.unitPrice, workspace.currency)}</td>
                      <td className="px-3 py-3">{formatAmount(item.unitPrice * item.quantity, workspace.currency)}</td>
                    </tr>)}</tbody>
                  </table>
                </div>
                <div className="mt-5 space-y-1 text-right text-sm">
                  <p>Subtotal: {formatAmount(purchaseOrder.subtotal, workspace.currency)}</p>
                  <p>Tax: {formatAmount(purchaseOrder.tax, workspace.currency)}</p>
                  <p className="font-semibold">Total: {formatAmount(purchaseOrder.totalAmount, workspace.currency)}</p>
                </div>
              </section>

              {canManage && ["APPROVED", "PARTIALLY_RECEIVED"].includes(purchaseOrder.status) && (
                <section className="rounded-xl border border-stock-border bg-white p-5 shadow-sm sm:p-7">
                  <h2 className="text-lg font-semibold">Goods Receipt</h2>
                  <p className="mt-1 text-sm text-stock-secondary-text">Only non-damaged received units increase available inventory.</p>
                  {receiptError && <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{receiptError}</p>}
                  <form onSubmit={(event) => void submitGoodsReceipt(event)} className="mt-4 space-y-4">
                    <label className="block max-w-md space-y-1.5 text-sm font-medium">
                      Warehouse *
                      <select required value={selectedWarehouse} onChange={(event) => setSelectedWarehouse(event.target.value)} className="h-11 w-full rounded-lg border border-stock-border bg-white px-3 font-normal">
                        <option value="">Select warehouse</option>
                        {warehouses.map((warehouse) => <option key={warehouse._id} value={warehouse._id}>{warehouse.warehouseName} · {warehouse.city}</option>)}
                      </select>
                    </label>
                    <div className="space-y-3">
                      {purchaseOrder.products.filter((item) => item.receivedQuantity < item.quantity).map((item) => {
                        const remaining = item.quantity - item.receivedQuantity;
                        const values = receiptLines[item.productId] ?? { quantity: "", damaged: "" };
                        return <div key={item.productId} className="grid gap-3 rounded-lg border border-stock-border p-3 sm:grid-cols-[1fr_9rem_9rem]">
                          <div className="text-sm"><p className="font-medium">{item.productName}</p><p className="text-stock-secondary-text">Remaining: {remaining}</p></div>
                          <label className="space-y-1 text-sm">Received<input type="number" min="0" max={remaining} step="any" value={values.quantity} onChange={(event) => setReceiptLines((current) => ({ ...current, [item.productId]: { ...values, quantity: event.target.value } }))} className="h-10 w-full rounded-lg border border-stock-border px-2" /></label>
                          <label className="space-y-1 text-sm">Damaged<input type="number" min="0" max={values.quantity || remaining} step="any" value={values.damaged} onChange={(event) => setReceiptLines((current) => ({ ...current, [item.productId]: { ...values, damaged: event.target.value } }))} className="h-10 w-full rounded-lg border border-stock-border px-2" /></label>
                        </div>;
                      })}
                    </div>
                    <label className="block space-y-1.5 text-sm font-medium">
                      Discrepancies
                      <textarea maxLength={2000} rows={3} value={discrepancies} className="w-full rounded-lg border border-stock-border px-3 py-2 font-normal" onChange={(event) => setDiscrepancies(event.target.value)} />
                    </label>
                    <button type="submit" disabled={receiptSubmitting || optionsLoading || warehouses.length === 0} className="h-11 rounded-lg bg-stock-primary-blue px-4 text-sm font-semibold text-white disabled:opacity-60">
                      {receiptSubmitting ? "Confirming..." : "Confirm Goods Receipt"}
                    </button>
                  </form>
                </section>
              )}

              <section className="rounded-xl border border-stock-border bg-white p-5 shadow-sm sm:p-7">
                <h2 className="text-lg font-semibold">Receipt History</h2>
                {receipts.length === 0 ? <p className="mt-3 text-sm text-stock-secondary-text">No goods receipts recorded yet.</p> : (
                  <div className="mt-3 space-y-3">{receipts.map((receipt) => <article key={receipt._id} className="rounded-lg border border-stock-border p-4">
                    <div className="flex flex-wrap justify-between gap-2 text-sm"><strong>{receipt.receiptNumber}</strong><span>{new Date(receipt.receivedAt).toLocaleString()}</span></div>
                    <p className="mt-1 text-sm text-stock-secondary-text">Warehouse: {relationName(receipt.warehouseId)}</p>
                    <ul className="mt-2 list-inside list-disc text-sm">{receipt.products.map((line) => {
                      const product = purchaseOrder.products.find((item) => item.productId === line.productId);
                      return <li key={line.productId}>{product?.productName ?? "Product"}: {line.receivedQuantity} received, {line.damagedQuantity} damaged</li>;
                    })}</ul>
                    {receipt.discrepancies && <p className="mt-2 text-sm">Discrepancies: {receipt.discrepancies}</p>}
                  </article>)}</div>
                )}
              </section>
            </>
          )}
        </div>
      )}
    </AppShell>
  );
}
