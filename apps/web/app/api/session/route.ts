import { NextResponse } from "next/server";
import { createOrResumeDemoSession, sessionCookieOptions } from "../../../lib/demo-session";
import { DEMO_SESSION_COOKIE } from "../../../lib/session-token";

export async function GET(request: Request) {
  try {
    const session = await createOrResumeDemoSession(request);
    const response = NextResponse.json({ ready: true, identity: session.identity.kind }, { headers: { "Cache-Control": "private, no-store" } });
    if (session.token) response.cookies.set(DEMO_SESSION_COOKIE, session.token, sessionCookieOptions(request));
    return response;
  } catch (error) {
    console.error("demo_session_failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "The isolated demo session could not be created." }, { status: 503 });
  }
}
