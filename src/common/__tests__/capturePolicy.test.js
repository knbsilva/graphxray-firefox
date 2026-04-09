import {
  evaluateCaptureEligibility,
  filterCapturedEntries,
} from "../capturePolicy.js";

describe("capture policy", () => {
  const standardUrl = "https://graph.microsoft.com/v1.0/me";
  const ultraUrl = "https://admin.microsoft.com/admin/home";

  it("allows standard Graph capture when consented and running", () => {
    expect(
      evaluateCaptureEligibility(standardUrl, {
        captureConsentAccepted: true,
        capturePaused: false,
        ultraXRayMode: false,
      })
    ).toEqual({ allowed: true, reason: "allowed" });
  });

  it("blocks capture when consent has not been acknowledged", () => {
    expect(
      evaluateCaptureEligibility(standardUrl, {
        captureConsentAccepted: false,
        capturePaused: false,
        ultraXRayMode: true,
      })
    ).toEqual({ allowed: false, reason: "consent_required" });
  });

  it("blocks capture when paused", () => {
    expect(
      evaluateCaptureEligibility(standardUrl, {
        captureConsentAccepted: true,
        capturePaused: true,
        ultraXRayMode: true,
      })
    ).toEqual({ allowed: false, reason: "capture_paused" });
  });

  it("blocks Ultra X-Ray domains until Ultra X-Ray mode is enabled", () => {
    expect(
      evaluateCaptureEligibility(ultraUrl, {
        captureConsentAccepted: true,
        capturePaused: false,
        ultraXRayMode: false,
      })
    ).toEqual({ allowed: false, reason: "ultra_xray_disabled" });
  });

  it("allows Ultra X-Ray domains when the feature is enabled", () => {
    expect(
      evaluateCaptureEligibility(ultraUrl, {
        captureConsentAccepted: true,
        capturePaused: false,
        ultraXRayMode: true,
      })
    ).toEqual({ allowed: true, reason: "allowed" });
  });

  it("filters cached request entries through the same policy", () => {
    const entries = [
      { url: standardUrl, method: "GET" },
      { url: ultraUrl, method: "POST" },
    ];

    expect(
      filterCapturedEntries(entries, {
        captureConsentAccepted: true,
        capturePaused: false,
        ultraXRayMode: false,
      })
    ).toEqual([{ url: standardUrl, method: "GET" }]);
  });
});
