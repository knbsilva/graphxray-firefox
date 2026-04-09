import {
  DEFAULT_SESSION_RETENTION_MS,
  createEmptySessionState,
  isSessionExpired,
  normalizeSessionRetentionMs,
  normalizeSessionState,
} from "../session.js";

describe("session retention", () => {
  it("normalizes unsupported retention values to the default", () => {
    expect(normalizeSessionRetentionMs(123)).toBe(DEFAULT_SESSION_RETENTION_MS);
    expect(normalizeSessionRetentionMs(15 * 60 * 1000)).toBe(15 * 60 * 1000);
  });

  it("expires sessions using the selected retention window", () => {
    const updatedAt = new Date(Date.now() - 20 * 60 * 1000).toISOString();
    expect(isSessionExpired(updatedAt, 15 * 60 * 1000)).toBe(true);
    expect(isSessionExpired(updatedAt, 60 * 60 * 1000)).toBe(false);
  });

  it("drops expired persisted session state when retention is exceeded", () => {
    const expiredSession = {
      stack: [{ displayRequestUrl: "GET https://graph.microsoft.com/v1.0/me" }],
      diagnosticLogs: [{ event: "captured" }],
      modes: {
        sessionRetentionMs: 15 * 60 * 1000,
      },
      updatedAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
      sourceContext: "devtools",
    };

    expect(
      normalizeSessionState(expiredSession, expiredSession.modes.sessionRetentionMs)
    ).toEqual(createEmptySessionState());
  });

  it("keeps unexpired session state and normalizes retention into modes", () => {
    const activeSession = {
      stack: [{ displayRequestUrl: "GET https://graph.microsoft.com/v1.0/me" }],
      diagnosticLogs: [],
      modes: {},
      updatedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      sourceContext: "dashboard",
    };

    const normalized = normalizeSessionState(activeSession, 15 * 60 * 1000);
    expect(normalized.stack).toHaveLength(1);
    expect(normalized.modes.sessionRetentionMs).toBe(15 * 60 * 1000);
  });
});
