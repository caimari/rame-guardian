import { env } from "cloudflare:workers";
import { DEMO_SESSION_COOKIE, DEMO_SESSION_MAX_AGE_SECONDS, anonymousSubject, createSessionToken, isValidSessionToken, readCookie, sessionTokenDigest } from "./session-token";

const PER_SESSION_MODEL_CALLS_PER_HOUR = 30;
const GLOBAL_MODEL_CALLS_PER_HOUR = 500;

export type DemoIdentity = { userId: string; kind: "chatgpt" | "anonymous" };

export async function requestIdentity(request: Request): Promise<DemoIdentity | null> {
  const authenticated = request.headers.get("oai-authenticated-user-id")?.trim();
  if (authenticated) return { userId: `chatgpt:${authenticated}`, kind: "chatgpt" };

  const token = readCookie(request.headers.get("cookie"), DEMO_SESSION_COOKIE);
  if (!isValidSessionToken(token)) return null;
  const digest = await sessionTokenDigest(token);
  const now = Date.now();
  const session = await env.DB.prepare("SELECT expires_at FROM demo_sessions WHERE id_hash=? AND expires_at>?").bind(digest, now).first<{ expires_at: number }>();
  if (!session) return null;
  await env.DB.prepare("UPDATE demo_sessions SET last_seen_at=? WHERE id_hash=? AND last_seen_at<?").bind(now, digest, now - 5 * 60_000).run();
  return { userId: `anonymous:${digest}`, kind: "anonymous" };
}

export async function createOrResumeDemoSession(request: Request) {
  const existing = await requestIdentity(request);
  if (existing) return { identity: existing, token: null };

  const token = createSessionToken();
  const digest = await sessionTokenDigest(token);
  const now = Date.now();
  const expiresAt = now + DEMO_SESSION_MAX_AGE_SECONDS * 1000;
  await env.DB.prepare("INSERT INTO demo_sessions(id_hash,created_at,last_seen_at,expires_at) VALUES(?,?,?,?)").bind(digest, now, now, expiresAt).run();
  return { identity: { userId: await anonymousSubject(token), kind: "anonymous" as const }, token };
}

export function sessionCookieOptions(request: Request) {
  return {
    httpOnly: true,
    secure: new URL(request.url).protocol === "https:",
    sameSite: "lax" as const,
    path: "/",
    maxAge: DEMO_SESSION_MAX_AGE_SECONDS,
  };
}

export async function consumeModelBudget(userId: string) {
  const now = Date.now();
  const windowStart = Math.floor(now / 3_600_000) * 3_600_000;
  const expiresAt = windowStart + 3_600_000;
  const session = await incrementBucket(`session:${userId}:${windowStart}`, now, expiresAt);
  if (session > PER_SESSION_MODEL_CALLS_PER_HOUR) return { allowed: false, retryAfter: Math.max(1, Math.ceil((expiresAt - now) / 1000)), scope: "session" as const };
  const global = await incrementBucket(`global:${windowStart}`, now, expiresAt);
  if (global > GLOBAL_MODEL_CALLS_PER_HOUR) return { allowed: false, retryAfter: Math.max(1, Math.ceil((expiresAt - now) / 1000)), scope: "global" as const };
  return { allowed: true, retryAfter: 0, scope: "none" as const };
}

async function incrementBucket(key: string, now: number, expiresAt: number) {
  const row = await env.DB.prepare(`INSERT INTO demo_rate_limits(bucket_key,count,expires_at) VALUES(?,1,?)
    ON CONFLICT(bucket_key) DO UPDATE SET
      count=CASE WHEN demo_rate_limits.expires_at<=? THEN 1 ELSE demo_rate_limits.count+1 END,
      expires_at=CASE WHEN demo_rate_limits.expires_at<=? THEN excluded.expires_at ELSE demo_rate_limits.expires_at END
    RETURNING count`).bind(key, expiresAt, now, now).first<{ count: number }>();
  return Number(row?.count ?? 1);
}
