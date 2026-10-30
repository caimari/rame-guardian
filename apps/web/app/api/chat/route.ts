import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import type { ChatRequest } from "../../../lib/contracts";
import { consumeModelBudget, requestIdentity } from "../../../lib/demo-session";
import { chatWithNebius } from "../../../lib/nebius";

export async function POST(request: Request) {
  try {
    const identity = await requestIdentity(request);
    if (!identity) return NextResponse.json({ error: "A valid demo session is required." }, { status: 401 });
    const body = (await request.json()) as ChatRequest;
    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      return NextResponse.json({ error: "A message is required." }, { status: 400 });
    }
    const decisions = await env.DB.prepare(`SELECT statement FROM authority_decisions d WHERE user_id=? AND status='active'
      AND version=(SELECT MAX(d2.version) FROM authority_decisions d2 WHERE d2.user_id=d.user_id AND d2.decision_key=d.decision_key)
      ORDER BY decision_key LIMIT 20`).bind(identity.userId).all<{ statement: string }>();
    const safe: ChatRequest = {
      messages: body.messages.slice(-8)
        .filter((item) => (item.role === "user" || item.role === "assistant") && typeof item.content === "string")
        .map((item) => ({ role: item.role, content: item.content.slice(0, 4000) })),
      authorizedMemory: decisions.results.map((item) => item.statement),
    };
    const budget = await consumeModelBudget(identity.userId);
    if (!budget.allowed) return NextResponse.json({ error: "Demo model-call limit reached. Please retry after the current hourly window." }, { status: 429, headers: { "Retry-After": String(budget.retryAfter) } });
    return NextResponse.json(await chatWithNebius(safe));
  } catch (error) {
    console.error("chat_failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: error instanceof Error ? error.message : "The agent is unavailable." }, { status: 502 });
  }
}
