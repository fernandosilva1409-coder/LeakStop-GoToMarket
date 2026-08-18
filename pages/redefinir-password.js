import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";
import { detectLanguage } from "../lib/landingCopy";
import { getAuthCopy } from "../lib/authCopy";
import AuthLayout from "../components/ui/AuthLayout";
import Field from "../components/ui/Field";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";

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
    <AuthLayout title={t.title}>
      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        <Field label={t.newPassword}>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
        </Field>
        <Field label={t.confirmPassword}>
          <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={6} />
        </Field>
        {error && <p className="text-sm text-danger-text">{error}</p>}
        <Button type="submit" disabled={loading} className="mt-2">
          {loading ? t.saving : t.submit}
        </Button>
      </form>
    </AuthLayout>
  );
}
