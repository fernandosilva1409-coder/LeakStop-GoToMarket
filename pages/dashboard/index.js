import { useState } from "react";
import { Wallet, Trash2, Percent, PieChart, HelpCircle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { supabase } from "../../lib/supabaseClient";
import { formatMoney, catLabel, formatQty, num } from "../../lib/calculations";
import { useRestaurant } from "../../lib/useRestaurant";
import { useAnalysis } from "../../lib/useAnalysis";
import { useDetectedLanguage } from "../../lib/landingCopy";
import { getDashCopy } from "../../lib/dashboardCopy";
import PageShell from "../../components/ui/PageShell";
import StatCard from "../../components/ui/StatCard";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import WarningBanner from "../../components/ui/WarningBanner";

export default function Dashboard() {
  const { restaurant, loading: restaurantLoading, error: restaurantError } = useRestaurant();
  const { analysis, loading } = useAnalysis(restaurant);
  const [subscribing, setSubscribing] = useState(false);
  const [subscribeError, setSubscribeError] = useState("");
  const [openingPortal, setOpeningPortal] = useState(false);
  const [portalError, setPortalError] = useState("");
  const [ingredientSearch, setIngredientSearch] = useState("");
  const [dishSearch, setDishSearch] = useState("");
  const [dishCat, setDishCat] = useState("All");
  const [tab, setTab] = useState("overview");

  const browserLang = useDetectedLanguage();
  const lang = restaurant?.language || browserLang;
  const t = getDashCopy(lang);

  const handleSubscribe = async () => {
    setSubscribeError("");
    setSubscribing(true);
    const { data: { session } } = await supabase.auth.getSession();
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ restaurantId: restaurant.id, customerEmail: session?.user?.email }),
      });
      const body = await res.json();
      if (body.url) { window.location.href = body.url; return; }
      setSubscribeError(body.error || t.home.checkoutError);
    } catch (err) {
      setSubscribeError(t.home.stripeError);
    }
    setSubscribing(false);
  };

  const handleManageSubscription = async () => {
    setPortalError("");
    setOpeningPortal(true);
    const { data: { session } } = await supabase.auth.getSession();
    try {
      const res = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ restaurantId: restaurant.id }),
      });
      const body = await res.json();
      if (body.url) { window.location.href = body.url; return; }
      setPortalError(body.error || t.home.portalError);
    } catch (err) {
      setPortalError(t.home.stripeError);
    }
    setOpeningPortal(false);
  };

  if (restaurantLoading) return <p className="p-10 text-muted">{t.common.loading}</p>;
  if (restaurantError) return <p className="p-10 text-danger-text">{restaurantError}</p>;

  const currency = restaurant?.currency || "EUR";
  // A restaurant has a real Stripe subscription (trialing, active, past_due…)
  // as soon as checkout completes — that's the signal for showing "manage"
  // instead of "subscribe", not the specific status string.
  const hasSubscription = !!restaurant?.stripe_subscription_id;
  const statusLabel = t.home.subscriptionStatusLabels[restaurant?.subscription_status] || restaurant?.subscription_status;

  let topWaste = [], unmatchedSalesPct = 0, dishCategories = [];
  if (analysis) {
    topWaste = analysis.ingredientRows.filter((r) => r.status === "ok" && r.wasteCost > 0).slice(0, 5);
    const totalSoldAll = analysis.totalSoldMatched + analysis.unmatchedSalesQty;
    unmatchedSalesPct = totalSoldAll > 0 ? (analysis.unmatchedSalesQty / totalSoldAll) * 100 : 0;
    dishCategories = Array.from(new Set(analysis.dishRows.map((d) => catLabel(d.category))));
  }

  const filteredIngredients = analysis
    ? analysis.ingredientRows.filter((r) => r.name.toLowerCase().includes(ingredientSearch.toLowerCase()))
    : [];
  const filteredDishes = analysis
    ? analysis.dishRows
        .filter((d) => (dishCat === "All" || catLabel(d.category) === dishCat) && d.name.toLowerCase().includes(dishSearch.toLowerCase()))
        .sort((a, b) => b.sold * b.price - a.sold * a.price)
    : [];

  return (
    <PageShell lang={lang}>
      <h1 className="text-2xl font-bold text-heading">{restaurant?.name}</h1>
      <p className="mt-1 text-sm text-muted">
        {t.home.subscriptionStatus} <span className="font-medium text-heading">{statusLabel}</span>
      </p>

      {!hasSubscription ? (
        <div className="mt-4">
          <Button onClick={handleSubscribe} disabled={subscribing}>
            {subscribing ? t.home.openingStripe : t.home.subscribeCta}
          </Button>
          <p className="mt-1.5 text-xs text-muted">{t.home.vatIncluded}</p>
          {subscribeError && <p className="mt-2 text-sm text-danger-text">{subscribeError}</p>}
        </div>
      ) : (
        <div className="mt-4">
          <Button variant="secondary" onClick={handleManageSubscription} disabled={openingPortal}>
            {openingPortal ? t.home.opening : t.home.manageSubscription}
          </Button>
          {portalError && <p className="mt-2 text-sm text-danger-text">{portalError}</p>}
        </div>
      )}

      {loading || !analysis ? (
        <p className="mt-8 text-sm text-muted">{t.home.loadingData}</p>
      ) : (
        <>
          <div className="mb-6 mt-8 flex flex-wrap gap-2">
            {[
              { key: "overview", label: t.home.tabOverview },
              { key: "waste", label: t.home.tabWaste },
              { key: "profitability", label: t.home.tabProfitability },
            ].map((tabItem) => (
              <button
                key={tabItem.key}
                onClick={() => setTab(tabItem.key)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                  tab === tabItem.key ? "bg-gradient-to-br from-brass-light to-brass text-heading" : "bg-surface-card text-muted shadow-soft hover:text-heading"
                }`}
              >
                {tabItem.label}
              </button>
            ))}
          </div>

          {tab === "overview" && (
            <>
              {(analysis.mismatchCount > 0 || analysis.unmatchedRows.length > 0 || analysis.unmatchedSalesQty > 0) && (
                <WarningBanner>
                  {analysis.mismatchCount > 0 && <span>{t.home.mismatchWarning(analysis.mismatchCount)} </span>}
                  {analysis.unmatchedRows.length > 0 && <span>{t.home.unmatchedPurchasesWarning(analysis.unmatchedRows.length)} </span>}
                  {analysis.unmatchedSalesQty > 0 && (
                    <span>
                      {t.home.unmatchedSalesWarning(
                        num(unmatchedSalesPct, 0),
                        num(analysis.unmatchedSalesQty, 0),
                        analysis.unmatchedSalesTop.slice(0, 4).map(([name]) => name).join(", ")
                      )}
                    </span>
                  )}
                </WarningBanner>
              )}

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <StatCard icon={Wallet} label={t.home.totalRevenue} value={formatMoney(analysis.totalRevenue, currency)} />
                <StatCard icon={Trash2} label={t.home.wasteCost} value={formatMoney(analysis.totalWasteCost, currency)} tone="danger" />
                <StatCard icon={Percent} label={t.home.foodCostMargin} value={`${analysis.avgMarginPct.toFixed(0)}%`} tone={analysis.avgMarginPct >= 0 ? "good" : "danger"} />
                <StatCard icon={PieChart} label={t.home.totalMargin} value={`${analysis.avgFullMarginPct.toFixed(0)}%`} tone={analysis.avgFullMarginPct >= 0 ? "good" : "danger"} />
                {analysis.unmatchedSalesQty > 0 && (
                  <StatCard icon={HelpCircle} label={t.home.salesNotMatched} value={`${num(unmatchedSalesPct, 0)}%`} tone={unmatchedSalesPct > 10 ? "danger" : "neutral"} />
                )}
              </div>

              {topWaste.length > 0 && (
                <>
                  <p className="mb-2 mt-8 font-mono text-xs font-semibold uppercase tracking-wide text-brass">{t.home.topWastedIngredients}</p>
                  <div className="rounded-2xl bg-surface-card p-4 shadow-soft">
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={topWaste} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E7E4DA" vertical={false} />
                        <XAxis dataKey="name" tick={{ fill: "#8B897A", fontSize: 11, fontFamily: "IBM Plex Mono, monospace" }} axisLine={{ stroke: "#E7E4DA" }} tickLine={false} />
                        <YAxis tick={{ fill: "#8B897A", fontSize: 11, fontFamily: "IBM Plex Mono, monospace" }} axisLine={{ stroke: "#E7E4DA" }} tickLine={false} />
                        <Tooltip
                          contentStyle={{ background: "#FFFFFF", border: "1px solid #E7E4DA", borderRadius: 8, fontFamily: "IBM Plex Mono, monospace", fontSize: 12 }}
                          labelStyle={{ color: "#26251C" }}
                          formatter={(v) => formatMoney(v, currency)}
                        />
                        <Bar dataKey="wasteCost" radius={[4, 4, 0, 0]}>
                          {topWaste.map((_, i) => <Cell key={i} fill="#B5432E" />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </>
              )}
            </>
          )}

          {tab === "waste" && (
            <>
              <p className="mb-2 font-mono text-xs font-semibold uppercase tracking-wide text-brass">{t.home.wasteByIngredient}</p>
              <Input placeholder={t.home.searchIngredients} value={ingredientSearch} onChange={(e) => setIngredientSearch(e.target.value)} className="mb-3 w-full max-w-xs" />
              <div className="overflow-hidden rounded-2xl bg-surface-card shadow-soft">
                {filteredIngredients.length === 0 ? (
                  <p className="p-5 text-sm text-muted">—</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-surface-border text-left font-mono text-[11px] uppercase tracking-wide text-muted">
                        <th className="px-4 py-3">{t.home.colIngredient}</th>
                        <th className="px-4 py-3 text-right">{t.home.colPurchased}</th>
                        <th className="px-4 py-3 text-right">{t.home.colUsed}</th>
                        <th className="px-4 py-3 text-right">{t.home.colWaste}</th>
                        <th className="px-4 py-3 text-right">{t.home.colWasteCost}</th>
                        <th className="px-4 py-3 text-right">{t.home.colShortage}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredIngredients.map((r) => (
                        <tr key={r.key} className="border-b border-surface-border/60 last:border-0 hover:bg-surface-sunken">
                          <td className="px-4 py-3 font-medium text-heading">{r.name}</td>
                          {r.status === "mismatch" ? (
                            <td colSpan={5} className="px-4 py-3 text-warn-text">{t.home.fixUnitsBadge}</td>
                          ) : (
                            <>
                              <td className="px-4 py-3 text-right font-mono text-muted">{formatQty(r.purchased, r.unit)}</td>
                              <td className="px-4 py-3 text-right font-mono text-muted">{formatQty(r.used, r.unit)}</td>
                              <td className="px-4 py-3 text-right font-mono" style={{ color: r.waste > 0 ? "#B5432E" : undefined }}>{formatQty(r.waste, r.unit)}</td>
                              <td className="px-4 py-3 text-right font-mono" style={{ color: r.waste > 0 ? "#B5432E" : undefined }}>{formatMoney(r.wasteCost, currency)}</td>
                              <td className="px-4 py-3 text-right font-mono" style={{ color: r.shortage > 0 ? "#C99A3D" : undefined }}>{r.shortage > 0 ? formatQty(r.shortage, r.unit) : "—"}</td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {analysis.unmatchedRows.length > 0 && (
                <>
                  <p className="mb-1 mt-8 font-mono text-xs font-semibold uppercase tracking-wide text-brass">{t.home.unmatchedPurchasesTitle}</p>
                  <p className="mb-3 text-sm text-muted">{t.home.unmatchedPurchasesHint}</p>
                  <div className="overflow-hidden rounded-2xl bg-surface-card shadow-soft">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-surface-border text-left font-mono text-[11px] uppercase tracking-wide text-muted">
                          <th className="px-4 py-3">{t.home.colItem}</th>
                          <th className="px-4 py-3 text-right">{t.home.colEntries}</th>
                          <th className="px-4 py-3 text-right">{t.home.colSpend}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analysis.unmatchedRows.map((r) => (
                          <tr key={r.key} className="border-b border-surface-border/60 last:border-0 hover:bg-surface-sunken">
                            <td className="px-4 py-3 font-medium text-heading">{r.name}</td>
                            <td className="px-4 py-3 text-right font-mono text-muted">{r.entries}</td>
                            <td className="px-4 py-3 text-right font-mono text-muted">{formatMoney(r.spend, currency)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          )}

          {tab === "profitability" && (
            <>
              <p className="mb-2 font-mono text-xs font-semibold uppercase tracking-wide text-brass">{t.home.dishProfitability}</p>
              <Input placeholder={t.home.searchDishes} value={dishSearch} onChange={(e) => setDishSearch(e.target.value)} className="mb-3 w-full max-w-xs" />
              {analysis.dishRows.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  <button
                    onClick={() => setDishCat("All")}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${dishCat === "All" ? "bg-gradient-to-br from-brass-light to-brass text-heading" : "bg-surface-card text-muted shadow-soft hover:text-heading"}`}
                  >
                    {t.recommendations.allCategories} ({analysis.dishRows.length})
                  </button>
                  {dishCategories.map((c) => (
                    <button
                      key={c}
                      onClick={() => setDishCat(c)}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${dishCat === c ? "bg-gradient-to-br from-brass-light to-brass text-heading" : "bg-surface-card text-muted shadow-soft hover:text-heading"}`}
                    >
                      {c} ({analysis.dishRows.filter((d) => catLabel(d.category) === c).length})
                    </button>
                  ))}
                </div>
              )}
              <div className="overflow-hidden rounded-2xl bg-surface-card shadow-soft">
                {filteredDishes.length === 0 ? (
                  <p className="p-5 text-sm text-muted">—</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-surface-border text-left font-mono text-[11px] uppercase tracking-wide text-muted">
                        <th className="px-4 py-3">{t.recommendations.colDish}</th>
                        <th className="px-4 py-3">{t.recommendations.colCategory}</th>
                        <th className="px-4 py-3 text-right">{t.recommendations.colSold}</th>
                        <th className="px-4 py-3 text-right">{t.home.colFoodCost}</th>
                        <th className="px-4 py-3 text-right">{t.home.colOverheadPerPlate}</th>
                        <th className="px-4 py-3 text-right">{t.home.colFullCost}</th>
                        <th className="px-4 py-3 text-right">{t.menu.price}</th>
                        <th className="px-4 py-3 text-right">{t.recommendations.colFullMargin}</th>
                        <th className="px-4 py-3 text-right">{t.home.colFullMarginPct}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDishes.map((d) => (
                        <tr key={d.id} className="border-b border-surface-border/60 last:border-0 hover:bg-surface-sunken">
                          <td className="px-4 py-3 font-medium text-heading">{d.name}</td>
                          <td className="px-4 py-3 text-muted">{catLabel(d.category)}</td>
                          <td className="px-4 py-3 text-right font-mono text-muted">{num(d.sold, 0)}</td>
                          <td className="px-4 py-3 text-right font-mono text-muted">{formatMoney(d.cost, currency)}</td>
                          <td className="px-4 py-3 text-right font-mono text-muted">{formatMoney(d.overheadPerPlate, currency)}</td>
                          <td className="px-4 py-3 text-right font-mono text-muted">{formatMoney(d.fullCost, currency)}</td>
                          <td className="px-4 py-3 text-right font-mono text-muted">{formatMoney(d.price, currency)}</td>
                          <td className="px-4 py-3 text-right font-mono" style={{ color: d.fullMargin >= 0 ? "#4F7A3D" : "#B5432E" }}>{formatMoney(d.fullMargin, currency)}</td>
                          <td className="px-4 py-3 text-right font-mono" style={{ color: d.fullMargin >= 0 ? "#4F7A3D" : "#B5432E" }}>{num(d.fullMarginPct, 0)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}
        </>
      )}
    </PageShell>
  );
}
