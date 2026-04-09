import {
  getGraphXRaySession,
  getDiagnosticModeEnabled,
  getObjectFromLocalStorage,
  getPersistSessionData,
  getRequestBodiesCache,
  PERSIST_SESSION_DATA_STORAGE_KEY,
  saveObjectInLocalStorage,
  saveRequestBodiesCache,
} from "../common/storage.js";
import {
  DIAGNOSTIC_LOG_MESSAGE_TYPE,
  DIAGNOSTIC_MODE_STORAGE_KEY,
  buildDiagnosticEntry,
  createDiagnosticPreview,
} from "../common/diagnostics.js";
import { getAllDomainUrls } from "../common/domains.js";
import {
  addRuntimeMessageListener,
  extensionApi,
  sendRuntimeMessage,
} from "../common/extensionApi.js";
import { warnLog } from "../common/security.js";

const REQUEST_BODY_TTL_MS = 30 * 1000;
const REQUEST_BODY_CACHE_LIMIT = 50;
const DEFAULT_EXTENSION_STATE = {
  currentMetrics: {
    urls: [],
  },
  contextSwitches: 0,
  stack: [],
  isActive: false,
};

const pruneRequestBodies = (requestBodies, now = Date.now()) =>
  (requestBodies || [])
    .filter((entry) => entry?.timestamp && now - entry.timestamp <= REQUEST_BODY_TTL_MS)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, REQUEST_BODY_CACHE_LIMIT);

const findRequestBodyMatch = (requestBodies, requestDetails) => {
  const { url, method, startedDateTime } = requestDetails;
  const startedAt = startedDateTime ? new Date(startedDateTime).getTime() : Date.now();

  const exactMatches = requestBodies.filter((entry) => {
    if (entry.url !== url) {
      return false;
    }

    if (method && entry.method && entry.method !== method) {
      return false;
    }

    return true;
  });

  if (exactMatches.length > 0) {
    return exactMatches.sort(
      (left, right) =>
        Math.abs(left.timestamp - startedAt) - Math.abs(right.timestamp - startedAt)
    )[0];
  }

  // Only relax to URL-only matching when the caller did not provide a method.
  // Otherwise a GET can accidentally inherit the body from a nearby PATCH/POST
  // to the same endpoint.
  if (method) {
    return null;
  }

  return requestBodies.find((entry) => entry.url === url) || null;
};

const hasObjectChanged = (left, right) =>
  JSON.stringify(left) !== JSON.stringify(right);

const ensureExtensionState = async () => {
  const currentMetrics = await getObjectFromLocalStorage("currentMetrics");
  if (currentMetrics) {
    return;
  }

  await saveObjectInLocalStorage({
      ...DEFAULT_EXTENSION_STATE,
      requestBodiesCache: [],
  });
};

