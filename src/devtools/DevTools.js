import React from "react";
import "./DevTools.css";
import { CodeView } from "../components/CodeView";
import { AppHeader } from "../components/AppHeader";
import { FontSizes } from "@fluentui/theme";
import { getTheme } from "@fluentui/react";
import { getCodeView } from "../common/client.js";
import { isAllowedDomain } from "../common/domains.js";
import { Dropdown } from "@fluentui/react/lib/Dropdown";
import { Toggle } from "@fluentui/react/lib/Toggle";
import { IconButton } from "@fluentui/react/lib/Button";
import { TooltipHost } from "@fluentui/react/lib/Tooltip";
import DevToolsCommandBar from "../components/DevToolsCommandBar";
import { Layer } from "@fluentui/react/lib/Layer";
import {
  addStorageChangeListener,
  addRuntimeMessageListener,
  getDevtoolsApi,
  getHostWebview,
  isFirefoxBrowser,
  openExtensionPage,
} from "../common/extensionApi.js";
import {
  ALLOW_EXTERNAL_SNIPPETS_STORAGE_KEY,
  getAllowExternalSnippets,
  getGraphXRaySession,
  clearGraphXRayLocalData,
  saveAllowExternalSnippets,
  saveDiagnosticModeEnabled,
  saveGraphXRaySession,
} from "../common/storage.js";
import {
  buildDiagnosticEntry,
  DIAGNOSTIC_LOG_MESSAGE_TYPE,
  DIAGNOSTIC_MODE_STORAGE_KEY,
  MAX_DIAGNOSTIC_LOG_ENTRIES,
} from "../common/diagnostics.js";
import {
  buildDiagnosticExportPayload,
  buildSessionSnapshot,
  downloadContentAsFile,
  getSaveScriptContentFromStack,
  GRAPHXRAY_SESSION_STORAGE_KEY,
  normalizeSessionState,
} from "../common/session.js";
import {
  getSnippetLanguageOption,
  SNIPPET_LANGUAGE_OPTIONS,
} from "../common/snippetLanguages.js";
import { warnLog } from "../common/security.js";

const theme = getTheme();

const dropdownStyles = {
  dropdown: { width: 300 },
};

class DevTools extends React.Component {
  constructor() {
    super();
    const savedUltraXRayMode = localStorage.getItem("graphxray-ultraXRayMode");
    const ultraXRayMode = savedUltraXRayMode
      ? JSON.parse(savedUltraXRayMode)
      : false;
    const savedDiagnosticMode = localStorage.getItem(
      DIAGNOSTIC_MODE_STORAGE_KEY
    );
    const diagnosticMode = savedDiagnosticMode
      ? JSON.parse(savedDiagnosticMode)
      : false;

    this.state = {
      allowExternalSnippets: false,
      capturePaused: false,
      stack: [],
      diagnosticLogs: [],
      diagnosticMode,
      snippetLanguage: "powershell",
      ultraXRayMode,
    };
    this.sessionSyncTimeout = null;
    this.removeStorageChangeListener = null;
  }

  componentDidMount() {
    this.hydrateSessionFromStorage();
    this.hydrateExternalSnippetSetting();
    this.syncDiagnosticModeState();
    this.addSessionStorageListener();
    this.addDiagnosticLogListener();
    this.addListener();
    this.addListenerGraph();
  }

  componentWillUnmount() {
    if (this.sessionSyncTimeout) {
      clearTimeout(this.sessionSyncTimeout);
    }

    if (this.removeStorageChangeListener) {
      this.removeStorageChangeListener();
    }
  }

  syncDiagnosticModeState = async () => {
    await saveDiagnosticModeEnabled(this.state.diagnosticMode);
  };

  hydrateExternalSnippetSetting = async () => {
    this.setState({
      allowExternalSnippets: await getAllowExternalSnippets(),
    });
  };

  appendDiagnosticLog = (entry) => {
    this.setState(
      (previousState) => ({
        diagnosticLogs: [...previousState.diagnosticLogs, entry].slice(
          -MAX_DIAGNOSTIC_LOG_ENTRIES
        ),
      }),
      this.scheduleSessionSync
    );
  };

