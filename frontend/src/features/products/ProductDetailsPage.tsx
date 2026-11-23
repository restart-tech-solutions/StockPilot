
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AppShell } from "../../components/layout/AppShell";
import { apiRequest, StockPilotApiError } from "../../services/api";
import { useWorkspace } from "../workspace/workspaceContext";

interface ProductRecord {
  _id: string;
  productName: string;
  sku: string;
  barcode?: string;
  category: { _id: string; categoryName: string } | string | null;
  brand?: string;
  purchasePrice: number;
  sellingPrice: number;
  currentStock: number;
  minimumStockThreshold: number;
  supplier?: { _id: string; supplierName: string } | string | null;
  productDescription?: string;
  productImage?: string;
}

interface ProductDetailsResponse {
  success: boolean;
  product: ProductRecord;
}

function relationName(
  relation:
    | { _id: string; [key: string]: string }
    | string
    | null
    | undefined,
  field: "categoryName" | "supplierName"
): string {
  return typeof relation === "object" && relation
    ? relation[field] ?? "—"
    : "—";
}

function formatCurrency(value: number, currency: string) {
  return `${currency} ${value.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function getStockStatus(product: ProductRecord) {
  if (product.currentStock <= 0) {
    return {
      label: "Out of stock",
      description: "This product is currently unavailable.",
      className: "bg-red-50 text-red-700 ring-red-200",
      dotClass: "bg-red-500",
      iconClass: "bg-red-50 text-red-700",
    };
  }

  if (product.currentStock <= product.minimumStockThreshold) {
    return {
      label: "Low stock",
      description: "Stock has reached the minimum threshold.",
      className: "bg-amber-50 text-amber-700 ring-amber-200",
      dotClass: "bg-amber-500",
      iconClass: "bg-amber-50 text-amber-700",
    };
  }

  return {
    label: "In stock",
    description: "Inventory level is healthy.",
    className: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    dotClass: "bg-emerald-500",
    iconClass: "bg-emerald-50 text-emerald-700",
  };
}

function DetailItem({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-stock-border bg-white p-4">
      <dt className="text-xs font-medium uppercase tracking-wide text-stock-secondary-text">
        {label}
      </dt>
      <dd className="mt-2 break-words text-sm font-semibold text-stock-primary-text">
        {value || "—"}
      </dd>
    </div>
  );
}

function MetricCard({
  label,
  value,
  description,
  icon,
  iconClass,
}: {
  label: string;
  value: string;
  description: string;
  icon: string;
  iconClass: string;
}) {
  return (
    <div className="rounded-2xl border border-stock-border bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-stock-secondary-text">
            {label}
          </p>
          <p className="mt-3 break-words text-2xl font-bold tracking-tight text-stock-primary-text">
            {value}
          </p>
          <p className="mt-2 text-xs text-stock-secondary-text">
            {description}
          </p>
        </div>

        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl font-bold ${iconClass}`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

export function ProductDetailsPage() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const { workspace } = useWorkspace();

  const [product, setProduct] = useState<ProductRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [deleteError, setDeleteError] = useState("");

  const canManage =
    !workspace?.membershipRole ||
    ["BUSINESS_OWNER", "INVENTORY_MANAGER"].includes(
      workspace.membershipRole
    );

  const loadProduct = useCallback(async () => {
    if (!workspace?.id || !productId) {
      setLoading(false);
      setProduct(null);
      return;
    }

    setProduct(null);
    setLoading(true);
    setError("");

    try {
      const response = await apiRequest<ProductDetailsResponse>(
        `/products/${encodeURIComponent(productId)}?businessId=${encodeURIComponent(workspace.id)}`
      );

      if (!response.success || !response.product) {
        throw new Error("The product could not be loaded.");
      }

      setProduct(response.product);
    } catch (loadError) {
      setProduct(null);
      setError(
        loadError instanceof StockPilotApiError
          ? loadError.message
          : "Unable to load this product."
      );
    } finally {
      setLoading(false);
    }
  }, [productId, workspace?.id]);

  useEffect(() => {
    void loadProduct();
  }, [loadProduct, refresh]);

  const deleteProduct = async () => {
    if (
      !product ||
      !workspace?.id ||
      !window.confirm(
        `Delete "${product.productName}"? This cannot be undone.`
      )
    ) {
      return;
    }

    setDeleteError("");

    try {
      await apiRequest(`/products/${encodeURIComponent(product._id)}`, {
        method: "DELETE",
        body: JSON.stringify({ businessId: workspace.id }),
      });

      navigate("/products", { replace: true });
    } catch (deleteFailure) {
      setDeleteError(
        deleteFailure instanceof StockPilotApiError
          ? deleteFailure.message
          : "Unable to delete this product."
      );
    }
  };

  const stockStatus = product ? getStockStatus(product) : null;

  return (
    <AppShell
      mode="business"
      title="Product Details"
      description="View product information, pricing and inventory status."
      action={
        <div className="flex flex-wrap gap-2">
          {canManage && product && (
            <Link
              to={`/products/${product._id}/edit`}
              className="inline-flex h-11 items-center justify-center rounded-xl bg-stock-primary-blue px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800"
            >
              Edit Product
            </Link>
          )}

          <Link
            to="/products"
            className="inline-flex h-11 items-center justify-center rounded-xl border border-stock-border bg-white px-4 text-sm font-semibold text-stock-primary-text transition hover:border-stock-primary-blue hover:bg-blue-50"
          >
            ← Back to Products
          </Link>
        </div>
      }
    >
      {!workspace?.id ? (
        <section className="rounded-2xl border border-stock-border bg-white p-6 shadow-sm">
          <p className="text-sm text-stock-secondary-text">
            Select a business workspace to view product details.
          </p>

          <Link
            to="/workspaces"
            className="mt-4 inline-flex h-10 items-center rounded-xl bg-stock-primary-blue px-4 text-sm font-semibold text-white"
          >
            Select workspace
          </Link>
        </section>
      ) : loading ? (
        <section
          role="status"
          className="flex flex-col items-center justify-center rounded-2xl border border-stock-border bg-white px-5 py-20 shadow-sm"
        >
          <div className="h-9 w-9 animate-spin rounded-full border-2 border-blue-200 border-t-stock-primary-blue" />
          <p className="mt-4 text-sm font-medium text-stock-secondary-text">
            Loading product details...
          </p>
        </section>
      ) : error ? (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between"
        >
          <p>{error}</p>
          <button
            type="button"
            onClick={() => setRefresh((value) => value + 1)}
            className="h-10 shrink-0 rounded-xl border border-red-300 px-4 font-semibold transition hover:bg-red-100"
          >
            Retry
          </button>
        </div>
      ) : product && stockStatus ? (
        <div className="space-y-6">
          {/* Product overview */}
          <section className="rounded-2xl border border-stock-border bg-white p-5 shadow-sm sm:p-7">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
              {product.productImage ? (
                <img
                  src={product.productImage}
                  alt={product.productName}
                  className="h-32 w-32 shrink-0 rounded-2xl border border-stock-border bg-stock-light-grey object-cover"
                />
              ) : (
                <div className="flex h-32 w-32 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-4xl font-bold text-stock-primary-blue">
                  {product.productName.charAt(0).toUpperCase()}
                </div>
              )}

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-lg bg-blue-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-stock-primary-blue">
                    Product catalog
                  </span>

                  <span
                    className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${stockStatus.className}`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${stockStatus.dotClass}`}
                    />
                    {stockStatus.label}
                  </span>
                </div>

                <h2 className="mt-4 break-words text-2xl font-bold tracking-tight text-stock-primary-text sm:text-3xl">
                  {product.productName}
                </h2>

                <p className="mt-2 text-sm text-stock-secondary-text">
                  SKU: <span className="font-semibold text-stock-primary-text">{product.sku}</span>
                </p>

                <p className="mt-3 text-sm text-stock-secondary-text">
                  {stockStatus.description}
                </p>
              </div>
            </div>
          </section>

          {/* Pricing and inventory metrics */}
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Purchase price"
              value={formatCurrency(product.purchasePrice, workspace.currency)}
              description="Product acquisition cost"
              icon="₹"
              iconClass="bg-blue-50 text-blue-700"
            />

            <MetricCard
              label="Selling price"
              value={formatCurrency(product.sellingPrice, workspace.currency)}
              description="Current selling price"
              icon="↗"
              iconClass="bg-emerald-50 text-emerald-700"
            />

            <MetricCard
              label="Current stock"
              value={product.currentStock.toLocaleString("en-IN")}
              description="Available inventory quantity"
              icon="▦"
              iconClass="bg-indigo-50 text-indigo-700"
            />

            <MetricCard
              label="Minimum threshold"
              value={product.minimumStockThreshold.toLocaleString("en-IN")}
              description="Low-stock alert threshold"
              icon="!"
              iconClass="bg-amber-50 text-amber-700"
            />
          </section>

          {/* Product information */}
          <section className="rounded-2xl border border-stock-border bg-white p-5 shadow-sm sm:p-7">
            <div className="mb-5">
              <span className="text-xs font-bold uppercase tracking-wide text-stock-primary-blue">
                PRODUCT INFORMATION
              </span>
              <h3 className="mt-2 text-lg font-bold text-stock-primary-text">
                Product details
              </h3>
              <p className="mt-1 text-sm text-stock-secondary-text">
                Identification and classification information.
              </p>
            </div>

            <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <DetailItem label="Product name" value={product.productName} />
              <DetailItem label="SKU" value={product.sku} />
              <DetailItem label="Barcode" value={product.barcode || "—"} />
              <DetailItem label="Category" value={relationName(product.category, "categoryName")} />
              <DetailItem label="Brand" value={product.brand || "—"} />
              <DetailItem label="Supplier" value={relationName(product.supplier, "supplierName")} />
            </dl>
          </section>

          {/* Inventory information */}
          <section className="rounded-2xl border border-stock-border bg-white p-5 shadow-sm sm:p-7">
            <div className="mb-5">
              <span className="text-xs font-bold uppercase tracking-wide text-stock-primary-blue">
                INVENTORY
              </span>
              <h3 className="mt-2 text-lg font-bold text-stock-primary-text">
                Stock information
              </h3>
              <p className="mt-1 text-sm text-stock-secondary-text">
                Current inventory level and replenishment threshold.
              </p>
            </div>

            <div
              className={`rounded-xl border p-4 ${
                product.currentStock <= product.minimumStockThreshold
                  ? "border-amber-200 bg-amber-50"
                  : "border-emerald-200 bg-emerald-50"
              }`}
            >
              <div className="flex items-start gap-3">
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-lg font-bold ${stockStatus.iconClass}`}
                >
                  {product.currentStock <= 0
                    ? "!"
                    : product.currentStock <= product.minimumStockThreshold
                      ? "!"
                      : "✓"}
                </span>

                <div>
                  <p className="text-sm font-semibold text-stock-primary-text">
                    {product.currentStock <= 0
                      ? "Product is out of stock"
                      : product.currentStock <= product.minimumStockThreshold
                        ? "Stock is at or below the minimum threshold"
                        : "Stock level is healthy"}
                  </p>

                  <p className="mt-1 text-sm leading-6 text-stock-secondary-text">
                    Current stock is informational here and can be changed
                    through Inventory workflows, not on this page.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Product description */}
          <section className="rounded-2xl border border-stock-border bg-white p-5 shadow-sm sm:p-7">
            <div>
              <span className="text-xs font-bold uppercase tracking-wide text-stock-primary-blue">
                DESCRIPTION
              </span>

              <h3 className="mt-2 text-lg font-bold text-stock-primary-text">
                About this product
              </h3>
            </div>

            <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-stock-secondary-text">
              {product.productDescription || "No product description has been added."}
            </p>
          </section>

          {/* Delete error */}
          {deleteError && (
            <p
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {deleteError}
            </p>
          )}

          {/* Actions */}
          {canManage && (
            <section className="flex flex-col gap-3 rounded-2xl border border-stock-border bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-bold text-stock-primary-text">
                  Manage product
                </h3>
                <p className="mt-1 text-xs text-stock-secondary-text">
                  Update product information or remove this product.
                </p>
              </div>

              <button
                type="button"
                onClick={() => void deleteProduct()}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-red-200 px-4 text-sm font-semibold text-red-700 transition hover:bg-red-50"
              >
                Delete Product
              </button>
            </section>
          )}
        </div>
      ) : (
        <section className="rounded-2xl border border-stock-border bg-white p-10 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-2xl text-stock-secondary-text">
            ?
          </div>
          <h3 className="mt-4 font-bold text-stock-primary-text">
            Product not found
          </h3>
          <p className="mt-2 text-sm text-stock-secondary-text">
            This product may have been removed or is unavailable.
          </p>
          <Link
            to="/products"
            className="mt-5 inline-flex h-10 items-center justify-center rounded-xl bg-stock-primary-blue px-4 text-sm font-semibold text-white"
          >
            Back to Products
          </Link>
        </section>
      )}
    </AppShell>
  );
}
