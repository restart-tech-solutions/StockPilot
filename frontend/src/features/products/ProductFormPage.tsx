
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router-dom";
import { z } from "zod";
import { AppShell } from "../../components/layout/AppShell";
import { FormField } from "../../components/ui/FormField";
import { apiRequest, StockPilotApiError } from "../../services/api";
import { useWorkspace } from "../workspace/workspaceContext";

interface CategoryOption {
  _id: string;
  categoryName: string;
}

interface SupplierOption {
  _id: string;
  supplierName: string;
}

interface CategoryListResponse {
  success: boolean;
  categories: CategoryOption[];
}

interface SupplierListResponse {
  success: boolean;
  suppliers: SupplierOption[];
}

interface ProductRecord {
  _id: string;
  productName: string;
  sku: string;
  barcode?: string;
  category: string | { _id: string };
  brand?: string;
  purchasePrice: number;
  sellingPrice: number;
  minimumStockThreshold: number;
  supplier?: string | { _id: string };
  productDescription?: string;
}

interface ProductDetailsResponse {
  success: boolean;
  product: ProductRecord;
}

interface SaveProductResponse {
  success: boolean;
  message: string;
  data: ProductRecord;
}

const requiredNonNegativeNumber = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .refine(
      (value) => Number.isFinite(Number(value)) && Number(value) >= 0,
      `${label} must be a non-negative number`
    );

const optionalNonNegativeNumber = z
  .string()
  .optional()
  .refine(
    (value) =>
      value === undefined ||
      value.trim() === "" ||
      (Number.isFinite(Number(value)) && Number(value) >= 0),
    "Minimum stock threshold must be a non-negative number"
  );

const productSchema = z.object({
  productName: z.string().trim().min(1, "Product name is required"),
  sku: z.string().trim().min(1, "SKU is required"),
  category: z.string().min(1, "Category is required"),
  barcode: z.string().trim().optional(),
  brand: z.string().trim().optional(),
  purchasePrice: requiredNonNegativeNumber("Purchase price"),
  sellingPrice: requiredNonNegativeNumber("Selling price"),
  minimumStockThreshold: optionalNonNegativeNumber,
  supplier: z.string().optional(),
  productDescription: z.string().trim().optional(),
});

type ProductFormValues = z.infer<typeof productSchema>;

type CategoryLoadState =
  | { status: "loading" }
  | { status: "loaded"; categories: CategoryOption[] }
  | { status: "error"; message: string };

type SupplierLoadState =
  | { status: "loading" }
  | { status: "loaded"; suppliers: SupplierOption[] }
  | { status: "error"; message: string };

type ProductLoadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "loaded" }
  | { status: "error"; message: string };

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof StockPilotApiError ? error.message : fallback;
}

function relationId(
  relation: string | { _id: string } | undefined
): string {
  return typeof relation === "string" ? relation : relation?._id ?? "";
}

function FormSection({
  number,
  title,
  description,
  children,
}: {
  number: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-5">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-sm font-bold text-stock-primary-blue">
          {number}
        </div>
        <div>
          <h3 className="text-base font-bold text-stock-primary-text">
            {title}
          </h3>
          <p className="mt-1 text-sm text-stock-secondary-text">
            {description}
          </p>
        </div>
      </div>
      {children}
    </section>
  );
}

