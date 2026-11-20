import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { AppShell } from "../../components/layout/AppShell";
import { apiRequest, StockPilotApiError } from "../../services/api";
import { useWorkspace } from "../workspace/workspaceContext";

interface ProductOption {
  _id: string;
  productName: string;
  sku: string;
  minimumStockThreshold: number;
}

interface WarehouseOption {
  _id: string;
  warehouseName: string;
  city: string;
}

interface InventoryBalanceRecord {
  _id: string;
  productId: ProductOption | null;
  warehouseId: WarehouseOption | null;
  availableQuantity: number;
  reservedQuantity: number;
}

interface InventoryMovementRecord {
  _id: string;
  productId: ProductOption | null;
  warehouseId?: WarehouseOption | null;
  movementType: string;
  quantity: number;
  previousStock: number;
  newStock: number;
  referenceType?: string;
  referenceId?: string;
  createdAt: string;
}

interface InventoryTransferRecord {
  _id: string;
  transferNumber: string;
  productId: ProductOption | null;
  sourceWarehouseId: WarehouseOption | null;
  destinationWarehouseId: WarehouseOption | null;
  quantity: number;
  createdAt: string;
}

interface ListResponse<T> {
  success: boolean;
  pagination: { page: number; totalPages: number };
  balances?: T[];
  movements?: T[];
  transfers?: T[];
}

interface OptionsResponse<T> {
  success: boolean;
  [key: string]: T[] | boolean;
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof StockPilotApiError ? error.message : fallback;
}

