import { randomUUID } from "node:crypto";
import { z } from "zod";
import { SqliteAuthorityRepository } from "./sqlite-repository.js";

export type ResultKind = "proposal" | "plan" | "task_board" | "reference";
export type Dependency = {
  resultId: string;
  relation: string;
  confidence: "explicit" | "suggested";
};

export type WorkResult = {
  id: string;
  ownerId: string;
  kind: ResultKind;
  title: string;
  version: number;
  content: Record<string, unknown>;
  dependencies: Dependency[];
  humanEditedPaths: string[];
  createdAt: string;
  updatedAt: string;
};

export type RepairOperation = {
  resultId: string;
  op: "set" | "remove";
  path: string[];
  value: unknown;
  reason: string;
};

export type RepairAlternative = {
  id: string;
  label: string;
  consequence: string;
  requiresDecision: string | boolean;
  feasible: boolean;
};

export type RepairDraft = {
  id: string;
  ownerId: string;
  status: "pending" | "applied" | "conflicted";
  changeRequest: string;
  alternatives: RepairAlternative[];
  selectedAlternativeId: string;
  baseVersions: Record<string, number>;
  operations: RepairOperation[];
  impact: {
    affected: Array<{ id: string; title: string; version: number; changes: number }>;
    unchanged: Array<{ id: string; title: string; reason: string }>;
    preservedHumanEdits: Array<{ resultId: string; path: string }>;
  };
  createdAt: string;
  appliedAt: string | null;
};

type ResultRow = { payload: string };
type DraftRow = { payload: string };

export class RevisionConflictError extends Error {
  constructor(readonly conflicts: Array<{ resultId: string; expectedVersion: number; currentVersion: number }>) {
    super("The repair was prepared against result versions that are no longer current.");
  }
}

export class ProtectedHumanEditError extends Error {
  constructor(readonly resultId: string, readonly path: string) {
    super(`The proposed repair would overwrite the human-edited field ${path}.`);
  }
}

export class ProtectedResultStateError extends Error {
  constructor(readonly resultId: string, readonly path: string, message: string) {
    super(message);
  }
}

export const createResultSchema = z.object({
  id: z.string().uuid().optional(),
  kind: z.enum(["proposal", "plan", "task_board", "reference"]),
  title: z.string().min(1).max(180),
  content: z.record(z.string(), z.unknown()),
  dependencies: z.array(z.object({
    resultId: z.string().uuid(),
    relation: z.string().min(1).max(180),
    confidence: z.enum(["explicit", "suggested"]),
  })).max(50).default([]),
});

export const humanEditSchema = z.object({
  path: z.array(z.string().min(1).max(120)).min(1).max(20),
  value: z.unknown(),
});

const operationFields = {
  resultId: z.string().uuid(),
  path: z.array(z.string().min(1).max(120)).min(1).max(20),
  reason: z.string().min(1).max(500),
};

const operationSchema = z.object({
  ...operationFields,
  op: z.enum(["set", "remove"]),
  value: z.json(),
});

export const repairPlanSchema = z.object({
  alternatives: z.array(z.object({
    id: z.string().min(1).max(80),
    label: z.string().min(1).max(180),
    consequence: z.string().min(1).max(1_000),
    requiresDecision: z.union([z.string().min(1).max(500), z.boolean()]),
    feasible: z.boolean(),
  })).min(1).max(10),
  selectedAlternativeId: z.string().min(1).max(80),
  affectedResultIds: z.array(z.string().uuid()).min(1).max(50),
  operations: z.array(operationSchema).min(1).max(200),
});

export const prepareRepairSchema = repairPlanSchema.extend({
  changeRequest: z.string().min(3).max(2_000),
});

export type PrepareRepairInput = z.infer<typeof prepareRepairSchema>;

export class SqliteRevisionWorkspace {
  constructor(readonly repository: SqliteAuthorityRepository, readonly now = () => new Date()) {
    repository.db.exec(`
      CREATE TABLE IF NOT EXISTS work_results (
        id TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        version INTEGER NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS repair_drafts (
        id TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL,
        status TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL,
        applied_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_results_owner ON work_results(owner_id, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_repairs_owner ON repair_drafts(owner_id, created_at DESC);
    `);
  }

