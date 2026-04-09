import {
  getStorageLocal,
  sendRuntimeMessage,
  setStorageLocal,
} from "./extensionApi.js";
import { DIAGNOSTIC_MODE_STORAGE_KEY } from "./diagnostics.js";
import {
  DEFAULT_SESSION_RETENTION_MS,
  GRAPHXRAY_SESSION_STORAGE_KEY,
  createEmptySessionState,
  isSessionExpired,
  normalizeSessionRetentionMs,
  normalizeSessionState,
} from "./session.js";

const REQUEST_BODIES_STORAGE_KEY = "requestBodiesCache";
const ALLOW_EXTERNAL_SNIPPETS_STORAGE_KEY = "graphxrayAllowExternalSnippets";
const EXTERNAL_SNIPPETS_ACKNOWLEDGED_STORAGE_KEY =
  "graphxrayExternalSnippetsAcknowledged";
const SENSITIVE_CAPTURE_CONSENT_STORAGE_KEY = "graphxraySensitiveCaptureConsent";
const EXPORT_SANITIZATION_MODE_STORAGE_KEY = "graphxrayExportSanitizationMode";
const PERSIST_SESSION_DATA_STORAGE_KEY = "graphxrayPersistSessionData";
const SESSION_RETENTION_MS_STORAGE_KEY = "graphxraySessionRetentionMs";
const ULTRA_XRAY_ACKNOWLEDGED_STORAGE_KEY = "graphxrayUltraXRayAcknowledged";
const LEGACY_EXTENSION_STATE = {
  currentMetrics: {
    urls: [],
  },
  contextSwitches: 0,
  stack: [],
  isActive: false,
  [REQUEST_BODIES_STORAGE_KEY]: [],
};

const saveObjectInLocalStorage = async function (obj) {
  return setStorageLocal(obj);
};

const getObjectFromLocalStorage = async function (key) {
  return getStorageLocal(key);
};

const commitIfActive = async function (obj) {
  const isActive = await getIsActive();
  if (isActive) {
    await saveObjectInLocalStorage(obj);
  }
};

const getIsActive = async () => {
  return true;
};
const getStack = async () => await getObjectFromLocalStorage("stack");
const getCurrentMetrics = async () =>
  await getObjectFromLocalStorage("currentMetrics");
const getContextSwitches = async () =>
  await getObjectFromLocalStorage("contextSwitches");
const getRequestBodiesCache = async () =>
  (await getObjectFromLocalStorage(REQUEST_BODIES_STORAGE_KEY)) || [];
const saveRequestBodiesCache = async (cache) =>
  await saveObjectInLocalStorage({
    [REQUEST_BODIES_STORAGE_KEY]: cache,
  });
const getDiagnosticModeEnabled = async () =>
  Boolean(await getObjectFromLocalStorage(DIAGNOSTIC_MODE_STORAGE_KEY));
const saveDiagnosticModeEnabled = async (enabled) =>
  await saveObjectInLocalStorage({
    [DIAGNOSTIC_MODE_STORAGE_KEY]: Boolean(enabled),
  });
const getAllowExternalSnippets = async () =>
  Boolean(await getObjectFromLocalStorage(ALLOW_EXTERNAL_SNIPPETS_STORAGE_KEY));
const saveAllowExternalSnippets = async (enabled) =>
  await saveObjectInLocalStorage({
    [ALLOW_EXTERNAL_SNIPPETS_STORAGE_KEY]: Boolean(enabled),
  });
const getExternalSnippetsAcknowledged = async () =>
  Boolean(
    await getObjectFromLocalStorage(EXTERNAL_SNIPPETS_ACKNOWLEDGED_STORAGE_KEY)
  );
const saveExternalSnippetsAcknowledged = async (acknowledged) =>
  await saveObjectInLocalStorage({
    [EXTERNAL_SNIPPETS_ACKNOWLEDGED_STORAGE_KEY]: Boolean(acknowledged),
  });
const getSensitiveCaptureConsentAccepted = async () =>
  Boolean(await getObjectFromLocalStorage(SENSITIVE_CAPTURE_CONSENT_STORAGE_KEY));
const saveSensitiveCaptureConsentAccepted = async (accepted) =>
  await saveObjectInLocalStorage({
    [SENSITIVE_CAPTURE_CONSENT_STORAGE_KEY]: Boolean(accepted),
  });
const getExportSanitizationMode = async () =>
  (await getObjectFromLocalStorage(EXPORT_SANITIZATION_MODE_STORAGE_KEY)) ||
  "redacted";
const saveExportSanitizationMode = async (mode) =>
  await saveObjectInLocalStorage({
    [EXPORT_SANITIZATION_MODE_STORAGE_KEY]: mode || "redacted",
  });
const getPersistSessionData = async () => {
  const value = await getObjectFromLocalStorage(PERSIST_SESSION_DATA_STORAGE_KEY);
  return value === undefined ? true : Boolean(value);
};
const savePersistSessionData = async (enabled) =>
  await saveObjectInLocalStorage({
    [PERSIST_SESSION_DATA_STORAGE_KEY]: Boolean(enabled),
    ...(enabled
      ? {}
      : {
          [GRAPHXRAY_SESSION_STORAGE_KEY]: createEmptySessionState(),
          [REQUEST_BODIES_STORAGE_KEY]: [],
        }),
  });
const getSessionRetentionMs = async () =>
  normalizeSessionRetentionMs(
    await getObjectFromLocalStorage(SESSION_RETENTION_MS_STORAGE_KEY)
  );
const saveSessionRetentionMs = async (retentionMs) =>
  await saveObjectInLocalStorage({
    [SESSION_RETENTION_MS_STORAGE_KEY]: normalizeSessionRetentionMs(retentionMs),
  });
