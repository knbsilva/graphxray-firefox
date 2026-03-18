const browserApi = typeof browser !== "undefined" ? browser : null;

const chromeApi = typeof chrome !== "undefined" ? chrome : null;

const extensionApi = browserApi || chromeApi || null;

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

const getExtensionUrl = (path) => {
  if (!extensionApi?.runtime?.getURL) {
    return path;
  }

  return extensionApi.runtime.getURL(path);
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
        console.log("Runtime message handler failed:", error);
        sendResponse({
          error: error?.message || String(error),
        });
      });

    return true;
  });
};

export {
  extensionApi,
  sendRuntimeMessage,
  setStorageLocal,
  getStorageLocal,
  queryTabs,
  openExtensionOptionsPage,
  getExtensionUrl,
  getHostWebview,
  getDevtoolsApi,
  isFirefoxBrowser,
  addRuntimeMessageListener,
};