  recordDiagnosticEntry = (entry) => {
    if (!this.state.diagnosticMode) {
      return;
    }

    this.appendDiagnosticLog(buildDiagnosticEntry(entry));
  };

  recordDiagnostic = (
    event,
    details = {},
    level = "info",
    source = "devtools"
  ) => {
    this.recordDiagnosticEntry({
      source,
      event,
      level,
      details,
    });
  };

  clearStack = () => {
    this.setState({ stack: [] }, this.scheduleSessionSync);
  };

  clearSession = () => {
    this.setState(
      {
        stack: [],
        diagnosticLogs: [],
      },
      this.scheduleSessionSync
    );
  };

  hydrateSessionFromStorage = async () => {
    const session = normalizeSessionState(await getGraphXRaySession());
    if (
      session.stack.length === 0 &&
      session.diagnosticLogs.length === 0 &&
      !session.updatedAt
    ) {
      return;
    }

    this.setState({
      allowExternalSnippets: session.modes.allowExternalSnippets,
      capturePaused: session.modes.capturePaused,
      stack: session.stack,
      diagnosticLogs: session.diagnosticLogs,
      diagnosticMode: session.modes.diagnosticMode,
      snippetLanguage: session.modes.snippetLanguage,
      ultraXRayMode: session.modes.ultraXRayMode,
    });
  };

  addSessionStorageListener = () => {
    this.removeStorageChangeListener = addStorageChangeListener(
      (changes, areaName) => {
        if (
          areaName !== "local"
        ) {
          return;
        }

        if (
          Object.prototype.hasOwnProperty.call(
            changes,
            ALLOW_EXTERNAL_SNIPPETS_STORAGE_KEY
          )
        ) {
          this.setState({
            allowExternalSnippets: Boolean(
              changes[ALLOW_EXTERNAL_SNIPPETS_STORAGE_KEY]?.newValue
            ),
          });
        }

        if (
          !Object.prototype.hasOwnProperty.call(
            changes,
            GRAPHXRAY_SESSION_STORAGE_KEY
          )
        ) {
          return;
        }

        const nextSession = normalizeSessionState(
          changes[GRAPHXRAY_SESSION_STORAGE_KEY]?.newValue
        );

        if (nextSession.sourceContext === "devtools") {
          return;
        }

        this.setState({
          allowExternalSnippets: nextSession.modes.allowExternalSnippets,
          capturePaused: nextSession.modes.capturePaused,
          stack: nextSession.stack,
          diagnosticLogs: nextSession.diagnosticLogs,
          diagnosticMode: nextSession.modes.diagnosticMode,
          snippetLanguage: nextSession.modes.snippetLanguage,
          ultraXRayMode: nextSession.modes.ultraXRayMode,
        });
      }
    );
  };

  buildCurrentSessionSnapshot = (sourceContext = "devtools") =>
    buildSessionSnapshot({
      stack: this.state.stack,
      diagnosticLogs: this.state.diagnosticLogs,
      modes: {
        allowExternalSnippets: this.state.allowExternalSnippets,
        capturePaused: this.state.capturePaused,
        diagnosticMode: this.state.diagnosticMode,
        snippetLanguage: this.state.snippetLanguage,
        ultraXRayMode: this.state.ultraXRayMode,
      },
      sourceContext,
    });

  buildRequestStackKey = (request, harEntry = null) => {
    const startedDateTime =
      harEntry?.startedDateTime ||
      request?._harEntry?.startedDateTime ||
      new Date().toISOString();

    return [
      String(request?.method || "GRAPH").toUpperCase(),
      request?.url || "unknown-url",
      startedDateTime,
    ].join("|");
  };

  appendStackEntry = (entry) =>
    new Promise((resolve) => {
      this.setState(
        (previousState) => ({
          stack: [...previousState.stack, entry],
        }),
        () => {
          this.scheduleSessionSync();
          resolve();
        }
      );
    });

  replaceStackEntry = (requestKey, nextEntry) =>
    new Promise((resolve) => {
      this.setState(
        (previousState) => ({
          stack: previousState.stack.map((entry) =>
            entry.requestKey === requestKey ? nextEntry : entry
          ),
        }),
        () => {
          this.scheduleSessionSync();
          resolve();
        }
      );
    });

