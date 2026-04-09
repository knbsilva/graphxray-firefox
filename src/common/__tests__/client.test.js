import { getPowershellCmd } from "../client.js";

describe("client security controls", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    delete global.fetch;
    jest.clearAllMocks();
  });

  it("does not call DevX for non-PowerShell languages in Local only mode", async () => {
    const result = await getPowershellCmd(
      "python",
      "POST",
      "https://graph.microsoft.com/v1.0/users",
      '{"displayName":"Admin User"}',
      { allowExternalSnippets: false }
    );

    expect(global.fetch).not.toHaveBeenCalled();
    expect(result).toEqual({
      code: null,
      error:
        "External snippet generation is disabled in Local only mode for this language.",
      source: "none",
    });
  });

  it("keeps PowerShell local in Local only mode without calling DevX", async () => {
    const result = await getPowershellCmd(
      "powershell",
      "PATCH",
      "https://graph.microsoft.com/beta/deviceManagement/configurationPolicies('abc')",
      '{"name":"Baseline policy"}',
      { allowExternalSnippets: false }
    );

    expect(global.fetch).not.toHaveBeenCalled();
    expect(result.source).toBe("local");
    expect(result.error).toBeNull();
    expect(result.code).toContain("Invoke-MgGraphRequest -Method PATCH");
    expect(result.code).toContain("$params = @{");
  });
});
