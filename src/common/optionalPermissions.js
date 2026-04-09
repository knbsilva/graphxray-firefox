import { GRAPH_DOMAINS } from "./domains.js";
import {
  containsPermissions,
  removePermissions,
  requestPermissions,
} from "./extensionApi.js";

const toOriginPatterns = (origins = []) =>
  origins.map((origin) => `${origin}/*`);

const OPTIONAL_PERMISSION_SCOPES = {
  externalSnippets: {
    origins: toOriginPatterns([
      "https://devxapi-func-prod-eastus.azurewebsites.net",
    ]),
  },
  ultraXRay: {
    origins: toOriginPatterns(GRAPH_DOMAINS.ULTRA_XRAY),
  },
};

const getOptionalPermissionScope = (scopeName) =>
  OPTIONAL_PERMISSION_SCOPES[scopeName] || { origins: [] };

const hasOptionalPermissionScope = async (scopeName) => {
  const scope = getOptionalPermissionScope(scopeName);
  if (!scope.origins.length) {
    return true;
  }

  const result = await containsPermissions(scope);
  return result === null ? false : Boolean(result);
};

const requestOptionalPermissionScope = async (scopeName) => {
  const scope = getOptionalPermissionScope(scopeName);
  if (!scope.origins.length) {
    return true;
  }

  const result = await requestPermissions(scope);
  return result === null ? false : Boolean(result);
};

const removeOptionalPermissionScope = async (scopeName) => {
  const scope = getOptionalPermissionScope(scopeName);
  if (!scope.origins.length) {
    return true;
  }

  const result = await removePermissions(scope);
  return result === null ? false : Boolean(result);
};

export {
  OPTIONAL_PERMISSION_SCOPES,
  getOptionalPermissionScope,
  hasOptionalPermissionScope,
  requestOptionalPermissionScope,
  removeOptionalPermissionScope,
};
