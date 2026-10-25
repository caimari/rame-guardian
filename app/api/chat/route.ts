import { NextResponse } from "next/server";
import type { ChatRequest } from "../../../lib/contracts";
import { chatWithNebius } from "../../../lib/nebius";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ChatRequest;
    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      return NextResponse.json({ error: "A message is required." }, { status: 400 });
    }
    const safe: ChatRequest = {
      messages: body.messages.slice(-8)
        .filter((item) => (item.role === "user" || item.role === "assistant") && typeof item.content === "string")
        .map((item) => ({ role: item.role, content: item.content.slice(0, 4000) })),
      authorizedMemory: Array.isArray(body.authorizedMemory)
        ? body.authorizedMemory.filter((item): item is string => typeof item === "string").slice(0, 20)
        : [],
    };
    return NextResponse.json(await chatWithNebius(safe));
  } catch (error) {
    console.error("chat_failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: error instanceof Error ? error.message : "The agent is unavailable." }, { status: 502 });
  }
}
