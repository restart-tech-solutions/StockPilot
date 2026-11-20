import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { AppShell } from "../../components/layout/AppShell";
import { apiRequest, StockPilotApiError } from "../../services/api";
import { useWorkspace } from "../workspace/workspaceContext";

interface ProductImportResponse {
  success: boolean;
  message: string;
  summary: {
    totalRows: number;
    imported: number;
    failed: number;
  };
  importedProducts: Array<{
    row: number;
    sku: string;
  }>;
  errors: Array<{
    row: number;
    sku?: string;
    message: string;
  }>;
}

const templateColumns = [
  "productName",
  "sku",
  "category",
  "purchasePrice",
  "sellingPrice",
  "barcode",
  "brand",
  "openingStock",
  "minimumStockThreshold",
  "supplier",
  "productDescription",
  "productImage",
];

function downloadProductTemplate() {
  const file = new Blob([`${templateColumns.join(",")}\r\n`], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = "stockpilot-products-template.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function ProductImportPage() {
  const { workspace } = useWorkspace();
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [requestError, setRequestError] = useState("");
  const [result, setResult] = useState<ProductImportResponse | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] ?? null;
    setResult(null);
    setRequestError("");
    setFileError("");

    if (
      nextFile &&
      ![".xlsx", ".xls", ".csv"].some((extension) =>
        nextFile.name.toLowerCase().endsWith(extension)
      )
    ) {
      setFile(null);
      setFileError("Choose an XLSX, XLS, or CSV file.");
      event.target.value = "";
      return;
    }

    setFile(nextFile);
  };

  const startImport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFileError("");
    setRequestError("");
    setResult(null);

    if (!workspace?.id) {
      setRequestError("Select a business workspace before importing products.");
      return;
    }
    if (!file) {
      setFileError("Choose an Excel or CSV file to import.");
      return;
    }

    const formData = new FormData();
    formData.append("businessId", workspace.id);
    formData.append("file", file);

    setIsSubmitting(true);
    try {
      const response = await apiRequest<ProductImportResponse>(
        "/products/import",
        {
          method: "POST",
          body: formData,
        }
      );

      if (!response.success || !response.summary || !Array.isArray(response.errors)) {
        throw new Error("The server did not return a valid product import summary.");
      }

      setResult(response);
      setFile(null);
      if (fileInput.current) {
        fileInput.current.value = "";
      }
    } catch (error) {
      setRequestError(
        error instanceof StockPilotApiError
          ? error.message
          : "Unable to import products."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppShell
      mode="business"
      title="Import Products"
      description="Import products and optional opening stock from an Excel or CSV file."
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
            Select a business workspace before importing products.
          </p>
          <Link
            to="/workspaces"
            className="mt-4 inline-flex h-10 items-center justify-center rounded-lg bg-stock-primary-blue px-4 text-sm font-semibold text-white"
          >
            Select workspace
          </Link>
        </section>
      ) : (
        <div className="mx-auto max-w-3xl space-y-5">
          {(fileError || requestError) && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {fileError || requestError}
            </div>
          )}

          <section className="rounded-xl border border-stock-border bg-white p-5 shadow-sm sm:p-8">
            <form className="space-y-6" onSubmit={startImport}>
              <div>
                <label
                  htmlFor="product-import-file"
                  className="block text-sm font-medium text-stock-primary-text"
                >
                  Upload Excel or CSV file
                </label>
                <input
                  ref={fileInput}
                  id="product-import-file"
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  disabled={isSubmitting}
                  onChange={onFileChange}
                  className="mt-2 block w-full rounded-lg border border-stock-border bg-white text-sm text-stock-primary-text file:mr-4 file:h-11 file:border-0 file:bg-stock-light-grey file:px-4 file:text-sm file:font-medium file:text-stock-primary-text"
                />
                <p className="mt-2 text-sm text-stock-secondary-text">
                  Supported formats: XLSX, XLS, CSV
                  {file && ` · Selected: ${file.name}`}
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-stock-border p-4">
                  <h2 className="text-sm font-semibold text-stock-deep-navy">
                    Required columns
                  </h2>
                  <p className="mt-2 break-words text-sm leading-6 text-stock-secondary-text">
                    productName, sku, category, purchasePrice, sellingPrice
                  </p>
                </div>
                <div className="rounded-lg border border-stock-border p-4">
                  <h2 className="text-sm font-semibold text-stock-deep-navy">
                    Optional columns
                  </h2>
                  <p className="mt-2 break-words text-sm leading-6 text-stock-secondary-text">
                    barcode, brand, openingStock, minimumStockThreshold,
                    supplier, productDescription, productImage
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-stock-border bg-stock-light-grey px-4 py-3 text-sm leading-6 text-stock-secondary-text">
                The category column must contain a category ID from this
                business workspace. Opening stock is recorded through the
                existing audited inventory movement workflow. Supplier is
                optional; when supplied, it must be a supplier ID from this
                workspace.
              </div>

              <button
                type="button"
                onClick={downloadProductTemplate}
                className="text-sm font-semibold text-stock-primary-blue hover:underline"
              >
                Download blank CSV template
              </button>

              <div className="flex flex-col-reverse gap-3 border-t border-stock-border pt-5 sm:flex-row sm:justify-end">
                <Link
                  to="/products"
                  className="inline-flex h-11 items-center justify-center rounded-lg border border-stock-border px-4 text-sm font-medium text-stock-primary-text"
                >
                  Cancel
                </Link>
                <button
                  type="submit"
                  disabled={!file || isSubmitting}
                  className="h-11 rounded-lg bg-stock-primary-blue px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? "Importing..." : "Start Import"}
                </button>
              </div>
            </form>
          </section>

          {result && (
            <section
              role="status"
              className="rounded-xl border border-stock-border bg-white p-5 shadow-sm sm:p-6"
            >
              <h2 className="text-base font-semibold text-stock-deep-navy">
                Import summary
              </h2>
              <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                {[
                  ["Total rows", result.summary.totalRows],
                  ["Imported", result.summary.imported],
                  ["Failed", result.summary.failed],
                ].map(([label, count]) => (
                  <div
                    key={label}
                    className="rounded-lg border border-stock-border bg-stock-light-grey p-4"
                  >
                    <dt className="text-sm text-stock-secondary-text">
                      {label}
                    </dt>
                    <dd className="mt-1 text-xl font-semibold text-stock-deep-navy">
                      {count}
                    </dd>
                  </div>
                ))}
              </dl>

              {result.errors.length > 0 && (
                <div className="mt-5">
                  <h3 className="text-sm font-semibold text-stock-primary-text">
                    Row errors
                  </h3>
                  <div className="mt-3 overflow-x-auto rounded-lg border border-stock-border">
                    <table className="w-full min-w-[32rem] text-left text-sm">
                      <thead className="bg-stock-light-grey text-stock-secondary-text">
                        <tr>
                          <th scope="col" className="px-4 py-3 font-medium">
                            Row
                          </th>
                          <th scope="col" className="px-4 py-3 font-medium">
                            SKU
                          </th>
                          <th scope="col" className="px-4 py-3 font-medium">
                            Error
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.errors.map((rowError, index) => (
                          <tr
                            key={`${rowError.row}-${rowError.sku ?? index}`}
                            className="border-t border-stock-border"
                          >
                            <td className="px-4 py-3">{rowError.row}</td>
                            <td className="px-4 py-3">{rowError.sku || "—"}</td>
                            <td className="px-4 py-3">{rowError.message}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </AppShell>
  );
}
