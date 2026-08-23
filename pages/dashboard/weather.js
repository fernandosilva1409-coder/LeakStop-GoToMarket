import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Sun, Cloud, CloudFog, CloudRain, CloudSnow, CloudLightning, TrendingUp, TrendingDown, Sparkles } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { useRestaurant } from "../../lib/useRestaurant";
import { useDetectedLanguage } from "../../lib/landingCopy";
import { getDashCopy } from "../../lib/dashboardCopy";
import { useWeatherAnalytics } from "../../lib/useWeatherAnalytics";
import { computeWeatherCorrelation, computeDishWeatherSensitivity } from "../../lib/weatherAnalytics";
import { num } from "../../lib/calculations";
import { weatherCondition, tempBand } from "../../lib/weather";
import PageShell from "../../components/ui/PageShell";
import Card from "../../components/ui/Card";
import StatCard from "../../components/ui/StatCard";
import SimpleBarChart from "../../components/ui/SimpleBarChart";

const CONDITION_ICONS = { clear: Sun, cloudy: Cloud, fog: CloudFog, rain: CloudRain, snow: CloudSnow, storm: CloudLightning, unknown: Cloud };
const RANGES = ["30", "90", "365", "all"];

function cutoffDate(rangeDays) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - rangeDays);
  return d.toISOString().slice(0, 10);
}

