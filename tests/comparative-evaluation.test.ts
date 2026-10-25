import { describe, expect, it } from "vitest";
import { applyReferenceRepair } from "../services/agent/src/reference-repair.js";
import { SqliteAuthorityRepository } from "../services/agent/src/sqlite-repository.js";
import { RevisionConflictError, SqliteRevisionWorkspace, type PrepareRepairInput } from "../services/agent/src/revision-workspace.js";

describe("same-model comparative evaluation", () => {
  it("isolates execution semantics using the same snapshot and exact same model operations", () => {
    const repository = new SqliteAuthorityRepository(":memory:");
    const workspace = new SqliteRevisionWorkspace(repository, () => new Date("2026-10-25T12:00:00Z"));
    const ownerId = "antoni";
    const plan = workspace.createResult(ownerId, {
      kind: "plan", title: "Delivery plan",
      content: { availableHours: 12, requiredHours: 12, note: "Initial plan" }, dependencies: [],
    });
    const sameModelOutput: PrepareRepairInput = {
      changeRequest: "I have six hours; keep the date.",
      alternatives: [{ id: "reduce", label: "Reduce scope", consequence: "Fit six hours.", requiresDecision: true, feasible: true }],
      selectedAlternativeId: "reduce",
      affectedResultIds: [plan.id],
      operations: [
        { resultId: plan.id, op: "set", path: ["availableHours"], value: 6, reason: "Apply new availability." },
        { resultId: plan.id, op: "set", path: ["requiredHours"], value: 6, reason: "Fit selected scope." },
      ],
    };

    const identicalSnapshotForReference = workspace.listResults(ownerId);
    const rameDraft = workspace.prepareRepair(ownerId, sameModelOutput);

    // A second session edits the plan after the model planned but before tools apply.
    const concurrentlyEdited = workspace.applyHumanEdit(ownerId, plan.id, ["availableHours"], 8)!;
    const referenceInputAfterSameEdit = structuredClone(identicalSnapshotForReference);
    referenceInputAfterSameEdit[0]!.content.availableHours = 8;
    referenceInputAfterSameEdit[0]!.version = concurrentlyEdited.version;

    const referenceFinal = applyReferenceRepair(referenceInputAfterSameEdit, sameModelOutput.operations);
    expect(referenceFinal[0]!.content.availableHours).toBe(6);
    expect(() => workspace.applyRepair(ownerId, rameDraft.id)).toThrow(RevisionConflictError);
    expect(workspace.getResult(ownerId, plan.id)!.content.availableHours).toBe(8);

    // Same model, same initial context, same operations. Only RAME's execution
    // semantics prevent the stale plan from overwriting the later human edit.
  });
});
