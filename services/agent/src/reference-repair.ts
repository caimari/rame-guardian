import type { RepairOperation, WorkResult } from "./revision-workspace.js";

/**
 * Competent reference executor for evaluation: it receives the same field-level
 * plan as RAME and applies it, but has no persistent base-version or protected
 * state checks. This intentionally models a normal approved tool call rather
 * than a weakened language model.
 */
export function applyReferenceRepair(results: WorkResult[], operations: RepairOperation[]): WorkResult[] {
  const output = structuredClone(results);
  for (const operation of operations) {
    const result = output.find((candidate) => candidate.id === operation.resultId);
    if (!result) throw new Error(`Unknown result ${operation.resultId}.`);
    const { parent, key } = parentAtPath(result.content, operation.path);
    if (operation.op === "set") parent[key] = structuredClone(operation.value);
    else delete parent[key];
    result.version += 1;
  }
  return output;
}

function parentAtPath(root: Record<string, unknown>, path: string[]) {
  let parent = root;
  for (const raw of path.slice(0, -1)) {
    const key = safeKey(raw);
    const next = parent[key];
    if (!next || typeof next !== "object" || Array.isArray(next)) parent[key] = {};
    parent = parent[key] as Record<string, unknown>;
  }
  return { parent, key: safeKey(path.at(-1)!) };
}

function safeKey(key: string) {
  if (key === "__proto__" || key === "prototype" || key === "constructor") throw new Error("Unsafe result path.");
  return key;
}
