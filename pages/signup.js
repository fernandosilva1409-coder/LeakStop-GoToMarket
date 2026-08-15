import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { ChefHat } from "lucide-react";
import { supabase } from "../lib/supabaseClient";

export default function Signup() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [restaurantName, setRestaurantName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
      setError("Conta criada — confirma o teu email antes de continuar.");
      setLoading(false);
      return;
    }

    // create_restaurant_for_user (see supabase/schema.sql) creates the restaurant,
    // the owner membership row, and a zeroed overhead row in one transaction.
    const { data: restaurantId, error: rpcError } = await supabase.rpc("create_restaurant_for_user", {
      restaurant_name: restaurantName,
      p_currency: "EUR",
      p_language: "pt",
    });
    if (rpcError) { setError(rpcError.message); setLoading(false); return; }

    router.push("/dashboard");
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
          <h1 className="text-xl font-semibold text-paper">Criar conta</h1>
          <form onSubmit={handleSignup} className="mt-6 flex flex-col gap-4">
            <input
              placeholder="Nome do restaurante" value={restaurantName} onChange={(e) => setRestaurantName(e.target.value)} required
              className="rounded-lg border border-ink-border2 bg-ink-bg px-3 py-2 text-sm text-paper placeholder:text-faint focus:border-brass focus:outline-none"
            />
            <input
              placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
              className="rounded-lg border border-ink-border2 bg-ink-bg px-3 py-2 text-sm text-paper placeholder:text-faint focus:border-brass focus:outline-none"
            />
            <input
              placeholder="Palavra-passe" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6}
              className="rounded-lg border border-ink-border2 bg-ink-bg px-3 py-2 text-sm text-paper placeholder:text-faint focus:border-brass focus:outline-none"
            />
            {error && <p className="text-sm text-danger-text">{error}</p>}
            <button
              type="submit" disabled={loading}
              className="mt-2 rounded-lg bg-brass px-4 py-2 text-sm font-semibold text-ink-bg hover:bg-brass-light disabled:opacity-60"
            >
              {loading ? "A criar…" : "Criar conta"}
            </button>
          </form>
        </div>
        <p className="mt-6 text-center text-sm text-muted">
          Já tens conta? <Link href="/login" className="font-medium text-brass hover:text-brass-light">Entrar</Link>
        </p>
        <p className="mt-3 text-center text-xs text-faint">
          Ao criar conta, aceitas os{" "}
          <Link href="/termos" className="text-muted hover:text-paper">Termos de Serviço</Link> e a{" "}
          <Link href="/politica-privacidade" className="text-muted hover:text-paper">Política de Privacidade</Link>.
        </p>
      </div>
    </div>
  );
}
