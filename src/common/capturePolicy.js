import { isUltraXRayDomain } from "./domains.js";

const evaluateCaptureEligibility = (url, modes = {}) => {
  const {
    captureConsentAccepted = false,
    capturePaused = false,
    ultraXRayMode = false,
  } = modes;

  if (!captureConsentAccepted) {
    return {
      allowed: false,
      reason: "consent_required",
    };
  }

  if (capturePaused) {
    return {
      allowed: false,
      reason: "capture_paused",
    };
  }

  if (isUltraXRayDomain(url) && !ultraXRayMode) {
    return {
      allowed: false,
      reason: "ultra_xray_disabled",
    };
  }

  return {
    allowed: true,
    reason: "allowed",
  };
};

const filterCapturedEntries = (entries = [], modes = {}) =>
  entries.filter((entry) => evaluateCaptureEligibility(entry?.url, modes).allowed);

export { evaluateCaptureEligibility, filterCapturedEntries };
