import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { supabase } from "../lib/supabaseClient";
import { LANGUAGES, detectLanguage, COPY } from "../lib/landingCopy";
import { CURRENCY_SYMBOLS } from "../lib/calculations";
import { getAuthCopy } from "../lib/authCopy";
import AuthLayout from "../components/ui/AuthLayout";
import Field from "../components/ui/Field";
import Input from "../components/ui/Input";
import Select from "../components/ui/Select";
import Button from "../components/ui/Button";

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
    <AuthLayout
      title={t.title}
      footer={
        <>
          <p className="mt-6 text-center text-sm text-muted">
            {t.alreadyHaveAccount} <Link href={`/login?lang=${lang}`} className="font-medium text-brass hover:text-brass-dark">{t.login}</Link>
          </p>
          <p className="mt-3 text-center text-xs text-muted">
            {t.trialPricing}
            <br />
            {t.acceptTerms}{" "}
            <Link href={`/termos?lang=${lang}`} className="text-muted hover:text-heading">{COPY[lang]?.footer_terms || COPY.pt.footer_terms}</Link> {t.and}{" "}
            <Link href={`/politica-privacidade?lang=${lang}`} className="text-muted hover:text-heading">{COPY[lang]?.footer_privacy || COPY.pt.footer_privacy}</Link>.
          </p>
        </>
      }
    >
      <form onSubmit={handleSignup} className="mt-6 flex flex-col gap-4">
        <Field label={t.restaurantName}>
          <Input value={restaurantName} onChange={(e) => setRestaurantName(e.target.value)} required />
        </Field>
        <Field label="Email">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Field label={t.password}>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t.language}>
            <Select value={language} onChange={(e) => setLanguage(e.target.value)}>
              {LANGUAGES.map(({ code, label }) => (
                <option key={code} value={code}>{label}</option>
              ))}
            </Select>
          </Field>
          <Field label={t.currency}>
            <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {CURRENCIES.map((code) => (
                <option key={code} value={code}>{code} ({CURRENCY_SYMBOLS[code]})</option>
              ))}
            </Select>
          </Field>
        </div>
        {error && <p className="text-sm text-danger-text">{error}</p>}
        <Button type="submit" disabled={loading} className="mt-2">
          {loading ? t.openingStripe : t.submit}
        </Button>
      </form>
    </AuthLayout>
  );
}
