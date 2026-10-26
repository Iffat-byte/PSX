import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";
const MAX_CONTEXT_CHARS = 60_000;

const SYSTEM = `You are the PSX Pilot research assistant for an individual investor on the Pakistan Stock Exchange.
You answer questions about the user's own portfolio records, which are provided as JSON in <portfolio_context>.

Rules:
- Use only the figures in <portfolio_context> and general financial knowledge. Never invent prices, financial statements, company announcements, dividends, Shariah status, trading signals or sources.
- Market prices in the context come from the data source named in "dataSource". If it says demo/synthetic, say so when you use a price.
- If information is missing, say what is missing and how the user could add it in PSX Pilot.
- You provide education and analysis of the user's own records, not personalised investment advice. Do not tell the user to buy or sell a specific security; you may explain trade-offs, scenarios and risks.
- Reply in the user's language. If they write Roman Urdu, reply in clear Roman Urdu; otherwise English.
- Use PKR formatting like "Rs 1,234". Be concise and use short bullet lists where helpful.`;

export async function GET() {
  return NextResponse.json({ configured: Boolean(process.env.ANTHROPIC_API_KEY), model: process.env.ANTHROPIC_API_KEY ? MODEL : null });
}

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "AI service not configured" }, { status: 503 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { question, context, history } = (body ?? {}) as { question?: unknown; context?: unknown; history?: unknown };
  if (typeof question !== "string" || !question.trim() || question.length > 2000) {
    return NextResponse.json({ error: "Question must be 1–2000 characters" }, { status: 400 });
  }
  const ctxText = JSON.stringify(context ?? {});
  if (ctxText.length > MAX_CONTEXT_CHARS) {
    return NextResponse.json({ error: "Portfolio context too large" }, { status: 413 });
  }
  const prior = Array.isArray(history)
    ? history
        .filter((m): m is { role: "user" | "assistant"; content: string } => !!m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
        .slice(-8)
        .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }))
    : [];
  // Conversation must start with a user turn.
  while (prior.length && prior[0].role !== "user") prior.shift();

  const client = new Anthropic();
  try {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: { effort: "low" },
      system: SYSTEM,
      messages: [
        ...prior,
        { role: "user", content: `<portfolio_context>\n${ctxText}\n</portfolio_context>\n\n${question.trim()}` },
      ],
    });
    if (response.stop_reason === "refusal") {
      return NextResponse.json({ answer: "I can't help with that request. Try asking about your portfolio records, calculations or general investing concepts." });
    }
    const text = response.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
    return NextResponse.json({ answer: text || "(No answer returned.)", model: response.model });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) return NextResponse.json({ error: "The AI service is busy. Please try again shortly." }, { status: 429 });
    if (err instanceof Anthropic.AuthenticationError) return NextResponse.json({ error: "AI service credentials are invalid." }, { status: 502 });
    if (err instanceof Anthropic.APIError) return NextResponse.json({ error: "The AI service returned an error." }, { status: 502 });
    return NextResponse.json({ error: "Could not reach the AI service." }, { status: 502 });
  }
}
