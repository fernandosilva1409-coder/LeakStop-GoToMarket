import { useEffect, useState } from "react";
import Link from "next/link";
import { Globe, CircleDollarSign, ChefHat, Plug, ArrowRight, History, Tags, MapPin } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { useRestaurant } from "../../lib/useRestaurant";
import { LANGUAGES, useDetectedLanguage } from "../../lib/landingCopy";
import { CURRENCY_SYMBOLS, catLabel } from "../../lib/calculations";
import { fetchAllRows } from "../../lib/supabaseUtils";
import { getDashCopy } from "../../lib/dashboardCopy";
import PageShell from "../../components/ui/PageShell";
import Card from "../../components/ui/Card";
import Field from "../../components/ui/Field";
import Select from "../../components/ui/Select";
import Input from "../../components/ui/Input";
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
  const [categories, setCategories] = useState([]);
  const [excludedCategories, setExcludedCategories] = useState(new Set());
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [city, setCity] = useState("");
  const [savingLocation, setSavingLocation] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [locationSaved, setLocationSaved] = useState(false);

  const browserLang = useDetectedLanguage();
  const lang = restaurant?.language || browserLang;
  const dash = getDashCopy(lang);
  const t = dash.settings;

  useEffect(() => {
    if (!restaurant) return;
    setLanguage(restaurant.language || "pt");
    setCurrency(restaurant.currency || "EUR");
    setCity(restaurant.city || "");
  }, [restaurant]);

  useEffect(() => {
    if (!restaurant) return;
    (async () => {
      const [dishRows, excludedRows] = await Promise.all([
        fetchAllRows(() => supabase.from("dishes").select("category").eq("restaurant_id", restaurant.id)),
        fetchAllRows(() => supabase.from("excluded_categories").select("category").eq("restaurant_id", restaurant.id)).catch(() => []),
      ]);
      const distinctCategories = Array.from(new Set((dishRows || []).map((d) => catLabel(d.category)))).sort();
      setCategories(distinctCategories);
      setExcludedCategories(new Set((excludedRows || []).map((r) => r.category)));
      setCategoriesLoading(false);
    })();
  }, [restaurant]);

  const toggleCategory = async (cat) => {
    if (!restaurant) return;
    const isExcluded = excludedCategories.has(cat);
    if (isExcluded) {
      await supabase.from("excluded_categories").delete().eq("restaurant_id", restaurant.id).eq("category", cat);
      setExcludedCategories((prev) => { const next = new Set(prev); next.delete(cat); return next; });
    } else {
      await supabase.from("excluded_categories").insert({ restaurant_id: restaurant.id, category: cat });
      setExcludedCategories((prev) => new Set(prev).add(cat));
    }
  };

  const handleSaveLocation = async (e) => {
    e.preventDefault();
    if (!city.trim() || !restaurant) return;
    setSavingLocation(true);
    setLocationError("");
    setLocationSaved(false);
    try {
      const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city.trim())}&count=1&language=${lang}&format=json`);
      const body = await res.json();
      const match = body?.results?.[0];
      if (!match) { setLocationError(t.locationNotFound); setSavingLocation(false); return; }
      const displayCity = [match.name, match.country].filter(Boolean).join(", ");
      const { error } = await supabase
        .from("restaurants")
        .update({ city: displayCity, latitude: match.latitude, longitude: match.longitude })
        .eq("id", restaurant.id);
      if (error) { setLocationError(error.message); setSavingLocation(false); return; }
      setCity(displayCity);
      setLocationSaved(true);
    } catch (err) {
      setLocationError(t.locationNotFound);
    }
    setSavingLocation(false);
  };

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
        <div className="mb-4 flex items-center gap-2">
          <Tags size={15} className="text-brass" />
          <p className="font-mono text-xs font-semibold uppercase tracking-wide text-brass">{t.categoriesTitle}</p>
        </div>
        <p className="mb-4 text-sm text-muted">{t.categoriesHint}</p>
        {categoriesLoading ? (
          <p className="text-sm text-muted">{dash.common.loading}</p>
        ) : categories.length === 0 ? (
          <p className="text-sm text-muted">{t.categoriesEmpty}</p>
        ) : (
          <div className="space-y-2">
            {categories.map((cat) => {
              const included = !excludedCategories.has(cat);
              return (
                <div key={cat} className="flex items-center justify-between gap-3 rounded-xl bg-surface-sunken px-3.5 py-2.5">
                  <span className="text-sm font-medium text-heading">{cat}</span>
                  <button
                    type="button"
                    onClick={() => toggleCategory(cat)}
                    title={included ? t.categoryIncluded : t.categoryExcluded}
                    className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${included ? "bg-brass" : "bg-surface-border"}`}
                  >
                    <span
                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${included ? "translate-x-5" : "translate-x-0.5"}`}
                    />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card className="mt-6">
        <form onSubmit={handleSaveLocation}>
          <Field label={t.locationTitle} icon={MapPin} hint={t.locationHint}>
            <Input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder={t.locationPlaceholder}
            />
          </Field>
          {restaurant.city && (
            <p className="mt-1 text-xs text-muted">{t.locationCity}: {restaurant.city}</p>
          )}
          {locationError && <p className="mt-4 text-sm text-danger-text">{locationError}</p>}
          {locationSaved && <p className="mt-4 text-sm text-good">{dash.common.saved}</p>}
          <Button type="submit" disabled={savingLocation || !city.trim()} className="mt-4">
            {savingLocation ? dash.common.saving : dash.common.save}
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
