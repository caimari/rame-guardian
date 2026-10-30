import { env } from "cloudflare:workers";
import { requestIdentity } from "./demo-session";

export async function requestUserId(request: Request) {
  return (await requestIdentity(request))?.userId ?? null;
}

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`).join(",")}}`;
}

export async function sha256(value: unknown) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonicalJson(value)));
  return hex(new Uint8Array(bytes));
}

export async function signReceipt(payload: unknown) {
  const key = await signingKey();
  const privateKey = await crypto.subtle.importKey("jwk", JSON.parse(key.private_jwk), { name: "Ed25519" }, false, ["sign"]);
  const bytes = new TextEncoder().encode(canonicalJson(payload));
  const signature = await crypto.subtle.sign("Ed25519", privateKey, bytes);
  const publicKey = await crypto.subtle.importKey("jwk", JSON.parse(key.public_jwk), { name: "Ed25519" }, false, ["verify"]);
  const verified = await crypto.subtle.verify("Ed25519", publicKey, signature, bytes);
  return { keyId: key.key_id, algorithm: "Ed25519" as const, signature: base64url(new Uint8Array(signature)), publicJwk: JSON.parse(key.public_jwk), verified };
}

async function signingKey() {
  const existing = await env.DB.prepare("SELECT key_id, private_jwk, public_jwk FROM signing_keys ORDER BY created_at LIMIT 1").first<{ key_id: string; private_jwk: string; public_jwk: string }>();
  if (existing) return existing;
  const pair = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
  const privateJwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  const publicJwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
  const keyId = `rame-site-${crypto.randomUUID()}`;
  await env.DB.prepare("INSERT OR IGNORE INTO signing_keys(key_id, private_jwk, public_jwk, created_at) VALUES(?, ?, ?, ?)")
    .bind(keyId, JSON.stringify(privateJwk), JSON.stringify(publicJwk), Date.now()).run();
  return (await env.DB.prepare("SELECT key_id, private_jwk, public_jwk FROM signing_keys ORDER BY created_at LIMIT 1").first<{ key_id: string; private_jwk: string; public_jwk: string }>())!;
}

function hex(bytes: Uint8Array) { return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(""); }
function base64url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}
