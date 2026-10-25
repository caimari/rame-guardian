import { generateKeyPairSync, randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { AuthorityEngine, ReceiptSigner } from "../packages/authority/src/index.js";
import { ActionConflictError, SqliteActionExecutor } from "../services/agent/src/action-executor.js";
import { SqliteAuthorityRepository } from "../services/agent/src/sqlite-repository.js";

function fixture() {
  const pair = generateKeyPairSync("ed25519");
  const signer = new ReceiptSigner({ keyId: "test-key", privateKeyPem: pair.privateKey.export({ type: "pkcs8", format: "pem" }).toString() });
  const repository = new SqliteAuthorityRepository(":memory:");
  const now = () => new Date("2026-10-25T12:00:00Z");
  const authority = new AuthorityEngine(signer, now, repository);
  return { repository, authority, executor: new SqliteActionExecutor(repository, authority, now) };
}

function authorizeNotBefore(authority: AuthorityEngine, time: string, ref: string) {
  const proposal = authority.propose({
    ownerId: "antoni",
    key: "calendar.not_before",
    kind: "rule",
    value: { time },
    statement: `Work blocks start at or after ${time}.`,
    source: { class: "user", ref },
  });
  return authority.authorize(proposal.id, { id: "antoni", kind: "user" });
}

describe("transactional action executor", () => {
  it("executes an allowed calendar action exactly once", () => {
    const { authority, executor } = fixture();
    authorizeNotBefore(authority, "10:00", "session-1");
    const id = randomUUID();
    const action = {
      id,
      ownerId: "antoni",
      tool: "calendar.create_block" as const,
      parameters: { title: "Release review", start: "2026-10-30T10:30:00+01:00", end: "2026-10-30T12:00:00+01:00" },
      decisions: [{ key: "calendar.not_before", version: 1 }],
    };
    const first = executor.execute(action);
    const replay = executor.execute(action);
    expect(first).toMatchObject({ decision: { allowed: true }, replayed: false });
    expect(replay).toMatchObject({ decision: { allowed: true }, replayed: true, effect: { id: first.effect?.id } });
    expect(executor.listCalendarBlocks("antoni")).toHaveLength(1);
  });

  it("blocks stale actions without creating side effects", () => {
    const { authority, executor } = fixture();
    authorizeNotBefore(authority, "10:00", "session-1");
    authorizeNotBefore(authority, "12:00", "session-2");
    const result = executor.execute({
      id: randomUUID(), ownerId: "antoni", tool: "calendar.create_block",
      parameters: { title: "Stale meeting", start: "2026-10-30T12:30:00+01:00", end: "2026-10-30T13:00:00+01:00" },
      decisions: [{ key: "calendar.not_before", version: 1 }],
    });
    expect(result).toMatchObject({ decision: { allowed: false, code: "stale_decision" }, effect: null });
    expect(executor.listCalendarBlocks("antoni")).toHaveLength(0);
  });

  it("rejects reuse of an action id with different content", () => {
    const { authority, executor } = fixture();
    authorizeNotBefore(authority, "10:00", "session-1");
    const id = randomUUID();
    const base = {
      id, ownerId: "antoni", tool: "tasks.create" as const,
      parameters: { title: "Prepare release notes" },
      decisions: [{ key: "calendar.not_before", version: 1 }],
    };
    executor.execute(base);
    expect(() => executor.execute({ ...base, parameters: { title: "Different task" } })).toThrow(ActionConflictError);
    expect(executor.listTasks("antoni")).toHaveLength(1);
  });
});
