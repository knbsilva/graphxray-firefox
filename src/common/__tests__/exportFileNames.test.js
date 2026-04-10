import {
  buildGraphXRayExportFileName,
  getResourceSlug,
} from "../exportFileNames.js";

describe("export file names", () => {
  const fixedTimestamp = new Date("2026-04-10T14:29:03.123Z");

  it("builds clear entry file names for request exports", () => {
    const fileName = buildGraphXRayExportFileName({
      scope: "entry",
      artifact: "request",
      method: "POST",
      url: "https://graph.microsoft.com/beta/directoryObjects/getByIds?$select=displayName,id",
      mode: "redacted",
      extension: "json",
      timestamp: fixedTimestamp,
    });

    expect(fileName).toBe(
      "graphxray-entry-request-post-directoryobjects-getbyids-query-redacted-20260410T142903123Z.json"
    );
  });

  it("includes language and source in snippet exports", () => {
    const fileName = buildGraphXRayExportFileName({
      scope: "entry",
      artifact: "snippet",
      method: "GET",
      url: "https://graph.microsoft.com/beta/subscribedSkus",
      language: "python",
      source: "devx",
      mode: "raw",
      extension: "py",
      timestamp: fixedTimestamp,
    });

    expect(fileName).toBe(
      "graphxray-entry-snippet-get-subscribedskus-python-devx-raw-20260410T142903123Z.py"
    );
  });

  it("uses summary artifact names for session summaries", () => {
    const fileName = buildGraphXRayExportFileName({
      scope: "session",
      artifact: "summary",
      language: "powershell",
      mode: "summary",
      extension: "json",
      timestamp: fixedTimestamp,
    });

    expect(fileName).toBe(
      "graphxray-session-summary-powershell-summary-20260410T142903123Z.json"
    );
  });

  it("builds diagnostic log file names", () => {
    const fileName = buildGraphXRayExportFileName({
      scope: "diagnostic",
      artifact: "logs",
      mode: "redacted",
      extension: "json",
      timestamp: fixedTimestamp,
    });

    expect(fileName).toBe(
      "graphxray-diagnostic-logs-redacted-20260410T142903123Z.json"
    );
  });

  it("extracts a concise resource slug from graph urls", () => {
    expect(
      getResourceSlug(
        "https://graph.microsoft.com/beta/deviceManagement/configurationPolicies('16544197-fa08-46b0-b0a6-d13ccb97995a')/settings?$expand=settingDefinitions&$top=1000"
      )
    ).toBe("configurationpolicies-settings-query");
  });
});
