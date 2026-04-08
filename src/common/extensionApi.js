import { warnLog } from "./security.js";

const browserApi = typeof browser !== "undefined" ? browser : null;
const chromeApi = typeof chrome !== "undefined" ? chrome : null;

const extensionApi = browserApi || chromeApi || null;
const DOWNLOAD_CANCELLED_PATTERN = /cancel|canceled|cancelled|aborted|user canceled/i;

const wrapChromeCallback = (invoke) =>
  new Promise((resolve, reject) => {
    try {
      invoke((result) => {
        const lastError = chromeApi?.runtime?.lastError;
        if (lastError) {
          reject(new Error(lastError.message));
          return;
        }
        resolve(result);
      });
    } catch (error) {
      reject(error);
    }
  });

const sendRuntimeMessage = async (message) => {
  if (!extensionApi?.runtime?.sendMessage) {
    return null;
  }

  if (browserApi) {
    return extensionApi.runtime.sendMessage(message);
  }

  return wrapChromeCallback((callback) =>
    extensionApi.runtime.sendMessage(message, callback)
  );
};

const setStorageLocal = async (value) => {
  if (!extensionApi?.storage?.local?.set) {
    return undefined;
  }

  if (browserApi) {
    return extensionApi.storage.local.set(value);
  }

  return wrapChromeCallback((callback) =>
    extensionApi.storage.local.set(value, callback)
  );
};

const getStorageLocal = async (key) => {
  if (!extensionApi?.storage?.local?.get) {
    return undefined;
  }

  if (browserApi) {
    const value = await extensionApi.storage.local.get(key);
    return value[key];
  }

  const value = await wrapChromeCallback((callback) =>
    extensionApi.storage.local.get(key, callback)
  );
  return value[key];
};

const queryTabs = async (queryInfo) => {
  if (!extensionApi?.tabs?.query) {
    return [];
  }

  if (browserApi) {
    return extensionApi.tabs.query(queryInfo);
  }

  return wrapChromeCallback((callback) =>
    extensionApi.tabs.query(queryInfo, callback)
  );
};

const createTab = async (createProperties) => {
  if (!extensionApi?.tabs?.create) {
    return null;
  }

  if (browserApi) {
    return extensionApi.tabs.create(createProperties);
  }

  return wrapChromeCallback((callback) =>
    extensionApi.tabs.create(createProperties, callback)
  );
};

const openExtensionOptionsPage = async () => {
  if (extensionApi?.runtime?.openOptionsPage) {
    if (browserApi) {
      return extensionApi.runtime.openOptionsPage();
    }

    return wrapChromeCallback((callback) =>
      extensionApi.runtime.openOptionsPage(callback)
    );
  }

  const optionsUrl = getExtensionUrl("options.html");
  if (typeof window !== "undefined" && optionsUrl) {
    window.open(optionsUrl);
  }

  return undefined;
};

const normalizeDownloadError = (error) => {
  const message = error?.message || String(error || "");
  return {
    message,
    cancelled: DOWNLOAD_CANCELLED_PATTERN.test(message),
  };
};

const downloadFile = async ({ url, filename, saveAs = true }) => {
  if (!extensionApi?.downloads?.download) {
    return {
      status: "unsupported",
      downloadId: null,
    };
  }

  try {
    if (browserApi) {
      const downloadId = await extensionApi.downloads.download({
        url,
        filename,
        saveAs,
      });
      return {
        status:
          downloadId === null || downloadId === undefined
            ? "cancelled"
            : "saved",
        downloadId,
      };
    }

    const downloadId = await wrapChromeCallback((callback) =>
      extensionApi.downloads.download(
        {
          url,
          filename,
          saveAs,
        },
        callback
      )
    );

    return {
      status:
        downloadId === null || downloadId === undefined
          ? "cancelled"
          : "saved",
      downloadId,
    };
  } catch (error) {
    const normalizedError = normalizeDownloadError(error);
    return {
      status: normalizedError.cancelled ? "cancelled" : "error",
      downloadId: null,
      error: normalizedError.message,
    };
  }
};

const getExtensionUrl = (path) => {
  if (!extensionApi?.runtime?.getURL) {
    return path;
  }

  return extensionApi.runtime.getURL(path);
};

const openExtensionPage = async (path) => {
  const url = getExtensionUrl(path);

  if (extensionApi?.tabs?.create) {
    try {
      return await createTab({ url });
    } catch (error) {
      warnLog("Could not create extension tab, falling back to window.open", error);
    }
  }

  if (typeof window !== "undefined" && url) {
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return null;
};

const getHostWebview = () => {
  if (typeof window === "undefined") {
    return null;
  }

  return window.chrome?.webview ?? null;
};

const getDevtoolsApi = () => extensionApi?.devtools ?? null;
const isFirefoxBrowser = () =>
  typeof navigator !== "undefined" && /firefox/i.test(navigator.userAgent);

const addRuntimeMessageListener = (listener) => {
  if (!extensionApi?.runtime?.onMessage?.addListener) {
    return;
  }

  if (browserApi) {
    extensionApi.runtime.onMessage.addListener((message, sender) =>
      listener(message, sender)
    );
    return;
  }

  extensionApi.runtime.onMessage.addListener((message, sender, sendResponse) => {
    Promise.resolve(listener(message, sender))
      .then((response) => {
        sendResponse(response);
      })
      .catch((error) => {
        warnLog("Runtime message handler failed", error);
        sendResponse({
          error: error?.message || String(error),
        });
      });

    return true;
  });
};

const addStorageChangeListener = (listener) => {
  if (!extensionApi?.storage?.onChanged?.addListener) {
    return () => {};
  }

  const wrappedListener = (changes, areaName) => listener(changes, areaName);
  extensionApi.storage.onChanged.addListener(wrappedListener);

  return () => {
    extensionApi.storage?.onChanged?.removeListener?.(wrappedListener);
  };
};

export {
  extensionApi,
  sendRuntimeMessage,
  setStorageLocal,
  getStorageLocal,
  queryTabs,
  createTab,
  openExtensionOptionsPage,
  downloadFile,
  getExtensionUrl,
  openExtensionPage,
  getHostWebview,
  getDevtoolsApi,
  isFirefoxBrowser,
  addRuntimeMessageListener,
  addStorageChangeListener,
};
