import { buildDiagnosticEntry, createDiagnosticPreview } from "../diagnostics.js";

describe("diagnostic helpers", () => {
  it("marks diagnostic entries as redacted sensitive data", () => {
    const entry = buildDiagnosticEntry({
      source: "devtools",
      event: "request_captured",
      details: {
        authorization: "Bearer test-token",
      },
    });

    expect(entry.classification).toEqual({
      kind: "diagnostic-log",
      level: "sensitive",
      handling: "redacted",
    });
    expect(entry.details.authorization).toBe("[REDACTED]");
  });

  it("redacts sensitive values in previews", () => {
    const preview = createDiagnosticPreview({
      owner: "admin@contoso.com",
      id: "123e4567-e89b-12d3-a456-426614174000",
    });

    expect(preview).toContain("[REDACTED_EMAIL]");
    expect(preview).toContain("[REDACTED_GUID]");
  });
});