export default function WeatherPage() {
  const { restaurant, loading: restaurantLoading, error: restaurantError } = useRestaurant();
  const browserLang = useDetectedLanguage();
  const lang = restaurant?.language || browserLang;
  const dash = getDashCopy(lang);
  const t = dash.weather;
  const currency = restaurant?.currency || "EUR";
  const [range, setRange] = useState("all");

  const { data, loading } = useWeatherAnalytics(restaurant);

  const [proposal, setProposal] = useState(null);
  const [proposalLoading, setProposalLoading] = useState(false);
  const [proposalError, setProposalError] = useState("");

  useEffect(() => {
    if (!restaurant || !data?.hasLocation || !data?.hasData) return;
    let active = true;
    (async () => {
      setProposalLoading(true);
      setProposalError("");
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch("/api/weather-proposal", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
          body: JSON.stringify({ restaurantId: restaurant.id }),
        });
        const body = await res.json();
        if (!active) return;
        if (!res.ok) { setProposalError(body.error || t.proposalError); return; }
        setProposal(body.proposal);
      } catch {
        if (active) setProposalError(t.proposalError);
      }
      if (active) setProposalLoading(false);
    })();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurant?.id, data?.hasLocation, data?.hasData]);

  const [catFilter, setCatFilter] = useState("All");

  const { byCondition, byTemperature, sensitivity } = useMemo(() => {
    if (!data?.sales) return { byCondition: [], byTemperature: [], sensitivity: [] };
    let sales = data.sales;
    let weather = data.weather;
    if (range !== "all") {
      const cutoff = cutoffDate(Number(range));
      sales = sales.filter((s) => s.date >= cutoff);
      weather = weather.filter((w) => w.date >= cutoff);
    }
    const correlation = computeWeatherCorrelation(sales, weather, data.dishInfoByName);
    // Default view ("All") skips whatever categories the restaurant already
    // excluded from analytics in Settings (typically drinks/bottles, where
    // this whole model doesn't apply) — picking a specific category
    // overrides that, since asking for it explicitly is a clear signal.
    const sensitivityOpts = catFilter === "All"
      ? { excludedCategories: data.excludedCategories }
      : { category: catFilter };
    return { ...correlation, sensitivity: computeDishWeatherSensitivity(sales, weather, data.dishInfoByName, sensitivityOpts) };
  }, [data, range, catFilter]);

  const overallAvgRevenuePerDay = useMemo(() => {
    if (!byCondition.length) return 0;
    const totalRevenue = byCondition.reduce((s, r) => s + r.totalRevenue, 0);
    const totalDays = byCondition.reduce((s, r) => s + r.days, 0);
    return totalDays ? totalRevenue / totalDays : 0;
  }, [byCondition]);

  const deltaPct = (avgRevenuePerDay) =>
    overallAvgRevenuePerDay ? Math.round(((avgRevenuePerDay - overallAvgRevenuePerDay) / overallAvgRevenuePerDay) * 100) : 0;

  if (restaurantLoading) return <p className="p-10 text-muted">{dash.common.loading}</p>;
  if (restaurantError) return <p className="p-10 text-danger-text">{restaurantError}</p>;

  const forecast = data?.forecast || [];

  return (
    <PageShell lang={lang}>
      <h1 className="text-2xl font-bold text-heading">{t.title}</h1>
      <p className="mt-1 text-sm text-muted">{t.subtitle}</p>

      {loading ? (
        <p className="mt-6 text-sm text-muted">{dash.common.loading}</p>
      ) : !data?.hasLocation ? (
        <Card className="mt-6">
          <p className="font-semibold text-heading">{t.noLocationTitle}</p>
          <p className="mt-1 text-sm text-muted">{t.noLocationBody}</p>
          <Link href="/dashboard/settings" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brass hover:text-brass-dark">
            {t.noLocationCta}
          </Link>
        </Card>
      ) : !data?.hasData ? (
        <Card className="mt-6">
          <p className="text-sm text-muted">{t.notEnoughData}</p>
        </Card>
      ) : (
        <>
          <div className="mt-6 flex flex-wrap gap-2">
            {RANGES.map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                  range === r ? "bg-gradient-to-br from-brass-light to-brass text-heading" : "bg-surface-card text-muted shadow-soft hover:text-heading"
                }`}
              >
                {t.rangeLabels[r]}
              </button>
            ))}
          </div>

          {(proposalLoading || proposal || proposalError) && (
            <Card className="mt-4 border border-brass/20 bg-gradient-to-br from-surface-card to-brass/5">
              <div className="flex items-center gap-2">
                <Sparkles size={15} className="text-brass" />
                <p className="font-mono text-xs font-semibold uppercase tracking-wide text-brass">{t.proposalTitle}</p>
              </div>
              {proposalLoading ? (
                <p className="mt-2 text-sm text-muted">{t.proposalLoading}</p>
              ) : proposalError ? (
                <p className="mt-2 text-sm text-muted">{proposalError}</p>
              ) : (
                <p className="mt-2 text-sm leading-relaxed text-heading">{proposal}</p>
              )}
            </Card>
          )}

          {byCondition.length > 0 && (
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <StatCard
                icon={TrendingUp} tone="good" label={t.bestDayLabel}
                value={`${t.conditionLabels[byCondition[0].label] || byCondition[0].label} · ${t.vsAverage(deltaPct(byCondition[0].avgRevenuePerDay))}`}
              />
              <StatCard
                icon={TrendingDown} tone="danger" label={t.worstDayLabel}
                value={`${t.conditionLabels[byCondition[byCondition.length - 1].label] || byCondition[byCondition.length - 1].label} · ${t.vsAverage(deltaPct(byCondition[byCondition.length - 1].avgRevenuePerDay))}`}
              />
            </div>
          )}

          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <p className="mb-4 font-mono text-xs font-semibold uppercase tracking-wide text-brass">{t.conditionChartTitle}</p>
              <SimpleBarChart
                items={byCondition.map((r) => ({ label: t.conditionLabels[r.label] || r.label, value: r.avgRevenuePerDay }))}
                money currency={currency} valueLabel={t.revenuePerDay} categorical
              />
            </Card>
            <Card>
              <p className="mb-4 font-mono text-xs font-semibold uppercase tracking-wide text-brass">{t.temperatureChartTitle}</p>
              <SimpleBarChart
                items={byTemperature.map((r) => ({ label: t.tempBandLabels[r.label] || r.label, value: r.avgRevenuePerDay }))}
                money currency={currency} valueLabel={t.revenuePerDay} categorical
              />
            </Card>
          </div>

          <Card className="mt-6">
            <p className="font-mono text-xs font-semibold uppercase tracking-wide text-brass">{t.sensitivityTitle}</p>
            <p className="mt-1 text-sm text-muted">{t.sensitivityHint}</p>
            {data?.categories?.length > 0 && (
              <div className="mb-4 mt-3 flex flex-wrap gap-2">
                <button
                  onClick={() => setCatFilter("All")}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${catFilter === "All" ? "bg-gradient-to-br from-brass-light to-brass text-heading" : "bg-surface-sunken text-muted hover:text-heading"}`}
                >
                  {dash.recommendations.allCategories}
                </button>
                {data.categories.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCatFilter(c)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${catFilter === c ? "bg-gradient-to-br from-brass-light to-brass text-heading" : "bg-surface-sunken text-muted hover:text-heading"}`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
            {sensitivity.length === 0 ? (
              <p className="text-sm text-muted">{t.sensitivityEmpty}</p>
            ) : (
              <div className="space-y-2">
                {sensitivity.map((d) => (
                  <div key={d.dish} className="flex items-center justify-between gap-3 rounded-xl bg-surface-sunken px-3.5 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-heading">{d.dish}</p>
                      <p className="text-xs text-muted">
                        {t.bestIn} {t.conditionLabels[d.best.condition] || d.best.condition} ({num(d.best.avgUnitsPerDay, 1)} {t.unitsPerDay})
                        {" · "}
                        {t.worstIn} {t.conditionLabels[d.worst.condition] || d.worst.condition} ({num(d.worst.avgUnitsPerDay, 1)} {t.unitsPerDay})
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-brass/10 px-2.5 py-1 font-mono text-xs font-semibold text-brass">
                      -{num(d.swingPct, 0)}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="mt-6">
            <p className="font-mono text-xs font-semibold uppercase tracking-wide text-brass">{t.forecastTitle}</p>
            <p className="mt-1 text-sm text-muted">{t.forecastHint}</p>
            <p className="mb-4 mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-semibold">
              <span className="text-good">↑ {t.boostLabel}</span>
              <span className="text-danger-text">↓ {t.trimLabel}</span>
            </p>
            {forecast.length === 0 ? (
              <p className="text-sm text-muted">{t.forecastEmpty}</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
                {forecast.map((day) => {
                  const cond = weatherCondition(day.code);
                  const Icon = CONDITION_ICONS[cond] || Cloud;
                  const histRow = byCondition.find((r) => r.label === cond);
                  // This restaurant's history may have zero days of a forecasted
                  // condition (e.g. Lisbon rarely logs a "storm" day) — fall back
                  // to the temperature band, which has denser coverage, rather
                  // than leaving the day with no signal at all.
                  const tempRow = !histRow ? byTemperature.find((r) => r.label === tempBand(day.tempMax)) : null;
                  const deltaSource = histRow || tempRow;
                  const pct = deltaSource ? deltaPct(deltaSource.avgRevenuePerDay) : null;
                  const boosts = sensitivity.filter((d) => d.best.condition === cond).slice(0, 2);
                  const trims = sensitivity.filter((d) => d.worst.condition === cond).slice(0, 2);
                  return (
                    <div key={day.date} className="rounded-xl bg-surface-sunken p-3">
                      <p className="font-mono text-[11px] uppercase tracking-wide text-muted">
                        {new Date(`${day.date}T00:00:00`).toLocaleDateString(lang, { weekday: "short", day: "numeric", month: "short" })}
                      </p>
                      <Icon size={22} className="mt-1.5 text-brass" />
                      <p className="mt-1 text-xs text-heading">{t.conditionLabels[cond] || cond}</p>
                      <p className="text-xs text-muted">{Math.round(day.tempMin)}° / {Math.round(day.tempMax)}°</p>
                      {pct !== null ? (
                        <>
                          <p className={`mt-1.5 font-mono text-xs font-semibold ${pct >= 0 ? "text-good" : "text-danger-text"}`}>
                            {t.vsAverage(pct)}
                          </p>
                          {tempRow && <p className="text-[10px] text-muted">{t.forecastTempFallback}</p>}
                        </>
                      ) : (
                        <p className="mt-1.5 text-[11px] text-muted">{t.forecastNoHistory}</p>
                      )}
                      {boosts.length > 0 && (
                        <p className="mt-2 truncate text-[11px] text-good" title={`${t.boostLabel}: ${boosts.map((d) => d.dish).join(", ")}`}>
                          ↑ {boosts.map((d) => d.dish).join(", ")}
                        </p>
                      )}
                      {trims.length > 0 && (
                        <p className="truncate text-[11px] text-danger-text" title={`${t.trimLabel}: ${trims.map((d) => d.dish).join(", ")}`}>
                          ↓ {trims.map((d) => d.dish).join(", ")}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </>
      )}
    </PageShell>
  );
}
