import { mkdirSync } from "node:fs";
import { join } from "node:path";
import Fastify from "fastify";
import { z } from "zod";
import { AuthorityEngine, AuthorityError, verifyReceipt } from "@rame/authority";
import { loadReceiptSigner } from "./keys.js";
import { SqliteAuthorityRepository } from "./sqlite-repository.js";
import { NebiusClient } from "./nebius-client.js";
import { ActionConflictError, protectedActionInputSchema, SqliteActionExecutor } from "./action-executor.js";
import { createResultSchema, humanEditSchema, prepareRepairSchema, ProtectedHumanEditError, RevisionConflictError, SqliteRevisionWorkspace } from "./revision-workspace.js";

const dataDirectory = process.env.RAME_DATA_DIR ?? join(process.cwd(), "data");
mkdirSync(dataDirectory, { recursive: true, mode: 0o700 });
const repository = new SqliteAuthorityRepository(join(dataDirectory, "guardian.db"));
const signer = loadReceiptSigner(dataDirectory);
const authority = new AuthorityEngine(signer, () => new Date(), repository);
const actionExecutor = new SqliteActionExecutor(repository, authority);
const revisions = new SqliteRevisionWorkspace(repository);
const app = Fastify({ logger: true, bodyLimit: 512 * 1024 });
const nebius = process.env.NEBIUS_API_KEY ? new NebiusClient(process.env.NEBIUS_API_KEY, process.env.NEBIUS_MODEL) : null;

const proposalSchema = z.object({
  key: z.string().min(2).max(120),
  kind: z.enum(["preference", "rule", "permission"]),
  value: z.unknown(),
  statement: z.string().min(3).max(500),
  source: z.object({ class: z.enum(["user", "document", "tool", "model"]), ref: z.string().min(1).max(300), excerpt: z.string().max(1000).optional() }),
});

function userId(request: { headers: Record<string, unknown> }) {
  const value = request.headers["x-rame-user-id"];
  return typeof value === "string" && value.length > 0 ? value : "demo-user";
}

app.get("/health", async () => ({ status: "ok", service: "rame-agent", receiptKeyId: signer.keyId }));
app.get("/v1/receipt-keys/current", async () => ({ keyId: signer.keyId, algorithm: "Ed25519", publicKeyPem: signer.publicKeyPem }));

app.post("/v1/proposals", async (request, reply) => {
  const parsed = proposalSchema.safeParse(request.body);
  if (!parsed.success) return reply.code(400).send({ error: "invalid_proposal", details: parsed.error.issues });
  const proposal = authority.propose({ ownerId: userId(request), ...parsed.data });
  repository.audit(proposal.ownerId, "proposal.created", proposal.id, { key: proposal.key, source: proposal.source });
  return reply.code(201).send({ proposal });
});

app.post<{ Params: { id: string } }>("/v1/proposals/:id/authorize", async (request, reply) => {
  try {
    const result = authority.authorize(request.params.id, { id: userId(request), kind: "user" });
    return reply.code(201).send({ ...result, receiptVerified: verifyReceipt(result.receipt, signer.publicKeyPem) });
  } catch (error) {
    if (error instanceof AuthorityError) return reply.code(409).send({ error: error.code, message: error.message });
    throw error;
  }
});

app.get<{ Params: { key: string } }>("/v1/decisions/:key/latest", async (request, reply) => {
  const decision = repository.latestDecision(userId(request), request.params.key);
  return decision ? { decision } : reply.code(404).send({ error: "decision_not_found" });
});

app.get<{ Params: { id: string } }>("/v1/receipts/:id", async (request, reply) => {
  const receipt = repository.getReceipt(request.params.id);
  return receipt ? { receipt, verified: verifyReceipt(receipt, signer.publicKeyPem) } : reply.code(404).send({ error: "receipt_not_found" });
});

app.post("/v1/actions/evaluate", async (request, reply) => {
  const schema = z.object({ id: z.string(), tool: z.enum(["calendar.create_block", "tasks.create"]), parameters: z.record(z.string(), z.unknown()), decisions: z.array(z.object({ key: z.string(), version: z.number().int().positive() })) });
  const parsed = schema.safeParse(request.body);
  if (!parsed.success) return reply.code(400).send({ error: "invalid_action", details: parsed.error.issues });
  const action = { ...parsed.data, ownerId: userId(request) };
  const decision = authority.evaluate(action);
  repository.audit(action.ownerId, decision.allowed ? "action.allowed" : "action.blocked", action.id, { action, decision });
  return reply.code(decision.allowed ? 200 : 409).send({ decision });
});

