import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { requestUserId, signReceipt } from "../../../lib/authority";

type ProposalRow = { id: string; user_id: string; decision_key: string; kind: string; value_json: string; statement: string; based_on_version: number | null; status: string; source_ref: string; source_excerpt: string | null; created_at: number };
type DecisionRow = { id: string; decision_key: string; kind: string; value_json: string; statement: string; version: number; previous_decision_id: string | null; authorized_at: number; status: string };

export async function GET(request: Request) {
  const userId = await requestUserId(request);
  if (!userId) return NextResponse.json({ error: "A valid demo session is required." }, { status: 401 });
  const [decisions, receipts, events, calendar] = await Promise.all([
    env.DB.prepare(`SELECT d.* FROM authority_decisions d WHERE d.user_id = ? AND d.status = 'active'
      AND d.version = (SELECT MAX(d2.version) FROM authority_decisions d2 WHERE d2.user_id=d.user_id AND d2.decision_key=d.decision_key)
      ORDER BY d.decision_key`).bind(userId).all<DecisionRow>(),
    env.DB.prepare("SELECT id, decision_id, payload_json, signature, key_id, created_at FROM authorization_receipts WHERE user_id = ? ORDER BY created_at DESC LIMIT 20").bind(userId).all(),
    env.DB.prepare("SELECT id, action, subject_id, detail, created_at FROM audit_events WHERE user_id = ? ORDER BY created_at DESC LIMIT 30").bind(userId).all(),
    env.DB.prepare("SELECT id, action_id, title, start_at, end_at, created_at FROM calendar_blocks WHERE user_id = ? ORDER BY created_at DESC LIMIT 20").bind(userId).all(),
  ]);
  return NextResponse.json({
    decisions: decisions.results.map((row) => ({ id: row.id, key: row.decision_key, kind: row.kind, value: JSON.parse(row.value_json), statement: row.statement, version: row.version, previousDecisionId: row.previous_decision_id, authorizedAt: row.authorized_at, status: row.status })),
    receipts: receipts.results.map((row) => ({ ...row, payload: JSON.parse(String(row.payload_json)) })),
    events: events.results.map((row) => ({ ...row, detail: JSON.parse(String(row.detail)) })),
    calendarBlocks: calendar.results,
  });
}

export async function POST(request: Request) {
  const userId = await requestUserId(request);
  if (!userId) return NextResponse.json({ error: "A valid demo session is required." }, { status: 401 });
  const body = await request.json() as Record<string, unknown>;
  if (body.action === "propose") return propose(userId, body);
  if (body.action === "authorize") return authorize(userId, String(body.proposalId ?? ""));
  return NextResponse.json({ error: "Unknown authority action." }, { status: 400 });
}

async function propose(userId: string, body: Record<string, unknown>) {
  const key = String(body.key ?? "");
  const kind = String(body.kind ?? "");
  const statement = String(body.statement ?? "");
  if (!key || !["preference", "rule", "permission"].includes(kind) || statement.length < 3 || statement.length > 500) {
    return NextResponse.json({ error: "Invalid proposal." }, { status: 400 });
  }
  const latest = await env.DB.prepare("SELECT version FROM authority_decisions WHERE user_id = ? AND decision_key = ? ORDER BY version DESC LIMIT 1").bind(userId, key).first<{ version: number }>();
  const proposal = { id: crypto.randomUUID(), userId, key, kind, value: body.value, statement, basedOnVersion: latest?.version ?? null, status: "pending", sourceRef: String(body.sourceRef ?? "web-session"), sourceExcerpt: typeof body.sourceExcerpt === "string" ? body.sourceExcerpt.slice(0, 1000) : null, createdAt: Date.now() };
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO authority_proposals(id,user_id,decision_key,kind,value_json,statement,based_on_version,status,source_ref,source_excerpt,created_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?)`).bind(proposal.id, userId, key, kind, JSON.stringify(body.value ?? null), statement, proposal.basedOnVersion, "pending", proposal.sourceRef, proposal.sourceExcerpt, proposal.createdAt),
    env.DB.prepare("INSERT INTO audit_events(id,user_id,action,subject_id,detail,created_at) VALUES(?,?,?,?,?,?)").bind(crypto.randomUUID(), userId, "proposal.created", proposal.id, JSON.stringify({ key, basedOnVersion: proposal.basedOnVersion }), proposal.createdAt),
  ]);
  return NextResponse.json({ proposal }, { status: 201 });
}

async function authorize(userId: string, proposalId: string) {
  const proposal = await env.DB.prepare("SELECT * FROM authority_proposals WHERE id = ? AND user_id = ?").bind(proposalId, userId).first<ProposalRow>();
  if (!proposal || proposal.status !== "pending") return NextResponse.json({ error: "Proposal is missing or no longer pending." }, { status: 409 });
  const latest = await env.DB.prepare("SELECT * FROM authority_decisions WHERE user_id = ? AND decision_key = ? ORDER BY version DESC LIMIT 1").bind(userId, proposal.decision_key).first<DecisionRow>();
  if ((latest?.version ?? null) !== proposal.based_on_version) return NextResponse.json({ error: "Proposal is stale." }, { status: 409 });
  const now = Date.now();
  const decision = { id: crypto.randomUUID(), key: proposal.decision_key, kind: proposal.kind, value: JSON.parse(proposal.value_json), statement: proposal.statement, version: (latest?.version ?? 0) + 1, previousDecisionId: latest?.id ?? null, authorizedAt: now };
  const payload = { schema: "rame.authorization-receipt.v1", receiptId: crypto.randomUUID(), decisionId: decision.id, ownerId: userId, key: decision.key, version: decision.version, statement: decision.statement, value: decision.value, authorizedBy: userId, authorizedAt: new Date(now).toISOString(), previousDecisionId: decision.previousDecisionId, source: { class: "user", ref: proposal.source_ref } };
  const signed = await signReceipt(payload);
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO authority_decisions(id,user_id,decision_key,kind,value_json,statement,version,previous_decision_id,authorized_by,authorized_at,status)
      VALUES(?,?,?,?,?,?,?,?,?,?,?)`).bind(decision.id, userId, decision.key, decision.kind, JSON.stringify(decision.value), decision.statement, decision.version, decision.previousDecisionId, userId, now, "active"),
    env.DB.prepare("UPDATE authority_proposals SET status = 'authorized' WHERE id = ? AND status = 'pending'").bind(proposal.id),
    env.DB.prepare("INSERT INTO authorization_receipts(id,decision_id,user_id,payload_json,signature,key_id,created_at) VALUES(?,?,?,?,?,?,?)").bind(payload.receiptId, decision.id, userId, JSON.stringify(payload), signed.signature, signed.keyId, now),
    env.DB.prepare("INSERT INTO audit_events(id,user_id,action,subject_id,detail,created_at) VALUES(?,?,?,?,?,?)").bind(crypto.randomUUID(), userId, "decision.authorized", decision.id, JSON.stringify({ key: decision.key, version: decision.version, receiptVerified: signed.verified }), now),
  ]);
  return NextResponse.json({ decision, receipt: { ...signed, payload }, receiptVerified: signed.verified }, { status: 201 });
}
