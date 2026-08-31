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
