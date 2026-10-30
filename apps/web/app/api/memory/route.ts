import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "../../../db";
import { auditEvents, memoryVersions } from "../../../db/schema";
import type { MemoryProposal } from "../../../lib/contracts";
import { requestUserId } from "../../../lib/authority";

export async function GET(request: Request) {
  try {
    const userId = await requestUserId(request);
    if (!userId) return NextResponse.json({ error: "A valid demo session is required." }, { status: 401 });
    const rows = await getDb().select().from(memoryVersions).where(eq(memoryVersions.userId, userId)).orderBy(desc(memoryVersions.createdAt)).limit(50);
    return NextResponse.json({ memories: rows.filter((row) => row.status === "authorized") });
  } catch (error) {
    console.error("memory_read_failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ memories: [], warning: "Memory storage is not ready." });
  }
}

export async function POST(request: Request) {
  try {
    const userId = await requestUserId(request);
    if (!userId) return NextResponse.json({ error: "A valid demo session is required." }, { status: 401 });
    const body = (await request.json()) as MemoryProposal;
    const scopes = ["preference", "workflow", "project"];
    if (typeof body.statement !== "string" || body.statement.length < 3 || body.statement.length > 320 || !scopes.includes(body.scope)) {
      return NextResponse.json({ error: "Invalid memory proposal." }, { status: 400 });
    }
    const id = crypto.randomUUID();
    const now = new Date();
    const digest = await sha256(`${body.scope}:${body.statement}`);
    const record = { id, userId, statement: body.statement, scope: body.scope, confidence: Math.max(0, Math.min(1, Number(body.confidence) || 0)), version: 1, digest, source: "conversation", status: "authorized" as const, createdAt: now };
    const db = getDb();
    await db.batch([
      db.insert(memoryVersions).values(record),
      db.insert(auditEvents).values({ id: crypto.randomUUID(), userId: record.userId, action: "memory.authorized", subjectId: id, detail: JSON.stringify({ version: 1, digest, source: record.source }), createdAt: now }),
    ]);
    return NextResponse.json({ memory: record }, { status: 201 });
  } catch (error) {
    console.error("memory_write_failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Memory could not be authorized." }, { status: 500 });
  }
}

async function sha256(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