  mergeBatchSnippetUpgrades = (existingSnippets = [], upgradedSnippets = []) => {
    const upgradeMap = new Map(
      upgradedSnippets
        .filter((snippet) => snippet?.id && snippet.code)
        .map((snippet) => [snippet.id, snippet])
    );

    let updatedCount = 0;
    const mergedSnippets = existingSnippets.map((snippet) => {
      const upgradedSnippet = upgradeMap.get(snippet.id);
      if (!upgradedSnippet) {
        return snippet;
      }

      const snippetChanged =
        snippet.code !== upgradedSnippet.code ||
        snippet.codeSource !== upgradedSnippet.codeSource ||
        snippet.codeError !== upgradedSnippet.codeError;

      if (snippetChanged) {
        updatedCount += 1;
      }

      upgradeMap.delete(snippet.id);
      return snippetChanged ? { ...snippet, ...upgradedSnippet } : snippet;
    });

    for (const upgradedSnippet of upgradeMap.values()) {
      mergedSnippets.push(upgradedSnippet);
      updatedCount += 1;
    }

    return {
      snippets: mergedSnippets,
      updatedCount,
    };
  };

  scheduleSessionSync = () => {
    if (this.sessionSyncTimeout) {
      clearTimeout(this.sessionSyncTimeout);
    }

    this.sessionSyncTimeout = setTimeout(async () => {
      try {
        await saveGraphXRaySession(this.buildCurrentSessionSnapshot());
      } catch (error) {
        warnLog("Could not persist Graph X-Ray session", error);
      }
    }, 150);
  };

  openDashboard = () => {
    openExtensionPage("dashboard.html").catch((error) => {
      warnLog("Could not open standalone dashboard", error);
    });
  };

  saveScript = async () => {
    const script = getSaveScriptContentFromStack(this.state.stack);
    if (!script.trim()) {
      warnLog("No generated code is available to save yet.");
      this.recordDiagnostic(
        "save_script_skipped",
        {
          reason: "empty_script",
        },
        "warning"
      );
      return;
    }
    const languageOpt = getSnippetLanguageOption(this.state.snippetLanguage);
    const fileName = "GraphXRaySession." + languageOpt.fileExt;
    await downloadContentAsFile(script, fileName);
    this.recordDiagnostic("save_script_requested", {
      fileName,
      language: this.state.snippetLanguage,
      scriptLength: script.length,
    });
  };

  copyScript = () => {
    const script = getSaveScriptContentFromStack(this.state.stack);
    if (!script.trim()) {
      warnLog("No generated code is available to copy yet.");
      this.recordDiagnostic(
        "copy_script_skipped",
        {
          reason: "empty_script",
        },
        "warning"
      );
      return;
    }
    navigator.clipboard.writeText(script);
    this.recordDiagnostic("copy_script_requested", {
      language: this.state.snippetLanguage,
      scriptLength: script.length,
    });
  };

  saveLogs = () => {
    if (this.state.diagnosticLogs.length === 0) {
      warnLog("No diagnostic logs are available to save yet.");
      return;
    }

    if (
      typeof window !== "undefined" &&
      !window.confirm(
        "Diagnostic logs can contain sensitive Microsoft 365 administrative data. Save them to disk?"
      )
    ) {
      return;
    }

    const logPayload = buildDiagnosticExportPayload(
      this.buildCurrentSessionSnapshot()
    );
    const fileName = `GraphXRayDiagnostics-${new Date()
      .toISOString()
      .replace(/[:.]/g, "-")}.json`;

    downloadContentAsFile(
      JSON.stringify(logPayload, null, 2),
      fileName,
      "application/json"
    );
  };

  clearLocalCache = async () => {
    await clearGraphXRayLocalData();
    this.setState(
      {
        stack: [],
        diagnosticLogs: [],
      },
      this.scheduleSessionSync
    );
    this.recordDiagnostic("local_cache_cleared", {
      snippetLanguage: this.state.snippetLanguage,
    });
  };

