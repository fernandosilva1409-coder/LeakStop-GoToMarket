import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { ChefHat } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { LANGUAGES, detectLanguage, COPY } from "../lib/landingCopy";
import { CURRENCY_SYMBOLS } from "../lib/calculations";
import { getAuthCopy } from "../lib/authCopy";

const CURRENCIES = Object.keys(CURRENCY_SYMBOLS);

export default function Signup() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [restaurantName, setRestaurantName] = useState("");
  const [lang, setLang] = useState("pt");
  const [language, setLanguage] = useState("pt");
  const [currency, setCurrency] = useState("EUR");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!router.isReady) return;
    const detected = detectLanguage(router.query);
    setLang(detected);
    setLanguage(detected);
  }, [router.isReady, router.query]);

  const t = getAuthCopy(lang).signup;

  const handleSignup = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });
    if (authError) { setError(authError.message); setLoading(false); return; }

    // signUp() returns a fresh session for the new user, but doesn't replace an
    // already-active session on this client — force-adopt it so the RPC below
    // (and the RLS it relies on) runs as the account we just created, not
    // whoever happened to already be logged in on this browser.
    if (authData.session) {
      await supabase.auth.setSession(authData.session);
    } else {
      setError(t.confirmEmail);
      setLoading(false);
      return;
    }

    // create_restaurant_for_user (see supabase/schema.sql) creates the restaurant,
    // the owner membership row, and a zeroed overhead row in one transaction.
    const { data: restaurantId, error: rpcError } = await supabase.rpc("create_restaurant_for_user", {
      restaurant_name: restaurantName,
      p_currency: currency,
      p_language: language,
    });
    if (rpcError) { setError(rpcError.message); setLoading(false); return; }

    // Every new account goes straight to Stripe Checkout to start the 5-day
    // trial — a card is required up front, so there's no free, unattached
    // "trialing" account sitting in the dashboard with nothing behind it.
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authData.session.access_token}` },
        body: JSON.stringify({ restaurantId, customerEmail: email }),
      });
      const body = await res.json();
      if (body.url) { window.location.href = body.url; return; }
      setError(body.error || t.checkoutFailed);
      router.push("/dashboard");
    } catch (err) {
      setError(t.stripeConnectFailed);
      router.push("/dashboard");
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-bg px-6">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brass text-ink-bg">
            <ChefHat size={18} strokeWidth={2.2} />
          </div>
          <span className="text-lg font-bold text-paper">LeakStop</span>
        </Link>
        <div className="rounded-2xl border border-ink-border bg-ink-panel p-8">
          <h1 className="text-xl font-semibold text-paper">{t.title}</h1>
          <form onSubmit={handleSignup} className="mt-6 flex flex-col gap-4">
            <input
              placeholder={t.restaurantName} value={restaurantName} onChange={(e) => setRestaurantName(e.target.value)} required
              className="rounded-lg border border-ink-border2 bg-ink-bg px-3 py-2 text-sm text-paper placeholder:text-faint focus:border-brass focus:outline-none"
            />
            <input
              placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
              className="rounded-lg border border-ink-border2 bg-ink-bg px-3 py-2 text-sm text-paper placeholder:text-faint focus:border-brass focus:outline-none"
            />
            <input
              placeholder={t.password} type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6}
              className="rounded-lg border border-ink-border2 bg-ink-bg px-3 py-2 text-sm text-paper placeholder:text-faint focus:border-brass focus:outline-none"
            />
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-muted">{t.language}</span>
                <select
                  value={language} onChange={(e) => setLanguage(e.target.value)}
                  className="rounded-lg border border-ink-border2 bg-ink-bg px-3 py-2 text-sm text-paper focus:border-brass focus:outline-none"
                >
                  {LANGUAGES.map(({ code, label }) => (
                    <option key={code} value={code}>{label}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-muted">{t.currency}</span>
                <select
                  value={currency} onChange={(e) => setCurrency(e.target.value)}
                  className="rounded-lg border border-ink-border2 bg-ink-bg px-3 py-2 text-sm text-paper focus:border-brass focus:outline-none"
                >
                  {CURRENCIES.map((code) => (
                    <option key={code} value={code}>{code} ({CURRENCY_SYMBOLS[code]})</option>
                  ))}
                </select>
              </label>
            </div>
            {error && <p className="text-sm text-danger-text">{error}</p>}
            <button
              type="submit" disabled={loading}
              className="mt-2 rounded-lg bg-brass px-4 py-2 text-sm font-semibold text-ink-bg hover:bg-brass-light disabled:opacity-60"
            >
              {loading ? t.openingStripe : t.submit}
            </button>
          </form>
        </div>
        <p className="mt-6 text-center text-sm text-muted">
          {t.alreadyHaveAccount} <Link href={`/login?lang=${lang}`} className="font-medium text-brass hover:text-brass-light">{t.login}</Link>
        </p>
        <p className="mt-3 text-center text-xs text-faint">
          {t.trialPricing}
          <br />
          {t.acceptTerms}{" "}
          <Link href={`/termos?lang=${lang}`} className="text-muted hover:text-paper">{COPY[lang]?.footer_terms || COPY.pt.footer_terms}</Link> {t.and}{" "}
          <Link href={`/politica-privacidade?lang=${lang}`} className="text-muted hover:text-paper">{COPY[lang]?.footer_privacy || COPY.pt.footer_privacy}</Link>.
        </p>
      </div>
    </div>
  );
}
