import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { requestUserId, sha256 } from "../../../lib/authority";
import { repairWithNemotron } from "../../../lib/nebius";

type DecisionRow = { id: string; decision_key: string; value_json: string; statement: string; version: number; authorized_at: number };
type ResultRow = { id: string; kind: string; title: string; version: number; content_json: string; dependencies_json: string; human_edited_paths_json: string; updated_at: number };
type DraftRow = { id: string; status: string; change_request: string; target_decision_key: string; target_decision_version: number; target_hours: number; base_versions_json: string; operations_json: string; impact_json: string; model_json: string; approval_hash: string | null; approved_at: number | null; applied_at: number | null; created_at: number; updated_at: number };
type Operation = { resultId: string; nextContent: Record<string, unknown>; reason: string };

const DECISION_KEY = "work.available_hours";

export async function GET(request: Request) {
  try {
    return NextResponse.json(await readState(requestUserId(request)));
  } catch (error) {
    console.error("recovery_read_failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Recovery state could not be loaded." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const userId = requestUserId(request);
  try {
    const body = await request.json() as Record<string, unknown>;
    switch (body.action) {
      case "initialize": return initialize(userId);
      case "create_draft": return createDraft(userId, Number(body.targetHours), body.provisional === true);
      case "approve": return approve(userId, String(body.draftId ?? ""));
      case "apply": return apply(userId, String(body.draftId ?? ""), String(body.requestId ?? ""));
      case "concurrent_edit": return concurrentEdit(userId);
      default: return NextResponse.json({ error: "Unknown recovery action." }, { status: 400 });
    }
  } catch (error) {
    console.error("recovery_action_failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: error instanceof Error ? error.message : "Recovery action failed." }, { status: 500 });
  }
}

async function initialize(userId: string) {
  const decision = await latestDecision(userId);
  const hours = decision ? Number((JSON.parse(decision.value_json) as { hours?: number }).hours) : 0;
  if (!decision || hours !== 12) return NextResponse.json({ error: "Authorize the 12-hour baseline first." }, { status: 409 });
  const now = Date.now();
  const rows = [
    { id: crypto.randomUUID(), kind: "plan", title: "Delivery plan", content: { deadline: "2026-10-30", availableHours: 12, requiredHours: 12, allocation: ["Core build · 6h", "Validation · 3h", "Demo · 3h"], deliveryMode: "full" }, deps: [DECISION_KEY], protected: [] },
    { id: crypto.randomUUID(), kind: "proposal", title: "Client proposal", content: { scope: "Accessible AI launch package", price: "€2,600", accessibility: "WCAG AAA checkout", deliveryNote: "Full scope delivered by October 30" }, deps: [DECISION_KEY], protected: ["/price", "/accessibility"] },
    { id: crypto.randomUUID(), kind: "task_board", title: "Execution board", content: { tasks: [{ id: "task-audit", title: "Architecture audit", status: "done" }, { id: "task-checkout", title: "Checkout implementation", status: "todo" }, { id: "task-training", title: "Team training", status: "todo" }] }, deps: [DECISION_KEY], protected: ["/tasks/0/id", "/tasks/0/status"] },
    { id: crypto.randomUUID(), kind: "reference", title: "Independent research note", content: { topic: "Competitor evidence", status: "reviewed", conclusion: "No availability dependency" }, deps: [], protected: [] },
  ];
  const writes = [
    env.DB.prepare("DELETE FROM repair_applications WHERE user_id = ?").bind(userId),
    env.DB.prepare("DELETE FROM repair_drafts WHERE user_id = ?").bind(userId),
    env.DB.prepare("DELETE FROM work_results WHERE user_id = ?").bind(userId),
    ...rows.map((row) => env.DB.prepare(`INSERT INTO work_results(id,user_id,kind,title,version,content_json,dependencies_json,human_edited_paths_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)`)
      .bind(row.id, userId, row.kind, row.title, 1, JSON.stringify(row.content), JSON.stringify(row.deps), JSON.stringify(row.protected), now, now)),
    audit(userId, "repair.baseline_initialized", decision.id, { hours: 12, decisionVersion: decision.version, results: rows.length }, now),
  ];
  await env.DB.batch(writes);
  return NextResponse.json({ ok: true, state: await readState(userId) }, { status: 201 });
}

async function createDraft(userId: string, targetHours: number, provisional: boolean) {
  if (![6, 8].includes(targetHours)) return NextResponse.json({ error: "Target hours must be 6 or 8." }, { status: 400 });
  const decision = await latestDecision(userId);
  const results = await resultRows(userId);
  if (!decision || results.length !== 4) return NextResponse.json({ error: "Initialize the four-result baseline first." }, { status: 409 });
  const authorizedHours = Number((JSON.parse(decision.value_json) as { hours?: number }).hours);
  if (!provisional && authorizedHours !== targetHours) return NextResponse.json({ error: `The current authority is ${authorizedHours}h, not ${targetHours}h.` }, { status: 409 });
  if (provisional && targetHours !== 6) return NextResponse.json({ error: "Only the 6-hour what-if draft is provisional." }, { status: 400 });
  const publicResults = results.map(publicResult);
  const model = await repairWithNemotron({ targetHours, authority: { key: DECISION_KEY, version: decision.version, authorizedHours }, results: publicResults, provisional });
  const operations = buildOperations(results, targetHours);
  validateOperations(results, operations, targetHours);
  const now = Date.now();
  const id = crypto.randomUUID();
  const baseVersions = Object.fromEntries(results.map((row) => [row.id, row.version]));
  const preserved = results.filter((row) => !operations.some((operation) => operation.resultId === row.id)).map((row) => row.title);
  const impact = { changed: operations.map((operation) => ({ resultId: operation.resultId, reason: operation.reason })), preserved, protectedFields: ["Client proposal.price", "Client proposal.accessibility", "Architecture audit completion"], atomicWrites: operations.length };
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO repair_drafts(id,user_id,status,change_request,target_decision_key,target_decision_version,target_hours,base_versions_json,operations_json,impact_json,model_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(id, userId, "pending", `Adapt delivery to ${targetHours} available hours without moving the deadline.`, DECISION_KEY, decision.version, targetHours, JSON.stringify(baseVersions), JSON.stringify(operations), JSON.stringify(impact), JSON.stringify(model), now, now),
    audit(userId, "repair.draft_created", id, { targetHours, provisional, decisionVersion: decision.version, model: model.model, operations: operations.length }, now),
  ]);
  return NextResponse.json({ draftId: id, state: await readState(userId) }, { status: 201 });
}

async function approve(userId: string, draftId: string) {
  const draft = await draftById(userId, draftId);
  if (!draft || draft.status !== "pending") return NextResponse.json({ error: "Draft is missing or no longer pending." }, { status: 409 });
  const approvalHash = await sha256({ draftId: draft.id, targetDecisionVersion: draft.target_decision_version, baseVersions: JSON.parse(draft.base_versions_json), operations: JSON.parse(draft.operations_json) });
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare("UPDATE repair_drafts SET status='approved', approval_hash=?, approved_at=?, updated_at=? WHERE id=? AND user_id=? AND status='pending'").bind(approvalHash, now, now, draftId, userId),
    audit(userId, "repair.draft_approved", draftId, { approvalHash, decisionVersion: draft.target_decision_version }, now),
  ]);
  return NextResponse.json({ approvalHash, state: await readState(userId) });
}

