import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AppShell } from "../../components/layout/AppShell";
import { apiRequest, StockPilotApiError } from "../../services/api";
import { useWorkspace } from "../workspace/workspaceContext";

interface CategoryOption {
  _id: string;
  categoryName: string;
}

interface ProductRecord {
  _id: string;
  productName: string;
  sku: string;
  category: string | { _id: string; categoryName: string } | null;
  currentStock: number;
  purchasePrice: number;
  sellingPrice: number;
  minimumStockThreshold: number;
}

interface ProductListResponse {
  success: boolean;
  products: ProductRecord[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface CategoryListResponse {
  success: boolean;
  categories: CategoryOption[];
}

function categoryName(category: ProductRecord["category"]): string {
  return typeof category === "object" && category
    ? category.categoryName
    : "—";
}

function requestError(error: unknown, fallback: string): string {
  return error instanceof StockPilotApiError ? error.message : fallback;
}

export function ProductListPage() {
  const { workspace } = useWorkspace();
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [categoryError, setCategoryError] = useState("");
  const [actionError, setActionError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const canManage =
    !workspace?.membershipRole ||
    ["BUSINESS_OWNER", "INVENTORY_MANAGER"].includes(
      workspace.membershipRole
    );

  useEffect(() => {
    setProducts([]);
    setPage(1);
    setTotalPages(0);
    setError("");
  }, [workspace?.id]);

  useEffect(() => {
    if (!workspace?.id) {
      setCategories([]);
      setCategoryError("");
      return;
    }

    let active = true;
    apiRequest<CategoryListResponse>(
      `/categories?businessId=${encodeURIComponent(workspace.id)}`
    )
      .then((response) => {
        if (!response.success || !Array.isArray(response.categories)) {
          throw new Error("The category list could not be loaded.");
        }
        if (active) {
          setCategories(response.categories);
          setCategoryError("");
        }
      })
      .catch((loadError: unknown) => {
        if (active) {
          setCategoryError(
            requestError(loadError, "Unable to load workspace categories.")
          );
        }
      });

    return () => {
      active = false;
    };
  }, [workspace?.id]);

  useEffect(() => {
    if (!workspace?.id) {
      setProducts([]);
      setLoading(false);
      return;
    }

    let active = true;
    const timer = window.setTimeout(() => {
      const query = new URLSearchParams({
        businessId: workspace.id,
        page: String(page),
        limit: "10",
      });
      if (search.trim()) {
        query.set("search", search.trim());
      }
      if (categoryId) {
        query.set("categoryId", categoryId);
      }

      setLoading(true);
      setError("");
      apiRequest<ProductListResponse>(`/products?${query.toString()}`)
        .then((response) => {
          if (!response.success || !Array.isArray(response.products)) {
            throw new Error("The product list could not be loaded.");
          }
          if (!active) {
            return;
          }
          if (
            response.pagination.totalPages > 0 &&
            page > response.pagination.totalPages
          ) {
            setPage(response.pagination.totalPages);
            return;
          }
          setProducts(response.products);
          setTotalPages(response.pagination.totalPages);
        })
        .catch((loadError: unknown) => {
          if (active) {
            setError(requestError(loadError, "Unable to load products."));
          }
        })
        .finally(() => {
          if (active) {
            setLoading(false);
          }
        });
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [workspace?.id, page, search, categoryId, refresh]);

  const deleteProduct = async (product: ProductRecord) => {
    if (
      !workspace?.id ||
      !window.confirm(`Delete "${product.productName}"? This cannot be undone.`)
    ) {
      return;
    }
    setActionError("");
    try {
      await apiRequest(`/products/${encodeURIComponent(product._id)}`, {
        method: "DELETE",
        body: JSON.stringify({ businessId: workspace.id }),
      });
      setRefresh((value) => value + 1);
    } catch (deleteError) {
      setActionError(requestError(deleteError, "Unable to delete this product."));
    }
  };

  return (
    <AppShell
      mode="business"
      title="Products"
      description="Manage products for the selected business workspace."
      action={
        canManage ? (
          <div className="flex flex-wrap gap-2">
            <Link
              to="/products/import"
              className="inline-flex h-11 items-center justify-center rounded-lg border border-stock-border bg-white px-4 text-sm font-semibold text-stock-primary-text hover:border-stock-primary-blue"
            >
              Import Products
            </Link>
            <Link
              to="/products/new"
              className="inline-flex h-11 items-center justify-center rounded-lg bg-stock-primary-blue px-4 text-sm font-semibold text-white hover:bg-blue-800"
            >
              Add Product
            </Link>
          </div>
        ) : null
      }
    >
      {!workspace?.id ? (
        <section className="rounded-xl border border-stock-border bg-white p-5">
          <p className="text-sm text-stock-secondary-text">
            Select a business workspace to view products.
          </p>
          <Link
            to="/workspaces"
            className="mt-4 inline-flex h-10 items-center rounded-lg bg-stock-primary-blue px-4 text-sm font-semibold text-white"
          >
            Select workspace
          </Link>
        </section>
      ) : (
        <div className="space-y-5">
          {categoryError && (
            <p
              role="alert"
              className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
            >
              Category filtering is unavailable: {categoryError}
            </p>
          )}
          {actionError && (
            <p
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {actionError}
            </p>
          )}

          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="min-w-0 flex-1">
              <span className="sr-only">Search products</span>
              <input
                type="search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Search product name or SKU..."
                className="h-11 w-full rounded-lg border border-stock-border bg-white px-3 text-sm text-stock-primary-text"
              />
            </label>
            <label className="sm:w-64">
              <span className="sr-only">Filter by category</span>
              <select
                value={categoryId}
                onChange={(event) => {
                  setCategoryId(event.target.value);
                  setPage(1);
                }}
                disabled={Boolean(categoryError)}
                className="h-11 w-full rounded-lg border border-stock-border bg-white px-3 text-sm text-stock-primary-text disabled:bg-stock-light-grey"
              >
                <option value="">All categories</option>
                {categories.map((category) => (
                  <option key={category._id} value={category._id}>
                    {category.categoryName}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {error && (
            <div
              role="alert"
              className="flex flex-col gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between"
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
          )}

          <section className="min-w-0 overflow-hidden rounded-xl border border-stock-border bg-white shadow-sm">
            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-[48rem] border-collapse text-left text-sm">
                <thead className="bg-stock-light-grey text-stock-secondary-text">
                  <tr>
                    {["Product", "SKU", "Category", "Stock", "Actions"].map(
                      (column) => (
                        <th key={column} scope="col" className="px-4 py-3 font-medium">
                          {column}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-12 text-center text-stock-secondary-text">
                        Loading products...
                      </td>
                    </tr>
                  ) : products.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-12 text-center text-stock-secondary-text">
                        {search || categoryId
                          ? "No products match these filters."
                          : "No products have been added to this workspace yet."}
                      </td>
                    </tr>
                  ) : (
                    products.map((product) => (
                      <tr
                        key={product._id}
                        className="border-t border-stock-border text-stock-primary-text"
                      >
                        <td className="px-4 py-3 font-medium">{product.productName}</td>
                        <td className="px-4 py-3">{product.sku}</td>
                        <td className="px-4 py-3">{categoryName(product.category)}</td>
                        <td className="px-4 py-3">{product.currentStock}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-x-3 gap-y-1">
                            <Link
                              className="font-medium text-stock-primary-blue hover:underline"
                              to={`/products/${product._id}`}
                            >
                              View
                            </Link>
                            {canManage && (
                              <>
                                <Link
                                  className="font-medium text-stock-primary-blue hover:underline"
                                  to={`/products/${product._id}/edit`}
                                >
                                  Edit
                                </Link>
                                <button
                                  type="button"
                                  onClick={() => void deleteProduct(product)}
                                  className="font-medium text-red-700 hover:underline"
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
          </section>

          <div className="flex flex-col gap-3 text-sm text-stock-secondary-text sm:flex-row sm:items-center sm:justify-between">
            <p>
              {totalPages > 0 ? `Page ${page} of ${totalPages}` : "No pages"} ·{" "}
              {products.length} on this page
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={loading || page <= 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                className="h-10 rounded-lg border border-stock-border bg-white px-3 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={loading || page >= totalPages}
                onClick={() => setPage((value) => value + 1)}
                className="h-10 rounded-lg border border-stock-border bg-white px-3 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
