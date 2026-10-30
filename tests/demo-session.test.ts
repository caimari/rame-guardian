import { describe, expect, it } from "vitest";
import { anonymousSubject, encodeSessionToken, isValidSessionToken, readCookie } from "../apps/web/lib/session-token.js";

describe("anonymous demo sessions", () => {
  it("assigns different durable subjects to two independent visitors", async () => {
    const visitorA = encodeSessionToken(new Uint8Array(32).fill(17));
    const visitorB = encodeSessionToken(new Uint8Array(32).fill(23));

    expect(isValidSessionToken(visitorA)).toBe(true);
    expect(isValidSessionToken(visitorB)).toBe(true);
    expect(await anonymousSubject(visitorA)).not.toBe(await anonymousSubject(visitorB));
  });

  it("rejects malformed identifiers instead of accepting a client-selected user id", () => {
    expect(isValidSessionToken("private-demo-user")).toBe(false);
    expect(isValidSessionToken("../../another-user")).toBe(false);
    expect(isValidSessionToken("a".repeat(43))).toBe(true);
  });

  it("reads only the named cookie", () => {
    const token = encodeSessionToken(new Uint8Array(32).fill(31));
    expect(readCookie(`theme=dark; rame_guardian_session=${token}; locale=en`, "rame_guardian_session")).toBe(token);
    expect(readCookie(`other=${token}`, "rame_guardian_session")).toBeNull();
  });
});
