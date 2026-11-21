import { useEffect, useState } from "react";
import { AppShell } from "../../components/layout/AppShell";
import { apiRequest, StockPilotApiError } from "../../services/api";
import { useWorkspace } from "../workspace/workspaceContext";

interface TaxSettings {
  taxEnabled: boolean;
  taxName: string;
  taxPercentage: number;
  invoicePrefix: string;
  lastInvoiceSequence: number;
}

interface SettingsResponse {
  success: boolean;
  settings: TaxSettings;
}

const defaults: TaxSettings = {
  taxEnabled: false,
  taxName: "GST",
  taxPercentage: 0,
  invoicePrefix: "INV",
  lastInvoiceSequence: 0,
};

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof StockPilotApiError ? error.message : fallback;
}

export function TaxInvoiceSettingsPage() {
  const { workspace } = useWorkspace();

  const [settings, setSettings] = useState<TaxSettings>(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!workspace?.id) {
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setError("");
    setSuccess("");
    setInitialized(false);

    apiRequest<SettingsResponse>("/business/tax-invoice-settings")
      .then((response) => {
        if (!response.success || !response.settings) {
          throw new Error("Unable to load tax settings.");
        }

        if (active) {
          setSettings(response.settings);
          setInitialized(true);
        }
      })
      .catch((err) => {
        if (!active) return;

        if (err instanceof StockPilotApiError && err.status === 404) {
          setSettings(defaults);
          setInitialized(true);
        } else {
          setError(getErrorMessage(err, "Unable to load tax settings."));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [workspace?.id]);

  const updateField = <K extends keyof TaxSettings>(
    field: K,
    value: TaxSettings[K]
  ) => {
    setSettings((current) => ({ ...current, [field]: value }));
    setSuccess("");
  };

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!workspace?.id) return;

    const taxName = settings.taxName.trim();
    const invoicePrefix = settings.invoicePrefix.trim().toUpperCase();

    if (!taxName) {
      setError("Tax name is required.");
      return;
    }

    if (
      !Number.isFinite(settings.taxPercentage) ||
      settings.taxPercentage < 0 ||
      settings.taxPercentage > 100
    ) {
      setError("Tax percentage must be between 0 and 100.");
      return;
    }

    if (!/^[A-Z0-9-]{1,10}$/.test(invoicePrefix)) {
      setError("Invoice prefix must contain 1–10 letters, numbers or hyphens.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await apiRequest<SettingsResponse>(
        "/business/tax-invoice-settings",
        {
          method: "POST",
          body: JSON.stringify({
            taxEnabled: settings.taxEnabled,
            taxName,
            taxPercentage: settings.taxPercentage,
            invoicePrefix,
          }),
        }
      );

      if (!response.success || !response.settings) {
        throw new Error("The server did not confirm the settings.");
      }

      setSettings(response.settings);
      setInitialized(true);
      setSuccess("Tax and invoice settings saved successfully.");
    } catch (err) {
      setError(getErrorMessage(err, "Unable to save settings."));
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "mt-2 h-11 w-full rounded-lg border border-stock-border bg-white px-3 text-sm text-stock-primary-text focus:border-stock-primary-blue focus:outline-none";

  return (
    <AppShell
      mode="business"
      title="Tax & Invoice Settings"
      description="Configure tax details and invoice numbering for your business."
    >
      {!workspace?.id ? (
        <div className="rounded-xl border border-stock-border bg-white p-6 text-sm text-stock-secondary-text">
          Select a business workspace to manage tax and invoice settings.
        </div>
      ) : loading ? (
        <div role="status" className="rounded-xl border border-stock-border bg-white p-6 text-sm text-stock-secondary-text">
          Loading settings...
        </div>
      ) : (
        <div className="mx-auto max-w-4xl space-y-5">
          {error && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          {success && (
            <div role="status" className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
              {success}
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-5">
            <section className="rounded-xl border border-stock-border bg-white p-5 shadow-sm sm:p-7">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold text-stock-deep-navy">
                    Tax Configuration
                  </h2>
                  <p className="mt-1 text-sm text-stock-secondary-text">
                    Enable or disable tax calculations for your business.
                  </p>
                </div>

                <label className="flex cursor-pointer items-center gap-3">
                  <span className="text-sm font-medium text-stock-primary-text">
                    {settings.taxEnabled ? "Enabled" : "Disabled"}
                  </span>
                  <input
                    type="checkbox"
                    checked={settings.taxEnabled}
                    onChange={(event) =>
                      updateField("taxEnabled", event.target.checked)
                    }
                    className="h-5 w-5 accent-blue-600"
                    aria-label="Enable tax"
                  />
                </label>
              </div>

              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-medium text-stock-primary-text">
                    Tax Name
                  </span>
                  <input
                    value={settings.taxName}
                    onChange={(event) =>
                      updateField("taxName", event.target.value)
                    }
                    placeholder="GST"
                    maxLength={40}
                    className={inputClass}
                    required
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-stock-primary-text">
                    Tax Percentage (%)
                  </span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={settings.taxPercentage}
                    onChange={(event) =>
                      updateField(
                        "taxPercentage",
                        event.target.value === ""
                          ? 0
                          : Number(event.target.value)
                      )
                    }
                    className={inputClass}
                    required
                  />
                </label>
              </div>

              {!settings.taxEnabled && (
                <p className="mt-4 rounded-lg bg-stock-light-grey p-3 text-xs text-stock-secondary-text">
                  Tax calculations are disabled. Your saved tax name and
                  percentage will be retained.
                </p>
              )}
            </section>

            <section className="rounded-xl border border-stock-border bg-white p-5 shadow-sm sm:p-7">
              <h2 className="text-base font-semibold text-stock-deep-navy">
                Invoice Configuration
              </h2>
              <p className="mt-1 text-sm text-stock-secondary-text">
                Set the prefix used when generating invoice numbers.
              </p>

              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-medium text-stock-primary-text">
                    Invoice Prefix
                  </span>
                  <input
                    value={settings.invoicePrefix}
                    onChange={(event) =>
                      updateField(
                        "invoicePrefix",
                        event.target.value.toUpperCase()
                      )
                    }
                    placeholder="INV"
                    maxLength={10}
                    className={inputClass}
                    required
                  />
                </label>

                <div>
                  <span className="text-sm font-medium text-stock-primary-text">
                    Last Invoice Sequence
                  </span>
                  <div className="mt-2 flex h-11 items-center rounded-lg border border-stock-border bg-stock-light-grey px-3 text-sm font-medium text-stock-primary-text">
                    {settings.lastInvoiceSequence}
                  </div>
                  <p className="mt-1 text-xs text-stock-secondary-text">
                    Automatically maintained by the server.
                  </p>
                </div>
              </div>

              <div className="mt-5 rounded-lg border border-stock-border p-4">
                <p className="text-xs text-stock-secondary-text">
                  Invoice numbering preview
                </p>
                <p className="mt-1 text-lg font-semibold text-stock-deep-navy">
                  {settings.invoicePrefix || "INV"}-
                  {String(settings.lastInvoiceSequence + 1).padStart(4, "0")}
                </p>
                <p className="mt-1 text-xs text-stock-secondary-text">
                  Preview only. The server controls actual invoice numbering.
                </p>
              </div>
            </section>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving || !initialized}
                className="inline-flex h-11 items-center justify-center rounded-lg bg-stock-primary-blue px-6 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Saving Settings..." : "Save Settings"}
              </button>
            </div>
          </form>
        </div>
      )}
    </AppShell>
  );
}
