import { anthropic, CHAT_MODEL } from "../../lib/anthropic";
import { requireRestaurantMember } from "../../lib/apiAuth";
import { loadChatContext } from "../../lib/chatContext";
import { CHAT_TOOLS, runChatTool } from "../../lib/chatTools";
import { getDashCopy } from "../../lib/dashboardCopy";

const LANGUAGE_NAMES = { pt: "Portuguese", en: "English", de: "German", fr: "French", es: "Spanish" };
const MAX_TOOL_ROUNDS = 4;
const MAX_HISTORY_MESSAGES = 20;

function buildSystemPrompt(restaurant) {
  const languageName = LANGUAGE_NAMES[restaurant.language] || "Portuguese";
  const pinButtonLabel = getDashCopy(restaurant.language).chat.pinButton;
  return [
    'You are the "Chat with Your Data" assistant inside LeakStop, a restaurant cost and margin analytics app.',
    `You are answering questions about "${restaurant.name}" only. You have no access to and must never speculate about any other restaurant's data.`,
    "Use the provided tools to fetch real numbers before answering — never invent figures. If a tool returns no data for something, say so plainly instead of guessing.",
    `Monetary values returned by tools are already in the restaurant's currency (${restaurant.currency || "EUR"}) — do not convert or relabel them.`,
    "Keep answers short and concrete: lead with the number or the direct answer, then at most one or two sentences of context. This is a chat panel, not a report.",
    "This chat panel renders plain text only, not markdown — never use **bold**, bullet/dash lists, or headers. Write plain sentences, and use a plain \"em — dash\" or commas to separate items instead of a list.",
    `Whenever you use a tool, this chat panel automatically renders a small chart or KPI grid from that tool's data right below your text reply — you never need to draw one yourself or tell the user "here is a chart", it's already there. If the user asks for a chart, graph, or visualization, just answer their question in text with the real numbers and stop — the chart appears on its own. Only mention the "${pinButtonLabel}" button (use that exact label, not a translation) if the user wants to keep that chart permanently on the Analytics page, since that's what it's for, not for creating the chart in the first place.`,
    "If a question needs a breakdown or filter no tool supports (e.g. a dimension not covered by any tool's parameters), say plainly what you can't do and offer the closest thing you can answer instead — never claim you have no tools at all when other tools could still answer part of the question.",
    "When a question is about growth, performance, or how the business is doing in general financial terms (e.g. \"how much did I grow\", \"how are sales doing\"), answer with revenue, not units sold — units sold only answers the question when the user specifically asks about volume, popularity, or how many were sold. Likewise, \"most profitable\" or \"most lucrative\" means profit/margin, not revenue — the highest-revenue category or dish is not necessarily the most profitable one, so use the profit/margin fields when a tool provides them instead of picking the top revenue figure.",
    `Always respond in ${languageName}, regardless of the language of these instructions or of the tool data. If replying in Portuguese, use European Portuguese with the informal "tu" register (e.g. "tens", "podes", "a tua conta"), never Brazilian Portuguese or "você".`,
  ].join("\n");
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { restaurantId, messages } = req.body || {};
  if (!restaurantId || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "Missing restaurantId or messages" });
  }

  const { error: authError, supabase } = await requireRestaurantMember(req, restaurantId);
  if (authError) return res.status(403).json({ error: authError });

  const { data: restaurant, error: restaurantError } = await supabase
    .from("restaurants").select("*").eq("id", restaurantId).single();
  if (restaurantError || !restaurant) return res.status(404).json({ error: "Restaurant not found" });

  const conversation = messages
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-MAX_HISTORY_MESSAGES)
    .map((m) => ({ role: m.role, content: m.content }));
  if (conversation.length === 0 || conversation[conversation.length - 1].role !== "user") {
    return res.status(400).json({ error: "Last message must be from the user" });
  }

  let context;
  try {
    context = await loadChatContext(supabase, restaurant);
  } catch (err) {
    console.error("Chat context error:", err);
    return res.status(500).json({ error: "Could not load restaurant data" });
  }

  const system = buildSystemPrompt(restaurant);

  try {
    let loopMessages = conversation;
    const toolCallLog = [];
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await anthropic.messages.create({
        model: CHAT_MODEL,
        max_tokens: 1024,
        system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
        tools: CHAT_TOOLS,
        messages: loopMessages,
      });

      if (response.stop_reason !== "tool_use") {
        const text = response.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
        return res.status(200).json({ reply: text, toolCalls: toolCallLog });
      }

      const toolUseBlocks = response.content.filter((b) => b.type === "tool_use");
      const toolResults = toolUseBlocks.map((block) => {
        try {
          const output = runChatTool(block.name, block.input, context);
          toolCallLog.push({ name: block.name, input: block.input, output });
          return { type: "tool_result", tool_use_id: block.id, content: JSON.stringify(output) };
        } catch (err) {
          return { type: "tool_result", tool_use_id: block.id, content: `Error: ${err.message}`, is_error: true };
        }
      });

      loopMessages = [
        ...loopMessages,
        { role: "assistant", content: response.content },
        { role: "user", content: toolResults },
      ];
    }
    return res.status(200).json({ reply: "", toolCalls: toolCallLog });
  } catch (err) {
    console.error("Chat error:", err);
    return res.status(500).json({ error: "Could not reach the assistant" });
  }
}
