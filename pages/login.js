import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { ChefHat } from "lucide-react";
import { supabase } from "../lib/supabaseClient";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (authError) { setError(authError.message); return; }
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
          <h1 className="text-xl font-semibold text-paper">Entrar</h1>
          <form onSubmit={handleLogin} className="mt-6 flex flex-col gap-4">
            <input
              placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
              className="rounded-lg border border-ink-border2 bg-ink-bg px-3 py-2 text-sm text-paper placeholder:text-faint focus:border-brass focus:outline-none"
            />
            <input
              placeholder="Palavra-passe" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
              className="rounded-lg border border-ink-border2 bg-ink-bg px-3 py-2 text-sm text-paper placeholder:text-faint focus:border-brass focus:outline-none"
            />
            {error && <p className="text-sm text-danger-text">{error}</p>}
            <button
              type="submit" disabled={loading}
              className="mt-2 rounded-lg bg-brass px-4 py-2 text-sm font-semibold text-ink-bg hover:bg-brass-light disabled:opacity-60"
            >
              {loading ? "A entrar…" : "Entrar"}
            </button>
          </form>
        </div>
        <p className="mt-6 text-center text-sm text-muted">
          Ainda não tens conta? <Link href="/signup" className="font-medium text-brass hover:text-brass-light">Criar conta</Link>
        </p>
      </div>
    </div>
  );
}
