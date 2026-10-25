import { describe, expect, it } from "vitest";
import { SqliteAuthorityRepository } from "../services/agent/src/sqlite-repository.js";
import { ProtectedHumanEditError, RevisionConflictError, SqliteRevisionWorkspace } from "../services/agent/src/revision-workspace.js";

function fixture() {
  const repository = new SqliteAuthorityRepository(":memory:");
  let tick = 0;
  const workspace = new SqliteRevisionWorkspace(repository, () => new Date(Date.UTC(2026, 9, 25, 12, 0, tick++)));
  const ownerId = "antoni";
  const proposal = workspace.createResult(ownerId, {
    kind: "proposal", title: "Client proposal",
    content: { scope: ["audit", "implementation", "training"], price: 2400, deliveryDate: "2026-11-06", accessibility: "WCAG AA" },
    dependencies: [],
  });
  const plan = workspace.createResult(ownerId, {
    kind: "plan", title: "Delivery plan",
    content: { availableHours: 12, requiredHours: 12, deadline: "2026-11-06", work: { audit: 3, implementation: 7, training: 2 } },
    dependencies: [{ resultId: proposal.id, relation: "implements proposal scope and delivery date", confidence: "explicit" }],
  });
  const board = workspace.createResult(ownerId, {
    kind: "task_board", title: "Project tasks",
    content: { tasks: { audit: { id: "audit", title: "Audit", status: "done" }, build: { id: "build", title: "Implementation", status: "todo" }, training: { id: "training", title: "Training", status: "todo" } } },
    dependencies: [{ resultId: plan.id, relation: "realizes plan activities", confidence: "explicit" }],
  });
  const comparison = workspace.createResult(ownerId, {
    kind: "reference", title: "Provider comparison",
    content: { winner: "Provider B", rationale: "Best support coverage" }, dependencies: [],
  });
  workspace.applyHumanEdit(ownerId, proposal.id, ["price"], 2600);
  workspace.applyHumanEdit(ownerId, proposal.id, ["accessibility"], "WCAG AAA for checkout");
  return { workspace, ownerId, proposal, plan, board, comparison };
}

function repairInput(ids: { proposal: string; plan: string; board: string }) {
  return {
    changeRequest: "What if I only have six hours this week and want to keep the delivery date?",
    alternatives: [
      { id: "reduce-scope", label: "Keep the date", consequence: "Limit delivery to audit and a smaller implementation.", requiresDecision: "Approve reduced scope.", feasible: true },
      { id: "move-date", label: "Keep the scope", consequence: "Move the delivery date.", requiresDecision: "Approve a later date.", feasible: true },
      { id: "keep-all", label: "Keep date and scope", consequence: "Twelve hours of work cannot fit in six available hours.", requiresDecision: "Add resources or change a condition.", feasible: false },
    ],
    selectedAlternativeId: "reduce-scope",
    affectedResultIds: [ids.proposal, ids.plan, ids.board],
    operations: [
      { resultId: ids.proposal, op: "set" as const, path: ["scope"], value: ["audit", "implementation-lite"], reason: "Fit the authorized six-hour budget." },
      { resultId: ids.plan, op: "set" as const, path: ["availableHours"], value: 6, reason: "Apply the proposed availability." },
      { resultId: ids.plan, op: "set" as const, path: ["requiredHours"], value: 6, reason: "Reflect the reduced scope." },
      { resultId: ids.plan, op: "set" as const, path: ["work"], value: { audit: 3, "implementation-lite": 3 }, reason: "Preserve feasible activities." },
      { resultId: ids.board, op: "remove" as const, path: ["tasks", "training"], reason: "Training is outside the selected scope." },
      { resultId: ids.board, op: "set" as const, path: ["tasks", "build", "title"], value: "Light implementation", reason: "Align the existing task without replacing its identity." },
    ],
  };
}

describe("selective repair workspace", () => {
  it("repairs three related results while preserving human edits, task identity, status, and an independent result", () => {
    const { workspace, ownerId, proposal, plan, board, comparison } = fixture();
    const independentBefore = workspace.getResult(ownerId, comparison.id)!;
    const draft = workspace.prepareRepair(ownerId, repairInput({ proposal: proposal.id, plan: plan.id, board: board.id }));

    expect(draft.impact.affected).toHaveLength(3);
    expect(draft.impact.unchanged).toEqual(expect.arrayContaining([expect.objectContaining({ id: comparison.id })]));
    expect(draft.impact.preservedHumanEdits).toEqual(expect.arrayContaining([
      { resultId: proposal.id, path: "/price" },
      { resultId: proposal.id, path: "/accessibility" },
    ]));
    expect(workspace.getResult(ownerId, plan.id)!.content.availableHours).toBe(12);

    workspace.applyRepair(ownerId, draft.id);
    const repairedProposal = workspace.getResult(ownerId, proposal.id)!;
    const repairedPlan = workspace.getResult(ownerId, plan.id)!;
    const repairedBoard = workspace.getResult(ownerId, board.id)!;
    const independentAfter = workspace.getResult(ownerId, comparison.id)!;
    const tasks = repairedBoard.content.tasks as Record<string, { id: string; title: string; status: string }>;

    expect(repairedProposal.content).toMatchObject({ price: 2600, accessibility: "WCAG AAA for checkout", scope: ["audit", "implementation-lite"] });
    expect(repairedPlan.content).toMatchObject({ availableHours: 6, requiredHours: 6, deadline: "2026-11-06" });
    expect(tasks.audit).toEqual({ id: "audit", title: "Audit", status: "done" });
    expect(tasks.build).toEqual({ id: "build", title: "Light implementation", status: "todo" });
    expect(tasks.training).toBeUndefined();
    expect(independentAfter).toEqual(independentBefore);
  });

  it("rejects a repair if a result changes after the preview was prepared", () => {
    const { workspace, ownerId, proposal, plan, board } = fixture();
    const draft = workspace.prepareRepair(ownerId, repairInput({ proposal: proposal.id, plan: plan.id, board: board.id }));
    workspace.applyHumanEdit(ownerId, plan.id, ["notes"], "Client requested a checkpoint.");

    expect(() => workspace.applyRepair(ownerId, draft.id)).toThrow(RevisionConflictError);
    expect(workspace.getResult(ownerId, plan.id)!.content).toMatchObject({ availableHours: 12, notes: "Client requested a checkpoint." });
    expect(workspace.getRepair(ownerId, draft.id)!.status).toBe("conflicted");
  });

  it("does not silently overwrite a human-edited field", () => {
    const { workspace, ownerId, proposal, plan, board } = fixture();
    const input = repairInput({ proposal: proposal.id, plan: plan.id, board: board.id });
    input.operations.push({ resultId: proposal.id, op: "set", path: ["price"], value: 1800, reason: "Model suggested a lower price." });
    expect(() => workspace.prepareRepair(ownerId, input)).toThrow(ProtectedHumanEditError);
  });
});
