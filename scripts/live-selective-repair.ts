import assert from "node:assert/strict";
import { NebiusClient } from "../services/agent/src/nebius-client.js";
import { SqliteAuthorityRepository } from "../services/agent/src/sqlite-repository.js";
import { ProtectedHumanEditError, ProtectedResultStateError, SqliteRevisionWorkspace, type RepairDraft } from "../services/agent/src/revision-workspace.js";

const apiKey = process.env.NEBIUS_API_KEY;
if (!apiKey) throw new Error("NEBIUS_API_KEY is required.");

const ownerId = "live-gate-user";
const repository = new SqliteAuthorityRepository(":memory:");
const workspace = new SqliteRevisionWorkspace(repository);
const proposal = workspace.createResult(ownerId, {
  kind: "proposal",
  title: "Website accessibility delivery proposal",
  content: {
    scope: ["accessibility audit", "checkout remediation", "team training"],
    price: 2400,
    deliveryDate: "2026-11-06",
    accessibility: "WCAG AA",
  },
  dependencies: [],
});
const plan = workspace.createResult(ownerId, {
  kind: "plan",
  title: "Delivery plan",
  content: {
    availableHours: 12,
    requiredHours: 12,
    deadline: "2026-11-06",
    work: { "accessibility audit": 3, "checkout remediation": 7, "team training": 2 },
  },
  dependencies: [{ resultId: proposal.id, relation: "implements the proposal scope and delivery date", confidence: "explicit" }],
});
const board = workspace.createResult(ownerId, {
  kind: "task_board",
  title: "Project tasks",
  content: {
    tasks: {
      audit: { id: "audit", title: "Accessibility audit", status: "done", estimatedHours: 3 },
      checkout: { id: "checkout", title: "Checkout remediation", status: "todo", estimatedHours: 7 },
      training: { id: "training", title: "Team training", status: "todo", estimatedHours: 2 },
    },
  },
  dependencies: [{ resultId: plan.id, relation: "realizes the plan activities", confidence: "explicit" }],
});
const comparison = workspace.createResult(ownerId, {
  kind: "reference",
  title: "Hosting provider comparison",
  content: { winner: "Provider B", rationale: "Best support coverage" },
  dependencies: [],
});

workspace.applyHumanEdit(ownerId, proposal.id, ["price"], 2600);
workspace.applyHumanEdit(ownerId, proposal.id, ["accessibility"], "WCAG AAA for checkout");
const independentBefore = workspace.getResult(ownerId, comparison.id)!;
const changeRequest = "This week I can work only six hours. Keep the delivery date. Show feasible alternatives, then select a reduced scope that preserves completed work and my manual edits.";
const diagnosticFetch: typeof fetch = async (input, init) => {
  const response = await fetch(input, init);
  if (process.env.RAME_DEBUG_MODEL_OUTPUT === "1" && response.ok) {
    const body = await response.clone().json() as { choices?: Array<{ message?: { content?: string } }> };
    console.error("MODEL_OUTPUT", body.choices?.[0]?.message?.content ?? "<empty>");
  }
  return response;
};
const client = new NebiusClient(apiKey, process.env.NEBIUS_MODEL ?? "nvidia/nemotron-3-super-120b-a12b", undefined, diagnosticFetch);
let proposed: Awaited<ReturnType<NebiusClient["planRepair"]>> | null = null;
let draft: RepairDraft | null = null;
let plannerRequest = changeRequest;
const rejectedAttempts: Array<{ attempt: number; code: string; reason: string }> = [];
for (let attempt = 1; attempt <= 3 && !draft; attempt += 1) {
  proposed = await client.planRepair({ changeRequest: plannerRequest, results: workspace.listResults(ownerId) });
  try {
    draft = workspace.prepareRepair(ownerId, { changeRequest, ...proposed.plan });
  } catch (error) {
    if (!(error instanceof ProtectedHumanEditError) && !(error instanceof ProtectedResultStateError)) throw error;
    const code = error instanceof ProtectedHumanEditError ? "human_edit_protected" : "operational_state_protected";
    rejectedAttempts.push({ attempt, code, reason: error.message });
    plannerRequest = `${changeRequest}\nA previous candidate was rejected by the deterministic validator: ${error.message} Do not include any operation at that path or its parent. Produce a corrected plan from the unchanged snapshot.`;
  }
}
if (!proposed || !draft) throw new Error("Nemotron did not produce a valid repair within three attempts.");
const applied = workspace.applyRepair(ownerId, draft.id);

const finalProposal = workspace.getResult(ownerId, proposal.id)!;
const finalBoard = workspace.getResult(ownerId, board.id)!;
const finalComparison = workspace.getResult(ownerId, comparison.id)!;
const finalTasks = finalBoard.content.tasks as Record<string, { id: string; status: string }>;
assert.equal(finalProposal.content.price, 2600, "manual price edit must survive");
assert.equal(finalProposal.content.accessibility, "WCAG AAA for checkout", "manual accessibility edit must survive");
assert.deepEqual(finalTasks.audit, { ...finalTasks.audit, id: "audit", status: "done" }, "completed task identity and state must survive");
assert.deepEqual(finalComparison, independentBefore, "independent result must remain byte-for-byte equivalent");

console.log(JSON.stringify({
  status: "PASS",
  model: proposed.model,
  usage: proposed.usage,
  alternatives: proposed.plan.alternatives,
  selectedAlternativeId: proposed.plan.selectedAlternativeId,
  affectedResultIds: proposed.plan.affectedResultIds,
  operationCount: proposed.plan.operations.length,
  rejectedAttempts,
  impact: draft.impact,
  appliedVersions: Object.fromEntries(applied.results.map((result) => [result.title, result.version])),
  invariants: {
    humanPricePreserved: true,
    humanAccessibilityPreserved: true,
    completedTaskPreserved: true,
    independentResultUnchanged: true,
  },
}, null, 2));