async function apply(userId: string, draftId: string, requestId: string) {
  if (!requestId) return NextResponse.json({ error: "A stable request id is required." }, { status: 400 });
  const requestHash = await sha256({ userId, draftId, requestId });
  const existing = await env.DB.prepare("SELECT request_hash,response_json FROM repair_applications WHERE request_id=? AND user_id=?").bind(requestId, userId).first<{ request_hash: string; response_json: string }>();
  if (existing) {
    if (existing.request_hash !== requestHash) return NextResponse.json({ error: "Request id conflict." }, { status: 409 });
    return NextResponse.json({ ...JSON.parse(existing.response_json), replayed: true, state: await readState(userId) });
  }
  const draft = await draftById(userId, draftId);
  if (!draft || draft.status !== "approved" || !draft.approval_hash) return NextResponse.json({ error: "Approve this exact draft before applying it." }, { status: 409 });
  const operations = JSON.parse(draft.operations_json) as Operation[];
  const baseVersions = JSON.parse(draft.base_versions_json) as Record<string, number>;
  const now = Date.now();
  const response = { applied: true, draftId, requestId, replayed: false, updatedResults: operations.map((operation) => ({ id: operation.resultId, version: baseVersions[operation.resultId] + 1 })), message: "Selective repair committed atomically." };
  const versionClauses = Object.entries(baseVersions).map(() => "(id=? AND version=?)").join(" OR ");
  const versionBindings = Object.entries(baseVersions).flatMap(([id, version]) => [id, version]);
  const guard = env.DB.prepare(`INSERT INTO repair_assertions(id,ok,created_at) SELECT ?, CASE WHEN
      (SELECT status FROM repair_drafts WHERE id=? AND user_id=?)='approved'
      AND (SELECT approval_hash FROM repair_drafts WHERE id=? AND user_id=?)=?
      AND (SELECT version FROM authority_decisions WHERE user_id=? AND decision_key=? AND status='active' ORDER BY version DESC LIMIT 1)=?
      AND (SELECT COUNT(*) FROM work_results WHERE user_id=? AND (${versionClauses}))=?
      THEN 1 ELSE 0 END, ?`)
    .bind(crypto.randomUUID(), draftId, userId, draftId, userId, draft.approval_hash, userId, DECISION_KEY, draft.target_decision_version, userId, ...versionBindings, Object.keys(baseVersions).length, now);
  const writes = [guard, ...operations.map((operation) => env.DB.prepare("UPDATE work_results SET content_json=?,version=version+1,updated_at=? WHERE id=? AND user_id=? AND version=?")
    .bind(JSON.stringify(operation.nextContent), now, operation.resultId, userId, baseVersions[operation.resultId])),
    env.DB.prepare("UPDATE repair_drafts SET status='applied',applied_at=?,updated_at=? WHERE id=? AND user_id=? AND status='approved'").bind(now, now, draftId, userId),
    env.DB.prepare("INSERT INTO repair_applications(request_id,user_id,draft_id,request_hash,response_json,created_at) VALUES(?,?,?,?,?,?)").bind(requestId, userId, draftId, requestHash, JSON.stringify(response), now),
    audit(userId, "repair.applied", draftId, { requestId, decisionVersion: draft.target_decision_version, writes: operations.length, atomic: true }, now),
  ];
  try {
    await env.DB.batch(writes);
    return NextResponse.json({ ...response, state: await readState(userId) });
  } catch {
    const raced = await env.DB.prepare("SELECT request_hash,response_json FROM repair_applications WHERE request_id=? AND user_id=?").bind(requestId, userId).first<{ request_hash: string; response_json: string }>();
    if (raced?.request_hash === requestHash) return NextResponse.json({ ...JSON.parse(raced.response_json), replayed: true, state: await readState(userId) });
    const latest = await latestDecision(userId);
    const rows = await resultRows(userId);
    const changedResults = rows.filter((row) => baseVersions[row.id] !== row.version).map((row) => ({ id: row.id, title: row.title, expected: baseVersions[row.id], actual: row.version }));
    const reason = latest?.version !== draft.target_decision_version ? `Authority advanced from v${draft.target_decision_version} to v${latest?.version ?? "missing"}.` : changedResults.length ? `${changedResults.length} result version changed after the draft.` : "Atomic preconditions no longer hold.";
    const failedAt = Date.now();
    await env.DB.batch([
      env.DB.prepare("UPDATE repair_drafts SET status='stale',updated_at=? WHERE id=? AND user_id=? AND status='approved'").bind(failedAt, draftId, userId),
      audit(userId, "repair.stale_rejected", draftId, { reason, changedResults, atomic: true, partialWrites: 0 }, failedAt),
    ]);
    return NextResponse.json({ error: reason, code: "stale_repair", partialWrites: 0, state: await readState(userId) }, { status: 409 });
  }
}

