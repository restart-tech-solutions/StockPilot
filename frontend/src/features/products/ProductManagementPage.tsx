
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

function stockStatus(product: ProductRecord) {
  if (product.currentStock <= 0) {
    return {
      label: "Out of stock",
      className: "bg-red-50 text-red-700 ring-red-200",
      dotClass: "bg-red-500",
    };
  }

  if (product.currentStock <= product.minimumStockThreshold) {
    return {
      label: "Low stock",
      className: "bg-amber-50 text-amber-700 ring-amber-200",
      dotClass: "bg-amber-500",
    };
  }

  return {
    label: "In stock",
    className: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    dotClass: "bg-emerald-500",
  };
}

function SummaryCard({
  label,
  value,
  description,
  icon,
  iconClass,
}: {
  label: string;
  value: number;
  description: string;
  icon: string;
  iconClass: string;
}) {
  return (
    <div className="rounded-2xl border border-stock-border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-stock-secondary-text">
            {label}
          </p>
          <p className="mt-3 text-3xl font-bold tracking-tight text-stock-primary-text">
            {value.toLocaleString("en-IN")}
          </p>
          <p className="mt-1 text-xs text-stock-secondary-text">
            {description}
          </p>
        </div>

        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg font-bold ${iconClass}`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

export function ProductListPage() {
  const { workspace } = useWorkspace();

  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalProducts, setTotalProducts] = useState(0);
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

  const inStockCount = products.filter(
    (product) => stockStatus(product).label === "In stock"
  ).length;

  const lowStockCount = products.filter(
    (product) => stockStatus(product).label === "Low stock"
  ).length;

  const outOfStockCount = products.filter(
    (product) => stockStatus(product).label === "Out of stock"
  ).length;

  useEffect(() => {
    setProducts([]);
    setPage(1);
    setTotalPages(0);
    setTotalProducts(0);
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
          setTotalProducts(response.pagination.total);
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
      !window.confirm(
        `Delete "${product.productName}"? This cannot be undone.`
      )
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
      setActionError(
        requestError(deleteError, "Unable to delete this product.")
      );
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
              className="inline-flex h-11 items-center justify-center rounded-xl border border-stock-border bg-white px-4 text-sm font-semibold text-stock-primary-text shadow-sm transition hover:border-stock-primary-blue hover:bg-blue-50"
            >
              Import Products
            </Link>

            <Link
              to="/products/new"
              className="inline-flex h-11 items-center justify-center rounded-xl bg-stock-primary-blue px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800"
            >
              + Add Product
            </Link>
          </div>
        ) : null
      }
    >
      {!workspace?.id ? (
        <section className="rounded-2xl border border-stock-border bg-white p-6 shadow-sm">
          <p className="text-sm text-stock-secondary-text">
            Select a business workspace to view products.
          </p>

          <Link
            to="/workspaces"
            className="mt-4 inline-flex h-10 items-center rounded-xl bg-stock-primary-blue px-4 text-sm font-semibold text-white"
          >
            Select workspace
          </Link>
        </section>
      ) : (
        <div className="space-y-6">
          {/* Page introduction */}
          <section className="flex flex-col justify-between gap-4 rounded-2xl border border-stock-border bg-white p-6 shadow-sm sm:flex-row sm:items-center">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-semibold text-stock-primary-blue">
                  INVENTORY
                </span>
                <span className="text-xs text-stock-secondary-text">
                  Product management
                </span>
              </div>

              <h2 className="mt-3 text-2xl font-bold tracking-tight text-stock-primary-text">
                Your product catalog
              </h2>

              <p className="mt-1 max-w-xl text-sm leading-6 text-stock-secondary-text">
                Keep your product information organized and monitor stock
                availability across your business.
              </p>
            </div>

            <div className="hidden rounded-2xl bg-blue-50 p-4 text-3xl text-stock-primary-blue sm:block">
              ▦
            </div>
          </section>

          {/* Summary cards */}
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              label="Total products"
              value={totalProducts}
              description="Across this workspace"
              icon="▦"
              iconClass="bg-blue-50 text-blue-700"
            />

            <SummaryCard
              label="In stock"
              value={inStockCount}
              description="On this page"
              icon="✓"
              iconClass="bg-emerald-50 text-emerald-700"
            />

            <SummaryCard
              label="Low stock"
              value={lowStockCount}
              description="On this page"
              icon="!"
              iconClass="bg-amber-50 text-amber-700"
            />

            <SummaryCard
              label="Out of stock"
              value={outOfStockCount}
              description="On this page"
              icon="×"
              iconClass="bg-red-50 text-red-700"
            />
          </section>

          {/* Alerts */}
          {categoryError && (
            <p
              role="alert"
              className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
            >
              Category filtering is unavailable: {categoryError}
            </p>
          )}

          {actionError && (
            <div
              role="alert"
              className="flex flex-col justify-between gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 sm:flex-row sm:items-center"
            >
              <p>{actionError}</p>
              <button
                type="button"
                onClick={() => setActionError("")}
                className="text-left font-semibold hover:underline sm:text-right"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Product list */}
          <section className="overflow-hidden rounded-2xl border border-stock-border bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-stock-border p-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="text-lg font-bold text-stock-primary-text">
                  All products
                </h3>
                <p className="mt-1 text-sm text-stock-secondary-text">
                  Search, filter and manage your product catalog.
                </p>
              </div>

              <span className="w-fit rounded-full bg-stock-light-grey px-3 py-1.5 text-xs font-semibold text-stock-secondary-text">
                {totalProducts.toLocaleString("en-IN")} products
              </span>
            </div>

            {/* Search and filter */}
            <div className="grid grid-cols-1 gap-3 border-b border-stock-border bg-slate-50/70 p-5 md:grid-cols-[1fr_260px]">
              <label className="relative block">
                <span className="sr-only">Search products</span>
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg text-stock-secondary-text">
                  ⌕
                </span>

                <input
                  type="search"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Search by product name or SKU..."
                  className="h-12 w-full rounded-xl border border-stock-border bg-white pl-10 pr-4 text-sm text-stock-primary-text outline-none transition placeholder:text-slate-400 focus:border-stock-primary-blue focus:ring-2 focus:ring-blue-100"
                />
              </label>

              <label>
                <span className="sr-only">Filter by category</span>
                <select
                  value={categoryId}
                  onChange={(event) => {
                    setCategoryId(event.target.value);
                    setPage(1);
                  }}
                  disabled={Boolean(categoryError)}
                  className="h-12 w-full rounded-xl border border-stock-border bg-white px-3 text-sm text-stock-primary-text outline-none transition focus:border-stock-primary-blue focus:ring-2 focus:ring-blue-100 disabled:bg-stock-light-grey"
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

            {/* Error state */}
            {error && (
              <div
                role="alert"
                className="m-5 flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between"
              >
                <p>{error}</p>
                <button
                  type="button"
                  onClick={() => setRefresh((value) => value + 1)}
                  className="h-10 shrink-0 rounded-lg border border-red-300 px-4 font-semibold transition hover:bg-red-100"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Table */}
            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-stock-secondary-text">
                  <tr>
                    <th scope="col" className="px-5 py-4 font-semibold">
                      Product
                    </th>
                    <th scope="col" className="px-5 py-4 font-semibold">
                      SKU
                    </th>
                    <th scope="col" className="px-5 py-4 font-semibold">
                      Category
                    </th>
                    <th scope="col" className="px-5 py-4 font-semibold">
                      Stock quantity
                    </th>
                    <th scope="col" className="px-5 py-4 font-semibold">
                      Status
                    </th>
                    <th scope="col" className="px-5 py-4 text-right font-semibold">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-stock-border">
                  {loading ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-5 py-16 text-center text-stock-secondary-text"
                      >
                        <div className="flex flex-col items-center gap-3">
                          <div className="h-7 w-7 animate-spin rounded-full border-2 border-blue-200 border-t-stock-primary-blue" />
                          <span className="text-sm font-medium">
                            Loading products...
                          </span>
                        </div>
                      </td>
                    </tr>
                  ) : products.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-16 text-center">
                        <div className="mx-auto flex max-w-sm flex-col items-center">
                          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-3xl text-stock-primary-blue">
                            ▦
                          </div>

                          <h4 className="mt-4 text-base font-bold text-stock-primary-text">
                            {search || categoryId
                              ? "No matching products"
                              : "No products yet"}
                          </h4>

                          <p className="mt-2 text-sm leading-6 text-stock-secondary-text">
                            {search || categoryId
                              ? "Try changing your search or category filter."
                              : "Your product catalog is empty. Add your first product to start managing your inventory."}
                          </p>

                          {canManage && !search && !categoryId && (
                            <Link
                              to="/products/new"
                              className="mt-5 inline-flex h-10 items-center justify-center rounded-xl bg-stock-primary-blue px-4 text-sm font-semibold text-white transition hover:bg-blue-800"
                            >
                              + Add your first product
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    products.map((product) => {
                      const status = stockStatus(product);

                      return (
                        <tr
                          key={product._id}
                          className="text-stock-primary-text transition hover:bg-slate-50"
                        >
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 font-bold text-stock-primary-blue">
                                {product.productName
                                  .charAt(0)
                                  .toUpperCase()}
                              </div>

                              <div className="min-w-0">
                                <p className="truncate font-semibold">
                                  {product.productName}
                                </p>
                                <p className="mt-0.5 text-xs text-stock-secondary-text">
                                  Product
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="px-5 py-4 font-medium text-stock-secondary-text">
                            {product.sku}
                          </td>

                          <td className="px-5 py-4">
                            {categoryName(product.category)}
                          </td>

                          <td className="px-5 py-4">
                            <span className="font-semibold tabular-nums">
                              {product.currentStock.toLocaleString("en-IN")}
                            </span>
                            <span className="ml-1 text-xs text-stock-secondary-text">
                              units
                            </span>
                          </td>

                          <td className="px-5 py-4">
                            <span
                              className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1.5 text-xs font-semibold ring-1 ring-inset ${status.className}`}
                            >
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${status.dotClass}`}
                              />
                              {status.label}
                            </span>
                          </td>

                          <td className="px-5 py-4">
                            <div className="flex items-center justify-end gap-3">
                              <Link
                                className="font-semibold text-stock-primary-blue hover:underline"
                                to={`/products/${product._id}`}
                              >
                                View
                              </Link>

                              {canManage && (
                                <>
                                  <Link
                                    className="font-semibold text-stock-primary-blue hover:underline"
                                    to={`/products/${product._id}/edit`}
                                  >
                                    Edit
                                  </Link>

                                  <button
                                    type="button"
                                    onClick={() => void deleteProduct(product)}
                                    className="font-semibold text-red-600 hover:underline"
                                  >
                                    Delete
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex flex-col gap-3 border-t border-stock-border bg-white px-5 py-4 text-sm sm:flex-row sm:items-center sm:justify-between">
              <p className="text-stock-secondary-text">
                {totalProducts > 0 ? (
                  <>
                    Showing{" "}
                    <span className="font-semibold text-stock-primary-text">
                      {(page - 1) * 10 + 1}–
                      {(page - 1) * 10 + products.length}
                    </span>{" "}
                    of{" "}
                    <span className="font-semibold text-stock-primary-text">
                      {totalProducts.toLocaleString("en-IN")}
                    </span>{" "}
                    products
                  </>
                ) : (
                  "No products to display"
                )}
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={loading || page <= 1}
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                  className="h-10 rounded-xl border border-stock-border bg-white px-4 font-medium text-stock-primary-text transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Previous
                </button>

                <span className="min-w-20 text-center text-xs font-medium text-stock-secondary-text">
                  {totalPages > 0 ? `${page} / ${totalPages}` : "0 / 0"}
                </span>

                <button
                  type="button"
                  disabled={loading || page >= totalPages}
                  onClick={() => setPage((value) => value + 1)}
                  className="h-10 rounded-xl border border-stock-border bg-white px-4 font-medium text-stock-primary-text transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
    </AppShell>
  );
}