  createResult(ownerId: string, input: z.infer<typeof createResultSchema>): WorkResult {
    const timestamp = this.now().toISOString();
    const result: WorkResult = {
      id: input.id ?? randomUUID(),
      ownerId,
      kind: input.kind,
      title: input.title,
      version: 1,
      content: structuredClone(input.content),
      dependencies: structuredClone(input.dependencies),
      humanEditedPaths: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.repository.db.prepare(`INSERT INTO work_results(id, owner_id, kind, version, payload, created_at, updated_at)
      VALUES(?, ?, ?, ?, ?, ?, ?)`).run(result.id, ownerId, result.kind, result.version, JSON.stringify(result), timestamp, timestamp);
    this.repository.audit(ownerId, "result.created", result.id, { kind: result.kind, title: result.title, dependencies: result.dependencies });
    return result;
  }

  getResult(ownerId: string, id: string): WorkResult | null {
    const row = this.repository.db.prepare("SELECT payload FROM work_results WHERE owner_id = ? AND id = ?").get(ownerId, id) as ResultRow | undefined;
    return row ? JSON.parse(row.payload) as WorkResult : null;
  }

  listResults(ownerId: string): WorkResult[] {
    const rows = this.repository.db.prepare("SELECT payload FROM work_results WHERE owner_id = ? ORDER BY created_at, id").all(ownerId) as ResultRow[];
    return rows.map((row) => JSON.parse(row.payload) as WorkResult);
  }

  applyHumanEdit(ownerId: string, resultId: string, path: string[], value: unknown): WorkResult | null {
    const transaction = this.repository.db.transaction(() => {
      const current = this.getResult(ownerId, resultId);
      if (!current) return null;
      setAtPath(current.content, path, structuredClone(value));
      const pointer = toPointer(path);
      if (!current.humanEditedPaths.includes(pointer)) current.humanEditedPaths.push(pointer);
      current.version += 1;
      current.updatedAt = this.now().toISOString();
      this.saveResult(current);
      this.repository.audit(ownerId, "result.human_edited", resultId, { path: pointer, version: current.version });
      return current;
    });
    return transaction.immediate();
  }

  prepareRepair(ownerId: string, input: PrepareRepairInput): RepairDraft {
    const selected = input.alternatives.find((alternative) => alternative.id === input.selectedAlternativeId);
    if (!selected) throw new Error("The selected alternative does not exist.");
    if (!selected.feasible) throw new Error("An infeasible alternative cannot be prepared for application.");
    const affectedIds = new Set(input.affectedResultIds);
    const all = this.listResults(ownerId);
    const affected = all.filter((result) => affectedIds.has(result.id));
    if (affected.length !== affectedIds.size) throw new Error("One or more affected results do not exist.");

    const changesByResult = new Map<string, number>();
    for (const operation of input.operations) {
      if (!affectedIds.has(operation.resultId)) throw new Error("Every repair operation must target a declared affected result.");
      const result = affected.find((item) => item.id === operation.resultId)!;
      const pointer = toPointer(operation.path);
      const protectedPath = result.humanEditedPaths.find((candidate) => pathsOverlap(candidate, pointer));
      if (protectedPath) throw new ProtectedHumanEditError(result.id, protectedPath);
      assertOperationalStateIsPreserved(result, operation, pointer);
      changesByResult.set(result.id, (changesByResult.get(result.id) ?? 0) + 1);
    }

    const timestamp = this.now().toISOString();
    const draft: RepairDraft = {
      id: randomUUID(),
      ownerId,
      status: "pending",
      changeRequest: input.changeRequest,
      alternatives: structuredClone(input.alternatives),
      selectedAlternativeId: input.selectedAlternativeId,
      baseVersions: Object.fromEntries(affected.map((result) => [result.id, result.version])),
      operations: structuredClone(input.operations),
      impact: {
        affected: affected.map((result) => ({ id: result.id, title: result.title, version: result.version, changes: changesByResult.get(result.id) ?? 0 })),
        unchanged: all.filter((result) => !affectedIds.has(result.id)).map((result) => ({ id: result.id, title: result.title, reason: "No registered dependency on the proposed change." })),
        preservedHumanEdits: affected.flatMap((result) => result.humanEditedPaths.map((path) => ({ resultId: result.id, path }))),
      },
      createdAt: timestamp,
      appliedAt: null,
    };
    this.repository.db.prepare(`INSERT INTO repair_drafts(id, owner_id, status, payload, created_at, applied_at)
      VALUES(?, ?, ?, ?, ?, NULL)`).run(draft.id, ownerId, draft.status, JSON.stringify(draft), timestamp);
    this.repository.audit(ownerId, "repair.prepared", draft.id, { baseVersions: draft.baseVersions, impact: draft.impact });
    return draft;
  }

  getRepair(ownerId: string, id: string): RepairDraft | null {
    const row = this.repository.db.prepare("SELECT payload FROM repair_drafts WHERE owner_id = ? AND id = ?").get(ownerId, id) as DraftRow | undefined;
    return row ? JSON.parse(row.payload) as RepairDraft : null;
  }

  applyRepair(ownerId: string, draftId: string): { draft: RepairDraft; results: WorkResult[] } {
    const transaction = this.repository.db.transaction((): { ok: true; draft: RepairDraft; results: WorkResult[] } | { ok: false; conflicts: Array<{ resultId: string; expectedVersion: number; currentVersion: number }> } => {
      const draft = this.getRepair(ownerId, draftId);
      if (!draft || draft.status !== "pending") throw new Error("The repair is missing or is no longer pending.");
      const conflicts = Object.entries(draft.baseVersions).flatMap(([resultId, expectedVersion]) => {
        const current = this.getResult(ownerId, resultId);
        return !current || current.version !== expectedVersion
          ? [{ resultId, expectedVersion, currentVersion: current?.version ?? 0 }]
          : [];
      });
      if (conflicts.length > 0) {
        draft.status = "conflicted";
        this.saveDraft(draft);
        this.repository.audit(ownerId, "repair.conflicted", draft.id, { conflicts });
        return { ok: false, conflicts };
      }

      const changed = new Map<string, WorkResult>();
      for (const operation of draft.operations) {
        const result = changed.get(operation.resultId) ?? this.getResult(ownerId, operation.resultId)!;
        if (operation.op === "set") setAtPath(result.content, operation.path, structuredClone(operation.value));
        else removeAtPath(result.content, operation.path);
        changed.set(result.id, result);
      }
      const timestamp = this.now().toISOString();
      for (const result of changed.values()) {
        result.version += 1;
        result.updatedAt = timestamp;
        this.saveResult(result);
      }
      draft.status = "applied";
      draft.appliedAt = timestamp;
      this.saveDraft(draft);
      this.repository.audit(ownerId, "repair.applied", draft.id, { resultVersions: Object.fromEntries([...changed.values()].map((result) => [result.id, result.version])) });
      return { ok: true, draft, results: [...changed.values()] };
    });
    const result = transaction.immediate();
    if (!result.ok) throw new RevisionConflictError(result.conflicts);
    return { draft: result.draft, results: result.results };
  }

  private saveResult(result: WorkResult) {
    this.repository.db.prepare("UPDATE work_results SET version = ?, payload = ?, updated_at = ? WHERE id = ? AND owner_id = ?")
      .run(result.version, JSON.stringify(result), result.updatedAt, result.id, result.ownerId);
  }

  private saveDraft(draft: RepairDraft) {
    this.repository.db.prepare("UPDATE repair_drafts SET status = ?, payload = ?, applied_at = ? WHERE id = ? AND owner_id = ?")
      .run(draft.status, JSON.stringify(draft), draft.appliedAt, draft.id, draft.ownerId);
  }
}

function toPointer(path: string[]) {
  return `/${path.map((part) => part.replaceAll("~", "~0").replaceAll("/", "~1")).join("/")}`;
}

function pathsOverlap(left: string, right: string) {
  return left === right || left.startsWith(`${right}/`) || right.startsWith(`${left}/`);
}

function safeKey(key: string) {
  if (key === "__proto__" || key === "prototype" || key === "constructor") throw new Error("Unsafe result path.");
  return key;
}

function parentAtPath(root: Record<string, unknown>, path: string[]) {
  let parent: Record<string, unknown> = root;
  for (const raw of path.slice(0, -1)) {
    const key = safeKey(raw);
    const next = parent[key];
    if (!next || typeof next !== "object" || Array.isArray(next)) parent[key] = {};
    parent = parent[key] as Record<string, unknown>;
  }
  return { parent, key: safeKey(path.at(-1)!) };
}

function setAtPath(root: Record<string, unknown>, path: string[], value: unknown) {
  const { parent, key } = parentAtPath(root, path);
  parent[key] = value;
}

function removeAtPath(root: Record<string, unknown>, path: string[]) {
  const { parent, key } = parentAtPath(root, path);
  delete parent[key];
}

function assertOperationalStateIsPreserved(result: WorkResult, operation: RepairOperation, pointer: string) {
  if (result.kind !== "task_board" || operation.path[0] !== "tasks") return;
  if (operation.path.length < 2) {
    throw new ProtectedResultStateError(result.id, pointer, "A repair must address tasks by stable id rather than replace the whole task collection.");
  }
  const taskId = operation.path[1]!;
  const tasks = result.content.tasks;
  const task = tasks && typeof tasks === "object" && !Array.isArray(tasks)
    ? (tasks as Record<string, unknown>)[taskId]
    : undefined;
  const existing = task && typeof task === "object" && !Array.isArray(task) ? task as Record<string, unknown> : null;
  if (!existing) return;
  if (operation.path.length === 2 && existing.status === "done") {
    throw new ProtectedResultStateError(result.id, pointer, "A completed task cannot be removed or replaced by a repair.");
  }
  if (operation.path[2] === "id") {
    throw new ProtectedResultStateError(result.id, pointer, "A repair cannot change a task's stable identity.");
  }
  if (operation.path[2] === "status" && existing.status === "done" && operation.value !== "done") {
    throw new ProtectedResultStateError(result.id, pointer, "A repair cannot reopen a completed task.");
  }
}
