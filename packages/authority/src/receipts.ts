import { createPrivateKey, createPublicKey, sign, verify } from "node:crypto";
import { canonicalJson } from "./canonical.js";
import type { AuthorizationReceipt, AuthorizationReceiptPayload } from "./types.js";

export class ReceiptSigner {
  readonly keyId: string;
  readonly publicKeyPem: string;
  readonly #privateKey: ReturnType<typeof createPrivateKey>;

  constructor(input: { keyId: string; privateKeyPem: string }) {
    this.keyId = input.keyId;
    this.#privateKey = createPrivateKey(input.privateKeyPem);
    this.publicKeyPem = createPublicKey(this.#privateKey).export({ type: "spki", format: "pem" }).toString();
  }

  issue(payload: AuthorizationReceiptPayload): AuthorizationReceipt {
    const signature = sign(null, Buffer.from(canonicalJson(payload)), this.#privateKey).toString("base64url");
    return { keyId: this.keyId, algorithm: "Ed25519", payload, signature };
  }
}

export function verifyReceipt(receipt: AuthorizationReceipt, publicKeyPem: string): boolean {
  if (receipt.algorithm !== "Ed25519") return false;
  return verify(null, Buffer.from(canonicalJson(receipt.payload)), createPublicKey(publicKeyPem), Buffer.from(receipt.signature, "base64url"));
}
