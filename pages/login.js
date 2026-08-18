import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { supabase } from "../lib/supabaseClient";
import { detectLanguage } from "../lib/landingCopy";
import { getAuthCopy } from "../lib/authCopy";
import AuthLayout from "../components/ui/AuthLayout";
import Field from "../components/ui/Field";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";

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
    <AuthLayout
      title={t.title}
      footer={
        <p className="mt-6 text-center text-sm text-muted">
          {t.noAccount} <Link href={`/signup?lang=${lang}`} className="font-medium text-brass hover:text-brass-dark">{t.createAccount}</Link>
        </p>
      }
    >
      <form onSubmit={handleLogin} className="mt-6 flex flex-col gap-4">
        <Field label="Email">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Field label={t.password}>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </Field>
        <Link href={`/esqueci-password?lang=${lang}`} className="-mt-2 self-end text-xs text-muted hover:text-brass">{t.forgotPassword}</Link>
        {error && <p className="text-sm text-danger-text">{error}</p>}
        <Button type="submit" disabled={loading} className="mt-2">
          {loading ? t.loggingIn : t.submit}
        </Button>
      </form>
    </AuthLayout>
  );
}
