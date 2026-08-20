import { useEffect, useRef, useState } from "react";
import { Send, Sparkles, Pin, PinOff, Trash2 } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { useRestaurant } from "../../lib/useRestaurant";
import { useDetectedLanguage } from "../../lib/landingCopy";
import { getDashCopy } from "../../lib/dashboardCopy";
import PageShell from "../../components/ui/PageShell";
import Input from "../../components/ui/Input";
import Button from "../../components/ui/Button";
import WidgetChart from "../../components/ui/WidgetChart";
import { fetchAllRows } from "../../lib/supabaseUtils";

export default function ChatPage() {
  const { restaurant, loading: restaurantLoading, error: restaurantError } = useRestaurant();
  const [messages, setMessages] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef(null);

  const browserLang = useDetectedLanguage();
  const lang = restaurant?.language || browserLang;
  const dash = getDashCopy(lang);
  const t = dash.chat;
  const currency = restaurant?.currency || "EUR";

  useEffect(() => {
    if (!restaurant) return;
    (async () => {
      const data = await fetchAllRows(() =>
        supabase.from("chat_messages").select("*").eq("restaurant_id", restaurant.id).order("created_at", { ascending: true })
      );
      setMessages((data || []).map((m) => ({ id: m.id, role: m.role, content: m.content, toolCalls: m.tool_calls || [], pinned: m.pinned })));
      setHistoryLoading(false);
    })();
  }, [restaurant]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  const sendMessage = async (text) => {
    if (!text || sending || !restaurant) return;

    setSending(true);
    setError("");

    const { data: userRow } = await supabase
      .from("chat_messages")
      .insert({ restaurant_id: restaurant.id, role: "user", content: text })
      .select()
      .single();
    const userMessage = { id: userRow?.id, role: "user", content: text };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ restaurantId: restaurant.id, messages: nextMessages }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "error");

      const reply = body.reply || "…";
      const toolCalls = body.toolCalls || [];
      const { data: assistantRow } = await supabase
        .from("chat_messages")
        .insert({ restaurant_id: restaurant.id, role: "assistant", content: reply, tool_calls: toolCalls })
        .select()
        .single();
      setMessages([...nextMessages, { id: assistantRow?.id, role: "assistant", content: reply, toolCalls, pinned: false }]);
    } catch (err) {
      setError(t.errorGeneric);
    }
    setSending(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    sendMessage(input.trim());
  };

  const handlePin = async (msg, question) => {
    if (!restaurant || !msg.toolCalls?.length || msg.pinned) return;
    const lastCall = msg.toolCalls[msg.toolCalls.length - 1];
    const { error: insertError } = await supabase.from("analytics_widgets").insert({
      restaurant_id: restaurant.id,
      title: question.slice(0, 200),
      tool_name: lastCall.name,
      tool_input: lastCall.input || {},
      data: lastCall.output,
    });
    if (insertError) return;
    if (msg.id) await supabase.from("chat_messages").update({ pinned: true }).eq("id", msg.id);
    setMessages((prev) => prev.map((m) => (m === msg ? { ...m, pinned: true } : m)));
  };

  const handleClear = async () => {
    if (!restaurant || messages.length === 0 || !window.confirm(t.clearConfirm)) return;
    await supabase.from("chat_messages").delete().eq("restaurant_id", restaurant.id);
    setMessages([]);
  };

  if (restaurantLoading) return <p className="p-10 text-muted">{dash.common.loading}</p>;
  if (restaurantError) return <p className="p-10 text-danger-text">{restaurantError}</p>;

  return (
    <PageShell
      lang={lang}
      contentClassName="flex min-w-0 flex-1 flex-col overflow-x-auto"
      className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-8 sm:px-6 lg:px-8"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-heading">{t.title}</h1>
          <p className="mt-1 text-sm text-muted">{t.subtitle}</p>
        </div>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={handleClear}
            className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:bg-surface-sunken hover:text-danger-text"
          >
            <Trash2 size={13} /> {t.clearButton}
          </button>
        )}
      </div>

      <div ref={scrollRef} className="mt-6 flex-1 space-y-3 overflow-y-auto rounded-2xl bg-surface-card p-4 shadow-soft" style={{ minHeight: "50vh", maxHeight: "60vh" }}>
        {historyLoading && (
          <p className="flex h-full items-center justify-center text-center text-sm text-muted">{dash.common.loading}</p>
        )}
        {!historyLoading && messages.length === 0 && !sending && (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <p className="text-sm text-muted">{t.emptyState}</p>
            {t.suggestions?.length > 0 && (
              <div className="w-full max-w-md">
                <p className="mb-2 font-mono text-xs font-semibold uppercase tracking-wide text-brass">{t.suggestionsTitle}</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {t.suggestions.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => sendMessage(q)}
                      className="rounded-full bg-surface-sunken px-3 py-1.5 text-xs font-medium text-heading shadow-soft transition-colors hover:bg-gradient-to-br hover:from-brass-light hover:to-brass"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={m.id || i} className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}>
            <div
              className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                m.role === "user" ? "bg-gradient-to-br from-brass-light to-brass text-heading" : "bg-surface-sunken text-heading"
              }`}
            >
              {m.content}
            </div>
            {m.role === "assistant" && m.toolCalls?.length > 0 && (
              <>
                <div className="mt-2 w-full max-w-md rounded-2xl bg-surface-card p-4 shadow-soft">
                  <WidgetChart
                    toolName={m.toolCalls[m.toolCalls.length - 1].name}
                    toolInput={m.toolCalls[m.toolCalls.length - 1].input}
                    data={m.toolCalls[m.toolCalls.length - 1].output}
                    currency={currency}
                    labels={dash.analytics}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handlePin(m, messages[i - 1]?.content || m.content)}
                  disabled={m.pinned}
                  className={`mt-1 flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                    m.pinned ? "text-good" : "text-muted hover:bg-surface-sunken hover:text-heading"
                  }`}
                >
                  {m.pinned ? <Pin size={12} /> : <PinOff size={12} />}
                  {m.pinned ? t.pinned : t.pinButton}
                </button>
              </>
            )}
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
