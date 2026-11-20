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

function relationId(relation: string | { _id: string } | undefined): string {
  return typeof relation === "string" ? relation : relation?._id ?? "";
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
      setCategoryLoadState({ status: "error", message: "Select a workspace first." });
      setSupplierLoadState({ status: "error", message: "Select a workspace first." });
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
    apiRequest<SupplierListResponse>(`/suppliers?${suppliersQuery.toString()}`)
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
          minimumStockThreshold: String(product.minimumStockThreshold ?? 0),
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
          isEdit ? "Unable to update the product." : "Unable to create the product."
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
          className="inline-flex h-10 items-center justify-center rounded-lg border border-stock-border bg-white px-4 text-sm font-medium text-stock-primary-text hover:border-stock-primary-blue"
        >
          Back to Products
        </Link>
      }
    >
      {!workspace?.id ? (
        <section className="rounded-xl border border-stock-border bg-white p-5 sm:p-6">
          <p className="text-sm text-stock-secondary-text">
            Select a business workspace before editing products.
          </p>
          <Link
            to="/workspaces"
            className="mt-4 inline-flex h-10 items-center justify-center rounded-lg bg-stock-primary-blue px-4 text-sm font-semibold text-white"
          >
            Select workspace
          </Link>
        </section>
      ) : (
        <div className="mx-auto max-w-3xl rounded-xl border border-stock-border bg-white p-5 shadow-sm sm:p-8">
          {loading && (
            <p role="status" className="mb-5 text-sm text-stock-secondary-text">
              Loading product information...
            </p>
          )}

          {(categoryLoadState.status === "error" ||
            productLoadState.status === "error") && (
            <div
              role="alert"
              className="mb-5 flex flex-col gap-3 rounded-lg border border-red-200 bg-red-50 p-4 sm:flex-row sm:items-center sm:justify-between"
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
                className="h-10 shrink-0 rounded-lg border border-red-300 px-4 text-sm font-semibold text-red-800"
              >
                Retry
              </button>
            </div>
          )}

          {supplierLoadState.status === "error" && (
            <p
              role="status"
              className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
            >
              Supplier selection is unavailable: {supplierLoadState.message}
              {isEdit ? " The existing supplier will be preserved." : ""}
            </p>
          )}

          {categoryLoadState.status === "loaded" && categories.length === 0 && (
            <p
              role="status"
              className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
            >
              This workspace has no categories. A category is required to save a
              product.
            </p>
          )}

          {submitError && (
            <div
              role="alert"
              className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {submitError}
            </div>
          )}

          {recordReady && (
            <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
              <div className="grid gap-5 sm:grid-cols-2">
                <FormField
                  id="productName"
                  label="Product name"
                  autoComplete="off"
                  error={errors.productName?.message}
                  {...register("productName")}
                />
                <FormField
                  id="sku"
                  label="SKU"
                  autoComplete="off"
                  error={errors.sku?.message}
                  {...register("sku")}
                />
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <FormField
                  id="barcode"
                  label="Barcode"
                  error={errors.barcode?.message}
                  {...register("barcode")}
                />
                <FormField
                  id="category"
                  label="Category"
                  error={errors.category?.message}
                >
                  <select
                    id="category"
                    className={[
                      "h-11 w-full rounded-lg border bg-white px-3 text-sm text-stock-primary-text outline-none focus:border-stock-primary-blue focus:ring-2 focus:ring-stock-primary-blue/15",
                      errors.category ? "border-red-500" : "border-stock-border",
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
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <FormField
                  id="brand"
                  label="Brand"
                  error={errors.brand?.message}
                  {...register("brand")}
                />
                <FormField id="supplier" label="Supplier">
                  <select
                    id="supplier"
                    disabled={supplierLoadState.status !== "loaded"}
                    className="h-11 w-full rounded-lg border border-stock-border bg-white px-3 text-sm text-stock-primary-text disabled:bg-stock-light-grey"
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

              <div className="grid gap-5 sm:grid-cols-2">
                <FormField
                  id="purchasePrice"
                  label={`Purchase price (${workspace.currency})`}
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  error={errors.purchasePrice?.message}
                  {...register("purchasePrice")}
                />
                <FormField
                  id="sellingPrice"
                  label={`Selling price (${workspace.currency})`}
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  error={errors.sellingPrice?.message}
                  {...register("sellingPrice")}
                />
              </div>

              <div className="rounded-lg border border-stock-border bg-stock-light-grey px-4 py-3 text-sm leading-6 text-stock-secondary-text">
                Current stock is read-only here and is managed through
                Inventory. Opening stock can be added only through Excel/CSV
                product import.
              </div>

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

              <FormField
                id="productDescription"
                label="Product description"
                error={errors.productDescription?.message}
              >
                <textarea
                  id="productDescription"
                  rows={4}
                  className="w-full rounded-lg border border-stock-border bg-white px-3 py-2.5 text-sm text-stock-primary-text outline-none focus:border-stock-primary-blue focus:ring-2 focus:ring-stock-primary-blue/15"
                  {...register("productDescription")}
                />
              </FormField>

              <div className="flex flex-col-reverse gap-3 border-t border-stock-border pt-5 sm:flex-row sm:justify-end">
                <Link
                  to="/products"
                  className="inline-flex h-11 items-center justify-center rounded-lg border border-stock-border px-4 text-sm font-medium text-stock-primary-text"
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
                  className="h-11 rounded-lg bg-stock-primary-blue px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting
                    ? "Saving..."
                    : isEdit
                      ? "Update Product"
                      : "Save Product"}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </AppShell>
  );
}