  addDiagnosticLogListener() {
    addRuntimeMessageListener((message) => {
      if (
        message?.type !== DIAGNOSTIC_LOG_MESSAGE_TYPE ||
        !message.payload ||
        !this.state.diagnosticMode
      ) {
        return null;
      }

      this.appendDiagnosticLog(message.payload);
      return null;
    });
  }

  addListenerGraph() {
    const hostWebview = getHostWebview();
    if (!hostWebview) {
      return;
    }
    hostWebview.addEventListener("message", (event) => {
      const msg = JSON.parse(event.data);
      if (msg.eventName === "GraphCall") {
        if (this.state.capturePaused) {
          this.recordDiagnostic("capture_skipped_paused", {
            source: "host_graph_call",
            eventName: msg.eventName,
          });
          return;
        }
        this.recordDiagnostic("host_graph_call_received", {
          eventName: msg.eventName,
        });
        this.showRequest(msg);
      }
    });
  }

  async addRequestToStack(request, version, harEntry = null) {
    this.recordDiagnostic("request_processing_started", {
      method: request.method,
      url: request.url,
      hasHarEntry: Boolean(harEntry),
      snippetLanguage: this.state.snippetLanguage,
      allowExternalSnippets: this.state.allowExternalSnippets,
    });

    const requestKey = this.buildRequestStackKey(request, harEntry);

    if (this.state.snippetLanguage === "powershell") {
      const localCodeView = await getCodeView(
        this.state.snippetLanguage,
        request,
        version,
        harEntry,
        {
          preferLocalPowerShell: true,
          allowExternalSnippets: this.state.allowExternalSnippets,
        },
        this.recordDiagnosticEntry
      );
      if (!localCodeView) {
        this.recordDiagnostic(
          "request_processing_skipped",
          {
            method: request.method,
            url: request.url,
            reason: "code_view_null",
          },
          "warning"
        );
        return;
      }

      const localEntry = {
        ...localCodeView,
        requestKey,
      };

      await this.appendStackEntry(localEntry);

      this.recordDiagnostic("snippet_rendered_local", {
        displayRequestUrl: localEntry.displayRequestUrl,
        hasCode: Boolean(localEntry.code),
        codeLength: localEntry.code ? localEntry.code.length : 0,
        batchSnippetCount: localEntry.batchCodeSnippets
          ? localEntry.batchCodeSnippets.length
          : 0,
        codeSource: localEntry.codeSource,
      });

      this.recordDiagnostic("request_processing_completed", {
        displayRequestUrl: localEntry.displayRequestUrl,
        hasCode: Boolean(localEntry.code),
        codeLength: localEntry.code ? localEntry.code.length : 0,
        batchSnippetCount: localEntry.batchCodeSnippets
          ? localEntry.batchCodeSnippets.length
          : 0,
        codeSource: localEntry.codeSource,
      });

      this.recordDiagnostic("snippet_upgrade_requested", {
        method: request.method,
        url: request.url,
        displayRequestUrl: localEntry.displayRequestUrl,
      });

      const upgradedCodeView = await getCodeView(
        this.state.snippetLanguage,
        request,
        version,
        harEntry,
        {
          devxOnly: true,
          allowExternalSnippets: this.state.allowExternalSnippets,
        },
        this.recordDiagnosticEntry
      );

      if (!upgradedCodeView) {
        this.recordDiagnostic("snippet_kept_local_after_devx_failure", {
          displayRequestUrl: localEntry.displayRequestUrl,
          reason: "code_view_null",
          codeSource: localEntry.codeSource,
        });
        return;
      }

      const mergedBatchSnippets = this.mergeBatchSnippetUpgrades(
        localEntry.batchCodeSnippets,
        upgradedCodeView.batchCodeSnippets
      );
      const hasMainUpgrade = Boolean(upgradedCodeView.code);
      const hasBatchUpgrade = mergedBatchSnippets.updatedCount > 0;

      if (hasMainUpgrade || hasBatchUpgrade) {
        const upgradedEntry = {
          ...localEntry,
          code: hasMainUpgrade ? upgradedCodeView.code : localEntry.code,
          codeError: hasMainUpgrade
            ? upgradedCodeView.codeError
            : localEntry.codeError,
          codeSource: hasMainUpgrade
            ? upgradedCodeView.codeSource
            : localEntry.codeSource,
          batchCodeSnippets: mergedBatchSnippets.snippets,
        };

        await this.replaceStackEntry(requestKey, upgradedEntry);

        this.recordDiagnostic("snippet_upgraded_from_devx", {
          displayRequestUrl: upgradedEntry.displayRequestUrl,
          upgradedMainSnippet: hasMainUpgrade,
          upgradedBatchSnippetCount: mergedBatchSnippets.updatedCount,
          codeSource: upgradedEntry.codeSource,
          batchSnippetCount: upgradedEntry.batchCodeSnippets
            ? upgradedEntry.batchCodeSnippets.length
            : 0,
        });
        return;
      }

      this.recordDiagnostic("snippet_kept_local_after_devx_failure", {
        displayRequestUrl: localEntry.displayRequestUrl,
        codeSource: localEntry.codeSource,
        batchSnippetCount: localEntry.batchCodeSnippets
          ? localEntry.batchCodeSnippets.length
          : 0,
      });
      return;
    }

    const codeView = await getCodeView(
      this.state.snippetLanguage,
      request,
      version,
      harEntry,
      {
        allowExternalSnippets: this.state.allowExternalSnippets,
      },
      this.recordDiagnosticEntry
    );
    if (codeView) {
      await this.appendStackEntry({
        ...codeView,
        requestKey,
      });
      this.recordDiagnostic("request_processing_completed", {
        displayRequestUrl: codeView.displayRequestUrl,
        hasCode: Boolean(codeView.code),
        codeLength: codeView.code ? codeView.code.length : 0,
        batchSnippetCount: codeView.batchCodeSnippets
          ? codeView.batchCodeSnippets.length
          : 0,
      });
      return;
    }

    this.recordDiagnostic(
      "request_processing_skipped",
      {
        method: request.method,
        url: request.url,
        reason: "code_view_null",
      },
      "warning"
    );
  }

