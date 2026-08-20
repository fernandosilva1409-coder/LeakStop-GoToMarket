import { useEffect, useState } from "react";
import Link from "next/link";
import { Globe, CircleDollarSign, ChefHat, Plug, ArrowRight, History } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { useRestaurant } from "../../lib/useRestaurant";
import { LANGUAGES, useDetectedLanguage } from "../../lib/landingCopy";
import { CURRENCY_SYMBOLS } from "../../lib/calculations";
import { getDashCopy } from "../../lib/dashboardCopy";
import PageShell from "../../components/ui/PageShell";
import Card from "../../components/ui/Card";
import Field from "../../components/ui/Field";
import Select from "../../components/ui/Select";
import Button from "../../components/ui/Button";
import pkg from "../../package.json";

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
    <PageShell lang={lang} className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-heading">{t.title}</h1>
      <p className="mt-1 text-sm text-muted">{t.subtitle}</p>

      <Card className="mt-6">
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t.language} icon={Globe} hint={t.languageHint}>
              <Select value={language} onChange={(e) => setLanguage(e.target.value)}>
                {LANGUAGES.map(({ code, label }) => (
                  <option key={code} value={code}>{label}</option>
                ))}
              </Select>
            </Field>
            <Field label={t.currency} icon={CircleDollarSign} hint={t.currencyHint}>
              <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                {CURRENCIES.map((code) => (
                  <option key={code} value={code}>{code} ({CURRENCY_SYMBOLS[code]})</option>
                ))}
              </Select>
            </Field>
          </div>

          {saveError && <p className="mt-4 text-sm text-danger-text">{saveError}</p>}
          {saved && <p className="mt-4 text-sm text-good">{dash.common.saved}</p>}
          <Button type="submit" disabled={saving} className="mt-4">
            {saving ? dash.common.saving : dash.common.save}
          </Button>
        </form>
      </Card>

      <Card className="mt-6">
        <p className="mb-4 font-mono text-xs font-semibold uppercase tracking-wide text-brass">{t.accountTitle}</p>
        <Field label={t.accountRestaurant} icon={ChefHat}>
          <p className="px-1 py-1.5 text-sm text-heading">{restaurant.name}</p>
        </Field>
        <div className="mt-4 flex items-center justify-between">
          <p className="font-mono text-[11px] text-muted">{t.versionLabel} v{pkg.version}</p>
          <Link href="/dashboard/changelog" className="inline-flex items-center gap-1 text-xs font-semibold text-brass hover:text-brass-dark">
            <History size={13} /> {t.changelogLink}
          </Link>
        </div>
      </Card>

      <Card className="mt-6">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-muted">
            <Plug size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-heading">{t.integrationsTitle}</p>
            <p className="mt-1 text-sm text-muted">{t.integrationsBody}</p>
            <Link href="/dashboard/support" className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-brass hover:text-brass-dark">
              {t.integrationsLink} <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </Card>
    </PageShell>
  );
}
