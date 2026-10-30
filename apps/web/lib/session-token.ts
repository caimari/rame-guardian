export const DEMO_SESSION_COOKIE = "rame_guardian_session";
export const DEMO_SESSION_MAX_AGE_SECONDS = 24 * 60 * 60;

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function encodeSessionToken(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export function createSessionToken() {
  return encodeSessionToken(crypto.getRandomValues(new Uint8Array(32)));
}

export function isValidSessionToken(value: string | null | undefined): value is string {
  return typeof value === "string" && TOKEN_PATTERN.test(value);
}

export function readCookie(cookieHeader: string | null, name: string) {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0 || part.slice(0, separator).trim() !== name) continue;
    try { return decodeURIComponent(part.slice(separator + 1).trim()); }
    catch { return null; }
  }
  return null;
}

export async function sessionTokenDigest(token: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function anonymousSubject(token: string) {
  if (!isValidSessionToken(token)) throw new Error("Invalid anonymous session token.");
  return `anonymous:${await sessionTokenDigest(token)}`;
}
