import { Fragment, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { Wallet, Trash2, Percent, PieChart, HelpCircle, Sparkles, ChevronDown, ChevronRight } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { formatMoney, catLabel, formatQty, num } from "../../lib/calculations";
import { useRestaurant, hasActiveAccess } from "../../lib/useRestaurant";
import { useAnalysis } from "../../lib/useAnalysis";
import { useDetectedLanguage } from "../../lib/landingCopy";
import { getDashCopy } from "../../lib/dashboardCopy";
import PageShell from "../../components/ui/PageShell";
import Card from "../../components/ui/Card";
import StatCard from "../../components/ui/StatCard";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import WarningBanner from "../../components/ui/WarningBanner";
import SimpleBarChart from "../../components/ui/SimpleBarChart";
import SimplePieChart from "../../components/ui/SimplePieChart";

const RANGES = ["30", "90", "365", "all"];

export default function Dashboard() {
  const router = useRouter();
  const { restaurant, loading: restaurantLoading, error: restaurantError, refetch } = useRestaurant();
  const [range, setRange] = useState("all");
  const { analysis, loading, reload } = useAnalysis(restaurant, range === "all" ? undefined : Number(range));
  const [expandedDishId, setExpandedDishId] = useState(null);
  const [editRows, setEditRows] = useState(null); // working copy of the expanded dish's ingredientBreakdown
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [subscribing, setSubscribing] = useState(false);
  const [subscribeError, setSubscribeError] = useState("");
  const [openingPortal, setOpeningPortal] = useState(false);
  const [portalError, setPortalError] = useState("");
  const [ingredientSearch, setIngredientSearch] = useState("");
  const [dishSearch, setDishSearch] = useState("");
  const [dishCat, setDishCat] = useState("All");
  const [tab, setTab] = useState("overview");
  const [wasteMetric, setWasteMetric] = useState("cost");
  const [wasteCount, setWasteCount] = useState("5");
  const [overheadExplanation, setOverheadExplanation] = useState(null);
  const [overheadExplLoading, setOverheadExplLoading] = useState(false);
  const [overheadExplError, setOverheadExplError] = useState("");

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

  // Stripe redirects back here the instant checkout completes, but the
  // webhook that flips subscription_status to "trialing" can lag a couple
  // seconds behind — poll briefly instead of showing "not subscribed" right
  // after someone just paid.
  useEffect(() => {
    if (router.query.checkout !== "success" || !restaurant || hasActiveAccess(restaurant)) return;
    let cancelled = false;
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts += 1;
      const rest = await refetch();
      if (cancelled) return;
      if (hasActiveAccess(rest) || attempts >= 8) clearInterval(interval);
    }, 2000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [router.query.checkout, restaurant, refetch]);

  // Auto-generates as soon as the dashboard has data — cached ~24h server
  // side (see /api/overhead-explanation), so opening the page again the
  // same day just re-reads the cached row instead of re-asking Claude.
  useEffect(() => {
    if (!restaurant || !analysis) return;
    let active = true;
    (async () => {
      setOverheadExplError("");
      setOverheadExplLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch("/api/overhead-explanation", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
          body: JSON.stringify({ restaurantId: restaurant.id }),
        });
        const body = await res.json();
        if (!active) return;
        if (!res.ok) { setOverheadExplError(body.error || t.home.overheadExplainError); return; }
        setOverheadExplanation(body.explanation);
      } catch {
        if (active) setOverheadExplError(t.home.overheadExplainError);
      }
      if (active) setOverheadExplLoading(false);
    })();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurant?.id, !!analysis]);

  const toggleDishDetail = (dish) => {
    if (expandedDishId === dish.id) {
      setExpandedDishId(null);
      setEditRows(null);
      setEditError("");
      return;
    }
    setExpandedDishId(dish.id);
    setEditRows((dish.ingredientBreakdown || []).map((ing) => ({ ...ing, _removed: false })));
    setEditError("");
  };

  const updateEditRow = (idx, key, value) => {
    setEditRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [key]: value } : r)));
  };
  const removeEditRow = (idx) => {
    setEditRows((prev) => prev.map((r, i) => (i === idx ? { ...r, _removed: true } : r)));
  };

  const saveDishIngredients = async (dishId) => {
    setEditSaving(true);
    setEditError("");
    try {
      for (const row of editRows) {
        if (row._removed) {
          if (row.id) {
            const { error } = await supabase.from("dish_ingredients").delete().eq("id", row.id);
            if (error) throw error;
          }
          continue;
        }
        const payload = { name: row.name.trim(), qty: Number(row.qty) || 0, unit: row.unit || "g" };
        if (row.id) {
          const { error } = await supabase.from("dish_ingredients").update(payload).eq("id", row.id);
          if (error) throw error;
        } else if (payload.name) {
          const { error } = await supabase.from("dish_ingredients").insert({ dish_id: dishId, ...payload });
          if (error) throw error;
        }
      }
      setExpandedDishId(null);
      setEditRows(null);
      await reload();
    } catch (err) {
      setEditError(err.message || t.home.saveError);
    }
    setEditSaving(false);
  };

  if (restaurantLoading) return <p className="p-10 text-muted">{t.common.loading}</p>;
  if (restaurantError) return <p className="p-10 text-danger-text">{restaurantError}</p>;

  const currency = restaurant?.currency || "EUR";
  // A restaurant has a real Stripe subscription (trialing, active, past_due…)
  // as soon as checkout completes — that's the signal for showing "manage"
  // instead of "subscribe", not the specific status string.
  const hasSubscription = !!restaurant?.stripe_subscription_id;
  const statusLabel = t.home.subscriptionStatusLabels[restaurant?.subscription_status] || restaurant?.subscription_status;
  // The actual paywall: only trialing/active accounts see real data below —
  // everyone else (never checked out, canceled, payment failed) gets the
  // subscribe prompt and nothing else. See lib/useRestaurant.js for the
  // matching redirect that keeps other /dashboard/* pages out of reach too.
  const isActiveSubscriber = hasActiveAccess(restaurant);
  const checkoutPending = router.query.checkout === "success" && !isActiveSubscriber;

  let topWaste = [], unmatchedSalesPct = 0, dishCategories = [], categoryRevenue = [];
  if (analysis) {
    const wasteSortKey = wasteMetric === "qty" ? "waste" : "wasteCost";
    const sortedWaste = analysis.ingredientRows.filter((r) => r.status === "ok" && r[wasteSortKey] > 0).sort((a, b) => b[wasteSortKey] - a[wasteSortKey]);
    topWaste = wasteCount === "all" ? sortedWaste : sortedWaste.slice(0, Number(wasteCount));
    const totalSoldAll = analysis.totalSoldMatched + analysis.unmatchedSalesQty;
    unmatchedSalesPct = totalSoldAll > 0 ? (analysis.unmatchedSalesQty / totalSoldAll) * 100 : 0;
    dishCategories = Array.from(new Set(analysis.dishRows.map((d) => catLabel(d.category))));
    categoryRevenue = (analysis.salesStats?.byCategory || []).filter((c) => c.revenue > 0);
  }

  const filteredIngredients = analysis
    ? analysis.ingredientRows.filter((r) => r.name.toLowerCase().includes(ingredientSearch.toLowerCase()))
    : [];
  const filteredDishes = analysis
    ? analysis.dishRows
        .filter((d) => (dishCat === "All" || catLabel(d.category) === dishCat) && d.name.toLowerCase().includes(dishSearch.toLowerCase()))
        .sort((a, b) => b.sold * b.price - a.sold * a.price)
    : [];

  // Dishes with at least one ingredient that isn't contributing to cost —
  // no matching purchase, or a purchase in an incompatible unit — surfaced
  // proactively instead of only discoverable by opening each dish by hand.
  const attentionDishes = analysis
    ? analysis.dishRows
        .filter((d) => d.hasRecipe)
        .map((d) => ({ dish: d, problems: (d.ingredientBreakdown || []).filter((i) => i.status !== "matched") }))
        .filter((a) => a.problems.length > 0)
    : [];
  const attentionIngredientCount = attentionDishes.reduce((s, a) => s + a.problems.length, 0);

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

      {checkoutPending ? (
        <p className="mt-8 text-sm text-muted">{t.home.confirmingSubscription}</p>
      ) : !isActiveSubscriber ? (
        <p className="mt-8 text-sm text-muted">{t.home.subscribeToUnlock}</p>
      ) : loading || !analysis ? (
        <p className="mt-8 text-sm text-muted">{t.home.loadingData}</p>
      ) : (
        <>
          <div className="mt-8 flex flex-wrap gap-2">
            {RANGES.map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                  range === r ? "bg-gradient-to-br from-brass-light to-brass text-heading" : "bg-surface-card text-muted shadow-soft hover:text-heading"
                }`}
              >
                {t.common.rangeLabels[r]}
              </button>
            ))}
          </div>

          <div className="mb-6 mt-3 flex flex-wrap gap-2">
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

              <div className="mb-2 mt-8 flex flex-wrap items-center justify-between gap-3">
                <p className="font-mono text-xs font-semibold uppercase tracking-wide text-brass">{t.home.topWastedIngredients}</p>
                <div className="flex flex-wrap gap-2">
                  <div className="flex overflow-hidden rounded-full shadow-soft">
                    {[["cost", t.home.wasteByMetricCost], ["qty", t.home.wasteByMetricQty]].map(([key, label]) => (
                      <button
                        key={key}
                        onClick={() => setWasteMetric(key)}
                        className={`px-3 py-1.5 text-xs font-semibold transition-colors ${wasteMetric === key ? "bg-gradient-to-br from-brass-light to-brass text-heading" : "bg-surface-card text-muted hover:text-heading"}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="flex overflow-hidden rounded-full shadow-soft">
                    {[["5", t.home.wasteTop5], ["10", t.home.wasteTop10], ["all", t.home.wasteTopAll]].map(([key, label]) => (
                      <button
                        key={key}
                        onClick={() => setWasteCount(key)}
                        className={`px-3 py-1.5 text-xs font-semibold transition-colors ${wasteCount === key ? "bg-gradient-to-br from-brass-light to-brass text-heading" : "bg-surface-card text-muted hover:text-heading"}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {topWaste.length > 0 && (
                <div className="rounded-2xl bg-surface-card p-4 shadow-soft">
                  <SimpleBarChart
                    height={240}
                    categorical
                    money={wasteMetric === "cost"}
                    valueLabel={wasteMetric === "cost" ? t.home.colWasteCost : t.home.colWaste}
                    currency={currency}
                    items={topWaste.map((r) => ({
                      label: wasteMetric === "cost" ? r.name : `${r.name} (${r.unit})`,
                      value: wasteMetric === "cost" ? r.wasteCost : r.waste,
                    }))}
                  />
                </div>
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
              {categoryRevenue.length > 0 && (
                <>
                  <p className="mb-2 font-mono text-xs font-semibold uppercase tracking-wide text-brass">{t.home.revenueByCategory}</p>
                  <div className="mb-8 rounded-2xl bg-surface-card p-4 shadow-soft">
                    <SimplePieChart
                      money currency={currency}
                      items={categoryRevenue.map((c) => ({ label: c.category, value: c.revenue }))}
                    />
                  </div>
                </>
              )}
              {(overheadExplLoading || overheadExplanation || overheadExplError) && (
                <Card className="mb-6 border border-brass/20 bg-gradient-to-br from-surface-card to-brass/5">
                  <div className="flex items-center gap-2">
                    <Sparkles size={15} className="text-brass" />
                    <p className="font-mono text-xs font-semibold uppercase tracking-wide text-brass">{t.home.overheadExplainTitle}</p>
                  </div>
                  {overheadExplLoading ? (
                    <p className="mt-2 text-sm text-muted">{t.home.overheadExplainLoading}</p>
                  ) : overheadExplError ? (
                    <p className="mt-2 text-sm text-muted">{overheadExplError}</p>
                  ) : (
                    <p className="mt-2 text-sm leading-relaxed text-heading">{overheadExplanation}</p>
                  )}
                </Card>
              )}

              {attentionDishes.length > 0 && (
                <WarningBanner>
                  <p className="font-semibold">{t.home.attentionTitle(attentionIngredientCount, attentionDishes.length)}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {attentionDishes.map(({ dish, problems }) => (
                      <button
                        key={dish.id}
                        type="button"
                        onClick={() => { setDishSearch(""); setDishCat("All"); toggleDishDetail(dish); }}
                        title={problems.map((p) => p.name).join(", ")}
                        className="rounded-full bg-warn-bg/70 px-2.5 py-1 text-xs font-semibold text-warn-text hover:bg-warn-bg"
                      >
                        {dish.name} ({problems.length})
                      </button>
                    ))}
                  </div>
                </WarningBanner>
              )}

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
                        <th className="px-2 py-3" />
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
                      {filteredDishes.map((d) => {
                        const isExpanded = expandedDishId === d.id;
                        return (
                          <Fragment key={d.id}>
                            <tr
                              onClick={() => toggleDishDetail(d)}
                              className="cursor-pointer border-b border-surface-border/60 last:border-0 hover:bg-surface-sunken"
                            >
                              <td className="px-2 py-3 text-muted">{isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</td>
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
                            {isExpanded && (
                              <tr className="border-b border-surface-border/60 bg-surface-sunken/60">
                                <td colSpan={10} className="px-4 py-4">
                                  <p className="mb-2 font-mono text-[11px] uppercase tracking-wide text-brass">{t.home.costBreakdownTitle}</p>
                                  {editRows.length === 0 ? (
                                    <p className="text-sm text-muted">{t.home.noIngredientsYet}</p>
                                  ) : (
                                    <div className="space-y-1.5">
                                      {editRows.map((row, idx) => !row._removed && (
                                        <div key={row.id || idx} className="flex flex-wrap items-center gap-2">
                                          <span
                                            className={`w-28 shrink-0 rounded px-1.5 py-0.5 text-center font-mono text-[9px] uppercase tracking-wide ${
                                              row.status === "matched" ? "bg-good/10 text-good"
                                                : row.status === "dimension_mismatch" ? "bg-warn-bg text-warn-text"
                                                : "bg-danger-bg text-danger-text"
                                            }`}
                                          >
                                            {t.home.costStatusLabel[row.status] || row.status}
                                          </span>
                                          <Input value={row.name} onChange={(e) => updateEditRow(idx, "name", e.target.value)} className="min-w-[160px] flex-[2] text-xs" />
                                          <Input type="number" step="0.000001" value={row.qty} onChange={(e) => updateEditRow(idx, "qty", e.target.value)} className="w-24 text-xs" />
                                          <Input value={row.unit} onChange={(e) => updateEditRow(idx, "unit", e.target.value)} className="w-16 text-xs" />
                                          <span className="w-24 shrink-0 text-right font-mono text-xs text-muted">
                                            {row.unitCost != null ? formatMoney(row.unitCost, currency) : "—"}
                                          </span>
                                          <span className="w-24 shrink-0 text-right font-mono text-xs text-heading">
                                            {formatMoney(row.contribution, currency)}
                                          </span>
                                          <button type="button" onClick={() => removeEditRow(idx)} className="rounded p-1 text-danger-text hover:bg-danger-bg">
                                            <Trash2 size={13} />
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  {editError && <p className="mt-2 text-sm text-danger-text">{editError}</p>}
                                  <div className="mt-3 flex gap-2">
                                    <Button type="button" onClick={() => saveDishIngredients(d.id)} disabled={editSaving}>
                                      {editSaving ? t.common.saving : t.home.saveIngredients}
                                    </Button>
                                    <Button type="button" variant="secondary" onClick={() => toggleDishDetail(d)} disabled={editSaving}>
                                      {t.common.cancel}
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
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
