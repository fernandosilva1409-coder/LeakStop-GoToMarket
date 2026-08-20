import { useState } from "react";
import { AlertTriangle, PackageX, Star, ArrowUpRight, ArrowDownRight, Lightbulb } from "lucide-react";
import { useRestaurant } from "../../lib/useRestaurant";
import { useAnalysis } from "../../lib/useAnalysis";
import { computeRecommendations, formatMoney, catLabel, num } from "../../lib/calculations";
import { useDetectedLanguage } from "../../lib/landingCopy";
import { getDashCopy } from "../../lib/dashboardCopy";
import PageShell from "../../components/ui/PageShell";
import Card from "../../components/ui/Card";
import WarningBanner from "../../components/ui/WarningBanner";

const MATRIX_INFO = {
  star: { icon: Star, tone: "text-good" },
  plowhorse: { icon: ArrowUpRight, tone: "text-brass" },
  puzzle: { icon: Lightbulb, tone: "text-muted" },
  dog: { icon: ArrowDownRight, tone: "text-danger-text" },
};
const CLASSES = ["star", "plowhorse", "puzzle", "dog"];

export default function RecommendationsPage() {
  const { restaurant, loading: restaurantLoading, error: restaurantError } = useRestaurant();
  const { analysis, loading } = useAnalysis(restaurant);
  const [recCat, setRecCat] = useState("All");

  const browserLang = useDetectedLanguage();
  const lang = restaurant?.language || browserLang;
  const dash = getDashCopy(lang);
  const t = dash.recommendations;

  if (restaurantLoading) return <p className="p-10 text-muted">{dash.common.loading}</p>;
  if (restaurantError) return <p className="p-10 text-danger-text">{restaurantError}</p>;

  const currency = restaurant.currency || "EUR";
  const recs = loading || !analysis ? null : computeRecommendations(analysis, currency, lang);

  const recCategories = recs ? Array.from(new Set(recs.matrix.map((d) => catLabel(d.category)))) : [];
  const filteredMatrix = recs ? (recCat === "All" ? recs.matrix : recs.matrix.filter((d) => catLabel(d.category) === recCat)) : [];

  return (
    <PageShell lang={lang}>
      <h1 className="text-2xl font-bold text-heading">{t.title}</h1>

      {loading || !recs ? (
        <p className="mt-6 text-sm text-muted">{dash.common.loading}</p>
      ) : (
        <>
          {recs.matrix.length === 0 && recs.tooSmallCategories.length === 0 && recs.noRecipe.length === 0
            && recs.wasteAlerts.length === 0 && recs.shortageAlerts.length === 0 && (
            <p className="mt-6 text-sm text-muted">
              {t.emptyState}
            </p>
          )}

          {(recs.tooSmallCategories.length > 0 || recs.noRecipe.length > 0) && (
            <div className="mt-6">
              <WarningBanner>
                {recs.tooSmallCategories.length > 0 && <span>{t.smallCategoriesWarning(recs.tooSmallCategories.length)} </span>}
                {recs.noRecipe.length > 0 && <span>{t.noRecipeWarning(recs.noRecipe.length)}</span>}
              </WarningBanner>
            </div>
          )}

          {recs.matrix.length > 0 && (
            <section className={recs.tooSmallCategories.length > 0 || recs.noRecipe.length > 0 ? "" : "mt-6"}>
              <p className="mb-2 font-mono text-xs font-semibold uppercase tracking-wide text-brass">{t.matrixTitle}</p>

              <div className="mb-3 flex flex-wrap gap-2">
                <button
                  onClick={() => setRecCat("All")}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${recCat === "All" ? "bg-gradient-to-br from-brass-light to-brass text-heading" : "bg-surface-card text-muted shadow-soft hover:text-heading"}`}
                >
                  {t.allCategories} ({recs.matrix.length})
                </button>
                {recCategories.map((c) => (
                  <button
                    key={c}
                    onClick={() => setRecCat(c)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${recCat === c ? "bg-gradient-to-br from-brass-light to-brass text-heading" : "bg-surface-card text-muted shadow-soft hover:text-heading"}`}
                  >
                    {c} ({recs.matrix.filter((d) => catLabel(d.category) === c).length})
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {CLASSES.map((g) => {
                  const items = filteredMatrix.filter((d) => d.cls === g).sort((a, b) => b.sold * b.price - a.sold * a.price);
                  if (items.length === 0) return null;
                  const info = MATRIX_INFO[g];
                  const Icon = info.icon;
                  return (
                    <Card key={g}>
                      <div className={`flex items-center gap-2 ${info.tone}`}>
                        <Icon size={16} />
                        <p className="text-sm font-semibold">
                          {t.classLabels[g]} <span className="font-normal text-muted">({items.length})</span>
                        </p>
                      </div>
                      <p className="mt-1.5 text-xs leading-relaxed text-muted">{t.classDescriptions[g]}</p>
                      <div className="mt-3 max-h-64 space-y-2.5 overflow-y-auto overflow-x-hidden border-t border-surface-border pt-3">
                        {items.map((d) => (
                          <div key={d.id} className="min-w-0 text-sm">
                            <p className="truncate font-medium text-heading">{d.name}</p>
                            <p className="mt-0.5 truncate font-mono text-[11px] text-muted">
                              {t.dishStatLine(num(d.fullMarginPct, 0), num(d.sold, 0), d.suggestedPrice ? formatMoney(d.suggestedPrice, currency) : null)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </Card>
                  );
                })}
              </div>
            </section>
          )}

          {recs.wasteAlerts.length > 0 && (
            <section className="mt-8">
              <p className="mb-2 flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-wide text-brass">
                <AlertTriangle size={14} className="text-danger-text" /> {t.wasteAlerts}
              </p>
              <ul className="space-y-2">
                {recs.wasteAlerts.map((a) => (
                  <li key={a.key} className="rounded-xl border border-danger-border bg-danger-bg px-4 py-2.5 text-sm text-danger-text">
                    <strong className="font-semibold text-heading">{a.name}:</strong> {a.text}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {recs.shortageAlerts.length > 0 && (
            <section className="mt-8">
              <p className="mb-2 flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-wide text-brass">
                <PackageX size={14} className="text-warn-text" /> {t.shortageAlerts}
              </p>
              <ul className="space-y-2">
                {recs.shortageAlerts.map((a) => (
                  <li key={a.key} className="rounded-xl border border-warn-border bg-warn-bg px-4 py-2.5 text-sm text-warn-text">
                    <strong className="font-semibold text-heading">{a.name}:</strong> {a.text}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {recs.tooSmallCategories.length > 0 && (
            <section className="mt-8">
              <p className="mb-2 font-mono text-xs font-semibold uppercase tracking-wide text-brass">{t.smallCategoriesTitle}</p>
              <p className="mb-2 text-sm text-muted">
                {t.smallCategoriesDesc}
              </p>
              <ul className="space-y-1 text-sm text-heading">
                {recs.tooSmallCategories.map((c) => (
                  <li key={c.category}>{c.category} — {t.dishCount(c.count)}</li>
                ))}
              </ul>
            </section>
          )}

          {recs.noRecipe.length > 0 && (
            <section className="mt-8">
              <p className="mb-2 font-mono text-xs font-semibold uppercase tracking-wide text-brass">{t.noRecipeTitle}</p>
              <p className="mb-2 text-sm text-muted">
                {t.noRecipeDesc}
              </p>
              <ul className="space-y-1 text-sm text-heading">
                {recs.noRecipe.map((d) => (
                  <li key={d.id}>{d.name}</li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </PageShell>
  );
}
