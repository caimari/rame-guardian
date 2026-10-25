import { env } from "cloudflare:workers";
import type { ChatRequest, ChatResponse, MemoryProposal } from "./contracts";

const BASE_URL = "https://api.tokenfactory.nebius.com/v1";
const MODEL = "nvidia/Nemotron-3_5-Lightning";

const SYSTEM_PROMPT = `You are RAME Guardian, a concise personal AI agent with user-governed memory.
Never claim that something was stored. Memory is only stored after a separate user confirmation.
Return valid JSON only with this shape: {"reply":"helpful answer","proposal":null}
If the user states a durable personal preference, workflow, or project fact that would clearly help later, propose exactly one atomic memory using: {"reply":"helpful answer that mentions a proposal is ready","proposal":{"statement":"First-person, standalone fact","scope":"preference|workflow|project","confidence":0.0}}
Do not propose sensitive secrets, credentials, health, financial, political, religious, or intimate data. Do not infer traits.`;

export async function chatWithNebius(input: ChatRequest): Promise<ChatResponse> {
  const apiKey = env.NEBIUS_API_KEY;
  if (!apiKey) throw new Error("Nebius is not configured on this deployment.");
  const memory = input.authorizedMemory.length
    ? `\nAuthorized memory (use as context, do not repeat unless relevant):\n- ${input.authorizedMemory.join("\n- ")}`
    : "\nThere is no authorized memory yet.";
  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "system", content: SYSTEM_PROMPT + memory }, ...input.messages],
      temperature: 0.2,
      max_tokens: 500,
      response_format: { type: "json_object" },
      chat_template_kwargs: { enable_thinking: false },
    }),
  });
  if (!response.ok) throw new Error(`Nebius returned HTTP ${response.status}.`);
  const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("Nebius returned an empty response.");
  const parsed = JSON.parse(content) as { reply?: unknown; proposal?: unknown };
  if (typeof parsed.reply !== "string") throw new Error("Nebius returned an invalid response.");
  return { reply: parsed.reply, proposal: normalizeProposal(parsed.proposal), model: MODEL };
}

function normalizeProposal(value: unknown): MemoryProposal | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  const scopes = ["preference", "workflow", "project"];
  if (typeof candidate.statement !== "string" || !scopes.includes(String(candidate.scope))) return null;
  const confidence = Number(candidate.confidence);
  return {
    statement: candidate.statement.slice(0, 320),
    scope: candidate.scope as MemoryProposal["scope"],
    confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0.5,
  };
}
