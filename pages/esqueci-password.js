import { useState } from "react";
import Link from "next/link";
import { ChefHat } from "lucide-react";
import { supabase } from "../lib/supabaseClient";

export default function EsqueciPassword() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/redefinir-password`,
    });
    setLoading(false);
    if (resetError) { setError(resetError.message); return; }
    setSent(true);
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
          <h1 className="text-xl font-semibold text-paper">Recuperar palavra-passe</h1>

          {sent ? (
            <p className="mt-6 text-sm text-good">
              Se existir uma conta com esse email, enviámos um link para redefinires a palavra-passe. Verifica a caixa de entrada (e o spam).
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
              <p className="text-sm text-muted">Indica o email da tua conta e enviamos-te um link para criares uma nova palavra-passe.</p>
              <input
                placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                className="rounded-lg border border-ink-border2 bg-ink-bg px-3 py-2 text-sm text-paper placeholder:text-faint focus:border-brass focus:outline-none"
              />
              {error && <p className="text-sm text-danger-text">{error}</p>}
              <button
                type="submit" disabled={loading}
                className="mt-2 rounded-lg bg-brass px-4 py-2 text-sm font-semibold text-ink-bg hover:bg-brass-light disabled:opacity-60"
              >
                {loading ? "A enviar…" : "Enviar link de recuperação"}
              </button>
            </form>
          )}
        </div>
        <p className="mt-6 text-center text-sm text-muted">
          <Link href="/login" className="font-medium text-brass hover:text-brass-light">← Voltar ao login</Link>
        </p>
      </div>
    </div>
  );
}
