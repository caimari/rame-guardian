export type MemoryProposal = {
  key: string;
  kind: "preference" | "rule" | "permission";
  value: unknown;
  statement: string;
  scope: "preference" | "workflow" | "project";
  confidence: number;
};

export type ChatRequest = {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  authorizedMemory: string[];
};

export type ChatResponse = {
  reply: string;
  proposal: MemoryProposal | null;
  model: string;
};