const getUltraXRayAcknowledged = async () =>
  Boolean(await getObjectFromLocalStorage(ULTRA_XRAY_ACKNOWLEDGED_STORAGE_KEY));
const saveUltraXRayAcknowledged = async (acknowledged) =>
  await saveObjectInLocalStorage({
    [ULTRA_XRAY_ACKNOWLEDGED_STORAGE_KEY]: Boolean(acknowledged),
  });
const getGraphXRaySession = async () => {
  const retentionMs = await getSessionRetentionMs();
  const rawSession = await getObjectFromLocalStorage(GRAPHXRAY_SESSION_STORAGE_KEY);
  const normalizedSession = normalizeSessionState(rawSession, retentionMs);
  normalizedSession.modes.externalSnippetsAcknowledged =
    await getExternalSnippetsAcknowledged();
  normalizedSession.modes.persistSessionData = await getPersistSessionData();

  if (rawSession?.updatedAt && isSessionExpired(rawSession.updatedAt, retentionMs)) {
    await saveObjectInLocalStorage({
      [GRAPHXRAY_SESSION_STORAGE_KEY]: createEmptySessionState(),
    });
  }

  return normalizedSession;
};
const saveGraphXRaySession = async (session) =>
  await saveObjectInLocalStorage({
    [GRAPHXRAY_SESSION_STORAGE_KEY]: (await getPersistSessionData())
      ? normalizeSessionState(session)
      : createEmptySessionState(),
  });
const clearGraphXRaySession = async () =>
  await saveGraphXRaySession(createEmptySessionState());
const clearGraphXRayLocalData = async () => {
  await saveObjectInLocalStorage({
    ...LEGACY_EXTENSION_STATE,
    [ALLOW_EXTERNAL_SNIPPETS_STORAGE_KEY]: false,
    [DIAGNOSTIC_MODE_STORAGE_KEY]: false,
    [EXPORT_SANITIZATION_MODE_STORAGE_KEY]: "redacted",
    [EXTERNAL_SNIPPETS_ACKNOWLEDGED_STORAGE_KEY]: false,
    [PERSIST_SESSION_DATA_STORAGE_KEY]: true,
    [SESSION_RETENTION_MS_STORAGE_KEY]: DEFAULT_SESSION_RETENTION_MS,
    [SENSITIVE_CAPTURE_CONSENT_STORAGE_KEY]: false,
    [ULTRA_XRAY_ACKNOWLEDGED_STORAGE_KEY]: false,
    [GRAPHXRAY_SESSION_STORAGE_KEY]: createEmptySessionState(),
  });

  try {
    await sendRuntimeMessage({
      type: "CLEAR_REQUEST_BODY_CACHE",
    });
  } catch (error) {
    // Ignore background-clear errors here; persisted local data has already been reset.
  }
};

const addChoices = async (i = 1) => {
  const currentMetrics = await getObjectFromLocalStorage("currentMetrics");
  let { choices } = currentMetrics;
  await commitIfActive({
    currentMetrics: {
      ...currentMetrics,
      choices: choices + i,
    },
  });
};
const addConcepts = async (i = 1) => {
  const currentMetrics = await getObjectFromLocalStorage("currentMetrics");
  let { concepts } = currentMetrics;
  await commitIfActive({
    currentMetrics: {
      ...currentMetrics,
      concepts: concepts + i,
    },
  });
};

const addClicks = async (i = 1) => {
  const currentMetrics = await getObjectFromLocalStorage("currentMetrics");
  let { clicks } = currentMetrics;
  await commitIfActive({
    currentMetrics: {
      ...currentMetrics,
      clicks: clicks + i,
    },
  });
};

const addKeystrokes = async (i = 1) => {
  const currentMetrics = await getObjectFromLocalStorage("currentMetrics");
  let { keystrokes } = currentMetrics;
  await commitIfActive({
    currentMetrics: {
      ...currentMetrics,
      keystrokes: keystrokes + i,
    },
  });
};

export {
  ALLOW_EXTERNAL_SNIPPETS_STORAGE_KEY,
  EXTERNAL_SNIPPETS_ACKNOWLEDGED_STORAGE_KEY,
  EXPORT_SANITIZATION_MODE_STORAGE_KEY,
  PERSIST_SESSION_DATA_STORAGE_KEY,
  SESSION_RETENTION_MS_STORAGE_KEY,
  SENSITIVE_CAPTURE_CONSENT_STORAGE_KEY,
  ULTRA_XRAY_ACKNOWLEDGED_STORAGE_KEY,
  getObjectFromLocalStorage,
  saveObjectInLocalStorage,
  commitIfActive,
  getIsActive,
  getStack,
  getCurrentMetrics,
  getContextSwitches,
  getRequestBodiesCache,
  saveRequestBodiesCache,
  getDiagnosticModeEnabled,
  saveDiagnosticModeEnabled,
  getAllowExternalSnippets,
  saveAllowExternalSnippets,
  getExternalSnippetsAcknowledged,
  saveExternalSnippetsAcknowledged,
  getSensitiveCaptureConsentAccepted,
  saveSensitiveCaptureConsentAccepted,
  getExportSanitizationMode,
  saveExportSanitizationMode,
  getPersistSessionData,
  savePersistSessionData,
  getSessionRetentionMs,
  saveSessionRetentionMs,
  getUltraXRayAcknowledged,
  saveUltraXRayAcknowledged,
  getGraphXRaySession,
  saveGraphXRaySession,
  clearGraphXRaySession,
  clearGraphXRayLocalData,
  addClicks,
  addConcepts,
  addChoices,
  addKeystrokes,
};
