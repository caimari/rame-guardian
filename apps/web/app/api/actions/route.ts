import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { requestUserId, sha256 } from "../../../lib/authority";

type Reference = { key: string; version: number };

export async function POST(request: Request) {
  const userId = await requestUserId(request);
  if (!userId) return NextResponse.json({ error: "A valid demo session is required." }, { status: 401 });
  const body = await request.json() as { id?: unknown; tool?: unknown; parameters?: Record<string, unknown>; decisions?: Reference[] };
  if (typeof body.id !== "string" || body.tool !== "calendar.create_block" || !body.parameters || !Array.isArray(body.decisions) || body.decisions.length === 0) return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  const hash = await sha256({ ...body, userId });
  const existing = await env.DB.prepare("SELECT request_hash, response_json FROM action_attempts WHERE id = ? AND user_id = ?").bind(body.id, userId).first<{ request_hash: string; response_json: string }>();
  if (existing) {
    if (existing.request_hash !== hash) return NextResponse.json({ error: "Action id conflict." }, { status: 409 });
    return NextResponse.json({ ...JSON.parse(existing.response_json), replayed: true });
  }
  let code = "allowed";
  let reason = "All referenced decisions are current and permit the action.";
  for (const reference of body.decisions) {
    const latest = await env.DB.prepare("SELECT version, value_json FROM authority_decisions WHERE user_id = ? AND decision_key = ? AND status = 'active' ORDER BY version DESC LIMIT 1").bind(userId, reference.key).first<{ version: number; value_json: string }>();
    if (!latest) { code = "missing_decision"; reason = `No active decision exists for ${reference.key}.`; break; }
    if (latest.version !== reference.version) { code = "stale_decision"; reason = `${reference.key} advanced from v${reference.version} to v${latest.version}.`; break; }
    if (reference.key === "calendar.not_before") {
      const rule = JSON.parse(latest.value_json) as { time?: string };
      const start = String(body.parameters.start ?? "");
      const match = start.match(/T(\d{2}):(\d{2})/);
      if (!match || !rule.time || `${match[1]}:${match[2]}` < rule.time) { code = "constraint_denied"; reason = `The action starts before the authorized ${rule.time ?? "invalid"} boundary.`; break; }
    }
  }
  const allowed = code === "allowed";
  const now = Date.now();
  const effect = allowed ? { kind: "calendar_block", id: crypto.randomUUID(), title: String(body.parameters.title ?? "Work block"), start: String(body.parameters.start), end: String(body.parameters.end) } : null;
  const response = { decision: { allowed, code, reason, checkedDecisions: body.decisions }, effect, replayed: false };
  const writes = [
    env.DB.prepare("INSERT INTO action_attempts(id,user_id,request_hash,allowed,code,response_json,created_at) VALUES(?,?,?,?,?,?,?)").bind(body.id, userId, hash, allowed ? 1 : 0, code, JSON.stringify(response), now),
    env.DB.prepare("INSERT INTO audit_events(id,user_id,action,subject_id,detail,created_at) VALUES(?,?,?,?,?,?)").bind(crypto.randomUUID(), userId, allowed ? "action.executed" : "action.blocked", body.id, JSON.stringify({ code, reason, decisions: body.decisions }), now),
  ];
  if (effect) writes.push(env.DB.prepare("INSERT INTO calendar_blocks(id,user_id,action_id,title,start_at,end_at,created_at) VALUES(?,?,?,?,?,?,?)").bind(effect.id, userId, body.id, effect.title, effect.start, effect.end, now));
  await env.DB.batch(writes);
  return NextResponse.json(response, { status: allowed ? 200 : 409 });
}
