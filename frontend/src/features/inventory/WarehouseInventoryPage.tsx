
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

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}

function formatMovementType(value: string): string {
  return value.replaceAll("_", " ");
}

function movementStyle(type: string): string {
  if (
    ["STOCK_IN", "OPENING_STOCK", "PURCHASE_RECEIPT", "RETURNED_STOCK"].includes(
      type
    )
  ) {
    return "bg-emerald-50 text-emerald-700";
  }

  if (["STOCK_OUT", "SALES_DEDUCTION", "DAMAGED_STOCK"].includes(type)) {
    return "bg-red-50 text-red-700";
  }

  if (type === "STOCK_TRANSFER") {
    return "bg-blue-50 text-blue-700";
  }

  return "bg-amber-50 text-amber-700";
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wider text-stock-primary-blue">
        {eyebrow}
      </p>
      <h2 className="mt-2 text-lg font-bold text-stock-primary-text">
        {title}
      </h2>
      <p className="mt-1 text-sm text-stock-secondary-text">{description}</p>
    </div>
  );
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

  const title = isBalances
    ? "Warehouse Stock"
    : isTransfers
      ? "Stock Transfers"
      : "Stock Movements";

  const description = isBalances
    ? "Monitor available and reserved stock across your warehouses."
    : isTransfers
      ? "Move inventory between warehouses and review transfer history."
      : "Track stock changes and review your complete inventory movement history.";

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
            getErrorMessage(
              loadError,
              "Unable to load warehouse and product options."
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

    if (isBalances && warehouseFilter) {
      query.set("warehouseId", warehouseFilter);
    }

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

    apiRequest<
      ListResponse<
        InventoryBalanceRecord | InventoryMovementRecord | InventoryTransferRecord
      >
    >(path)
      .then((response) => {
        if (!response.success) {
          throw new Error("Inventory data could not be loaded.");
        }

        if (!active) return;

        if (isBalances) {
          const result = response.balances;

          if (!Array.isArray(result)) {
            throw new Error("Warehouse balances are unavailable.");
          }

          setBalances(result as InventoryBalanceRecord[]);
        } else if (isTransfers) {
          const result = response.transfers;

          if (!Array.isArray(result)) {
            throw new Error("Transfer history is unavailable.");
          }

          setTransfers(result as InventoryTransferRecord[]);
        } else {
          const result = response.movements;

          if (!Array.isArray(result)) {
            throw new Error("Movement history is unavailable.");
          }

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

  const submitTransfer = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
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
      setActionError(
        "Select a product, two different warehouses and a positive quantity."
      );
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
      setActionError(
        getErrorMessage(submitError, "Unable to transfer stock.")
      );
    } finally {
      setTransferSubmitting(false);
    }
  };

  const currentCount = isBalances
    ? balances.length
    : isTransfers
      ? transfers.length
      : movements.length;

  return (
    <AppShell
      mode="business"
      title={title}
      description={description}
      action={
        isTransfers && canManage ? (
          <button
            type="button"
            onClick={() => {
              setShowTransferForm((value) => !value);
              setActionError("");
            }}
            className="inline-flex h-11 items-center justify-center rounded-xl bg-stock-primary-blue px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800"
          >
            {showTransferForm ? "Close Form" : "+ Transfer Stock"}
          </button>
        ) : null
      }
    >
      {!workspace?.id ? (
        <section className="rounded-2xl border border-stock-border bg-white p-6 shadow-sm">
          <p className="text-sm text-stock-secondary-text">
            Select a business workspace to view inventory.
          </p>
        </section>
      ) : (
        <div className="space-y-6">
          {/* Inventory introduction */}
          <section className="rounded-2xl border border-stock-border bg-white p-5 shadow-sm sm:p-7">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <span className="inline-flex rounded-lg bg-blue-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-stock-primary-blue">
                  Inventory management
                </span>

                <h2 className="mt-3 text-xl font-bold text-stock-primary-text">
                  {isBalances
                    ? "Warehouse stock overview"
                    : isTransfers
                      ? "Manage stock transfers"
                      : "Inventory movement history"}
                </h2>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-stock-secondary-text">
                  {isBalances
                    ? "View product availability and reserved quantities at each warehouse."
                    : isTransfers
                      ? "Transfer products between your warehouses while maintaining an auditable history."
                      : "Review stock activity, including incoming stock, outgoing stock and adjustments."}
                </p>
              </div>

              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-2xl text-stock-primary-blue">
                ▦
              </div>
            </div>
          </section>

          {/* Inventory navigation */}
          <nav
            className="flex flex-wrap gap-2 rounded-2xl border border-stock-border bg-white p-3 shadow-sm"
            aria-label="Inventory views"
          >
            {[
              ["/inventory/movements", "Movements"],
              ["/inventory/balances", "Warehouse Stock"],
              ["/inventory/transfers", "Transfers"],
            ].map(([path, label]) => {
              const active = location.pathname === path;

              return (
                <Link
                  key={path}
                  to={path}
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex h-10 items-center rounded-xl border px-4 text-sm font-semibold transition ${
                    active
                      ? "border-blue-200 bg-blue-50 text-stock-primary-blue"
                      : "border-transparent bg-white text-stock-secondary-text hover:border-stock-border hover:bg-slate-50 hover:text-stock-primary-text"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </nav>

          {/* Page summary */}
          <section className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-stock-border bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-stock-secondary-text">
                Records on this page
              </p>
              <p className="mt-2 text-3xl font-bold text-stock-primary-text">
                {loading ? "—" : currentCount}
              </p>
              <p className="mt-1 text-xs text-stock-secondary-text">
                Current page results
              </p>
            </div>

            <div className="rounded-2xl border border-stock-border bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-stock-secondary-text">
                Total pages
              </p>
              <p className="mt-2 text-3xl font-bold text-stock-primary-text">
                {loading ? "—" : totalPages || 1}
              </p>
              <p className="mt-1 text-xs text-stock-secondary-text">
                Based on the current filters
              </p>
            </div>
          </section>

          {/* Error messages */}
          {(error || optionsError || actionError) && (
            <div
              role="alert"
              className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between"
            >
              <p>{error || optionsError || actionError}</p>

              {(error || optionsError) && (
                <button
                  type="button"
                  onClick={() => setRefresh((value) => value + 1)}
                  className="shrink-0 font-semibold underline"
                >
                  Retry
                </button>
              )}
            </div>
          )}

          {/* Filters */}
          <section className="rounded-2xl border border-stock-border bg-white p-5 shadow-sm">
            <SectionHeading
              eyebrow="FILTERS"
              title="Refine inventory records"
              description="Choose a warehouse or movement type to narrow the results."
            />

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {(isBalances || !isTransfers) && (
                <label className="block space-y-2 text-sm font-medium text-stock-primary-text">
                  Filter by warehouse
                  <select
                    value={warehouseFilter}
                    onChange={(event) => {
                      setWarehouseFilter(event.target.value);
                      setPage(1);
                    }}
                    className="h-12 w-full rounded-xl border border-stock-border bg-white px-3 text-sm font-normal outline-none transition focus:border-stock-primary-blue focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="">All warehouses</option>
                    {warehouses.map((warehouse) => (
                      <option key={warehouse._id} value={warehouse._id}>
                        {warehouse.warehouseName}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {!isBalances && !isTransfers && (
                <label className="block space-y-2 text-sm font-medium text-stock-primary-text">
                  Filter by movement type
                  <select
                    value={movementFilter}
                    onChange={(event) => {
                      setMovementFilter(event.target.value);
                      setPage(1);
                    }}
                    className="h-12 w-full rounded-xl border border-stock-border bg-white px-3 text-sm font-normal outline-none transition focus:border-stock-primary-blue focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="">All movement types</option>
                    {[
                      "OPENING_STOCK",
                      "STOCK_IN",
                      "STOCK_OUT",
                      "SALES_DEDUCTION",
                      "PURCHASE_RECEIPT",
                      "STOCK_ADJUSTMENT",
                      "STOCK_TRANSFER",
                      "DAMAGED_STOCK",
                      "RETURNED_STOCK",
                    ].map((type) => (
                      <option key={type} value={type}>
                        {formatMovementType(type)}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>

            {optionsLoading && (
              <p role="status" className="mt-3 text-xs text-stock-secondary-text">
                Loading filter options...
              </p>
            )}
          </section>

          {/* Stock transfer form */}
          {showTransferForm && isTransfers && canManage && (
            <section className="rounded-2xl border border-stock-border bg-white p-5 shadow-sm sm:p-7">
              <SectionHeading
                eyebrow="STOCK TRANSFER"
                title="Create a warehouse transfer"
                description="Select a product, source warehouse, destination warehouse and quantity."
              />

              <form
                onSubmit={(event) => void submitTransfer(event)}
                className="mt-6 space-y-5"
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block space-y-2 text-sm font-medium text-stock-primary-text">
                    Product
                    <select
                      required
                      value={transferProductId}
                      onChange={(event) =>
                        setTransferProductId(event.target.value)
                      }
                      className="h-12 w-full rounded-xl border border-stock-border bg-white px-3 text-sm font-normal outline-none focus:border-stock-primary-blue focus:ring-2 focus:ring-blue-100"
                    >
                      <option value="">Select product</option>
                      {products.map((product) => (
                        <option key={product._id} value={product._id}>
                          {product.productName} · {product.sku}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block space-y-2 text-sm font-medium text-stock-primary-text">
                    Quantity
                    <input
                      required
                      type="number"
                      min="0.000001"
                      step="any"
                      value={transferQuantity}
                      onChange={(event) =>
                        setTransferQuantity(event.target.value)
                      }
                      placeholder="Enter transfer quantity"
                      className="h-12 w-full rounded-xl border border-stock-border px-3 text-sm font-normal outline-none focus:border-stock-primary-blue focus:ring-2 focus:ring-blue-100"
                    />
                  </label>

                  <label className="block space-y-2 text-sm font-medium text-stock-primary-text">
                    Source warehouse
                    <select
                      required
                      value={sourceWarehouseId}
                      onChange={(event) =>
                        setSourceWarehouseId(event.target.value)
                      }
                      className="h-12 w-full rounded-xl border border-stock-border bg-white px-3 text-sm font-normal outline-none focus:border-stock-primary-blue focus:ring-2 focus:ring-blue-100"
                    >
                      <option value="">Select source warehouse</option>
                      {warehouses.map((warehouse) => (
                        <option key={warehouse._id} value={warehouse._id}>
                          {warehouse.warehouseName}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block space-y-2 text-sm font-medium text-stock-primary-text">
                    Destination warehouse
                    <select
                      required
                      value={destinationWarehouseId}
                      onChange={(event) =>
                        setDestinationWarehouseId(event.target.value)
                      }
                      className="h-12 w-full rounded-xl border border-stock-border bg-white px-3 text-sm font-normal outline-none focus:border-stock-primary-blue focus:ring-2 focus:ring-blue-100"
                    >
                      <option value="">Select destination warehouse</option>
                      {warehouses.map((warehouse) => (
                        <option key={warehouse._id} value={warehouse._id}>
                          {warehouse.warehouseName}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {sourceWarehouseId &&
                  destinationWarehouseId &&
                  sourceWarehouseId === destinationWarehouseId && (
                    <p className="text-sm text-red-600">
                      Source and destination warehouses must be different.
                    </p>
                  )}

                <div className="flex flex-col-reverse gap-3 border-t border-stock-border pt-5 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setShowTransferForm(false);
                      setActionError("");
                    }}
                    className="h-11 rounded-xl border border-stock-border px-5 text-sm font-semibold text-stock-primary-text transition hover:bg-slate-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={transferSubmitting || optionsLoading}
                    className="h-11 rounded-xl bg-stock-primary-blue px-6 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {transferSubmitting ? "Transferring..." : "Confirm Transfer"}
                  </button>
                </div>
              </form>
            </section>
          )}

          {/* Inventory records table */}
          <section className="overflow-hidden rounded-2xl border border-stock-border bg-white shadow-sm">
            <div className="flex flex-col gap-2 border-b border-stock-border p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-bold text-stock-primary-text">
                  {isBalances
                    ? "Warehouse stock records"
                    : isTransfers
                      ? "Transfer history"
                      : "Movement records"}
                </h3>
                <p className="mt-1 text-xs text-stock-secondary-text">
                  Page {page} · {currentCount} records displayed
                </p>
              </div>

              <button
                type="button"
                onClick={() => setRefresh((value) => value + 1)}
                disabled={loading}
                className="h-9 rounded-lg border border-stock-border px-3 text-xs font-semibold text-stock-primary-text transition hover:bg-slate-50 disabled:opacity-50"
              >
                ↻ Refresh
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[48rem] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-stock-secondary-text">
                  <tr>
                    {(isBalances
                      ? [
                          "Product",
                          "SKU",
                          "Warehouse",
                          "Available",
                          "Reserved",
                          "Minimum",
                        ]
                      : isTransfers
                        ? [
                            "Transfer",
                            "Product",
                            "From",
                            "To",
                            "Quantity",
                            "Date",
                          ]
                        : [
                            "Date",
                            "Product",
                            "Warehouse",
                            "Type",
                            "Quantity",
                            "Previous",
                            "New",
                            "Reference",
                          ]
                    ).map((heading) => (
                      <th
                        key={heading}
                        className="whitespace-nowrap px-4 py-4 font-semibold"
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody className="divide-y divide-stock-border">
                  {loading ? (
                    <tr>
                      <td
                        colSpan={isBalances ? 6 : isTransfers ? 6 : 8}
                        className="px-4 py-16 text-center"
                      >
                        <div className="flex flex-col items-center gap-3">
                          <span className="h-7 w-7 animate-spin rounded-full border-2 border-blue-200 border-t-stock-primary-blue" />
                          <span className="text-sm text-stock-secondary-text">
                            Loading inventory records...
                          </span>
                        </div>
                      </td>
                    </tr>
                  ) : isBalances && balances.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-16 text-center">
                        <p className="font-semibold text-stock-primary-text">
                          No warehouse balances found
                        </p>
                        <p className="mt-2 text-sm text-stock-secondary-text">
                          Warehouse stock records will appear here when
                          inventory is available.
                        </p>
                      </td>
                    </tr>
                  ) : isTransfers && transfers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-16 text-center">
                        <p className="font-semibold text-stock-primary-text">
                          No stock transfers found
                        </p>
                        <p className="mt-2 text-sm text-stock-secondary-text">
                          Your warehouse transfer history will appear here.
                        </p>
                      </td>
                    </tr>
                  ) : !isBalances && !isTransfers && movements.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-16 text-center">
                        <p className="font-semibold text-stock-primary-text">
                          No inventory movements found
                        </p>
                        <p className="mt-2 text-sm text-stock-secondary-text">
                          Try changing the filters to see other records.
                        </p>
                      </td>
                    </tr>
                  ) : isBalances ? (
                    balances.map((balance) => (
                      <tr
                        key={balance._id}
                        className="transition hover:bg-slate-50/70"
                      >
                        <td className="px-4 py-4 font-semibold text-stock-primary-text">
                          {balance.productId?.productName ??
                            "Unavailable product"}
                        </td>
                        <td className="px-4 py-4 text-stock-secondary-text">
                          {balance.productId?.sku ?? "—"}
                        </td>
                        <td className="px-4 py-4 text-stock-primary-text">
                          {balance.warehouseId?.warehouseName ??
                            "Unavailable warehouse"}
                        </td>
                        <td className="px-4 py-4 font-semibold text-stock-primary-text">
                          {balance.availableQuantity.toLocaleString("en-IN")}
                        </td>
                        <td className="px-4 py-4 text-stock-secondary-text">
                          {balance.reservedQuantity.toLocaleString("en-IN")}
                        </td>
                        <td className="px-4 py-4 text-stock-secondary-text">
                          {balance.productId?.minimumStockThreshold ?? "—"}
                        </td>
                      </tr>
                    ))
                  ) : isTransfers ? (
                    transfers.map((transfer) => (
                      <tr
                        key={transfer._id}
                        className="transition hover:bg-slate-50/70"
                      >
                        <td className="px-4 py-4 font-semibold text-stock-primary-blue">
                          {transfer.transferNumber}
                        </td>
                        <td className="px-4 py-4 font-medium text-stock-primary-text">
                          {transfer.productId?.productName ??
                            "Unavailable product"}
                        </td>
                        <td className="px-4 py-4 text-stock-secondary-text">
                          {transfer.sourceWarehouseId?.warehouseName ?? "—"}
                        </td>
                        <td className="px-4 py-4 text-stock-secondary-text">
                          {transfer.destinationWarehouseId?.warehouseName ??
                            "—"}
                        </td>
                        <td className="px-4 py-4 font-semibold text-stock-primary-text">
                          {transfer.quantity.toLocaleString("en-IN")}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-stock-secondary-text">
                          {formatDate(transfer.createdAt)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    movements.map((movement) => (
                      <tr
                        key={movement._id}
                        className="transition hover:bg-slate-50/70"
                      >
                        <td className="whitespace-nowrap px-4 py-4 text-xs text-stock-secondary-text">
                          {formatDate(movement.createdAt)}
                        </td>
                        <td className="px-4 py-4 font-semibold text-stock-primary-text">
                          {movement.productId?.productName ??
                            "Unavailable product"}
                          <p className="mt-1 text-xs font-normal text-stock-secondary-text">
                            {movement.productId?.sku ?? "—"}
                          </p>
                        </td>
                        <td className="px-4 py-4 text-stock-secondary-text">
                          {movement.warehouseId?.warehouseName ?? "—"}
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${movementStyle(movement.movementType)}`}
                          >
                            {formatMovementType(movement.movementType)}
                          </span>
                        </td>
                        <td className="px-4 py-4 font-semibold text-stock-primary-text">
                          {movement.quantity.toLocaleString("en-IN")}
                        </td>
                        <td className="px-4 py-4 text-stock-secondary-text">
                          {movement.previousStock.toLocaleString("en-IN")}
                        </td>
                        <td className="px-4 py-4 font-semibold text-stock-primary-text">
                          {movement.newStock.toLocaleString("en-IN")}
                        </td>
                        <td className="max-w-40 truncate px-4 py-4 text-xs text-stock-secondary-text">
                          {movement.referenceId ??
                            movement.referenceType ??
                            "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Pagination */}
          <section className="flex flex-col gap-3 rounded-2xl border border-stock-border bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-stock-secondary-text">
              Page <strong className="text-stock-primary-text">{page}</strong>{" "}
              of{" "}
              <strong className="text-stock-primary-text">
                {totalPages || 1}
              </strong>
            </p>

            <div className="flex gap-2">
              <button
                type="button"
                disabled={loading || page <= 1}
                onClick={() => setPage((value) => value - 1)}
                className="h-10 rounded-xl border border-stock-border bg-white px-4 text-sm font-semibold text-stock-primary-text transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                ← Previous
              </button>

              <button
                type="button"
                disabled={loading || page >= totalPages}
                onClick={() => setPage((value) => value + 1)}
                className="h-10 rounded-xl border border-stock-border bg-white px-4 text-sm font-semibold text-stock-primary-text transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next →
              </button>
            </div>
          </section>
        </div>
      )}
    </AppShell>
  );
}
