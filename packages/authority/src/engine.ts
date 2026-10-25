import { randomUUID } from "node:crypto";
import type { ActionDecision, Actor, AuthorizationReceipt, AuthorizedDecision, DecisionProposal, ObservationSource, ProtectedAction } from "./types.js";
import { ReceiptSigner } from "./receipts.js";

export class AuthorityError extends Error {
  constructor(readonly code: "human_authorization_required" | "proposal_not_pending" | "proposal_stale", message: string) {
    super(message);
  }
}

export class AuthorityEngine {
  readonly #proposals = new Map<string, DecisionProposal>();
  readonly #decisions = new Map<string, AuthorizedDecision[]>();

  constructor(readonly signer: ReceiptSigner, readonly now = () => new Date()) {}

  propose(input: { ownerId: string; key: string; kind: DecisionProposal["kind"]; value: unknown; statement: string; source: ObservationSource }): DecisionProposal {
    const latest = this.latest(input.ownerId, input.key);
    const proposal: DecisionProposal = {
      id: randomUUID(), ownerId: input.ownerId, key: input.key, kind: input.kind,
      value: input.value, statement: input.statement, source: input.source,
      basedOnVersion: latest?.version ?? null, status: "pending", createdAt: this.now().toISOString(),
    };
    this.#proposals.set(proposal.id, proposal);
    return proposal;
  }

  authorize(proposalId: string, actor: Actor): { decision: AuthorizedDecision; receipt: AuthorizationReceipt } {
    if (actor.kind !== "user") throw new AuthorityError("human_authorization_required", "Only an authenticated user can authorize a durable decision.");
    const proposal = this.#proposals.get(proposalId);
    if (!proposal || proposal.status !== "pending") throw new AuthorityError("proposal_not_pending", "The proposal is missing or is no longer pending.");
    if (actor.id !== proposal.ownerId) throw new AuthorityError("human_authorization_required", "A user cannot authorize another user's decision.");
    const latest = this.latest(proposal.ownerId, proposal.key);
    if ((latest?.version ?? null) !== proposal.basedOnVersion) throw new AuthorityError("proposal_stale", "The proposal was based on an obsolete decision version.");
    const authorizedAt = this.now().toISOString();
    const decision: AuthorizedDecision = {
      id: randomUUID(), ownerId: proposal.ownerId, key: proposal.key, kind: proposal.kind,
      value: proposal.value, statement: proposal.statement, version: (latest?.version ?? 0) + 1,
      previousDecisionId: latest?.id ?? null, source: proposal.source, authorizedBy: actor.id,
      authorizedAt, status: "active",
    };
    const history = this.#decisions.get(this.decisionMapKey(decision.ownerId, decision.key)) ?? [];
    history.push(decision);
    this.#decisions.set(this.decisionMapKey(decision.ownerId, decision.key), history);
    proposal.status = "authorized";
    const receipt = this.signer.issue({
      schema: "rame.authorization-receipt.v1", receiptId: randomUUID(), decisionId: decision.id,
      ownerId: decision.ownerId, key: decision.key, version: decision.version, statement: decision.statement,
      value: decision.value, source: decision.source, authorizedBy: decision.authorizedBy,
      authorizedAt: decision.authorizedAt, previousDecisionId: decision.previousDecisionId,
    });
    return { decision, receipt };
  }

  evaluate(action: ProtectedAction): ActionDecision {
    const checked: Array<{ key: string; version: number }> = [];
    for (const reference of action.decisions) {
      const latest = this.latest(action.ownerId, reference.key);
      if (!latest || latest.status !== "active") return { allowed: false, code: "missing_decision", reason: `No active decision exists for ${reference.key}.`, checkedDecisions: checked };
      checked.push({ key: latest.key, version: latest.version });
      if (latest.version !== reference.version) return { allowed: false, code: "stale_decision", reason: `${reference.key} advanced from v${reference.version} to v${latest.version}.`, checkedDecisions: checked };
      const denied = this.constraintDenial(action, latest);
      if (denied) return { allowed: false, code: "constraint_denied", reason: denied, checkedDecisions: checked };
    }
    return { allowed: true, code: "allowed", reason: "All referenced decisions are current and their constraints allow this action.", checkedDecisions: checked };
  }

  latest(ownerId: string, key: string): AuthorizedDecision | null {
    const values = this.#decisions.get(this.decisionMapKey(ownerId, key));
    return values?.at(-1) ?? null;
  }

  private constraintDenial(action: ProtectedAction, decision: AuthorizedDecision): string | null {
    if (decision.key !== "calendar.not_before" || action.tool !== "calendar.create_block") return null;
    const rule = decision.value as { time?: unknown };
    const start = action.parameters.start as unknown;
    if (typeof rule.time !== "string" || typeof start !== "string") return "The calendar constraint or action start time is invalid.";
    const actionTime = start.match(/T(\d{2}):(\d{2})/);
    if (!actionTime) return "The action start time must be an ISO date-time.";
    const minutes = Number(actionTime[1]) * 60 + Number(actionTime[2]);
    const parts = rule.time.split(":");
    const hour = Number(parts[0]);
    const minute = Number(parts[1]);
    if (parts.length !== 2 || !Number.isInteger(hour) || !Number.isInteger(minute)) return "The authorized not-before time is invalid.";
    return minutes < hour * 60 + minute ? `The action starts before the authorized ${rule.time} boundary.` : null;
  }

  private decisionMapKey(ownerId: string, key: string) { return `${ownerId}\u0000${key}`; }
}