async function concurrentEdit(userId: string) {
  const row = await env.DB.prepare("SELECT * FROM work_results WHERE user_id=? AND kind='task_board' LIMIT 1").bind(userId).first<ResultRow>();
  if (!row) return NextResponse.json({ error: "Initialize the baseline first." }, { status: 409 });
  const content = JSON.parse(row.content_json) as Record<string, unknown>;
  content.humanNote = `Manual review ${new Date().toISOString()}`;
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare("UPDATE work_results SET content_json=?,version=version+1,updated_at=? WHERE id=? AND user_id=? AND version=?").bind(JSON.stringify(content), now, row.id, userId, row.version),
    audit(userId, "repair.concurrent_edit", row.id, { fromVersion: row.version, toVersion: row.version + 1 }, now),
  ]);
  return NextResponse.json({ ok: true, state: await readState(userId) });
}

function buildOperations(rows: ResultRow[], hours: number): Operation[] {
  return rows.filter((row) => row.kind !== "reference").map((row) => {
    const content = JSON.parse(row.content_json) as Record<string, unknown>;
    if (row.kind === "plan") return { resultId: row.id, nextContent: { ...content, availableHours: hours, requiredHours: hours, allocation: hours === 6 ? ["Core build · 4h", "Validation · 1h", "Demo · 1h"] : ["Core build · 4h", "Validation · 2h", "Demo · 2h"], deliveryMode: hours === 6 ? "minimum viable" : "focused" }, reason: "Rebalance the authority-dependent plan." };
    if (row.kind === "proposal") return { resultId: row.id, nextContent: { ...content, deliveryNote: hours === 6 ? "Core scope by October 30; training follows separately" : "Focused scope delivered by October 30; training is asynchronous" }, reason: "Align delivery wording while preserving price and accessibility." };
    const tasks = Array.isArray(content.tasks) ? content.tasks.map((task) => {
      const item = task as Record<string, unknown>;
      return item.id === "task-training" ? { ...item, status: hours === 6 ? "deferred" : "async", note: "Moved outside the critical delivery path" } : item;
    }) : [];
    return { resultId: row.id, nextContent: { ...content, tasks }, reason: "Move only unfinished training outside the critical path." };
  });
}

