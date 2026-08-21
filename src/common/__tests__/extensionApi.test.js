import { normalizePermissionsPayload } from "../extensionApi.js";

describe("extension permission payloads", () => {
  it("preserves Firefox built-in data collection permissions", () => {
    expect(
      normalizePermissionsPayload({
        origins: ["https://example.test/*"],
        data_collection: ["websiteContent", "personallyIdentifyingInfo"],
      })
    ).toEqual({
      permissions: [],
      origins: ["https://example.test/*"],
      data_collection: ["websiteContent", "personallyIdentifyingInfo"],
    });
  });
});
