import {
  getAllowedDomainUrls,
  isAllowedDomain,
  isUltraXRayDomain,
  parseGraphUrl,
} from "../domains.js";

describe("domain allowlisting", () => {
  it("accepts exact Microsoft Graph origins", () => {
    expect(isAllowedDomain("https://graph.microsoft.com/v1.0/me")).toBe(true);
    expect(isAllowedDomain("https://graph.microsoft.us/v1.0/me")).toBe(true);
  });

  it("rejects spoofed origins that embed trusted hosts", () => {
    expect(
      isAllowedDomain("https://graph.microsoft.com.evil.example/v1.0/me", true)
    ).toBe(false);
    expect(
      isAllowedDomain(
        "https://evil.example/?next=https://graph.microsoft.com/v1.0/me",
        true
      )
    ).toBe(false);
  });

  it("detects real Ultra X-Ray origins but rejects spoofed ones", () => {
    expect(isUltraXRayDomain("https://admin.microsoft.com/#/homepage")).toBe(
      true
    );
    expect(
      isUltraXRayDomain("https://admin.microsoft.com.evil.example/dashboard")
    ).toBe(false);
  });

  it("parses path and host from valid URLs", () => {
    expect(
      parseGraphUrl(
        "https://graph.microsoft.com/beta/deviceManagement/managedDevices?$top=1"
      )
    ).toEqual({
      path: "/beta/deviceManagement/managedDevices?$top=1",
      host: "graph.microsoft.com",
    });
  });

  it("falls back safely for invalid URLs", () => {
    expect(parseGraphUrl("not-a-valid-url")).toEqual({
      path: "not-a-valid-url",
      host: "graph.microsoft.com",
    });
  });

  it("scopes request interception URLs to the active capture mode", () => {
    const standardUrls = getAllowedDomainUrls(false);
    const ultraUrls = getAllowedDomainUrls(true);

    expect(standardUrls).toContain("https://graph.microsoft.com/*");
    expect(standardUrls).not.toContain("https://admin.microsoft.com/*");
    expect(ultraUrls).toContain("https://admin.microsoft.com/*");
    expect(ultraUrls.length).toBeGreaterThan(standardUrls.length);
  });
});
