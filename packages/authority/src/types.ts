export type SourceClass = "user" | "document" | "tool" | "model";
export type DecisionKind = "preference" | "rule" | "permission";

export type Actor = {
  id: string;
  kind: "user" | "agent" | "tool";
};

export type ObservationSource = {
  class: SourceClass;
  ref: string;
  excerpt?: string | undefined;
};

export type DecisionProposal = {
  id: string;
  ownerId: string;
  key: string;
  kind: DecisionKind;
  value: unknown;
  statement: string;
  source: ObservationSource;
  basedOnVersion: number | null;
  status: "pending" | "authorized" | "rejected";
  createdAt: string;
};

export type AuthorizedDecision = {
  id: string;
  ownerId: string;
  key: string;
  kind: DecisionKind;
  value: unknown;
  statement: string;
  version: number;
  previousDecisionId: string | null;
  source: ObservationSource;
  authorizedBy: string;
  authorizedAt: string;
  status: "active" | "revoked";
};

export type AuthorizationReceiptPayload = {
  schema: "rame.authorization-receipt.v1";
  receiptId: string;
  decisionId: string;
  ownerId: string;
  key: string;
  version: number;
  statement: string;
  value: unknown;
  source: ObservationSource;
  authorizedBy: string;
  authorizedAt: string;
  previousDecisionId: string | null;
};

export type AuthorizationReceipt = {
  keyId: string;
  algorithm: "Ed25519";
  payload: AuthorizationReceiptPayload;
  signature: string;
};

export type DecisionReference = { key: string; version: number };

export type ProtectedAction = {
  id: string;
  ownerId: string;
  tool: "calendar.create_block" | "tasks.create";
  parameters: Record<string, unknown>;
  decisions: DecisionReference[];
};

export type ActionDecision = {
  allowed: boolean;
  code: "allowed" | "missing_decision" | "stale_decision" | "constraint_denied";
  reason: string;
  checkedDecisions: DecisionReference[];
};