  addListener() {
    const devtoolsApi = getDevtoolsApi();
    if (!devtoolsApi) {
      return;
    }
    devtoolsApi.network.onRequestFinished.addListener(async (harEntry) => {
      try {
        if (this.state.capturePaused) {
          this.recordDiagnostic("capture_skipped_paused", {
            source: "network",
            method: harEntry?.request?.method,
            url: harEntry?.request?.url,
          });
          return;
        }
        if (
          harEntry.request &&
          harEntry.request.url &&
          isAllowedDomain(harEntry.request.url, this.state.ultraXRayMode)
        ) {
          const request = harEntry.request;
          this.recordDiagnostic("network_request_finished", {
            method: request.method,
            url: request.url,
            status: harEntry.response?.status,
          });

          request._harEntry = harEntry;

          try {
            this.showRequest(request, harEntry);
          } catch (error) {
            warnLog("Could not process captured request", error);
          }
        }
      } catch (error) {
        warnLog("Request finished handler failed", error);
      }
    });
  }

  async showRequest(request, harEntry = null) {
    if (request.url.includes("/$batch")) {
      this.recordDiagnostic("batch_request_detected", {
        method: request.method,
        url: request.url,
      });
      await this.addRequestToStack(request, "", harEntry);
    } else {
      await this.addRequestToStack(request, "", harEntry);
    }
  }

  onLanguageChange = (e, option) => {
    const previousLanguage = this.state.snippetLanguage;
    this.setState(
      { snippetLanguage: option.key, stack: [] },
      () => {
        this.scheduleSessionSync();
        this.recordDiagnostic("language_changed", {
          from: previousLanguage,
          to: option.key,
          stackCleared: true,
        });
      }
    );
  };

  onUltraXRayToggle = (e, checked) => {
    this.setState({ ultraXRayMode: checked }, this.scheduleSessionSync);
    localStorage.setItem("graphxray-ultraXRayMode", JSON.stringify(checked));
    this.clearStack();
    this.recordDiagnostic("ultra_xray_toggled", {
      enabled: checked,
      stackCleared: true,
    });
  };

