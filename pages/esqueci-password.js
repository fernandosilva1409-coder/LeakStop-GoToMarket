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

export default function EsqueciPassword() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [lang, setLang] = useState("pt");

  useEffect(() => {
    if (!router.isReady) return;
    setLang(detectLanguage(router.query));
  }, [router.isReady, router.query]);

  const t = getAuthCopy(lang).forgotPassword;

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
    <AuthLayout
      title={t.title}
      footer={
        <p className="mt-6 text-center text-sm text-muted">
          <Link href={`/login?lang=${lang}`} className="font-medium text-brass hover:text-brass-dark">{t.backToLogin}</Link>
        </p>
      }
    >
      {sent ? (
        <p className="mt-6 text-sm text-good">
          {t.sentMessage}
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <p className="text-sm text-muted">{t.instructions}</p>
          <Field label="Email">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          {error && <p className="text-sm text-danger-text">{error}</p>}
          <Button type="submit" disabled={loading} className="mt-2">
            {loading ? t.sending : t.submit}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
