import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";
import { AppShell } from "../../components/layout/AppShell";
import { FormField } from "../../components/ui/FormField";
import { apiRequest, StockPilotApiError } from "../../services/api";
import { useWorkspace } from "../workspace/workspaceContext";

interface WarehouseRecord {
  _id: string;
  warehouseName: string;
  address: string;
  city: string;
  contactNumber: string;
}

interface WarehouseResponse {
  success: boolean;
  warehouse: WarehouseRecord;
}

interface WarehouseListResponse {
  success: boolean;
  warehouses: WarehouseRecord[];
}

const warehouseSchema = z.object({
  warehouseName: z.string().trim().min(1, "Warehouse name is required"),
  address: z.string().trim().min(1, "Address is required"),
  city: z.string().trim().min(1, "City is required"),
  contactNumber: z
    .string()
    .trim()
    .regex(/^\+?[0-9][0-9\s().-]{5,19}$/, "Enter a valid contact number"),
});

type WarehouseForm = z.infer<typeof warehouseSchema>;

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof StockPilotApiError ? error.message : fallback;
}

export function WarehouseManagementPage() {
  const { workspace } = useWorkspace();
  const location = useLocation();
  const navigate = useNavigate();

  const [warehouses, setWarehouses] = useState<WarehouseRecord[]>([]);
  const [warehouse, setWarehouse] = useState<WarehouseRecord | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [refresh, setRefresh] = useState(0);

  const segments = location.pathname.split("/").filter(Boolean);
  const isList = segments.length === 1;
  const isCreate = segments[1] === "new";
  const isEdit = segments[2] === "edit";
  const warehouseId =
    segments[1] && segments[1] !== "new" ? segments[1] : "";
  const isDetails = Boolean(warehouseId) && !isEdit;

  const canManage =
    !workspace?.membershipRole ||
    ["BUSINESS_OWNER", "INVENTORY_MANAGER"].includes(
      workspace.membershipRole
    );

  const [form, setForm] = useState<WarehouseForm>({
    warehouseName: "",
    address: "",
    city: "",
    contactNumber: "",
  });

  useEffect(() => {
    if (!workspace?.id) {
      setWarehouses([]);
      return;
    }

    let active = true;
    setLoading(true);
    setError("");

apiRequest<WarehouseListResponse>(
  `/warehouses?businessId=${encodeURIComponent(workspace.id)}`
)      .then((response) => {
        if (!response.success || !Array.isArray(response.warehouses)) {
          throw new Error("Unable to load warehouses.");
        }

        if (active) setWarehouses(response.warehouses);
      })
      .catch((err) => {
        if (active) {
          setError(getErrorMessage(err, "Unable to load warehouses."));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [workspace?.id, refresh]);

  useEffect(() => {
    if (!warehouseId || !workspace?.id) {
      setWarehouse(null);
      return;
    }

    let active = true;
    setLoading(true);
    setError("");

    apiRequest<WarehouseResponse>(
  `/warehouses/${encodeURIComponent(warehouseId)}?businessId=${encodeURIComponent(workspace.id)}`
)
      .then((response) => {
        if (!response.success || !response.warehouse) {
          throw new Error("Warehouse details could not be loaded.");
        }

        if (!active) return;

        setWarehouse(response.warehouse);

        if (isEdit) {
          setForm({
            warehouseName: response.warehouse.warehouseName,
            address: response.warehouse.address,
            city: response.warehouse.city,
            contactNumber: response.warehouse.contactNumber,
          });
        }
      })
      .catch((err) => {
        if (active) {
          setError(getErrorMessage(err, "Unable to load warehouse details."));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [warehouseId, workspace?.id, isEdit, refresh]);

  useEffect(() => {
    if (isCreate) {
      setForm({
        warehouseName: "",
        address: "",
        city: "",
        contactNumber: "",
      });
      setFormError("");
      setError("");
    }
  }, [isCreate]);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!workspace?.id) return;

    const parsed = warehouseSchema.safeParse(form);

    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message || "Check your details.");
      return;
    }

    setSaving(true);
    setFormError("");

    try {
      const response = await apiRequest<WarehouseResponse>(
        isEdit && warehouseId
          ? `/warehouses/${encodeURIComponent(warehouseId)}`
          : "/warehouses",
        {
          method: isEdit ? "PUT" : "POST",
body: JSON.stringify({
  ...parsed.data,
  businessId: workspace.id,
}),        }
      );

      if (!response.success || !response.warehouse?._id) {
        throw new Error("The server did not confirm the warehouse.");
      }

      navigate(`/warehouses/${response.warehouse._id}`);
    } catch (err) {
      setFormError(getErrorMessage(err, "Unable to save warehouse."));
    } finally {
      setSaving(false);
    }
  };

  const deleteWarehouse = async (target: WarehouseRecord) => {
    if (
      !window.confirm(
        `Delete "${target.warehouseName}"? This action cannot be undone.`
      )
    ) {
      return;
    }

    setError("");

    try {
      
      await apiRequest(
  `/warehouses/${encodeURIComponent(target._id)}?businessId=${encodeURIComponent(workspace?.id ?? "")}`,
  { method: "DELETE" }
);
      if (warehouse?._id === target._id) {
        navigate("/warehouses", { replace: true });
      }

      setRefresh((value) => value + 1);
    } catch (err) {
      setError(getErrorMessage(err, "Unable to delete warehouse."));
    }
  };

  const filteredWarehouses = warehouses.filter((item) =>
    [
      item.warehouseName,
      item.city,
      item.address,
      item.contactNumber,
    ]
      .join(" ")
      .toLowerCase()
      .includes(search.trim().toLowerCase())
  );

  const title = isList
    ? "Warehouse Management"
    : isCreate
      ? "Add Warehouse"
      : isEdit
        ? "Edit Warehouse"
        : "Warehouse Details";

  const inputClass =
    "h-11 w-full rounded-lg border border-stock-border bg-white px-3 text-sm text-stock-primary-text";

  return (
    <AppShell
      mode="business"
      title={title}
      description="Manage storage locations and warehouse information."
      action={
        isList && canManage ? (
          <Link
            to="/warehouses/new"
            className="inline-flex h-11 items-center rounded-lg bg-stock-primary-blue px-4 text-sm font-semibold text-white"
          >
            Add Warehouse
          </Link>
        ) : !isList ? (
          <Link
            to="/warehouses"
            className="inline-flex h-10 items-center rounded-lg border border-stock-border bg-white px-4 text-sm font-medium text-stock-primary-text"
          >
            Back to Warehouses
          </Link>
        ) : null
      }
    >
      {!workspace?.id ? (
        <p className="rounded-xl border border-stock-border bg-white p-5 text-sm text-stock-secondary-text">
          Select a business workspace to manage warehouses.
        </p>
      ) : isList ? (
        <div className="space-y-5">
          {error && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
            >
              {error}
              <button
                type="button"
                onClick={() => setRefresh((value) => value + 1)}
                className="ml-3 font-semibold underline"
              >
                Retry
              </button>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-stock-border bg-white p-5">
              <p className="text-sm text-stock-secondary-text">
                Total warehouses
              </p>
              <p className="mt-2 text-2xl font-semibold text-stock-deep-navy">
                {warehouses.length}
              </p>
            </div>
            <div className="rounded-xl border border-stock-border bg-white p-5">
              <p className="text-sm text-stock-secondary-text">
                Cities covered
              </p>
              <p className="mt-2 text-2xl font-semibold text-stock-deep-navy">
                {new Set(warehouses.map((item) => item.city.toLowerCase())).size}
              </p>
            </div>
          </div>

          <input
            type="search"
            aria-label="Search warehouses"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search warehouse, city or contact..."
            className={`${inputClass} sm:max-w-xl`}
          />

          <section className="overflow-hidden rounded-xl border border-stock-border bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[45rem] text-left text-sm">
                <thead className="bg-stock-light-grey text-stock-secondary-text">
                  <tr>
                    {[
                      "Warehouse",
                      "City",
                      "Address",
                      "Contact",
                      "Actions",
                    ].map((heading) => (
                      <th
                        key={heading}
                        scope="col"
                        className="px-4 py-3 font-medium"
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-12 text-center text-stock-secondary-text"
                      >
                        Loading warehouses...
                      </td>
                    </tr>
                  ) : filteredWarehouses.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-12 text-center text-stock-secondary-text"
                      >
                        {search
                          ? "No warehouses match your search."
                          : "No warehouses added yet. Add your first warehouse."}
                      </td>
                    </tr>
                  ) : (
                    filteredWarehouses.map((item) => (
                      <tr
                        key={item._id}
                        className="border-t border-stock-border"
                      >
                        <td className="px-4 py-3 font-medium text-stock-primary-text">
                          {item.warehouseName}
                        </td>
                        <td className="px-4 py-3">{item.city}</td>
                        <td className="max-w-xs truncate px-4 py-3">
                          {item.address}
                        </td>
                        <td className="px-4 py-3">{item.contactNumber}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-3">
                            <Link
                              to={`/warehouses/${item._id}`}
                              className="font-medium text-stock-primary-blue hover:underline"
                            >
                              View
                            </Link>
                            {canManage && (
                              <>
                                <Link
                                  to={`/warehouses/${item._id}/edit`}
                                  className="font-medium text-stock-primary-blue hover:underline"
                                >
                                  Edit
                                </Link>
                                <button
                                  type="button"
                                  onClick={() => void deleteWarehouse(item)}
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
        </div>
      ) : isCreate || isEdit ? (
        <section className="mx-auto max-w-3xl rounded-xl border border-stock-border bg-white p-5 shadow-sm sm:p-8">
          {error && (
            <p role="alert" className="mb-4 text-sm text-red-700">
              {error}
            </p>
          )}
          {formError && (
            <p
              role="alert"
              className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
            >
              {formError}
            </p>
          )}

          <form onSubmit={onSubmit} className="space-y-5">
            <FormField
              id="warehouseName"
              label="Warehouse name"
              value={form.warehouseName}
              onChange={(event) =>
                setForm({ ...form, warehouseName: event.target.value })
              }
            />
            <FormField id="address" label="Address">
              <textarea
                id="address"
                rows={3}
                value={form.address}
                onChange={(event) =>
                  setForm({ ...form, address: event.target.value })
                }
                className="w-full rounded-lg border border-stock-border bg-white px-3 py-2.5 text-sm text-stock-primary-text"
              />
            </FormField>
            <div className="grid gap-5 sm:grid-cols-2">
              <FormField
                id="city"
                label="City"
                value={form.city}
                onChange={(event) =>
                  setForm({ ...form, city: event.target.value })
                }
              />
              <FormField
                id="contactNumber"
                label="Contact number"
                value={form.contactNumber}
                onChange={(event) =>
                  setForm({ ...form, contactNumber: event.target.value })
                }
              />
            </div>
            <div className="flex flex-col-reverse gap-3 border-t border-stock-border pt-5 sm:flex-row sm:justify-end">
              <Link
                to="/warehouses"
                className="inline-flex h-11 items-center justify-center rounded-lg border border-stock-border px-4 text-sm font-medium text-stock-primary-text"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={saving || (isEdit && (loading || !warehouse))}
                className="h-11 rounded-lg bg-stock-primary-blue px-5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {saving
                  ? "Saving..."
                  : isEdit
                    ? "Update Warehouse"
                    : "Create Warehouse"}
              </button>
            </div>
          </form>
        </section>
      ) : (
        <div className="space-y-5">
          {loading && (
            <p role="status" className="rounded-lg bg-white p-5 text-sm">
              Loading warehouse...
            </p>
          )}
          {error && (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </p>
          )}
          {warehouse && (
            <section className="rounded-xl border border-stock-border bg-white p-5 shadow-sm sm:p-8">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <h2 className="text-xl font-semibold text-stock-deep-navy">
                  {warehouse.warehouseName}
                </h2>
                {canManage && (
                  <div className="flex gap-2">
                    <Link
                      to={`/warehouses/${warehouse._id}/edit`}
                      className="inline-flex h-10 items-center rounded-lg bg-stock-primary-blue px-4 text-sm font-semibold text-white"
                    >
                      Edit
                    </Link>
                    <button
                      type="button"
                      onClick={() => void deleteWarehouse(warehouse)}
                      className="h-10 rounded-lg border border-red-300 px-4 text-sm font-semibold text-red-700"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
              <dl className="mt-6 grid gap-5 sm:grid-cols-2">
                <div>
                  <dt className="text-sm text-stock-secondary-text">City</dt>
                  <dd className="mt-1 font-medium">{warehouse.city}</dd>
                </div>
                <div>
                  <dt className="text-sm text-stock-secondary-text">
                    Contact number
                  </dt>
                  <dd className="mt-1 font-medium">
                    {warehouse.contactNumber}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-sm text-stock-secondary-text">
                    Address
                  </dt>
                  <dd className="mt-1 whitespace-pre-wrap font-medium">
                    {warehouse.address}
                  </dd>
                </div>
              </dl>
            </section>
          )}
        </div>
      )}
    </AppShell>
  );
}