  onDiagnosticModeToggle = async (e, checked) => {
    localStorage.setItem(DIAGNOSTIC_MODE_STORAGE_KEY, JSON.stringify(checked));
    await saveDiagnosticModeEnabled(checked);

    this.setState(
      (previousState) => ({
        diagnosticMode: checked,
        diagnosticLogs: checked ? [] : previousState.diagnosticLogs,
      }),
      () => {
        this.scheduleSessionSync();
        if (checked) {
          this.recordDiagnostic("diagnostic_mode_enabled", {
            snippetLanguage: this.state.snippetLanguage,
            ultraXRayMode: this.state.ultraXRayMode,
          });
        }
      }
    );
  };

  toggleCapturePaused = async () => {
    const nextCapturePaused = !this.state.capturePaused;
    this.setState(
      {
        capturePaused: nextCapturePaused,
      },
      () => {
        this.scheduleSessionSync();
        this.recordDiagnostic(
          nextCapturePaused ? "capture_paused" : "capture_resumed",
          {
            snippetLanguage: this.state.snippetLanguage,
            ultraXRayMode: this.state.ultraXRayMode,
          }
        );
      }
    );
  };

  onAllowExternalSnippetsToggle = async (e, checked) => {
    const nextValue = Boolean(checked);
    await saveAllowExternalSnippets(nextValue);
    this.setState(
      {
        allowExternalSnippets: nextValue,
      },
      () => {
        this.scheduleSessionSync();
        this.recordDiagnostic("external_snippets_setting_changed", {
          enabled: nextValue,
          snippetLanguage: this.state.snippetLanguage,
        });
      }
    );
  };

