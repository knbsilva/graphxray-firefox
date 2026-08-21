jest.mock("../extensionApi.js", () => ({
  containsPermissions: jest.fn(),
  removePermissions: jest.fn(),
  requestPermissions: jest.fn(),
}));

import {
  OPTIONAL_PERMISSION_SCOPES,
  getOptionalPermissionScope,
  requestOptionalPermissionScope,
} from "../optionalPermissions.js";
import { requestPermissions } from "../extensionApi.js";

describe("optional permission scopes", () => {
  it("maps external snippets to the DevX host only", () => {
    expect(getOptionalPermissionScope("externalSnippets")).toEqual({
      origins: ["https://devxapi-func-prod-eastus.azurewebsites.net/*"],
      data_collection: ["websiteContent", "personallyIdentifyingInfo"],
    });
  });

  it("requests the DevX host and built-in Firefox data consent together", async () => {
    requestPermissions.mockResolvedValue(true);

    await expect(
      requestOptionalPermissionScope("externalSnippets")
    ).resolves.toBe(true);
    expect(requestPermissions).toHaveBeenCalledWith({
      origins: ["https://devxapi-func-prod-eastus.azurewebsites.net/*"],
      data_collection: ["websiteContent", "personallyIdentifyingInfo"],
    });
  });

  it("maps Ultra X-Ray to optional Microsoft admin hosts", () => {
    const scope = getOptionalPermissionScope("ultraXRay");

    expect(scope.origins).toContain("https://admin.microsoft.com/*");
    expect(scope.origins).toContain("https://admin.cloud.microsoft/*");
    expect(scope.origins).not.toContain("https://graph.microsoft.com/*");
    expect(scope.origins.length).toBe(
      OPTIONAL_PERMISSION_SCOPES.ultraXRay.origins.length
    );
  });

  it("falls back to an empty permission scope for unknown names", () => {
    expect(getOptionalPermissionScope("unknown-scope")).toEqual({
      origins: [],
    });
  });
});
