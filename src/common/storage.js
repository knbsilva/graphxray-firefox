import { getStorageLocal, setStorageLocal } from "./extensionApi.js";
import { DIAGNOSTIC_MODE_STORAGE_KEY } from "./diagnostics.js";
import {
  GRAPHXRAY_SESSION_STORAGE_KEY,
  createEmptySessionState,
  normalizeSessionState,
} from "./session.js";

const REQUEST_BODIES_STORAGE_KEY = "requestBodiesCache";
const ALLOW_EXTERNAL_SNIPPETS_STORAGE_KEY = "graphxrayAllowExternalSnippets";

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
const getGraphXRaySession = async () =>
  normalizeSessionState(
    await getObjectFromLocalStorage(GRAPHXRAY_SESSION_STORAGE_KEY)
  );
const saveGraphXRaySession = async (session) =>
  await saveObjectInLocalStorage({
    [GRAPHXRAY_SESSION_STORAGE_KEY]: normalizeSessionState(session),
  });
const clearGraphXRaySession = async () =>
  await saveGraphXRaySession(createEmptySessionState());

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
  getGraphXRaySession,
  saveGraphXRaySession,
  clearGraphXRaySession,
  addClicks,
  addConcepts,
  addChoices,
  addKeystrokes,
};