  render() {
    const showFirefoxNote = isFirefoxBrowser();
    const visibleStack = [...this.state.stack].reverse();

    return (
      <div className="App" style={{ fontSize: FontSizes.size12 }}>
        <Layer>
          <div
            style={{
              boxShadow: theme.effects.elevation4,
            }}
          >
            <AppHeader hideSettings={true}></AppHeader>
            <DevToolsCommandBar
              capturePaused={this.state.capturePaused}
              clearSession={this.clearSession}
              clearLocalCache={this.clearLocalCache}
              openDashboard={this.openDashboard}
              saveScript={this.saveScript}
              saveLogs={this.saveLogs}
              copyScript={this.copyScript}
              toggleCapturePaused={this.toggleCapturePaused}
            ></DevToolsCommandBar>
          </div>
        </Layer>
        <header className="App-header">
          <div
            style={{
              boxShadow: theme.effects.elevation16,
              padding: "10px",
              marginTop: "80px",
              marginBottom: "15px",
            }}
          >
            <h2>Graph Call Stack Trace</h2>
            <p>
              Displays the Graph API calls that are being made by the current
              browser tab. Code conversions are only available for published
              Graph APIs. Turn on <strong>Ultra X-Ray</strong> mode to see all
              API calls (open a{" "}
              <a
                href="https://github.com/knbsilva/graphxray-firefox/issues"
                target="_blank"
                rel="noreferrer"
              >
                GitHub issue
              </a>{" "}
              if there are admin portals or blades that are not being captured).
            </p>
            {showFirefoxNote && (
              <div
                style={{
                  borderLeft: "4px solid #d97706",
                  backgroundColor: "#fff7ed",
                  color: "#7c2d12",
                  padding: "10px 12px",
                  marginBottom: "14px",
                  borderRadius: "6px",
                }}
              >
                Firefox note: open the <strong>Network</strong> tab once before
                using <strong>Graph X-Ray</strong>. Firefox only starts raising
                `devtools.network.onRequestFinished` after the Network tool has
                been activated.
              </div>
            )}
            {this.state.capturePaused && (
              <div
                style={{
                  borderLeft: "4px solid #2563eb",
                  backgroundColor: "#eff6ff",
                  color: "#1e3a8a",
                  padding: "10px 12px",
                  marginBottom: "14px",
                  borderRadius: "6px",
                }}
              >
                Capture is paused. Graph X-Ray will keep the current session
                visible, but it will not append new entries until you resume
                capture.
              </div>
            )}
            {!this.state.allowExternalSnippets && (
              <div
                style={{
                  borderLeft: "4px solid #2563eb",
                  backgroundColor: "#eff6ff",
                  color: "#1e3a8a",
                  padding: "10px 12px",
                  marginBottom: "14px",
                  borderRadius: "6px",
                }}
              >
                Local only mode is enabled. PowerShell stays local, and other
                languages will not call the external DevX snippet service until
                you enable external snippet generation in the Graph X-Ray
                options page.
              </div>
            )}
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                gap: "20px",
                flexWrap: "wrap",
              }}
            >
              <Dropdown
                placeholder="Select an option"
                label="Select language"
                options={SNIPPET_LANGUAGE_OPTIONS}
                styles={dropdownStyles}
                selectedKey={this.state.snippetLanguage}
                onChange={this.onLanguageChange}
              />

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  marginBottom: "8px",
                }}
                >
                <Toggle
                  label="External snippets"
                  checked={this.state.allowExternalSnippets}
                  onChange={this.onAllowExternalSnippetsToggle}
                  onText="On"
                  offText="Local only"
                  styles={{
                    root: { marginBottom: 0 },
                    label: { fontWeight: "600" },
                  }}
                />
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  marginBottom: "8px",
                }}
              >
                <Toggle
                  label="Ultra X-Ray"
                  checked={this.state.ultraXRayMode}
                  onChange={this.onUltraXRayToggle}
                  onText="On"
                  offText="Off"
                  styles={{
                    root: { marginBottom: 0 },
                    label: { fontWeight: "600" },
                  }}
                />
                <TooltipHost
                  content="Enables ultra mode which allows you to see API calls that are not publicly documented by Microsoft. These are meant for educational purposes. These endpoints should not be used in custom scripts as they are not supported by Microsoft and are only meant for internal use."
                  styles={{
                    root: {
                      display: "inline-block",
                    },
                  }}
                >
                  <IconButton
                    iconProps={{ iconName: "Info" }}
                    title="Ultra X-Ray Information"
                    styles={{
                      root: {
                        minWidth: "24px",
                        width: "24px",
                        height: "24px",
                        color: "#666",
                        backgroundColor: "transparent",
                        border: "1px solid #ccc",
                        borderRadius: "50%",
                      },
                      rootHovered: {
                        backgroundColor: "rgba(0, 0, 0, 0.05)",
                        color: "#333",
                      },
                    }}
                  />
                </TooltipHost>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  marginBottom: "8px",
                }}
              >
                <Toggle
                  label="Diagnostic Mode"
                  checked={this.state.diagnosticMode}
                  onChange={this.onDiagnosticModeToggle}
                  onText="On"
                  offText="Off"
                  styles={{
                    root: { marginBottom: 0 },
                    label: { fontWeight: "600" },
                  }}
                />
                <TooltipHost
                  content="Captures structured troubleshooting logs for Graph X-Ray, including request flow, snippet generation, and export events. Saved logs can include request payloads and generated code snippets."
                  styles={{
                    root: {
                      display: "inline-block",
                    },
                  }}
                >
                  <IconButton
                    iconProps={{ iconName: "DiagnosticDataBarTooltip" }}
                    title="Diagnostic Mode Information"
                    styles={{
                      root: {
                        minWidth: "24px",
                        width: "24px",
                        height: "24px",
                        color: "#666",
                        backgroundColor: "transparent",
                        border: "1px solid #ccc",
                        borderRadius: "50%",
                      },
                      rootHovered: {
                        backgroundColor: "rgba(0, 0, 0, 0.05)",
                        color: "#333",
                      },
                    }}
                  />
                </TooltipHost>
              </div>
            </div>
          </div>
          {this.state.stack && this.state.stack.length > 0 && (
            <div
              style={{
                boxShadow: theme.effects.elevation16,
                padding: "10px",
                marginBottom: "15px",
              }}
            >
              {visibleStack.map((request, index) => (
                <div
                  key={request.requestKey || index}
                  style={{
                    boxShadow: theme.effects.elevation16,
                    padding: "10px",
                    marginBottom: "15px",
                    borderRadius: "8px",
                  }}
                >
                  <CodeView
                    request={request}
                    lightUrl={true}
                    snippetLanguage={this.state.snippetLanguage}
                  ></CodeView>
                </div>
              ))}
            </div>
          )}
        </header>
      </div>
    );
  }
}

export default DevTools;
