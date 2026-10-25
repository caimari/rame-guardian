import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { canonicalJson, type ActionDecision, type ProtectedAction, AuthorityEngine } from "@rame/authority";
import { SqliteAuthorityRepository } from "./sqlite-repository.js";

const decisionReferences = z.array(z.object({
  key: z.string().min(2).max(120),
  version: z.number().int().positive(),
})).min(1).max(20);

export const protectedActionInputSchema = z.discriminatedUnion("tool", [
  z.object({
    id: z.string().uuid(),
    tool: z.literal("tasks.create"),
    parameters: z.object({
      title: z.string().min(1).max(180),
      dueDate: z.string().date().nullable().optional(),
      sourceExcerpt: z.string().max(500).optional(),
    }),
    decisions: decisionReferences,
  }),
  z.object({
    id: z.string().uuid(),
    tool: z.literal("calendar.create_block"),
    parameters: z.object({
      title: z.string().min(1).max(180),
      start: z.string().datetime({ offset: true }),
      end: z.string().datetime({ offset: true }),
      sourceExcerpt: z.string().max(500).optional(),
    }).refine((value) => Date.parse(value.end) > Date.parse(value.start), { message: "end must be after start", path: ["end"] }),
    decisions: decisionReferences,
  }),
]);

export type ProtectedActionInput = z.infer<typeof protectedActionInputSchema>;
export type ActionEffect =
  | { kind: "task"; id: string; title: string; dueDate: string | null }
  | { kind: "calendar_block"; id: string; title: string; start: string; end: string };
export type ActionExecution = { decision: ActionDecision; effect: ActionEffect | null; replayed: boolean };

export class ActionConflictError extends Error {}

export class SqliteActionExecutor {
  constructor(
    readonly repository: SqliteAuthorityRepository,
    readonly authority: AuthorityEngine,
    readonly now = () => new Date(),
  ) {
    repository.db.exec(`
      CREATE TABLE IF NOT EXISTS action_attempts (
        action_id TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL,
        request_hash TEXT NOT NULL,
        tool TEXT NOT NULL,
        allowed INTEGER NOT NULL,
        response TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS task_outputs (
        id TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL,
        action_id TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        due_date TEXT,
        source_excerpt TEXT,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS calendar_blocks (
        id TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL,
        action_id TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        start_at TEXT NOT NULL,
        end_at TEXT NOT NULL,
        source_excerpt TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_actions_owner ON action_attempts(owner_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_tasks_owner ON task_outputs(owner_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_calendar_owner ON calendar_blocks(owner_id, start_at);
    `);
  }

  execute(action: ProtectedAction): ActionExecution {
    const requestHash = createHash("sha256").update(canonicalJson(action)).digest("hex");
    const transaction = this.repository.db.transaction((): ActionExecution => {
      const existing = this.repository.db.prepare("SELECT request_hash, response FROM action_attempts WHERE action_id = ?").get(action.id) as { request_hash: string; response: string } | undefined;
      if (existing) {
        if (existing.request_hash !== requestHash) throw new ActionConflictError("The action id was already used with a different request.");
        return { ...(JSON.parse(existing.response) as Omit<ActionExecution, "replayed">), replayed: true };
      }

      const decision = this.authority.evaluate(action);
      const createdAt = this.now().toISOString();
      const effect = decision.allowed ? this.applyEffect(action, createdAt) : null;
      const response: ActionExecution = { decision, effect, replayed: false };
      this.repository.db.prepare(`INSERT INTO action_attempts(action_id, owner_id, request_hash, tool, allowed, response, created_at)
        VALUES(?, ?, ?, ?, ?, ?, ?)`).run(action.id, action.ownerId, requestHash, action.tool, decision.allowed ? 1 : 0, JSON.stringify(response), createdAt);
      this.repository.audit(action.ownerId, decision.allowed ? "action.executed" : "action.blocked", action.id, { action, decision, effect });
      return response;
    });
    return transaction.immediate();
  }

  listTasks(ownerId: string) {
    return this.repository.db.prepare(`SELECT id, action_id AS actionId, title, due_date AS dueDate,
      source_excerpt AS sourceExcerpt, created_at AS createdAt FROM task_outputs WHERE owner_id = ? ORDER BY created_at DESC`).all(ownerId);
  }

  listCalendarBlocks(ownerId: string) {
    return this.repository.db.prepare(`SELECT id, action_id AS actionId, title, start_at AS start,
      end_at AS end, source_excerpt AS sourceExcerpt, created_at AS createdAt FROM calendar_blocks WHERE owner_id = ? ORDER BY start_at`).all(ownerId);
  }

  private applyEffect(action: ProtectedAction, createdAt: string): ActionEffect {
    const id = randomUUID();
    if (action.tool === "tasks.create") {
      const title = action.parameters.title as string;
      const dueDate = (action.parameters.dueDate as string | null | undefined) ?? null;
      this.repository.db.prepare(`INSERT INTO task_outputs(id, owner_id, action_id, title, due_date, source_excerpt, created_at)
        VALUES(?, ?, ?, ?, ?, ?, ?)`).run(id, action.ownerId, action.id, title, dueDate, action.parameters.sourceExcerpt ?? null, createdAt);
      return { kind: "task", id, title, dueDate };
    }
    const title = action.parameters.title as string;
    const start = action.parameters.start as string;
    const end = action.parameters.end as string;
    this.repository.db.prepare(`INSERT INTO calendar_blocks(id, owner_id, action_id, title, start_at, end_at, source_excerpt, created_at)
      VALUES(?, ?, ?, ?, ?, ?, ?, ?)`).run(id, action.ownerId, action.id, title, start, end, action.parameters.sourceExcerpt ?? null, createdAt);
    return { kind: "calendar_block", id, title, start, end };
  }
}
