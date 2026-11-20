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
  relation: { _id: string; [key: string]: string } | string | null | undefined,
  field: "categoryName" | "supplierName"
): string {
  return typeof relation === "object" && relation
    ? relation[field] ?? "—"
    : "—";
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
      !window.confirm(`Delete "${product.productName}"? This cannot be undone.`)
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

  return (
    <AppShell
      mode="business"
      title="Product Details"
      description="Read product information for the selected workspace."
      action={
        <div className="flex flex-wrap gap-2">
          {canManage && product && (
            <Link
              to={`/products/${product._id}/edit`}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-stock-primary-blue px-4 text-sm font-semibold text-white"
            >
              Edit Product
            </Link>
          )}
          <Link
            to="/products"
            className="inline-flex h-10 items-center justify-center rounded-lg border border-stock-border bg-white px-4 text-sm font-medium text-stock-primary-text"
          >
            Back to Products
          </Link>
        </div>
      }
    >
      {!workspace?.id ? (
        <p className="rounded-xl border border-stock-border bg-white p-5 text-sm text-stock-secondary-text">
          Select a business workspace to view product details.
        </p>
      ) : loading ? (
        <p role="status" className="rounded-xl border border-stock-border bg-white p-5 text-sm text-stock-secondary-text">
          Loading product...
        </p>
      ) : error ? (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between"
        >
          <p>{error}</p>
          <button
            type="button"
            onClick={() => setRefresh((value) => value + 1)}
            className="h-10 shrink-0 rounded-lg border border-red-300 px-4 font-semibold"
          >
            Retry
          </button>
        </div>
      ) : product ? (
        <section className="rounded-xl border border-stock-border bg-white p-5 shadow-sm sm:p-8">
          {deleteError && (
            <p
              role="alert"
              className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {deleteError}
            </p>
          )}
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            {product.productImage ? (
              <img
                src={product.productImage}
                alt=""
                className="h-32 w-32 rounded-lg border border-stock-border object-cover"
              />
            ) : (
              <div className="flex h-32 w-32 items-center justify-center rounded-lg bg-stock-light-grey text-sm text-stock-secondary-text">
                No image
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-semibold text-stock-deep-navy">
                {product.productName}
              </h2>
              <p className="mt-1 text-sm text-stock-secondary-text">
                SKU: {product.sku}
              </p>
              <dl className="mt-6 grid gap-x-8 gap-y-4 sm:grid-cols-2">
                <div>
                  <dt className="text-sm text-stock-secondary-text">Barcode</dt>
                  <dd className="mt-1 break-words text-sm font-medium text-stock-primary-text">
                    {product.barcode || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-stock-secondary-text">Category</dt>
                  <dd className="mt-1 text-sm font-medium text-stock-primary-text">
                    {relationName(product.category, "categoryName")}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-stock-secondary-text">Brand</dt>
                  <dd className="mt-1 text-sm font-medium text-stock-primary-text">
                    {product.brand || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-stock-secondary-text">Supplier</dt>
                  <dd className="mt-1 text-sm font-medium text-stock-primary-text">
                    {relationName(product.supplier, "supplierName")}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-stock-secondary-text">Purchase price</dt>
                  <dd className="mt-1 text-sm font-medium text-stock-primary-text">
                    {workspace.currency} {product.purchasePrice.toLocaleString()}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-stock-secondary-text">Selling price</dt>
                  <dd className="mt-1 text-sm font-medium text-stock-primary-text">
                    {workspace.currency} {product.sellingPrice.toLocaleString()}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-stock-secondary-text">Current stock</dt>
                  <dd className="mt-1 text-sm font-medium text-stock-primary-text">
                    {product.currentStock}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-stock-secondary-text">
                    Minimum stock threshold
                  </dt>
                  <dd className="mt-1 text-sm font-medium text-stock-primary-text">
                    {product.minimumStockThreshold}
                  </dd>
                </div>
              </dl>
              {product.productDescription && (
                <div className="mt-6">
                  <h3 className="text-sm font-semibold text-stock-primary-text">
                    Product description
                  </h3>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-stock-secondary-text">
                    {product.productDescription}
                  </p>
                </div>
              )}
              <p className="mt-6 rounded-lg border border-stock-border bg-stock-light-grey px-4 py-3 text-sm leading-6 text-stock-secondary-text">
                Current stock is informational only and can be changed through
                Inventory workflows, not here.
              </p>
              {canManage && (
                <button
                  type="button"
                  onClick={() => void deleteProduct()}
                  className="mt-5 h-10 rounded-lg border border-red-300 px-4 text-sm font-semibold text-red-700"
                >
                  Delete Product
                </button>
              )}
            </div>
          </div>
        </section>
      ) : (
        <p className="rounded-xl border border-stock-border bg-white p-5 text-sm text-stock-secondary-text">
          Product not found.
        </p>
      )}
    </AppShell>
  );
}
