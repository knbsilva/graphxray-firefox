import { queryTabs } from "./extensionApi.js";

export const getActiveTab = async function () {
  return queryTabs({ active: true, currentWindow: true });
};

export const getStartTab = async function () {
  return queryTabs({
    active: true,
  });
};
