import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { requestUserId } from "../../../../lib/authority";

const TABLES = [
  "authorization_receipts", "authority_proposals", "authority_decisions", "action_attempts", "calendar_blocks",
  "memory_versions", "repair_applications", "repair_drafts", "work_results", "audit_events",
] as const;

export async function POST(request: Request) {
  const userId = await requestUserId(request);
  if (!userId) return NextResponse.json({ error: "A valid demo session is required." }, { status: 401 });
  try {
    await env.DB.batch([
      ...TABLES.map((table) => env.DB.prepare(`DELETE FROM ${table} WHERE user_id=?`).bind(userId)),
      env.DB.prepare("DELETE FROM demo_rate_limits WHERE bucket_key LIKE ?").bind(`session:${userId}:%`),
    ]);
    return NextResponse.json({ reset: true });
  } catch (error) {
    console.error("demo_reset_failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "The demo session could not be reset." }, { status: 500 });
  }
}
