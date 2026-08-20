import { useEffect, useRef, useState } from "react";
import { Send, Sparkles } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { useRestaurant } from "../../lib/useRestaurant";
import { useDetectedLanguage } from "../../lib/landingCopy";
import { getDashCopy } from "../../lib/dashboardCopy";
import PageShell from "../../components/ui/PageShell";
import Input from "../../components/ui/Input";
import Button from "../../components/ui/Button";

export default function SupportPage() {
  const { restaurant, loading: restaurantLoading, error: restaurantError } = useRestaurant();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef(null);

  const browserLang = useDetectedLanguage();
  const lang = restaurant?.language || browserLang;
  const dash = getDashCopy(lang);
  const t = dash.support;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  const sendMessage = async (text) => {
    if (!text || sending) return;

    const nextMessages = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setInput("");
    setSending(true);
    setError("");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/support-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ language: lang, messages: nextMessages }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "error");
      setMessages([...nextMessages, { role: "assistant", content: body.reply || "…" }]);
    } catch (err) {
      setError(t.errorGeneric);
    }
    setSending(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    sendMessage(input.trim());
  };

  if (restaurantLoading) return <p className="p-10 text-muted">{dash.common.loading}</p>;
  if (restaurantError) return <p className="p-10 text-danger-text">{restaurantError}</p>;

  return (
    <PageShell
      lang={lang}
      contentClassName="flex min-w-0 flex-1 flex-col overflow-x-auto"
      className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-8 sm:px-6 lg:px-8"
    >
      <h1 className="text-2xl font-bold text-heading">{t.title}</h1>
      <p className="mt-1 text-sm text-muted">{t.subtitle}</p>

      <div ref={scrollRef} className="mt-6 flex-1 space-y-3 overflow-y-auto rounded-2xl bg-surface-card p-4 shadow-soft" style={{ minHeight: "50vh", maxHeight: "60vh" }}>
        {messages.length === 0 && !sending && (
          <p className="flex h-full items-center justify-center text-center text-sm text-muted">{t.emptyState}</p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                m.role === "user" ? "bg-gradient-to-br from-brass-light to-brass text-heading" : "bg-surface-sunken text-heading"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="flex items-center gap-1.5 rounded-2xl bg-surface-sunken px-3.5 py-2 text-sm text-muted">
              <Sparkles size={14} className="animate-pulse text-brass" /> {t.thinking}
            </div>
          </div>
        )}
      </div>

      {error && <p className="mt-2 text-sm text-danger-text">{error}</p>}

      <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
        <Input
          value={input} onChange={(e) => setInput(e.target.value)} placeholder={t.placeholder}
          disabled={sending}
          className="flex-1"
        />
        <Button type="submit" disabled={sending || !input.trim()} icon={Send}>
          {t.send}
        </Button>
      </form>
    </PageShell>
  );
}
