import { AlertTriangle, PackageX } from "lucide-react";
import { useRestaurant } from "../../lib/useRestaurant";
import { useAnalysis } from "../../lib/useAnalysis";
import { computeRecommendations, formatMoney } from "../../lib/calculations";
import { useDetectedLanguage } from "../../lib/landingCopy";
import { getDashCopy } from "../../lib/dashboardCopy";
import DashboardNav from "../../components/DashboardNav";

const CLASS_TONE = {
  star: "bg-good/10 text-good",
  plowhorse: "bg-brass/10 text-brass",
  puzzle: "bg-muted/10 text-muted",
  dog: "bg-danger-bg text-danger-text",
};

export default function RecommendationsPage() {
  const { restaurant, loading: restaurantLoading, error: restaurantError } = useRestaurant();
  const { analysis, loading } = useAnalysis(restaurant);

  const browserLang = useDetectedLanguage();
  const lang = restaurant?.language || browserLang;
  const dash = getDashCopy(lang);
  const t = dash.recommendations;

  if (restaurantLoading) return <p className="p-10 text-muted">{dash.common.loading}</p>;
  if (restaurantError) return <p className="p-10 text-danger-text">{restaurantError}</p>;

  const currency = restaurant.currency || "EUR";
  const recs = loading || !analysis ? null : computeRecommendations(analysis, currency, lang);

  return (
    <div className="min-h-screen bg-ink-bg">
      <DashboardNav lang={lang} />
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-bold text-paper">{t.title}</h1>

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

            {recs.matrix.length > 0 && (
              <section className="mt-6">
                <p className="mb-2 font-mono text-xs font-semibold uppercase tracking-wide text-brass">{t.matrixTitle}</p>
                <div className="overflow-hidden rounded-xl border border-ink-border bg-ink-panel">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-ink-border text-left font-mono text-[11px] uppercase tracking-wide text-faint">
                        <th className="px-4 py-3">{t.colDish}</th>
                        <th className="px-4 py-3">{t.colCategory}</th>
                        <th className="px-4 py-3">{t.colSold}</th>
                        <th className="px-4 py-3">{t.colFullMargin}</th>
                        <th className="px-4 py-3">{t.colClassification}</th>
                        <th className="px-4 py-3">{t.colSuggestedPrice}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recs.matrix.map((d) => (
                        <tr key={d.id} className="border-b border-ink-border/60 last:border-0 hover:bg-ink-bg/40">
                          <td className="px-4 py-3 font-medium text-paper">{d.name}</td>
                          <td className="px-4 py-3 text-muted">{d.category || "—"}</td>
                          <td className="px-4 py-3 font-mono text-muted">{d.sold}</td>
                          <td className="px-4 py-3 font-mono text-muted">{d.fullMarginPct.toFixed(0)}%</td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${CLASS_TONE[d.cls]}`}>
                              {t.classLabels[d.cls]}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono text-muted">{d.suggestedPrice ? formatMoney(d.suggestedPrice, currency) : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
                    <li key={a.key} className="rounded-lg border border-danger-border bg-danger-bg px-4 py-2.5 text-sm text-danger-text">
                      <strong className="font-semibold text-paper">{a.name}:</strong> {a.text}
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
                    <li key={a.key} className="rounded-lg border border-warn-border bg-warn-bg px-4 py-2.5 text-sm text-warn-text">
                      <strong className="font-semibold text-paper">{a.name}:</strong> {a.text}
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
                <ul className="space-y-1 text-sm text-paper">
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
                <ul className="space-y-1 text-sm text-paper">
                  {recs.noRecipe.map((d) => (
                    <li key={d.id}>{d.name}</li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
