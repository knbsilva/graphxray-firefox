import {
  DEFAULT_EXPORT_SANITIZATION_MODE,
  buildExportArtifact,
  normalizeExportSanitizationMode,
  redactSensitiveText,
  redactSensitiveValue,
} from "../security.js";

describe("security helpers", () => {
  it("redacts bearer tokens, emails, and GUIDs in plain text", () => {
    const input =
      'Authorization: Bearer abc.def.ghi\nOwner: user@example.com\nId: 123e4567-e89b-12d3-a456-426614174000';
    const output = redactSensitiveText(input);

    expect(output).toContain("Bearer [REDACTED]");
    expect(output).toContain("[REDACTED_EMAIL]");
    expect(output).toContain("[REDACTED_GUID]");
  });

  it("redacts nested JSON content in redacted export mode", () => {
    const artifact = buildExportArtifact({
      rawContent: JSON.stringify({
        access_token: "secret-token",
        owner: "admin@contoso.com",
        id: "123e4567-e89b-12d3-a456-426614174000",
      }),
      mode: "redacted",
      rawExtension: "json",
      rawMimeType: "application/json",
    });

    expect(artifact.extension).toBe("json");
    expect(artifact.mimeType).toBe("application/json");

    const parsed = JSON.parse(artifact.content);
    expect(parsed.access_token).toBe("[REDACTED]");
    expect(parsed.owner).toBe("[REDACTED_EMAIL]");
    expect(parsed.id).toBe("[REDACTED_GUID]");
  });

  it("returns metadata-only JSON in summary mode", () => {
    const artifact = buildExportArtifact({
      rawContent: '{"displayName":"tenant-admin@contoso.com"}',
      mode: "summary",
      summary: {
        kind: "snippet-summary",
        url: "https://graph.microsoft.com/v1.0/users/123e4567-e89b-12d3-a456-426614174000",
      },
    });

    expect(artifact.extension).toBe("json");
    expect(artifact.mimeType).toBe("application/json");

    const parsed = JSON.parse(artifact.content);
    expect(parsed.exportMode).toBe("summary");
    expect(parsed.kind).toBe("snippet-summary");
    expect(parsed.url).toContain("[REDACTED_GUID]");
    expect(parsed.rawContent).toBeUndefined();
  });

  it("normalizes invalid export modes to the secure default", () => {
    expect(normalizeExportSanitizationMode("bogus")).toBe(
      DEFAULT_EXPORT_SANITIZATION_MODE
    );
    expect(normalizeExportSanitizationMode("raw")).toBe("raw");
  });

  it("redacts nested values in objects and arrays", () => {
    const redacted = redactSensitiveValue({
      owner: "admin@contoso.com",
      members: [
        "123e4567-e89b-12d3-a456-426614174000",
        { access_token: "abc123" },
      ],
    });

    expect(redacted.owner).toBe("[REDACTED_EMAIL]");
    expect(redacted.members[0]).toBe("[REDACTED_GUID]");
    expect(redacted.members[1].access_token).toBe("[REDACTED]");
  });
});
