import { generateKeyPairSync } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { ReceiptSigner } from "@rame/authority";

export function loadReceiptSigner(dataDirectory: string) {
  const filename = join(dataDirectory, "receipt-signing-key.pem");
  mkdirSync(dirname(filename), { recursive: true, mode: 0o700 });
  let privateKeyPem: string;
  try {
    privateKeyPem = readFileSync(filename, "utf8");
  } catch {
    const pair = generateKeyPairSync("ed25519");
    privateKeyPem = pair.privateKey.export({ type: "pkcs8", format: "pem" }).toString();
    writeFileSync(filename, privateKeyPem, { mode: 0o600, flag: "wx" });
  }
  return new ReceiptSigner({ keyId: "rame-guardian-receipts-v1", privateKeyPem });
}
