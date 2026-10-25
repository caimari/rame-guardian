import { generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import { AuthorityEngine, AuthorityError, ReceiptSigner, verifyReceipt } from "../packages/authority/src/index.js";

function fixture() {
  const pair = generateKeyPairSync("ed25519");
  const signer = new ReceiptSigner({ keyId: "test-key-1", privateKeyPem: pair.privateKey.export({ type: "pkcs8", format: "pem" }).toString() });
  return { engine: new AuthorityEngine(signer, () => new Date("2026-10-25T12:00:00Z")), signer };
}

describe("RAME authority engine", () => {
  it("prevents the model from authorizing its own proposal", () => {
    const { engine } = fixture();
    const proposal = engine.propose({ ownerId: "antoni", key: "calendar.not_before", kind: "rule", value: { time: "10:00" }, statement: "Work blocks start at or after 10:00.", source: { class: "user", ref: "session-1" } });
    expect(() => engine.authorize(proposal.id, { id: "nemotron", kind: "agent" })).toThrowError(AuthorityError);
  });

  it("issues a verifiable receipt and detects tampering", () => {
    const { engine, signer } = fixture();
    const proposal = engine.propose({ ownerId: "antoni", key: "calendar.not_before", kind: "rule", value: { time: "10:00" }, statement: "Work blocks start at or after 10:00.", source: { class: "user", ref: "session-1" } });
    const { receipt } = engine.authorize(proposal.id, { id: "antoni", kind: "user" });
    expect(verifyReceipt(receipt, signer.publicKeyPem)).toBe(true);
    const tampered = structuredClone(receipt);
    tampered.payload.statement = "Work blocks may start at 08:00.";
    expect(verifyReceipt(tampered, signer.publicKeyPem)).toBe(false);
  });

  it("blocks a calendar action that violates the authorized boundary", () => {
    const { engine } = fixture();
    const proposal = engine.propose({ ownerId: "antoni", key: "calendar.not_before", kind: "rule", value: { time: "10:00" }, statement: "Work blocks start at or after 10:00.", source: { class: "user", ref: "session-1" } });
    engine.authorize(proposal.id, { id: "antoni", kind: "user" });
    const result = engine.evaluate({ id: "action-1", ownerId: "antoni", tool: "calendar.create_block", parameters: { start: "2026-10-26T08:00:00+01:00" }, decisions: [{ key: "calendar.not_before", version: 1 }] });
    expect(result).toMatchObject({ allowed: false, code: "constraint_denied" });
  });

  it("rejects a stale session after a legitimate rule update", () => {
    const { engine } = fixture();
    const v1 = engine.propose({ ownerId: "antoni", key: "calendar.not_before", kind: "rule", value: { time: "10:00" }, statement: "Work blocks start at or after 10:00.", source: { class: "user", ref: "session-1" } });
    engine.authorize(v1.id, { id: "antoni", kind: "user" });
    const v2 = engine.propose({ ownerId: "antoni", key: "calendar.not_before", kind: "rule", value: { time: "12:00" }, statement: "Work blocks start at or after 12:00.", source: { class: "user", ref: "session-2" } });
    engine.authorize(v2.id, { id: "antoni", kind: "user" });
    const result = engine.evaluate({ id: "action-old", ownerId: "antoni", tool: "calendar.create_block", parameters: { start: "2026-10-26T10:30:00+01:00" }, decisions: [{ key: "calendar.not_before", version: 1 }] });
    expect(result).toMatchObject({ allowed: false, code: "stale_decision" });
    expect(result.reason).toContain("v1 to v2");
  });
});