function validateOperations(rows: ResultRow[], operations: Operation[], hours: number) {
  if (operations.length !== 3) throw new Error("Repair must change exactly the three dependent results.");
  const byId = new Map(rows.map((row) => [row.id, row]));
  for (const operation of operations) {
    const row = byId.get(operation.resultId);
    if (!row || row.kind === "reference") throw new Error("Repair attempted to change an unrelated result.");
    const before = JSON.parse(row.content_json) as Record<string, unknown>;
    for (const path of JSON.parse(row.human_edited_paths_json) as string[]) {
      if (JSON.stringify(atPath(before, path)) !== JSON.stringify(atPath(operation.nextContent, path))) throw new Error(`Protected field changed: ${row.title}${path}`);
    }
    if (row.kind === "plan" && Number(operation.nextContent.availableHours) !== hours) throw new Error("Plan does not match target authority.");
  }
}

function atPath(value: unknown, path: string) {
  return path.split("/").filter(Boolean).reduce<unknown>((current, part) => current && typeof current === "object" ? (current as Record<string, unknown>)[part] : undefined, value);
}

async function readState(userId: string) {
  const [decision, results, drafts, events] = await Promise.all([
    latestDecision(userId), resultRows(userId),
    env.DB.prepare("SELECT * FROM repair_drafts WHERE user_id=? ORDER BY created_at DESC LIMIT 12").bind(userId).all<DraftRow>(),
    env.DB.prepare("SELECT id,action,subject_id,detail,created_at FROM audit_events WHERE user_id=? AND action LIKE 'repair.%' ORDER BY created_at DESC LIMIT 30").bind(userId).all<{ id: string; action: string; subject_id: string; detail: string; created_at: number }>(),
  ]);
  const parsedDrafts = drafts.results.map(publicDraft);
  const staleRejected = parsedDrafts.some((draft) => draft.status === "stale");
  return {
    decision: decision ? { id: decision.id, key: decision.decision_key, value: JSON.parse(decision.value_json), statement: decision.statement, version: decision.version, authorizedAt: decision.authorized_at } : null,
    results: results.map(publicResult), drafts: parsedDrafts,
    events: events.results.map((event) => ({ ...event, detail: JSON.parse(event.detail) })),
    comparison: {
      guardian: { staleRejected, atomic: true, protectedFields: true, recovery: "1 model-assisted draft · 1 review · 1 atomic commit", evidence: "Version trace + approval hash + idempotency receipt" },
      reference: { staleRejected, atomic: true, protectedFields: true, recovery: "4 records reopened · manual dependency review · 3 coordinated edits", evidence: "Transaction log only" },
    },
  };
}

async function latestDecision(userId: string) {
  return env.DB.prepare("SELECT id,decision_key,value_json,statement,version,authorized_at FROM authority_decisions WHERE user_id=? AND decision_key=? AND status='active' ORDER BY version DESC LIMIT 1").bind(userId, DECISION_KEY).first<DecisionRow>();
}
async function resultRows(userId: string) { return (await env.DB.prepare("SELECT * FROM work_results WHERE user_id=? ORDER BY kind,title").bind(userId).all<ResultRow>()).results; }
async function draftById(userId: string, id: string) { return env.DB.prepare("SELECT * FROM repair_drafts WHERE id=? AND user_id=?").bind(id, userId).first<DraftRow>(); }
function publicResult(row: ResultRow) { return { id: row.id, kind: row.kind, title: row.title, version: row.version, content: JSON.parse(row.content_json), dependencies: JSON.parse(row.dependencies_json), humanEditedPaths: JSON.parse(row.human_edited_paths_json), updatedAt: row.updated_at }; }
function publicDraft(row: DraftRow) { return { id: row.id, status: row.status, changeRequest: row.change_request, targetDecisionKey: row.target_decision_key, targetDecisionVersion: row.target_decision_version, targetHours: row.target_hours, baseVersions: JSON.parse(row.base_versions_json), operations: JSON.parse(row.operations_json), impact: JSON.parse(row.impact_json), model: JSON.parse(row.model_json), approvalHash: row.approval_hash, approvedAt: row.approved_at, appliedAt: row.applied_at, createdAt: row.created_at }; }
function audit(userId: string, action: string, subjectId: string, detail: unknown, at: number) { return env.DB.prepare("INSERT INTO audit_events(id,user_id,action,subject_id,detail,created_at) VALUES(?,?,?,?,?,?)").bind(crypto.randomUUID(), userId, action, subjectId, JSON.stringify(detail), at); }
