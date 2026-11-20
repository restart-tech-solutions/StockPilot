import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AppShell } from "../../components/layout/AppShell";
import { apiRequest, StockPilotApiError } from "../../services/api";
import { useWorkspace } from "../workspace/workspaceContext";

interface Category {
  _id: string;
  categoryName: string;
  description?: string;
}

interface CategoryListResponse {
  success: boolean;
  categories: Category[];
}

interface CategoryResponse {
  success: boolean;
  message?: string;
  category: Category;
}

function getError(error: unknown, fallback: string): string {
  return error instanceof StockPilotApiError ? error.message : fallback;
}

export function CategoryManagementPage() {
  const { workspace } = useWorkspace();

  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryName, setCategoryName] = useState("");
  const [description, setDescription] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [refresh, setRefresh] = useState(0);

  const canManage =
    !workspace?.membershipRole ||
    ["BUSINESS_OWNER", "INVENTORY_MANAGER"].includes(
      workspace.membershipRole
    );

  useEffect(() => {
    if (!workspace?.id) {
      setCategories([]);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setError("");

    apiRequest<CategoryListResponse>(
      `/categories?businessId=${encodeURIComponent(workspace.id)}`
    )
      .then((response) => {
        if (!response.success || !Array.isArray(response.categories)) {
          throw new Error("Unable to load categories.");
        }

        if (active) {
          setCategories(response.categories);
        }
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(getError(loadError, "Unable to load categories."));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [workspace?.id, refresh]);

  const resetForm = () => {
    setCategoryName("");
    setDescription("");
    setEditingId(null);
  };

  const saveCategory = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!categoryName.trim()) {
      setError("Category name is required.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const payload = {
        categoryName: categoryName.trim(),
        description: description.trim(),
      };

      if (editingId) {
        await apiRequest<CategoryResponse>(
          `/categories/${encodeURIComponent(editingId)}`,
          {
            method: "PUT",
            body: JSON.stringify(payload),
          }
        );
        setSuccess("Category updated successfully.");
      } else {
        await apiRequest<CategoryResponse>("/categories", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setSuccess("Category created successfully.");
      }

      resetForm();
      setRefresh((value) => value + 1);
    } catch (saveError) {
      setError(getError(saveError, "Unable to save category."));
    } finally {
      setSaving(false);
    }
  };

  const editCategory = (category: Category) => {
    setEditingId(category._id);
    setCategoryName(category.categoryName);
    setDescription(category.description || "");
    setError("");
    setSuccess("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const deleteCategory = async (category: Category) => {
    if (
      !window.confirm(
        `Delete "${category.categoryName}"? This action cannot be undone.`
      )
    ) {
      return;
    }

    setError("");
    setSuccess("");

    try {
      await apiRequest(
        `/categories/${encodeURIComponent(category._id)}`,
        { method: "DELETE" }
      );
      setSuccess("Category deleted successfully.");
      if (editingId === category._id) resetForm();
      setRefresh((value) => value + 1);
    } catch (deleteError) {
      setError(getError(deleteError, "Unable to delete category."));
    }
  };

  const filteredCategories = categories.filter((category) =>
    category.categoryName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppShell
      mode="business"
      title="Categories"
      description="Organize and manage your product categories."
      action={
        <Link
          to="/products"
          className="inline-flex h-11 items-center rounded-lg border border-stock-border bg-white px-4 text-sm font-semibold text-stock-primary-text hover:border-stock-primary-blue"
        >
          View Products
        </Link>
      }
    >
      {!workspace?.id ? (
        <section className="rounded-xl border border-stock-border bg-white p-5">
          <p className="text-sm text-stock-secondary-text">
            Select a business workspace to manage categories.
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
          {error && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {error}
            </div>
          )}

          {success && (
            <div
              role="status"
              className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
            >
              {success}
            </div>
          )}

          {canManage && (
            <section className="rounded-xl border border-stock-border bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-stock-primary-text">
                {editingId ? "Edit Category" : "Add New Category"}
              </h2>

              <form onSubmit={saveCategory} className="mt-4 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-stock-primary-text">
                      Category Name *
                    </span>
                    <input
                      type="text"
                      required
                      maxLength={100}
                      value={categoryName}
                      onChange={(event) => setCategoryName(event.target.value)}
                      placeholder="e.g. Electronics"
                      className="h-11 w-full rounded-lg border border-stock-border bg-white px-3 text-sm text-stock-primary-text"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-stock-primary-text">
                      Description
                    </span>
                    <input
                      type="text"
                      maxLength={500}
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      placeholder="Optional description"
                      className="h-11 w-full rounded-lg border border-stock-border bg-white px-3 text-sm text-stock-primary-text"
                    />
                  </label>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="h-11 rounded-lg bg-stock-primary-blue px-5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
                  >
                    {saving
                      ? "Saving..."
                      : editingId
                        ? "Update Category"
                        : "Create Category"}
                  </button>

                  {editingId && (
                    <button
                      type="button"
                      onClick={resetForm}
                      className="h-11 rounded-lg border border-stock-border bg-white px-5 text-sm font-semibold text-stock-primary-text"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </section>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-stock-primary-text">
                All Categories
              </h2>
              <p className="text-sm text-stock-secondary-text">
                {categories.length} categories in this workspace
              </p>
            </div>

            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search categories..."
              className="h-11 w-full rounded-lg border border-stock-border bg-white px-3 text-sm sm:w-72"
            />
          </div>

          <section className="overflow-hidden rounded-xl border border-stock-border bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[35rem] text-left text-sm">
                <thead className="bg-stock-light-grey text-stock-secondary-text">
                  <tr>
                    <th className="px-4 py-3 font-medium">Category Name</th>
                    <th className="px-4 py-3 font-medium">Description</th>
                    {canManage && (
                      <th className="px-4 py-3 font-medium">Actions</th>
                    )}
                  </tr>
                </thead>

                <tbody>
                  {loading ? (
                    <tr>
                      <td
                        colSpan={canManage ? 3 : 2}
                        className="px-4 py-12 text-center text-stock-secondary-text"
                      >
                        Loading categories...
                      </td>
                    </tr>
                  ) : filteredCategories.length === 0 ? (
                    <tr>
                      <td
                        colSpan={canManage ? 3 : 2}
                        className="px-4 py-12 text-center text-stock-secondary-text"
                      >
                        {search
                          ? "No categories match your search."
                          : "No categories added yet. Create your first category above."}
                      </td>
                    </tr>
                  ) : (
                    filteredCategories.map((category) => (
                      <tr
                        key={category._id}
                        className="border-t border-stock-border text-stock-primary-text"
                      >
                        <td className="px-4 py-3 font-medium">
                          {category.categoryName}
                        </td>
                        <td className="px-4 py-3 text-stock-secondary-text">
                          {category.description || "—"}
                        </td>
                        {canManage && (
                          <td className="px-4 py-3">
                            <div className="flex gap-3">
                              <button
                                type="button"
                                onClick={() => editCategory(category)}
                                className="font-medium text-stock-primary-blue hover:underline"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => void deleteCategory(category)}
                                className="font-medium text-red-700 hover:underline"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </AppShell>
  );
}
