import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { ChefHat } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { detectLanguage } from "../lib/landingCopy";
import { getAuthCopy } from "../lib/authCopy";

export default function RedefinirPassword() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [lang, setLang] = useState("pt");

  useEffect(() => {
    if (!router.isReady) return;
    setLang(detectLanguage(router.query));
  }, [router.isReady, router.query]);

  const t = getAuthCopy(lang).resetPassword;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) { setError(t.mismatch); return; }
    setLoading(true);
    // The recovery link Supabase emails already establishes a temporary
    // session for this browser — updateUser() uses it to set the new password.
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) { setError(updateError.message); return; }
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
          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
            <input
              placeholder={t.newPassword} type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6}
              className="rounded-lg border border-ink-border2 bg-ink-bg px-3 py-2 text-sm text-paper placeholder:text-faint focus:border-brass focus:outline-none"
            />
            <input
              placeholder={t.confirmPassword} type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={6}
              className="rounded-lg border border-ink-border2 bg-ink-bg px-3 py-2 text-sm text-paper placeholder:text-faint focus:border-brass focus:outline-none"
            />
            {error && <p className="text-sm text-danger-text">{error}</p>}
            <button
              type="submit" disabled={loading}
              className="mt-2 rounded-lg bg-brass px-4 py-2 text-sm font-semibold text-ink-bg hover:bg-brass-light disabled:opacity-60"
            >
              {loading ? t.saving : t.submit}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
