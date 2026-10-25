import type { AuthorizationReceipt, AuthorizedDecision, DecisionProposal } from "./types.js";

export type AuthorizationCommitResult = "committed" | "proposal_not_pending" | "proposal_stale";

export interface AuthorityRepository {
  saveProposal(proposal: DecisionProposal): void;
  getProposal(id: string): DecisionProposal | null;
  latestDecision(ownerId: string, key: string): AuthorizedDecision | null;
  commitAuthorization(proposal: DecisionProposal, decision: AuthorizedDecision, receipt: AuthorizationReceipt): AuthorizationCommitResult;
}

export class InMemoryAuthorityRepository implements AuthorityRepository {
  readonly #proposals = new Map<string, DecisionProposal>();
  readonly #decisions = new Map<string, AuthorizedDecision[]>();
  readonly #receipts = new Map<string, AuthorizationReceipt>();

  saveProposal(proposal: DecisionProposal) { this.#proposals.set(proposal.id, structuredClone(proposal)); }
  getProposal(id: string) {
    const proposal = this.#proposals.get(id);
    return proposal ? structuredClone(proposal) : null;
  }
  commitAuthorization(proposal: DecisionProposal, decision: AuthorizedDecision, receipt: AuthorizationReceipt): AuthorizationCommitResult {
    const stored = this.#proposals.get(proposal.id);
    if (!stored || stored.status !== "pending") return "proposal_not_pending";
    const latest = this.latestDecision(proposal.ownerId, proposal.key);
    if ((latest?.version ?? null) !== proposal.basedOnVersion) return "proposal_stale";
    const key = this.key(decision.ownerId, decision.key);
    const history = this.#decisions.get(key) ?? [];
    history.push(structuredClone(decision));
    this.#decisions.set(key, history);
    this.#proposals.set(proposal.id, structuredClone(proposal));
    this.#receipts.set(receipt.payload.receiptId, structuredClone(receipt));
    return "committed";
  }
  latestDecision(ownerId: string, key: string) {
    const decision = this.#decisions.get(this.key(ownerId, key))?.at(-1);
    return decision ? structuredClone(decision) : null;
  }
  private key(ownerId: string, key: string) { return `${ownerId}\u0000${key}`; }
}
