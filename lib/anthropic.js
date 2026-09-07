import Anthropic from "@anthropic-ai/sdk";

// Server-only — reads ANTHROPIC_API_KEY from the environment.
export const anthropic = new Anthropic();

// Cheapest current model — plenty for structured Q&A over pre-aggregated
// restaurant data through a small set of typed tools. Bump to a Sonnet/Opus
// model only for a future "deeper analysis" tier, not by default.
export const CHAT_MODEL = "claude-haiku-4-5";

// Reading a scanned/varied-layout invoice PDF and getting every line item,
// unit, and price right (this feeds cost/margin math) needs more care than
// haiku gives reliably — worth the extra cost for a document a user uploads
// a handful of times, not per chat message.
export const EXTRACTION_MODEL = "claude-sonnet-5";

// For cached, occasional narrative explanations that need to actually
// reason about a chain of pre-computed numbers (why is overhead-per-plate
// so high, given this overhead total, this period, this sold volume) rather
// than just look values up — haiku tends to restate the numbers instead of
// explaining the mechanism connecting them.
export const ANALYSIS_MODEL = "claude-sonnet-5";
