import {
  getObjectFromLocalStorage,
  getRequestBodiesCache,
  saveObjectInLocalStorage,
  saveRequestBodiesCache,
} from "../common/storage.js";
import { getAllDomainUrls } from "../common/domains.js";
import { addRuntimeMessageListener, extensionApi } from "../common/extensionApi.js";

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

  const snapshotRequestBodies = () => pruneRequestBodies(requestBodies);

  const persistRequestBodiesSnapshot = async () => {
    await saveRequestBodiesCache(snapshotRequestBodies());
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
        console.log("Could not persist request body cache:", error);
      });
  };

  const getRequestBodyFromCache = async (requestDetails) => {
    requestBodies = pruneRequestBodies(requestBodies);

    const inMemoryRequest = findRequestBodyMatch(requestBodies, requestDetails);
    if (inMemoryRequest) {
      return inMemoryRequest.body;
    }

    const storedRequestBodies = pruneRequestBodies(await getRequestBodiesCache());
    if (hasObjectChanged(await getRequestBodiesCache(), storedRequestBodies)) {
      await saveRequestBodiesCache(storedRequestBodies);
    }

    const storedRequestBody = findRequestBodyMatch(storedRequestBodies, requestDetails);
    if (storedRequestBody) {
      requestBodies = pruneRequestBodies([storedRequestBody, ...requestBodies]);
      return storedRequestBody.body;
    }

    return "";
  };

  await ensureExtensionState();

  // Initialize storage
  extensionApi.runtime.onInstalled.addListener(async function (details) {
    await saveObjectInLocalStorage({
      ...DEFAULT_EXTENSION_STATE,
      requestBodiesCache: [],
    });
  });

  // Capture request bodies for Graph API calls
  extensionApi.webRequest.onBeforeRequest.addListener(
    function (details) {
      console.log("Background - webRequest intercepted:", details.url, details.method);
      if (details.requestBody) {
        // Store the request body temporarily with URL as key
        let bodyData = "";
        if (details.requestBody.raw) {
          // Handle raw body data
          const decoder = new TextDecoder("utf-8");
          bodyData = details.requestBody.raw
            .map(data => decoder.decode(data.bytes))
            .join("");
        } else if (details.requestBody.formData) {
          // Handle form data
          bodyData = JSON.stringify(details.requestBody.formData);
        }
        
        console.log("Background - extracted body data:", bodyData);
        
        if (bodyData) {
          persistRequestBody(
            details.url,
            details.method,
            bodyData,
            details.timeStamp || Date.now()
          );

          console.log("Background - stored body for URL:", details.url);
          console.log("Background - current stored bodies:", requestBodies.map((entry) => entry.url));
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
    console.log("Background - received message:", request);
    if (request.type === "GET_REQUEST_BODY" && request.url) {
      const body = await getRequestBodyFromCache(request);
      console.log("Background - returning body for URL:", request.url, "body:", body);
      return { body };
    }

    if (request.method === "start") {
      await saveObjectInLocalStorage({ isActive: true });
      return { farewell: "Graph X-Ray started." };
    }

    if (request.method === "stop") {
      await saveObjectInLocalStorage({ isActive: false });
      return { farewell: "Graph X-Ray stopped." };
    }

    return null;
  });
}

init();