export function ProductCreatePage() {
  const { productId } = useParams();
  const isEdit = Boolean(productId);
  const navigate = useNavigate();
  const { workspace } = useWorkspace();

  const [categoryLoadState, setCategoryLoadState] =
    useState<CategoryLoadState>({ status: "loading" });

  const [supplierLoadState, setSupplierLoadState] =
    useState<SupplierLoadState>({ status: "loading" });

  const [productLoadState, setProductLoadState] =
    useState<ProductLoadState>({ status: "idle" });

  const [submitError, setSubmitError] = useState("");
  const [loadRetry, setLoadRetry] = useState(0);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      productName: "",
      sku: "",
      category: "",
      barcode: "",
      brand: "",
      purchasePrice: "",
      sellingPrice: "",
      minimumStockThreshold: "",
      supplier: "",
      productDescription: "",
    },
  });

  useEffect(() => {
    if (!workspace?.id) {
      setCategoryLoadState({
        status: "error",
        message: "Select a workspace first.",
      });
      setSupplierLoadState({
        status: "error",
        message: "Select a workspace first.",
      });
      return;
    }

    let active = true;

    setCategoryLoadState({ status: "loading" });
    setSupplierLoadState({ status: "loading" });

    apiRequest<CategoryListResponse>(
      `/categories?businessId=${encodeURIComponent(workspace.id)}`
    )
      .then((response) => {
        if (!response.success || !Array.isArray(response.categories)) {
          throw new Error("The category list could not be loaded.");
        }

        if (active) {
          setCategoryLoadState({
            status: "loaded",
            categories: response.categories,
          });
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setCategoryLoadState({
            status: "error",
            message: getErrorMessage(error, "Unable to load categories."),
          });
        }
      });

    const suppliersQuery = new URLSearchParams({
      businessId: workspace.id,
      limit: "100",
    });

    apiRequest<SupplierListResponse>(
      `/suppliers?${suppliersQuery.toString()}`
    )
      .then((response) => {
        if (!response.success || !Array.isArray(response.suppliers)) {
          throw new Error("The supplier list could not be loaded.");
        }

        if (active) {
          setSupplierLoadState({
            status: "loaded",
            suppliers: response.suppliers,
          });
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setSupplierLoadState({
            status: "error",
            message: getErrorMessage(error, "Unable to load suppliers."),
          });
        }
      });

    return () => {
      active = false;
    };
  }, [workspace?.id, loadRetry]);

  useEffect(() => {
    if (!isEdit || !productId || !workspace?.id) {
      setProductLoadState({ status: "idle" });
      return;
    }

    let active = true;

    reset({
      productName: "",
      sku: "",
      category: "",
      barcode: "",
      brand: "",
      purchasePrice: "",
      sellingPrice: "",
      minimumStockThreshold: "",
      supplier: "",
      productDescription: "",
    });

    setProductLoadState({ status: "loading" });

    apiRequest<ProductDetailsResponse>(
      `/products/${encodeURIComponent(productId)}?businessId=${encodeURIComponent(workspace.id)}`
    )
      .then((response) => {
        if (!response.success || !response.product) {
          throw new Error("The product could not be loaded.");
        }

        if (!active) {
          return;
        }

        const product = response.product;

        reset({
          productName: product.productName,
          sku: product.sku,
          category: relationId(product.category),
          barcode: product.barcode ?? "",
          brand: product.brand ?? "",
          purchasePrice: String(product.purchasePrice),
          sellingPrice: String(product.sellingPrice),
          minimumStockThreshold: String(
            product.minimumStockThreshold ?? 0
          ),
          supplier: relationId(product.supplier),
          productDescription: product.productDescription ?? "",
        });

        setProductLoadState({ status: "loaded" });
      })
      .catch((error: unknown) => {
        if (active) {
          setProductLoadState({
            status: "error",
            message: getErrorMessage(error, "Unable to load this product."),
          });
        }
      });

    return () => {
      active = false;
    };
  }, [isEdit, productId, workspace?.id, reset, loadRetry]);

  const categories =
    categoryLoadState.status === "loaded"
      ? categoryLoadState.categories
      : [];

  const suppliers =
    supplierLoadState.status === "loaded"
      ? supplierLoadState.suppliers
      : [];

  const onSubmit = async (values: ProductFormValues) => {
    if (!workspace?.id) {
      setSubmitError("Select a business workspace before saving the product.");
      return;
    }

    setSubmitError("");

    const minimumStockThreshold = values.minimumStockThreshold?.trim();

    const body: Record<string, unknown> = {
      businessId: workspace.id,
      productName: values.productName,
      sku: values.sku,
      category: values.category,
      purchasePrice: Number(values.purchasePrice),
      sellingPrice: Number(values.sellingPrice),
      barcode: values.barcode ?? "",
      brand: values.brand ?? "",
      minimumStockThreshold: minimumStockThreshold
        ? Number(minimumStockThreshold)
        : 0,
      productDescription: values.productDescription ?? "",
    };

    if (supplierLoadState.status === "loaded") {
      body.supplier = values.supplier ?? "";
    }

    try {
      const response = await apiRequest<SaveProductResponse>(
        isEdit && productId
          ? `/products/${encodeURIComponent(productId)}`
          : "/products",
        {
          method: isEdit ? "PUT" : "POST",
          body: JSON.stringify(body),
        }
      );

      if (!response.success || !response.data?._id) {
        throw new Error("The server did not confirm the product update.");
      }

      navigate(`/products/${response.data._id}`);
    } catch (error) {
      setSubmitError(
        getErrorMessage(
          error,
          isEdit
            ? "Unable to update the product."
            : "Unable to create the product."
        )
      );
    }
  };

  const categoryReady =
    categoryLoadState.status === "loaded" && categories.length > 0;

  const recordReady = !isEdit || productLoadState.status === "loaded";

  const loading =
    categoryLoadState.status === "loading" ||
    supplierLoadState.status === "loading" ||
    productLoadState.status === "loading";

  return (
    <AppShell
      mode="business"
      title={isEdit ? "Edit Product" : "Add Product"}
      description={
        isEdit
          ? "Update product information. Stock remains managed through Inventory."
          : "Create a product in the selected business workspace."
      }
      action={
        <Link
          to="/products"
          className="inline-flex h-10 items-center justify-center rounded-xl border border-stock-border bg-white px-4 text-sm font-semibold text-stock-primary-text shadow-sm transition hover:border-stock-primary-blue hover:bg-blue-50"
        >
          ← Back to Products
        </Link>
      }
    >
      {!workspace?.id ? (
        <section className="rounded-2xl border border-stock-border bg-white p-6 shadow-sm">
          <p className="text-sm text-stock-secondary-text">
            Select a business workspace before editing products.
          </p>
          <Link
            to="/workspaces"
            className="mt-4 inline-flex h-10 items-center rounded-xl bg-stock-primary-blue px-4 text-sm font-semibold text-white"
          >
            Select workspace
          </Link>
        </section>
      ) : (
        <div className="mx-auto max-w-5xl space-y-6">
          {/* Form introduction */}
          <section className="rounded-2xl border border-stock-border bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <span className="inline-flex rounded-lg bg-blue-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-stock-primary-blue">
                  Product catalog
                </span>

                <h2 className="mt-3 text-xl font-bold text-stock-primary-text">
                  {isEdit ? "Update product details" : "Product information"}
                </h2>

                <p className="mt-1 max-w-2xl text-sm leading-6 text-stock-secondary-text">
                  {isEdit
                    ? "Keep your product details and pricing accurate."
                    : "Enter the essential details to add a product to your business catalog."}
                </p>
              </div>

              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-2xl text-stock-primary-blue">
                ▦
              </div>
            </div>
          </section>

          {/* Loading */}
          {loading && (
            <div
              role="status"
              className="flex items-center gap-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-800"
            >
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-blue-200 border-t-blue-700" />
              Loading product information...
            </div>
          )}

          {/* Loading errors */}
          {(categoryLoadState.status === "error" ||
            productLoadState.status === "error") && (
            <div
              role="alert"
              className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <p className="text-sm text-red-700">
                {categoryLoadState.status === "error"
                  ? categoryLoadState.message
                  : productLoadState.status === "error"
                    ? productLoadState.message
                    : ""}
              </p>

              <button
                type="button"
                onClick={() => setLoadRetry((count) => count + 1)}
                className="h-10 shrink-0 rounded-lg border border-red-300 px-4 text-sm font-semibold text-red-800 transition hover:bg-red-100"
              >
                Retry
              </button>
            </div>
          )}

          {supplierLoadState.status === "error" && (
            <div
              role="status"
              className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
            >
              <strong>Supplier selection unavailable.</strong>{" "}
              {supplierLoadState.message}
              {isEdit ? " The existing supplier will be preserved." : ""}
            </div>
          )}

          {categoryLoadState.status === "loaded" &&
            categories.length === 0 && (
              <div
                role="status"
                className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
              >
                This workspace has no categories. A category is required to
                save a product. Please create a category first.
                <Link
                  to="/categories"
                  className="ml-1 font-semibold underline"
                >
                  Manage categories
                </Link>
              </div>
            )}

          {/* Form */}
          {recordReady && (
            <form
              className="space-y-6"
              onSubmit={handleSubmit(onSubmit)}
            >
              {/* Basic information */}
              <div className="rounded-2xl border border-stock-border bg-white p-5 shadow-sm sm:p-7">
                <FormSection
                  number="01"
                  title="Basic information"
                  description="Identify and organize your product."
                >
                  <div className="grid gap-5 sm:grid-cols-2">
                    <FormField
                      id="productName"
                      label="Product name *"
                      autoComplete="off"
                      error={errors.productName?.message}
                      {...register("productName")}
                    />

                    <FormField
                      id="sku"
                      label="SKU *"
                      autoComplete="off"
                      error={errors.sku?.message}
                      {...register("sku")}
                    />

                    <FormField
                      id="barcode"
                      label="Barcode"
                      error={errors.barcode?.message}
                      {...register("barcode")}
                    />

                    <FormField
                      id="brand"
                      label="Brand"
                      error={errors.brand?.message}
                      {...register("brand")}
                    />
                  </div>
                </FormSection>
              </div>

              {/* Classification */}
              <div className="rounded-2xl border border-stock-border bg-white p-5 shadow-sm sm:p-7">
                <FormSection
                  number="02"
                  title="Product classification"
                  description="Assign the product to a category and supplier."
                >
                  <div className="grid gap-5 sm:grid-cols-2">
                    <FormField
                      id="category"
                      label="Category *"
                      error={errors.category?.message}
                    >
                      <select
                        id="category"
                        className={[
                          "h-12 w-full rounded-xl border bg-white px-3 text-sm text-stock-primary-text outline-none transition focus:border-stock-primary-blue focus:ring-2 focus:ring-blue-100",
                          errors.category
                            ? "border-red-500"
                            : "border-stock-border",
                        ].join(" ")}
                        disabled={!categoryReady}
                        {...register("category")}
                      >
                        <option value="">Select category</option>
                        {categories.map((category) => (
                          <option key={category._id} value={category._id}>
                            {category.categoryName}
                          </option>
                        ))}
                      </select>
                    </FormField>

                    <FormField id="supplier" label="Supplier">
                      <select
                        id="supplier"
                        disabled={supplierLoadState.status !== "loaded"}
                        className="h-12 w-full rounded-xl border border-stock-border bg-white px-3 text-sm text-stock-primary-text outline-none transition focus:border-stock-primary-blue focus:ring-2 focus:ring-blue-100 disabled:bg-stock-light-grey"
                        {...register("supplier")}
                      >
                        <option value="">No supplier</option>
                        {suppliers.map((supplier) => (
                          <option key={supplier._id} value={supplier._id}>
                            {supplier.supplierName}
                          </option>
                        ))}
                      </select>
                    </FormField>
                  </div>
                </FormSection>
              </div>

              {/* Pricing */}
              <div className="rounded-2xl border border-stock-border bg-white p-5 shadow-sm sm:p-7">
                <FormSection
                  number="03"
                  title="Pricing details"
                  description={`Set the purchase and selling prices in ${workspace.currency}.`}
                >
                  <div className="grid gap-5 sm:grid-cols-2">
                    <FormField
                      id="purchasePrice"
                      label={`Purchase price (${workspace.currency}) *`}
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      error={errors.purchasePrice?.message}
                      {...register("purchasePrice")}
                    />

                    <FormField
                      id="sellingPrice"
                      label={`Selling price (${workspace.currency}) *`}
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      error={errors.sellingPrice?.message}
                      {...register("sellingPrice")}
                    />
                  </div>
                </FormSection>
              </div>

              {/* Inventory settings */}
              <div className="rounded-2xl border border-stock-border bg-white p-5 shadow-sm sm:p-7">
                <FormSection
                  number="04"
                  title="Inventory settings"
                  description="Configure the stock alert threshold for this product."
                >
                  <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                    <div className="flex items-start gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-lg text-stock-primary-blue">
                        i
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-stock-primary-text">
                          Stock quantity is managed separately
                        </p>
                        <p className="mt-1 text-sm leading-6 text-stock-secondary-text">
                          Current stock is read-only here and is managed
                          through Inventory. Opening stock can be added only
                          through Excel/CSV product import.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="max-w-md">
                    <FormField
                      id="minimumStockThreshold"
                      label="Minimum stock threshold"
                      type="number"
                      min="0"
                      step="any"
                      inputMode="decimal"
                      error={errors.minimumStockThreshold?.message}
                      {...register("minimumStockThreshold")}
                    />
                    <p className="mt-2 text-xs text-stock-secondary-text">
                      You can receive low-stock alerts when inventory reaches
                      this threshold.
                    </p>
                  </div>
                </FormSection>
              </div>

              {/* Description */}
              <div className="rounded-2xl border border-stock-border bg-white p-5 shadow-sm sm:p-7">
                <FormSection
                  number="05"
                  title="Product description"
                  description="Add additional information about this product."
                >
                  <FormField
                    id="productDescription"
                    label="Description"
                    error={errors.productDescription?.message}
                  >
                    <textarea
                      id="productDescription"
                      rows={4}
                      placeholder="Write a short description of your product..."
                      className="w-full resize-y rounded-xl border border-stock-border bg-white px-4 py-3 text-sm text-stock-primary-text outline-none transition placeholder:text-slate-400 focus:border-stock-primary-blue focus:ring-2 focus:ring-blue-100"
                      {...register("productDescription")}
                    />
                  </FormField>
                </FormSection>
              </div>

              {/* Submit error */}
              {submitError && (
                <div
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                >
                  {submitError}
                </div>
              )}

              {/* Form actions */}
              <div className="sticky bottom-0 z-10 flex flex-col-reverse gap-3 rounded-2xl border border-stock-border bg-white/95 p-4 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
                <p className="hidden text-xs text-stock-secondary-text sm:block">
                  Fields marked * are required.
                </p>

                <div className="flex flex-col-reverse gap-3 sm:flex-row">
                  <Link
                    to="/products"
                    className="inline-flex h-11 items-center justify-center rounded-xl border border-stock-border bg-white px-5 text-sm font-semibold text-stock-primary-text transition hover:bg-slate-50"
                  >
                    Cancel
                  </Link>

                  <button
                    type="submit"
                    disabled={
                      isSubmitting ||
                      !categoryReady ||
                      (isEdit && productLoadState.status !== "loaded")
                    }
                    className="inline-flex h-11 items-center justify-center rounded-xl bg-stock-primary-blue px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSubmitting
                      ? "Saving..."
                      : isEdit
                        ? "Update Product"
                        : "Save Product"}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      )}
    </AppShell>
  );
}
