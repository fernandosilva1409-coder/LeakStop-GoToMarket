import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { formatMoney } from "../../lib/calculations";
import { useRestaurant } from "../../lib/useRestaurant";
import { useAnalysis } from "../../lib/useAnalysis";
import { useDetectedLanguage } from "../../lib/landingCopy";
import { getDashCopy } from "../../lib/dashboardCopy";
import DashboardNav from "../../components/DashboardNav";

export default function Dashboard() {
  const { restaurant, loading: restaurantLoading, error: restaurantError } = useRestaurant();
  const { analysis, loading } = useAnalysis(restaurant);
  const [subscribing, setSubscribing] = useState(false);
  const [subscribeError, setSubscribeError] = useState("");
  const [openingPortal, setOpeningPortal] = useState(false);
  const [portalError, setPortalError] = useState("");

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

  return (
    <div className="min-h-screen bg-ink-bg">
      <DashboardNav lang={lang} />
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-bold text-paper">{restaurant?.name}</h1>
        <p className="mt-1 text-sm text-muted">
          {t.home.subscriptionStatus} <span className="font-medium text-paper">{statusLabel}</span>
        </p>

        {!hasSubscription ? (
          <div className="mt-4">
            <button
              onClick={handleSubscribe}
              disabled={subscribing}
              className="rounded-lg bg-brass px-5 py-2.5 text-sm font-semibold text-ink-bg hover:bg-brass-light disabled:opacity-60"
            >
              {subscribing ? t.home.openingStripe : t.home.subscribeCta}
            </button>
            <p className="mt-1.5 text-xs text-faint">{t.home.vatIncluded}</p>
            {subscribeError && <p className="mt-2 text-sm text-danger-text">{subscribeError}</p>}
          </div>
        ) : (
          <div className="mt-4">
            <button
              onClick={handleManageSubscription}
              disabled={openingPortal}
              className="rounded-lg border border-ink-border2 px-5 py-2.5 text-sm font-semibold text-paper hover:border-brass hover:text-brass disabled:opacity-60"
            >
              {openingPortal ? t.home.opening : t.home.manageSubscription}
            </button>
            {portalError && <p className="mt-2 text-sm text-danger-text">{portalError}</p>}
          </div>
        )}

        {loading || !analysis ? (
          <p className="mt-8 text-sm text-muted">{t.home.loadingData}</p>
        ) : (
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <KpiBox label={t.home.totalRevenue} value={formatMoney(analysis.totalRevenue, currency)} />
            <KpiBox label={t.home.wasteCost} value={formatMoney(analysis.totalWasteCost, currency)} tone="danger" />
            <KpiBox label={t.home.totalMargin} value={`${analysis.avgFullMarginPct.toFixed(0)}%`} tone={analysis.avgFullMarginPct >= 0 ? "good" : "danger"} />
          </div>
        )}
      </div>
    </div>
  );
}

function KpiBox({ label, value, tone = "neutral" }) {
  const toneClasses = {
    neutral: "border-ink-border bg-ink-panel",
    good: "border-good/30 bg-good/5",
    danger: "border-danger-border bg-danger-bg",
  }[tone];
  return (
    <div className={`rounded-xl border p-5 ${toneClasses}`}>
      <p className="font-mono text-[11px] uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1.5 font-mono text-2xl font-bold text-paper">{value}</p>
    </div>
  );
}
