import { getStorageLocal, setStorageLocal } from "./extensionApi.js";

const REQUEST_BODIES_STORAGE_KEY = "requestBodiesCache";

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
  console.log("getting clicks");
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
  getObjectFromLocalStorage,
  saveObjectInLocalStorage,
  commitIfActive,
  getIsActive,
  getStack,
  getCurrentMetrics,
  getContextSwitches,
  getRequestBodiesCache,
  saveRequestBodiesCache,
  addClicks,
  addConcepts,
  addChoices,
  addKeystrokes,
};