app.post("/v1/actions/execute", async (request, reply) => {
  const parsed = protectedActionInputSchema.safeParse(request.body);
  if (!parsed.success) return reply.code(400).send({ error: "invalid_action", details: parsed.error.issues });
  try {
    const result = actionExecutor.execute({ ...parsed.data, ownerId: userId(request) });
    return reply.code(result.decision.allowed ? 200 : 409).send(result);
  } catch (error) {
    if (error instanceof ActionConflictError) return reply.code(409).send({ error: "action_id_conflict", message: error.message });
    throw error;
  }
});

app.get("/v1/outputs/tasks", async (request) => ({ tasks: actionExecutor.listTasks(userId(request)) }));
app.get("/v1/outputs/calendar", async (request) => ({ calendarBlocks: actionExecutor.listCalendarBlocks(userId(request)) }));
app.get("/v1/results", async (request) => ({ results: revisions.listResults(userId(request)) }));

app.post("/v1/results", async (request, reply) => {
  const parsed = createResultSchema.safeParse(request.body);
  if (!parsed.success) return reply.code(400).send({ error: "invalid_result", details: parsed.error.issues });
  return reply.code(201).send({ result: revisions.createResult(userId(request), parsed.data) });
});

app.post<{ Params: { id: string } }>("/v1/results/:id/human-edit", async (request, reply) => {
  const parsed = humanEditSchema.safeParse(request.body);
  if (!parsed.success) return reply.code(400).send({ error: "invalid_edit", details: parsed.error.issues });
  const result = revisions.applyHumanEdit(userId(request), request.params.id, parsed.data.path, parsed.data.value);
  return result ? { result } : reply.code(404).send({ error: "result_not_found" });
});

app.post("/v1/repairs/prepare", async (request, reply) => {
  const parsed = prepareRepairSchema.safeParse(request.body);
  if (!parsed.success) return reply.code(400).send({ error: "invalid_repair", details: parsed.error.issues });
  try {
    return reply.code(201).send({ repair: revisions.prepareRepair(userId(request), parsed.data) });
  } catch (error) {
    if (error instanceof ProtectedHumanEditError) return reply.code(409).send({ error: "human_edit_protected", message: error.message, resultId: error.resultId, path: error.path });
    throw error;
  }
});

app.get<{ Params: { id: string } }>("/v1/repairs/:id", async (request, reply) => {
  const repair = revisions.getRepair(userId(request), request.params.id);
  return repair ? { repair } : reply.code(404).send({ error: "repair_not_found" });
});

app.post<{ Params: { id: string } }>("/v1/repairs/:id/apply", async (request, reply) => {
  try {
    return revisions.applyRepair(userId(request), request.params.id);
  } catch (error) {
    if (error instanceof RevisionConflictError) return reply.code(409).send({ error: "repair_stale", message: error.message, conflicts: error.conflicts });
    throw error;
  }
});
app.get("/v1/audit", async (request) => ({ events: repository.listAuditEvents(userId(request)) }));

app.post("/v1/agent/inspect-document", async (request, reply) => {
  if (!nebius) return reply.code(503).send({ error: "nebius_not_configured" });
  const schema = z.object({ title: z.string().min(1).max(200), content: z.string().min(1).max(100_000) });
  const parsed = schema.safeParse(request.body);
  if (!parsed.success) return reply.code(400).send({ error: "invalid_document", details: parsed.error.issues });
  const ownerId = userId(request);
  const result = await nebius.inspectDocument({ ...parsed.data, authorizedDecisions: repository.listLatestDecisions(ownerId), currentTimezone: "Europe/Madrid" });
  const runId = crypto.randomUUID();
  repository.audit(ownerId, "document.inspected", runId, { title: parsed.data.title, model: result.model, usage: result.usage, findings: { tasks: result.inspection.tasks.length, proposals: result.inspection.decisionProposals.length, untrustedInstructions: result.inspection.untrustedInstructionsDetected.length } });
  return { runId, ...result };
});

const port = Number(process.env.PORT ?? 8787);
await app.listen({ host: process.env.HOST ?? "127.0.0.1", port });
