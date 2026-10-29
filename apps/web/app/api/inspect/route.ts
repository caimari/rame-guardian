import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { requestUserId } from "../../../lib/authority";
import { inspectWithNebius } from "../../../lib/nebius";

export async function POST(request: Request) {
  try {
    const userId = requestUserId(request);
    const body = await request.json() as { title?: unknown; content?: unknown };
    if (typeof body.title !== "string" || typeof body.content !== "string" || !body.title.trim() || !body.content.trim() || body.content.length > 100_000) return NextResponse.json({ error: "Invalid document." }, { status: 400 });
    const rows = await env.DB.prepare(`SELECT decision_key, value_json, statement, version FROM authority_decisions d WHERE user_id = ? AND status = 'active'
      AND version = (SELECT MAX(d2.version) FROM authority_decisions d2 WHERE d2.user_id=d.user_id AND d2.decision_key=d.decision_key)`).bind(userId).all<{ decision_key: string; value_json: string; statement: string; version: number }>();
    const decisions = rows.results.map((row) => ({ key: row.decision_key, value: JSON.parse(row.value_json), statement: row.statement, version: row.version }));
    const result = await inspectWithNebius({ title: body.title.slice(0, 200), content: body.content, decisions });
    const runId = crypto.randomUUID();
    await env.DB.prepare("INSERT INTO audit_events(id,user_id,action,subject_id,detail,created_at) VALUES(?,?,?,?,?,?)")
      .bind(crypto.randomUUID(), userId, "document.inspected", runId, JSON.stringify({ model: result.model, tasks: result.inspection.tasks.length, warnings: result.inspection.untrustedInstructionsDetected.length, proposals: result.inspection.decisionProposals.length }), Date.now()).run();
    return NextResponse.json({ runId, decisionSnapshot: decisions.map(({ key, version }) => ({ key, version })), ...result });
  } catch (error) {
    console.error("inspection_failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: error instanceof Error ? error.message : "Inspection failed." }, { status: 502 });
  }
}