// This needs to be an export due to typescript implementation limitation of needing '--isolatedModules' tsconfig
export async function init() {
  // Store request bodies temporarily
  let requestBodies = [];
  let requestBodyWriteQueue = Promise.resolve();
  let diagnosticModeEnabled = await getDiagnosticModeEnabled();
  let persistSessionData = await getPersistSessionData();

  const snapshotRequestBodies = () => pruneRequestBodies(requestBodies);
  const emitDiagnosticLog = (event, details = {}, level = "info") => {
    if (!diagnosticModeEnabled) {
      return;
    }

    sendRuntimeMessage({
      type: DIAGNOSTIC_LOG_MESSAGE_TYPE,
      payload: buildDiagnosticEntry({
        source: "background",
        event,
        level,
        details,
      }),
    }).catch((error) => {
      warnLog("Could not send diagnostic log", error);
    });
  };

  const persistRequestBodiesSnapshot = async () => {
    if (!persistSessionData) {
      await saveRequestBodiesCache([]);
      return;
    }
    await saveRequestBodiesCache(snapshotRequestBodies());
  };

  const clearRequestBodyCache = async () => {
    requestBodies = [];
    await saveRequestBodiesCache([]);
    emitDiagnosticLog("request_body_cache_cleared");
  };

  const persistRequestBody = (url, method, body, timestamp) => {
    requestBodies = pruneRequestBodies([
      {
        url,
        method,
        body,
        timestamp,
      },
      ...requestBodies,
    ]);

    requestBodyWriteQueue = requestBodyWriteQueue
      .then(() => persistRequestBodiesSnapshot())
      .catch((error) => {
        warnLog("Could not persist request body cache", error);
        emitDiagnosticLog("request_body_persist_failed", {
          error: error?.message || String(error),
        }, "error");
      });
  };

  const getRequestBodyFromCache = async (requestDetails) => {
    requestBodies = pruneRequestBodies(requestBodies);

    const inMemoryRequest = findRequestBodyMatch(requestBodies, requestDetails);
    if (inMemoryRequest) {
      emitDiagnosticLog("request_body_cache_hit", {
        cache: "memory",
        url: requestDetails.url,
        method: requestDetails.method,
        bodyLength: inMemoryRequest.body ? inMemoryRequest.body.length : 0,
      });
      return inMemoryRequest.body;
    }

    const cachedRequestBodies = await getRequestBodiesCache();
    if (!persistSessionData) {
      emitDiagnosticLog("request_body_cache_storage_skipped", {
        url: requestDetails.url,
        method: requestDetails.method,
        reason: "memory_only_mode",
      });
      return "";
    }

    const storedRequestBodies = pruneRequestBodies(cachedRequestBodies);
    if (hasObjectChanged(cachedRequestBodies, storedRequestBodies)) {
      await saveRequestBodiesCache(storedRequestBodies);
    }

    const storedRequestBody = findRequestBodyMatch(storedRequestBodies, requestDetails);
    if (storedRequestBody) {
      requestBodies = pruneRequestBodies([storedRequestBody, ...requestBodies]);
      emitDiagnosticLog("request_body_cache_hit", {
        cache: "storage",
        url: requestDetails.url,
        method: requestDetails.method,
        bodyLength: storedRequestBody.body ? storedRequestBody.body.length : 0,
      });
      return storedRequestBody.body;
    }

    emitDiagnosticLog("request_body_cache_miss", {
      url: requestDetails.url,
      method: requestDetails.method,
      startedDateTime: requestDetails.startedDateTime,
    }, "warning");
    return "";
  };

  await ensureExtensionState();
  await getGraphXRaySession();
  if (!persistSessionData) {
    await saveRequestBodiesCache([]);
  }
  extensionApi.storage?.onChanged?.addListener((changes, areaName) => {
    if (
      areaName === "local" &&
      Object.prototype.hasOwnProperty.call(changes, DIAGNOSTIC_MODE_STORAGE_KEY)
    ) {
      diagnosticModeEnabled = Boolean(
        changes[DIAGNOSTIC_MODE_STORAGE_KEY]?.newValue
      );
    }

    if (
      areaName === "local" &&
      Object.prototype.hasOwnProperty.call(changes, PERSIST_SESSION_DATA_STORAGE_KEY)
    ) {
      persistSessionData = Boolean(
        changes[PERSIST_SESSION_DATA_STORAGE_KEY]?.newValue
      );

      if (!persistSessionData) {
        clearRequestBodyCache().catch((error) => {
          warnLog("Could not clear request body cache after disabling persistence", error);
        });
      }
    }
  });

  // Initialize storage
  extensionApi.runtime.onInstalled.addListener(async function (details) {
    await saveObjectInLocalStorage({
      ...DEFAULT_EXTENSION_STATE,
      requestBodiesCache: [],
    });
    emitDiagnosticLog("background_installed", {
      reason: details?.reason,
    });
  });

  // Capture request bodies for Graph API calls
  extensionApi.webRequest.onBeforeRequest.addListener(
    function (details) {
      emitDiagnosticLog("web_request_intercepted", {
        url: details.url,
        method: details.method,
        hasRequestBody: Boolean(details.requestBody),
      });
      if (details.requestBody) {
        // Store the request body temporarily with URL as key
        let bodyData = "";
        let requestBodySource = "unknown";
        if (details.requestBody.raw) {
          // Handle raw body data
          const decoder = new TextDecoder("utf-8");
          bodyData = details.requestBody.raw
            .map(data => decoder.decode(data.bytes))
            .join("");
          requestBodySource = "raw";
        } else if (details.requestBody.formData) {
          // Handle form data
          bodyData = JSON.stringify(details.requestBody.formData);
          requestBodySource = "formData";
        }

        if (bodyData) {
          persistRequestBody(
            details.url,
            details.method,
            bodyData,
            details.timeStamp || Date.now()
          );

          emitDiagnosticLog("request_body_captured", {
            url: details.url,
            method: details.method,
            source: requestBodySource,
            bodyLength: bodyData.length,
            bodyPreview: createDiagnosticPreview(bodyData),
          });
        }
      }
    },
    {
      urls: getAllDomainUrls()
    },
    ["requestBody"]
  );

  // Send request body data to devtools when available
  addRuntimeMessageListener(async (request) => {
    if (request?.type === DIAGNOSTIC_LOG_MESSAGE_TYPE) {
      return null;
    }

    if (request.type === "GET_REQUEST_BODY" && request.url) {
      const body = await getRequestBodyFromCache(request);
      emitDiagnosticLog("request_body_lookup_completed", {
        url: request.url,
        method: request.method,
        bodyLength: body ? body.length : 0,
        bodyPreview: body ? createDiagnosticPreview(body) : null,
      });
      return { body };
    }

    if (request.type === "CLEAR_REQUEST_BODY_CACHE") {
      await clearRequestBodyCache();
      return { cleared: true };
    }

    if (request.method === "start") {
      await saveObjectInLocalStorage({ isActive: true });
      emitDiagnosticLog("extension_started");
      return { farewell: "Graph X-Ray started." };
    }

    if (request.method === "stop") {
      await saveObjectInLocalStorage({ isActive: false });
      emitDiagnosticLog("extension_stopped");
      return { farewell: "Graph X-Ray stopped." };
    }

    return null;
  });
}

init();