export function WarehouseInventoryPage() {
  const { workspace } = useWorkspace();
  const location = useLocation();
  const isBalances = location.pathname.endsWith("/balances");
  const isTransfers = location.pathname.endsWith("/transfers");
  const canManage =
    !workspace?.membershipRole ||
    ["BUSINESS_OWNER", "INVENTORY_MANAGER"].includes(
      workspace.membershipRole
    );
  const [balances, setBalances] = useState<InventoryBalanceRecord[]>([]);
  const [movements, setMovements] = useState<InventoryMovementRecord[]>([]);
  const [transfers, setTransfers] = useState<InventoryTransferRecord[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [warehouseFilter, setWarehouseFilter] = useState("");
  const [movementFilter, setMovementFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [error, setError] = useState("");
  const [optionsError, setOptionsError] = useState("");
  const [actionError, setActionError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [showTransferForm, setShowTransferForm] = useState(false);
  const [transferProductId, setTransferProductId] = useState("");
  const [sourceWarehouseId, setSourceWarehouseId] = useState("");
  const [destinationWarehouseId, setDestinationWarehouseId] = useState("");
  const [transferQuantity, setTransferQuantity] = useState("");
  const [transferSubmitting, setTransferSubmitting] = useState(false);
  const [transferIdempotencyKey, setTransferIdempotencyKey] = useState(() =>
    window.crypto.randomUUID()
  );

  useEffect(() => {
    setPage(1);
    setError("");
  }, [workspace?.id, isBalances, isTransfers]);

  useEffect(() => {
    if (!workspace?.id || (!isBalances && !isTransfers)) {
      return;
    }
    let active = true;
    setOptionsLoading(true);
    setOptionsError("");
    const query = `businessId=${encodeURIComponent(workspace.id)}&limit=100`;
    Promise.all([
      apiRequest<OptionsResponse<WarehouseOption>>(
        `/warehouses?businessId=${encodeURIComponent(workspace.id)}`
      ),
      apiRequest<OptionsResponse<ProductOption>>(`/products?${query}`),
    ])
      .then(([warehouseResponse, productResponse]) => {
        if (
          !warehouseResponse.success ||
          !productResponse.success ||
          !Array.isArray(warehouseResponse.warehouses) ||
          !Array.isArray(productResponse.products)
        ) {
          throw new Error("Inventory filters could not be loaded.");
        }
        if (active) {
          setWarehouses(warehouseResponse.warehouses);
          setProducts(productResponse.products);
        }
      })
      .catch((loadError: unknown) => {
        if (active) {
          setOptionsError(
            getErrorMessage(loadError, "Unable to load warehouse and product options.")
          );
        }
      })
      .finally(() => {
        if (active) setOptionsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [workspace?.id, isBalances, isTransfers]);

  useEffect(() => {
    if (!workspace?.id) {
      setBalances([]);
      setMovements([]);
      setTransfers([]);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setError("");
    const query = new URLSearchParams({
      businessId: workspace.id,
      page: String(page),
      limit: "10",
    });
    if (isBalances && warehouseFilter) query.set("warehouseId", warehouseFilter);
    if (!isBalances && !isTransfers && warehouseFilter) {
      query.set("warehouseId", warehouseFilter);
    }
    if (movementFilter && !isBalances && !isTransfers) {
      query.set("movementType", movementFilter);
    }
    const path = isBalances
      ? `/inventory/balances?${query}`
      : isTransfers
        ? `/inventory/transfers?${query}`
        : `/inventory/movements?${query}`;
    apiRequest<ListResponse<InventoryBalanceRecord | InventoryMovementRecord | InventoryTransferRecord>>(path)
      .then((response) => {
        if (!response.success) {
          throw new Error("Inventory data could not be loaded.");
        }
        if (!active) return;
        if (isBalances) {
          const result = response.balances;
          if (!Array.isArray(result)) throw new Error("Warehouse balances are unavailable.");
          setBalances(result as InventoryBalanceRecord[]);
        } else if (isTransfers) {
          const result = response.transfers;
          if (!Array.isArray(result)) throw new Error("Transfer history is unavailable.");
          setTransfers(result as InventoryTransferRecord[]);
        } else {
          const result = response.movements;
          if (!Array.isArray(result)) throw new Error("Movement history is unavailable.");
          setMovements(result as InventoryMovementRecord[]);
        }
        setTotalPages(response.pagination.totalPages);
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(getErrorMessage(loadError, "Unable to load inventory."));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [
    workspace?.id,
    isBalances,
    isTransfers,
    warehouseFilter,
    movementFilter,
    page,
    refresh,
  ]);

  const submitTransfer = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (
      !workspace?.id ||
      !transferProductId ||
      !sourceWarehouseId ||
      !destinationWarehouseId ||
      sourceWarehouseId === destinationWarehouseId ||
      !Number.isFinite(Number(transferQuantity)) ||
      Number(transferQuantity) <= 0
    ) {
      setActionError("Select a product, two different warehouses and a positive quantity.");
      return;
    }
    setActionError("");
    setTransferSubmitting(true);
    try {
      await apiRequest("/inventory/transfers", {
        method: "POST",
        headers: { "Idempotency-Key": transferIdempotencyKey },
        body: JSON.stringify({
          businessId: workspace.id,
          productId: transferProductId,
          sourceWarehouseId,
          destinationWarehouseId,
          quantity: Number(transferQuantity),
        }),
      });
      setShowTransferForm(false);
      setTransferProductId("");
      setSourceWarehouseId("");
      setDestinationWarehouseId("");
      setTransferQuantity("");
      setTransferIdempotencyKey(window.crypto.randomUUID());
      setRefresh((value) => value + 1);
    } catch (submitError) {
      setActionError(getErrorMessage(submitError, "Unable to transfer stock."));
    } finally {
      setTransferSubmitting(false);
    }
  };

  const title = isBalances
    ? "Warehouse Stock"
    : isTransfers
      ? "Stock Transfers"
      : "Stock Movements";

  return (
    <AppShell
      mode="business"
      title={title}
      description="Review warehouse-specific availability and auditable stock history."
      action={
        isTransfers && canManage ? (
          <button
            type="button"
            onClick={() => setShowTransferForm((value) => !value)}
            className="h-11 rounded-lg bg-stock-primary-blue px-4 text-sm font-semibold text-white"
          >
            {showTransferForm ? "Close" : "Transfer Stock"}
          </button>
        ) : null
      }
    >
      {!workspace?.id ? (
        <p className="rounded-xl border border-stock-border bg-white p-5 text-sm text-stock-secondary-text">
          Select a business workspace to view inventory.
        </p>
      ) : (
        <div className="space-y-5">
          <nav className="flex flex-wrap gap-2" aria-label="Inventory views">
            {[
              ["/inventory/movements", "Movements"],
              ["/inventory/balances", "Warehouse Stock"],
              ["/inventory/transfers", "Transfers"],
            ].map(([path, label]) => (
              <Link
                key={path}
                to={path}
                aria-current={location.pathname === path ? "page" : undefined}
                className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                  location.pathname === path
                    ? "border-stock-primary-blue bg-blue-50 text-stock-primary-blue"
                    : "border-stock-border bg-white text-stock-primary-text"
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>

          {(error || optionsError || actionError) && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error || optionsError || actionError}
              {(error || optionsError) && <button type="button" onClick={() => setRefresh((value) => value + 1)} className="ml-3 font-semibold underline">Retry</button>}
            </div>
          )}

          {(isBalances || !isTransfers) && (
            <label className="block max-w-sm space-y-1 text-sm">
              Filter by warehouse
              <select value={warehouseFilter} onChange={(event) => { setWarehouseFilter(event.target.value); setPage(1); }} className="h-11 w-full rounded-lg border border-stock-border bg-white px-3">
                <option value="">All warehouses</option>
                {warehouses.map((warehouse) => <option key={warehouse._id} value={warehouse._id}>{warehouse.warehouseName}</option>)}
              </select>
            </label>
          )}
          {!isBalances && !isTransfers && (
            <label className="block max-w-sm space-y-1 text-sm">
              Filter by movement type
              <select value={movementFilter} onChange={(event) => { setMovementFilter(event.target.value); setPage(1); }} className="h-11 w-full rounded-lg border border-stock-border bg-white px-3">
                <option value="">All movement types</option>
                {["OPENING_STOCK", "STOCK_IN", "STOCK_OUT", "SALES_DEDUCTION", "PURCHASE_RECEIPT", "STOCK_ADJUSTMENT", "STOCK_TRANSFER", "DAMAGED_STOCK", "RETURNED_STOCK"].map((type) => <option key={type} value={type}>{type.replaceAll("_", " ")}</option>)}
              </select>
            </label>
          )}

          {showTransferForm && isTransfers && (
            <form onSubmit={(event) => void submitTransfer(event)} className="grid gap-3 rounded-xl border border-stock-border bg-white p-5 sm:grid-cols-2 lg:grid-cols-5">
              <label className="space-y-1 text-sm">Product<select required value={transferProductId} onChange={(event) => setTransferProductId(event.target.value)} className="h-10 w-full rounded-lg border border-stock-border bg-white px-2"><option value="">Select product</option>{products.map((product) => <option key={product._id} value={product._id}>{product.productName} · {product.sku}</option>)}</select></label>
              <label className="space-y-1 text-sm">From<select required value={sourceWarehouseId} onChange={(event) => setSourceWarehouseId(event.target.value)} className="h-10 w-full rounded-lg border border-stock-border bg-white px-2"><option value="">Source warehouse</option>{warehouses.map((warehouse) => <option key={warehouse._id} value={warehouse._id}>{warehouse.warehouseName}</option>)}</select></label>
              <label className="space-y-1 text-sm">To<select required value={destinationWarehouseId} onChange={(event) => setDestinationWarehouseId(event.target.value)} className="h-10 w-full rounded-lg border border-stock-border bg-white px-2"><option value="">Destination warehouse</option>{warehouses.map((warehouse) => <option key={warehouse._id} value={warehouse._id}>{warehouse.warehouseName}</option>)}</select></label>
              <label className="space-y-1 text-sm">Quantity<input required type="number" min="0.000001" step="any" value={transferQuantity} onChange={(event) => setTransferQuantity(event.target.value)} className="h-10 w-full rounded-lg border border-stock-border px-2" /></label>
              <button type="submit" disabled={transferSubmitting || optionsLoading} className="self-end h-10 rounded-lg bg-stock-primary-blue px-3 text-sm font-semibold text-white disabled:opacity-60">{transferSubmitting ? "Transferring..." : "Confirm Transfer"}</button>
            </form>
          )}

          {optionsLoading && <p role="status" className="text-sm text-stock-secondary-text">Loading inventory options...</p>}
          <section className="overflow-hidden rounded-xl border border-stock-border bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[48rem] text-left text-sm">
                <thead className="bg-stock-light-grey text-stock-secondary-text"><tr>
                  {(isBalances
                    ? ["Product", "SKU", "Warehouse", "Available", "Reserved", "Minimum"]
                    : isTransfers
                      ? ["Transfer", "Product", "From", "To", "Quantity", "Date"]
                      : ["Date", "Product", "Warehouse", "Type", "Quantity", "Previous", "New", "Reference"]
                  ).map((heading) => <th key={heading} className="px-4 py-3 font-medium">{heading}</th>)}
                </tr></thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={isBalances ? 6 : isTransfers ? 6 : 8} className="px-4 py-12 text-center text-stock-secondary-text">Loading inventory...</td></tr>
                  ) : isBalances && balances.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-12 text-center text-stock-secondary-text">No warehouse balances have been recorded.</td></tr>
                  ) : isTransfers && transfers.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-12 text-center text-stock-secondary-text">No stock transfers have been recorded.</td></tr>
                  ) : !isBalances && !isTransfers && movements.length === 0 ? (
                    <tr><td colSpan={8} className="px-4 py-12 text-center text-stock-secondary-text">No movements match these filters.</td></tr>
                  ) : isBalances ? balances.map((balance) => (
                    <tr key={balance._id} className="border-t border-stock-border">
                      <td className="px-4 py-3 font-medium">{balance.productId?.productName ?? "Unavailable product"}</td>
                      <td className="px-4 py-3">{balance.productId?.sku ?? "—"}</td>
                      <td className="px-4 py-3">{balance.warehouseId?.warehouseName ?? "Unavailable warehouse"}</td>
                      <td className="px-4 py-3">{balance.availableQuantity}</td>
                      <td className="px-4 py-3">{balance.reservedQuantity}</td>
                      <td className="px-4 py-3">{balance.productId?.minimumStockThreshold ?? "—"}</td>
                    </tr>
                  )) : isTransfers ? transfers.map((transfer) => (
                    <tr key={transfer._id} className="border-t border-stock-border">
                      <td className="px-4 py-3 font-medium">{transfer.transferNumber}</td>
                      <td className="px-4 py-3">{transfer.productId?.productName ?? "Unavailable product"}</td>
                      <td className="px-4 py-3">{transfer.sourceWarehouseId?.warehouseName ?? "—"}</td>
                      <td className="px-4 py-3">{transfer.destinationWarehouseId?.warehouseName ?? "—"}</td>
                      <td className="px-4 py-3">{transfer.quantity}</td>
                      <td className="px-4 py-3">{new Date(transfer.createdAt).toLocaleString()}</td>
                    </tr>
                  )) : movements.map((movement) => (
                    <tr key={movement._id} className="border-t border-stock-border">
                      <td className="px-4 py-3">{new Date(movement.createdAt).toLocaleString()}</td>
                      <td className="px-4 py-3">{movement.productId?.productName ?? "Unavailable product"}</td>
                      <td className="px-4 py-3">{movement.warehouseId?.warehouseName ?? "—"}</td>
                      <td className="px-4 py-3">{movement.movementType.replaceAll("_", " ")}</td>
                      <td className="px-4 py-3">{movement.quantity}</td>
                      <td className="px-4 py-3">{movement.previousStock}</td>
                      <td className="px-4 py-3">{movement.newStock}</td>
                      <td className="px-4 py-3">{movement.referenceId ?? movement.referenceType ?? "—"}</td>
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
    </AppShell>
  );
}
