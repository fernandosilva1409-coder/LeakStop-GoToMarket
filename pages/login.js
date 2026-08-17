import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { ChefHat } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { detectLanguage } from "../lib/landingCopy";
import { getAuthCopy } from "../lib/authCopy";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [lang, setLang] = useState("pt");

  useEffect(() => {
    if (!router.isReady) return;
    setLang(detectLanguage(router.query));
  }, [router.isReady, router.query]);

  const t = getAuthCopy(lang).login;

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
          <h1 className="text-xl font-semibold text-paper">{t.title}</h1>
          <form onSubmit={handleLogin} className="mt-6 flex flex-col gap-4">
            <input
              placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
              className="rounded-lg border border-ink-border2 bg-ink-bg px-3 py-2 text-sm text-paper placeholder:text-faint focus:border-brass focus:outline-none"
            />
            <input
              placeholder={t.password} type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
              className="rounded-lg border border-ink-border2 bg-ink-bg px-3 py-2 text-sm text-paper placeholder:text-faint focus:border-brass focus:outline-none"
            />
            <Link href={`/esqueci-password?lang=${lang}`} className="-mt-2 self-end text-xs text-muted hover:text-brass">{t.forgotPassword}</Link>
            {error && <p className="text-sm text-danger-text">{error}</p>}
            <button
              type="submit" disabled={loading}
              className="mt-2 rounded-lg bg-brass px-4 py-2 text-sm font-semibold text-ink-bg hover:bg-brass-light disabled:opacity-60"
            >
              {loading ? t.loggingIn : t.submit}
            </button>
          </form>
        </div>
        <p className="mt-6 text-center text-sm text-muted">
          {t.noAccount} <Link href={`/signup?lang=${lang}`} className="font-medium text-brass hover:text-brass-light">{t.createAccount}</Link>
        </p>
      </div>
    </div>
  );
}
