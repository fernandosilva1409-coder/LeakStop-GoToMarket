import { useEffect, useState } from "react";
import { Globe, CircleDollarSign } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { useRestaurant } from "../../lib/useRestaurant";
import { LANGUAGES, useDetectedLanguage } from "../../lib/landingCopy";
import { CURRENCY_SYMBOLS } from "../../lib/calculations";
import { getDashCopy } from "../../lib/dashboardCopy";
import DashboardNav from "../../components/DashboardNav";

const CURRENCIES = Object.keys(CURRENCY_SYMBOLS);

export default function SettingsPage() {
  const { restaurant, loading: restaurantLoading, error: restaurantError } = useRestaurant();
  const [language, setLanguage] = useState("pt");
  const [currency, setCurrency] = useState("EUR");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saved, setSaved] = useState(false);

  const browserLang = useDetectedLanguage();
  const lang = restaurant?.language || browserLang;
  const dash = getDashCopy(lang);
  const t = dash.settings;

  useEffect(() => {
    if (!restaurant) return;
    setLanguage(restaurant.language || "pt");
    setCurrency(restaurant.currency || "EUR");
  }, [restaurant]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveError("");
    setSaved(false);
    const { error } = await supabase.from("restaurants").update({ language, currency }).eq("id", restaurant.id);
    setSaving(false);
    if (error) { setSaveError(error.message); return; }
    setSaved(true);
  };

  if (restaurantLoading) return <p className="p-10 text-muted">{dash.common.loading}</p>;
  if (restaurantError) return <p className="p-10 text-danger-text">{restaurantError}</p>;

  return (
    <div className="min-h-screen bg-ink-bg">
      <DashboardNav lang={lang} />
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-bold text-paper">{t.title}</h1>
        <p className="mt-1 text-sm text-muted">{t.subtitle}</p>

        <form onSubmit={handleSubmit} className="mt-6 rounded-xl border border-ink-border bg-ink-panel p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-muted">
                <Globe size={13} /> {t.language}
              </span>
              <select
                value={language} onChange={(e) => setLanguage(e.target.value)}
                className="rounded-lg border border-ink-border2 bg-ink-bg px-3 py-2 text-sm text-paper focus:border-brass focus:outline-none"
              >
                {LANGUAGES.map(({ code, label }) => (
                  <option key={code} value={code}>{label}</option>
                ))}
              </select>
              <span className="text-xs text-faint">{t.languageHint}</span>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-muted">
                <CircleDollarSign size={13} /> {t.currency}
              </span>
              <select
                value={currency} onChange={(e) => setCurrency(e.target.value)}
                className="rounded-lg border border-ink-border2 bg-ink-bg px-3 py-2 text-sm text-paper focus:border-brass focus:outline-none"
              >
                {CURRENCIES.map((code) => (
                  <option key={code} value={code}>{code} ({CURRENCY_SYMBOLS[code]})</option>
                ))}
              </select>
              <span className="text-xs text-faint">{t.currencyHint}</span>
            </label>
          </div>

          {saveError && <p className="mt-4 text-sm text-danger-text">{saveError}</p>}
          {saved && <p className="mt-4 text-sm text-good">{dash.common.saved}</p>}
          <button
            type="submit" disabled={saving}
            className="mt-4 rounded-lg bg-brass px-4 py-2 text-sm font-semibold text-ink-bg hover:bg-brass-light disabled:opacity-60"
          >
            {saving ? dash.common.saving : dash.common.save}
          </button>
        </form>
      </div>
    </div>
  );
}
