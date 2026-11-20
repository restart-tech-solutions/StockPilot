import { useEffect, useState, type FormEvent } from "react";
import { AppShell } from "../../components/layout/AppShell";
import { apiRequest, StockPilotApiError } from "../../services/api";
import { useWorkspace } from "../workspace/workspaceContext";

interface NotificationPreferences {
  lowStockNotificationsEnabled: boolean;
  outOfStockNotificationsEnabled: boolean;
}

interface PreferencesResponse {
  success: boolean;
  preferences: NotificationPreferences;
}

const defaultPreferences: NotificationPreferences = {
  lowStockNotificationsEnabled: true,
  outOfStockNotificationsEnabled: true,
};

function messageFor(error: unknown, fallback: string): string {
  return error instanceof StockPilotApiError ? error.message : fallback;
}

export function NotificationPreferencesPage() {
  const { workspace } = useWorkspace();
  const [preferences, setPreferences] =
    useState<NotificationPreferences>(defaultPreferences);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const canManage =
    !workspace?.membershipRole ||
    workspace.membershipRole === "BUSINESS_OWNER";

  useEffect(() => {
    if (!workspace?.id) return;
    let active = true;
    setLoading(true);
    setError("");
    apiRequest<PreferencesResponse>(
      `/business/stock-notification-preferences?businessId=${encodeURIComponent(workspace.id)}`
    )
      .then((response) => {
        if (!response.success || !response.preferences) {
          throw new Error("Notification preferences could not be loaded.");
        }
        if (active) setPreferences(response.preferences);
      })
      .catch((loadError: unknown) => {
        if (active && loadError instanceof StockPilotApiError && loadError.status === 404) {
          setPreferences(defaultPreferences);
        } else if (active) {
          setError(messageFor(loadError, "Unable to load notification preferences."));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [workspace?.id]);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!workspace?.id || !canManage) return;
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const response = await apiRequest<PreferencesResponse>(
        "/business/stock-notification-preferences",
        {
          method: "POST",
          body: JSON.stringify({ businessId: workspace.id, ...preferences }),
        }
      );
      if (!response.success || !response.preferences) {
        throw new Error("Notification preferences could not be saved.");
      }
      setPreferences(response.preferences);
      setSaved(true);
    } catch (saveError: unknown) {
      setError(messageFor(saveError, "Unable to save notification preferences."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell
      mode="business"
      title="Notification Preferences"
      description="Choose which stock-alert events create in-app notifications for workspace members."
    >
      <form
        onSubmit={save}
        className="max-w-3xl rounded-xl border border-stock-border bg-white p-4 shadow-sm sm:p-6"
      >
        {error && (
          <div role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        )}
        {saved && (
          <p role="status" className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
            Preferences saved.
          </p>
        )}
        {loading ? (
          <p className="py-8 text-sm text-stock-secondary-text">
            Loading notification preferences...
          </p>
        ) : (
          <>
            <label className="flex items-start gap-3 border-b border-stock-border py-4">
              <input
                type="checkbox"
                checked={preferences.lowStockNotificationsEnabled}
                disabled={!canManage}
                onChange={(event) =>
                  setPreferences((current) => ({
                    ...current,
                    lowStockNotificationsEnabled: event.target.checked,
                  }))
                }
                className="mt-1"
              />
              <span>
                <span className="block font-medium text-stock-deep-navy">
                  Low-stock notifications
                </span>
                <span className="mt-1 block text-sm text-stock-secondary-text">
                  Notify workspace members when stock enters the configured low-stock range and when the alert resolves.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-3 py-4">
              <input
                type="checkbox"
                checked={preferences.outOfStockNotificationsEnabled}
                disabled={!canManage}
                onChange={(event) =>
                  setPreferences((current) => ({
                    ...current,
                    outOfStockNotificationsEnabled: event.target.checked,
                  }))
                }
                className="mt-1"
              />
              <span>
                <span className="block font-medium text-stock-deep-navy">
                  Out-of-stock notifications
                </span>
                <span className="mt-1 block text-sm text-stock-secondary-text">
                  Notify workspace members when stock reaches zero and when it is replenished.
                </span>
              </span>
            </label>
            {canManage ? (
              <button
                type="submit"
                disabled={saving}
                className="mt-3 rounded-lg bg-stock-primary-blue px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save preferences"}
              </button>
            ) : (
              <p className="mt-3 text-sm text-stock-secondary-text">
                Only a business owner can change these preferences.
              </p>
            )}
          </>
        )}
      </form>
    </AppShell>
  );
}
