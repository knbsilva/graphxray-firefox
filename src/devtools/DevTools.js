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
import { IconButton, PrimaryButton } from "@fluentui/react/lib/Button";
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
  CLEAR_CAPTURED_DATA_ON_STARTUP_STORAGE_KEY,
  EXTERNAL_SNIPPETS_ACKNOWLEDGED_STORAGE_KEY,
  EXPORT_SANITIZATION_MODE_STORAGE_KEY,
  PERSIST_SESSION_DATA_STORAGE_KEY,
  SESSION_RETENTION_MS_STORAGE_KEY,
  SENSITIVE_CAPTURE_CONSENT_STORAGE_KEY,
  ULTRA_XRAY_ACKNOWLEDGED_STORAGE_KEY,
  ULTRA_XRAY_MODE_STORAGE_KEY,
  getClearCapturedDataOnStartup,
  getExportSanitizationMode,
  getAllowExternalSnippets,
  getExternalSnippetsAcknowledged,
  getGraphXRaySession,
  getPersistSessionData,
  getSessionRetentionMs,
  getSensitiveCaptureConsentAccepted,
  getUltraXRayAcknowledged,
  getUltraXRayMode,
  clearGraphXRayLocalData,
  saveAllowExternalSnippets,
  saveExternalSnippetsAcknowledged,
  saveDiagnosticModeEnabled,
  saveGraphXRaySession,
  saveSensitiveCaptureConsentAccepted,
  saveUltraXRayAcknowledged,
  saveUltraXRayMode,
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
  hasOptionalPermissionScope,
  removeOptionalPermissionScope,
  requestOptionalPermissionScope,
} from "../common/optionalPermissions.js";
import {
  getSnippetLanguageOption,
  SNIPPET_LANGUAGE_OPTIONS,
} from "../common/snippetLanguages.js";
import {
  buildExportArtifact,
  DEFAULT_EXPORT_SANITIZATION_MODE,
  normalizeExportSanitizationMode,
  redactSensitiveText,
  warnLog,
} from "../common/security.js";
import { buildGraphXRayExportFileName } from "../common/exportFileNames.js";

const theme = getTheme();

const dropdownStyles = {
  dropdown: { width: 300 },
};

class DevTools extends React.Component {
  constructor() {
    super();
    const savedDiagnosticMode = localStorage.getItem(
      DIAGNOSTIC_MODE_STORAGE_KEY
    );
    const diagnosticMode = savedDiagnosticMode
      ? JSON.parse(savedDiagnosticMode)
      : false;

    this.state = {
      allowExternalSnippets: false,
      captureConsentAccepted: false,
      capturePaused: false,
      clearCapturedDataOnStartup: false,
      externalSnippetsAcknowledged: false,
      stack: [],
      diagnosticLogs: [],
      diagnosticMode,
      exportSanitizationMode: DEFAULT_EXPORT_SANITIZATION_MODE,
      persistSessionData: true,
      sessionRetentionMs: 60 * 60 * 1000,
      snippetLanguage: "powershell",
      ultraXRayAcknowledged: false,
      ultraXRayMode: false,
    };
    this.sessionSyncTimeout = null;
    this.removeStorageChangeListener = null;
  }

  async componentDidMount() {
    await Promise.all([
      this.hydrateSessionFromStorage(),
      this.hydrateCaptureConsent(),
      this.hydrateStartupClearSetting(),
      this.hydrateExternalSnippetSetting(),
      this.hydrateExternalSnippetAcknowledgement(),
      this.hydrateExportSanitizationMode(),
      this.hydratePersistenceMode(),
      this.hydrateSessionRetention(),
      this.hydrateUltraXRayAcknowledgement(),
      this.hydrateUltraXRayMode(),
    ]);
    this.syncDiagnosticModeState();
    this.addSessionStorageListener();
    this.addDiagnosticLogListener();
    this.addListener();
    this.addListenerGraph();
    await this.reconcileOptionalPermissionStates();
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

  hydrateExternalSnippetAcknowledgement = async () => {
    this.setState({
      externalSnippetsAcknowledged: await getExternalSnippetsAcknowledged(),
    });
  };

  hydrateExportSanitizationMode = async () => {
    this.setState({
      exportSanitizationMode: normalizeExportSanitizationMode(
        await getExportSanitizationMode()
      ),
    });
  };

  hydrateCaptureConsent = async () => {
    this.setState({
      captureConsentAccepted: await getSensitiveCaptureConsentAccepted(),
    });
  };

  hydrateStartupClearSetting = async () => {
    this.setState({
      clearCapturedDataOnStartup: await getClearCapturedDataOnStartup(),
    });
  };

  hydrateSessionRetention = async () => {
    this.setState({
      sessionRetentionMs: await getSessionRetentionMs(),
    });
  };

  hydratePersistenceMode = async () => {
    this.setState({
      persistSessionData: await getPersistSessionData(),
    });
  };

  hydrateUltraXRayAcknowledgement = async () => {
    this.setState({
      ultraXRayAcknowledged: await getUltraXRayAcknowledged(),
    });
  };

  hydrateUltraXRayMode = async () => {
    this.setState({
      ultraXRayMode: await getUltraXRayMode(),
    });
  };

  reconcileOptionalPermissionStates = async () => {
    const [externalSnippetsAllowed, session, ultraPermissionGranted, externalPermissionGranted] =
      await Promise.all([
        getAllowExternalSnippets(),
        getGraphXRaySession(),
        hasOptionalPermissionScope("ultraXRay"),
        hasOptionalPermissionScope("externalSnippets"),
      ]);

    if (externalSnippetsAllowed && !externalPermissionGranted) {
      await saveAllowExternalSnippets(false);
      this.setState({
        allowExternalSnippets: false,
      });
      this.recordDiagnostic(
        "external_snippets_disabled_missing_permission",
        {
          reason: "optional_permission_missing",
        },
        "warning"
      );
    }

    if (session.modes.ultraXRayMode && !ultraPermissionGranted) {
      await saveUltraXRayMode(false);
      this.setState(
        {
          ultraXRayMode: false,
        },
        this.scheduleSessionSync
      );
      this.recordDiagnostic(
        "ultra_xray_disabled_missing_permission",
        {
          reason: "optional_permission_missing",
        },
        "warning"
      );
    }
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
      captureConsentAccepted: session.modes.captureConsentAccepted,
      capturePaused: session.modes.capturePaused,
      clearCapturedDataOnStartup: session.modes.clearCapturedDataOnStartup,
      externalSnippetsAcknowledged: session.modes.externalSnippetsAcknowledged,
      stack: session.stack,
      diagnosticLogs: session.diagnosticLogs,
      diagnosticMode: session.modes.diagnosticMode,
      exportSanitizationMode: session.modes.exportSanitizationMode,
      persistSessionData: session.modes.persistSessionData,
      sessionRetentionMs: session.modes.sessionRetentionMs,
      snippetLanguage: session.modes.snippetLanguage,
      ultraXRayAcknowledged: session.modes.ultraXRayAcknowledged,
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
          Object.prototype.hasOwnProperty.call(
            changes,
            CLEAR_CAPTURED_DATA_ON_STARTUP_STORAGE_KEY
          )
        ) {
          this.setState({
            clearCapturedDataOnStartup: Boolean(
              changes[CLEAR_CAPTURED_DATA_ON_STARTUP_STORAGE_KEY]?.newValue
            ),
          });
        }

        if (
          Object.prototype.hasOwnProperty.call(
            changes,
            EXTERNAL_SNIPPETS_ACKNOWLEDGED_STORAGE_KEY
          )
        ) {
          this.setState({
            externalSnippetsAcknowledged: Boolean(
              changes[EXTERNAL_SNIPPETS_ACKNOWLEDGED_STORAGE_KEY]?.newValue
            ),
          });
        }

        if (
          Object.prototype.hasOwnProperty.call(
            changes,
            EXPORT_SANITIZATION_MODE_STORAGE_KEY
          )
        ) {
          this.setState({
            exportSanitizationMode: normalizeExportSanitizationMode(
              changes[EXPORT_SANITIZATION_MODE_STORAGE_KEY]?.newValue
            ),
          });
        }

        if (
          Object.prototype.hasOwnProperty.call(
            changes,
            PERSIST_SESSION_DATA_STORAGE_KEY
          )
        ) {
          this.setState({
            persistSessionData: Boolean(
              changes[PERSIST_SESSION_DATA_STORAGE_KEY]?.newValue
            ),
          });
        }

        if (
          Object.prototype.hasOwnProperty.call(
            changes,
            SESSION_RETENTION_MS_STORAGE_KEY
          )
        ) {
          this.setState({
            sessionRetentionMs:
              Number(changes[SESSION_RETENTION_MS_STORAGE_KEY]?.newValue) ||
              this.state.sessionRetentionMs,
          });
        }

        if (
          Object.prototype.hasOwnProperty.call(
            changes,
            SENSITIVE_CAPTURE_CONSENT_STORAGE_KEY
          )
        ) {
          this.setState({
            captureConsentAccepted: Boolean(
              changes[SENSITIVE_CAPTURE_CONSENT_STORAGE_KEY]?.newValue
            ),
          });
        }

        if (
          Object.prototype.hasOwnProperty.call(
            changes,
            ULTRA_XRAY_ACKNOWLEDGED_STORAGE_KEY
          )
        ) {
          this.setState({
            ultraXRayAcknowledged: Boolean(
              changes[ULTRA_XRAY_ACKNOWLEDGED_STORAGE_KEY]?.newValue
            ),
          });
        }

        if (
          Object.prototype.hasOwnProperty.call(changes, ULTRA_XRAY_MODE_STORAGE_KEY)
        ) {
          this.setState({
            ultraXRayMode: Boolean(changes[ULTRA_XRAY_MODE_STORAGE_KEY]?.newValue),
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
          captureConsentAccepted: nextSession.modes.captureConsentAccepted,
          capturePaused: nextSession.modes.capturePaused,
          clearCapturedDataOnStartup:
            nextSession.modes.clearCapturedDataOnStartup,
          externalSnippetsAcknowledged:
            nextSession.modes.externalSnippetsAcknowledged,
          stack: nextSession.stack,
          diagnosticLogs: nextSession.diagnosticLogs,
          diagnosticMode: nextSession.modes.diagnosticMode,
          exportSanitizationMode: nextSession.modes.exportSanitizationMode,
          persistSessionData: nextSession.modes.persistSessionData,
          sessionRetentionMs: nextSession.modes.sessionRetentionMs,
          snippetLanguage: nextSession.modes.snippetLanguage,
          ultraXRayAcknowledged: nextSession.modes.ultraXRayAcknowledged,
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
        captureConsentAccepted: this.state.captureConsentAccepted,
        capturePaused: this.state.capturePaused,
        clearCapturedDataOnStartup: this.state.clearCapturedDataOnStartup,
        diagnosticMode: this.state.diagnosticMode,
        externalSnippetsAcknowledged: this.state.externalSnippetsAcknowledged,
        exportSanitizationMode: this.state.exportSanitizationMode,
        persistSessionData: this.state.persistSessionData,
        sessionRetentionMs: this.state.sessionRetentionMs,
        snippetLanguage: this.state.snippetLanguage,
        ultraXRayAcknowledged: this.state.ultraXRayAcknowledged,
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
    const exportMode = this.state.exportSanitizationMode;
    const scriptArtifact = this.buildScriptExportArtifact(script, exportMode);
    const fileName = buildGraphXRayExportFileName({
      scope: "session",
      artifact: exportMode === "summary" ? "summary" : "script",
      language: this.state.snippetLanguage,
      mode: exportMode,
      extension: scriptArtifact.extension || languageOpt.fileExt,
    });
    await downloadContentAsFile(
      scriptArtifact.content,
      fileName,
      scriptArtifact.mimeType
    );
    this.recordDiagnostic("save_script_requested", {
      fileName,
      language: this.state.snippetLanguage,
      scriptLength: script.length,
      exportMode,
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
    const scriptArtifact = this.buildScriptExportArtifact(
      script,
      this.state.exportSanitizationMode
    );
    navigator.clipboard.writeText(scriptArtifact.content);
    this.recordDiagnostic("copy_script_requested", {
      language: this.state.snippetLanguage,
      scriptLength: script.length,
      exportMode: this.state.exportSanitizationMode,
    });
  };

  buildScriptExportArtifact = (script, exportMode) => {
    const languageOpt = getSnippetLanguageOption(this.state.snippetLanguage);

    if (exportMode === "summary") {
      return buildExportArtifact({
        rawContent: script,
        mode: exportMode,
        summary: {
          kind: "script-summary",
          language: this.state.snippetLanguage,
          snippetCount: this.state.stack.filter(
            (entry) => entry.code && entry.code.trim()
          ).length,
          batchSnippetCount: this.state.stack.reduce(
            (total, entry) => total + (entry.batchCodeSnippets?.length || 0),
            0
          ),
        },
      });
    }

    return {
      content: exportMode === "redacted" ? redactSensitiveText(script) : script,
      extension: languageOpt.fileExt,
      mimeType: "text/plain",
    };
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

    const logArtifact = buildDiagnosticExportPayload(
      this.buildCurrentSessionSnapshot(),
      this.state.exportSanitizationMode
    );
    const fileName = buildGraphXRayExportFileName({
      scope: "diagnostic",
      artifact: "logs",
      mode: this.state.exportSanitizationMode,
      extension: logArtifact.extension || "json",
    });

    downloadContentAsFile(
      logArtifact.content,
      fileName,
      logArtifact.mimeType
    );
  };

  clearLocalCache = async () => {
    await Promise.allSettled([
      removeOptionalPermissionScope("externalSnippets"),
      removeOptionalPermissionScope("ultraXRay"),
    ]);
    await clearGraphXRayLocalData();
    localStorage.setItem(DIAGNOSTIC_MODE_STORAGE_KEY, JSON.stringify(false));
    this.setState(
      {
        allowExternalSnippets: false,
        captureConsentAccepted: false,
        clearCapturedDataOnStartup: false,
        diagnosticMode: false,
        exportSanitizationMode: DEFAULT_EXPORT_SANITIZATION_MODE,
        externalSnippetsAcknowledged: false,
        persistSessionData: true,
        sessionRetentionMs: 60 * 60 * 1000,
        stack: [],
        diagnosticLogs: [],
        ultraXRayAcknowledged: false,
        ultraXRayMode: false,
      },
      this.scheduleSessionSync
    );
    this.recordDiagnostic("local_cache_cleared", {
      snippetLanguage: this.state.snippetLanguage,
    });
  };

  acknowledgeCaptureConsent = async () => {
    await saveSensitiveCaptureConsentAccepted(true);
    this.setState(
      {
        captureConsentAccepted: true,
      },
      () => {
        this.scheduleSessionSync();
        this.recordDiagnostic("capture_consent_acknowledged", {
          snippetLanguage: this.state.snippetLanguage,
          ultraXRayMode: this.state.ultraXRayMode,
        });
      }
    );
  };

  parseHostGraphCallMessage = (eventData) => {
    try {
      const message =
        typeof eventData === "string" ? JSON.parse(eventData) : eventData;

      if (
        !message ||
        message.eventName !== "GraphCall" ||
        typeof message.url !== "string"
      ) {
        return null;
      }

      return message;
    } catch (error) {
      this.recordDiagnostic(
        "host_message_rejected",
        {
          reason: "invalid_json",
        },
        "warning"
      );
      return null;
    }
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
      const msg = this.parseHostGraphCallMessage(event.data);
      if (!msg) {
        return;
      }

      if (!this.state.captureConsentAccepted) {
        this.recordDiagnostic("capture_skipped_no_consent", {
          source: "host_graph_call",
          eventName: msg.eventName,
        });
        return;
      }
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
        if (!this.state.captureConsentAccepted) {
          this.recordDiagnostic("capture_skipped_no_consent", {
            source: "network",
            method: harEntry?.request?.method,
            url: harEntry?.request?.url,
          });
          return;
        }
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

  onUltraXRayToggle = async (e, checked) => {
    const nextValue = Boolean(checked);
    const acknowledgementRequired =
      nextValue && !this.state.ultraXRayAcknowledged;

    if (acknowledgementRequired) {
      const confirmed =
        typeof window === "undefined"
          ? false
          : window.confirm(
              "Ultra X-Ray exposes undocumented or internal Microsoft admin APIs. These endpoints are unsupported and can surface higher-risk data. Enable Ultra X-Ray?"
            );

      if (!confirmed) {
        this.recordDiagnostic("ultra_xray_enable_cancelled", {
          reason: "acknowledgement_required",
        });
        return;
      }
    }

    if (nextValue) {
      const permissionGranted = await requestOptionalPermissionScope("ultraXRay");
      if (acknowledgementRequired) {
        await saveUltraXRayAcknowledged(true);
      }
      if (!permissionGranted) {
        this.recordDiagnostic(
          "ultra_xray_enable_cancelled",
          {
            reason: "optional_permission_denied",
          },
          "warning"
        );
        return;
      }
    } else {
      await removeOptionalPermissionScope("ultraXRay");
    }

    await saveUltraXRayMode(nextValue);

    this.setState(
      {
        ultraXRayAcknowledged: nextValue
          ? true
          : this.state.ultraXRayAcknowledged,
        ultraXRayMode: nextValue,
      },
      this.scheduleSessionSync
    );
    this.clearStack();
    this.recordDiagnostic("ultra_xray_toggled", {
      enabled: nextValue,
      acknowledged: nextValue ? true : this.state.ultraXRayAcknowledged,
      permissionScope: "optional_host_permissions",
      stackCleared: true,
    });
  };

  onDiagnosticModeToggle = async (e, checked) => {
    localStorage.setItem(DIAGNOSTIC_MODE_STORAGE_KEY, JSON.stringify(checked));
    await saveDiagnosticModeEnabled(checked);

    this.setState(
      {
        diagnosticMode: checked,
        diagnosticLogs: [],
      },
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
    const acknowledgementRequired =
      nextValue && !this.state.externalSnippetsAcknowledged;
    if (
      acknowledgementRequired &&
      typeof window !== "undefined" &&
      !window.confirm(
        "Enabling external snippet generation allows Graph X-Ray to send supported request payloads to the Microsoft Graph DevX snippet service. Continue?"
      )
    ) {
      this.recordDiagnostic(
        "external_snippets_enable_cancelled",
        {
          snippetLanguage: this.state.snippetLanguage,
        },
        "warning"
      );
      return;
    }

    if (nextValue) {
      const permissionGranted = await requestOptionalPermissionScope(
        "externalSnippets"
      );
      if (acknowledgementRequired) {
        await saveExternalSnippetsAcknowledged(true);
      }
      if (!permissionGranted) {
        this.recordDiagnostic(
          "external_snippets_enable_cancelled",
          {
            snippetLanguage: this.state.snippetLanguage,
            reason: "optional_permission_denied",
          },
          "warning"
        );
        return;
      }
    } else {
      await removeOptionalPermissionScope("externalSnippets");
    }

    await saveAllowExternalSnippets(nextValue);
    this.setState(
      {
        allowExternalSnippets: nextValue,
        externalSnippetsAcknowledged: nextValue
          ? true
          : this.state.externalSnippetsAcknowledged,
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
    const retentionLabel =
      this.state.sessionRetentionMs % (60 * 60 * 1000) === 0
        ? `${this.state.sessionRetentionMs / (60 * 60 * 1000)}h`
        : `${Math.round(this.state.sessionRetentionMs / (60 * 1000))}m`;

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
            {!this.state.captureConsentAccepted && (
              <div
                style={{
                  borderLeft: "4px solid #d97706",
                  backgroundColor: "#fffbeb",
                  color: "#7c2d12",
                  padding: "12px 14px",
                  marginBottom: "14px",
                  borderRadius: "6px",
                }}
              >
                <div style={{ marginBottom: "10px" }}>
                  Capture is blocked until you acknowledge that Graph X-Ray can
                  store and export sensitive Microsoft 365 administrative API
                  data locally.
                </div>
                <PrimaryButton onClick={this.acknowledgeCaptureConsent}>
                  I understand and want to enable capture
                </PrimaryButton>
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
            {this.state.ultraXRayMode && (
              <div
                style={{
                  borderLeft: "4px solid #b45309",
                  backgroundColor: "#fffbeb",
                  color: "#92400e",
                  padding: "10px 12px",
                  marginBottom: "14px",
                  borderRadius: "6px",
                }}
              >
                Ultra X-Ray is enabled. Graph X-Ray can now capture internal or
                undocumented Microsoft admin APIs that are higher risk and
                unsupported for automation use.
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
                alignItems: "center",
                gap: "8px",
                flexWrap: "wrap",
                marginBottom: "14px",
              }}
            >
              <span
                style={{
                  backgroundColor: "#e2e8f0",
                  color: "#334155",
                  borderRadius: "999px",
                  padding: "4px 10px",
                  fontSize: "12px",
                  fontWeight: 600,
                }}
              >
                Persistence: {this.state.persistSessionData ? "Persisted" : "Memory only"}
              </span>
              <span
                style={{
                  backgroundColor: "#e2e8f0",
                  color: "#334155",
                  borderRadius: "999px",
                  padding: "4px 10px",
                  fontSize: "12px",
                  fontWeight: 600,
                }}
              >
                Retention: {retentionLabel}
              </span>
              <span
                style={{
                  backgroundColor: "#e2e8f0",
                  color: "#334155",
                  borderRadius: "999px",
                  padding: "4px 10px",
                  fontSize: "12px",
                  fontWeight: 600,
                }}
              >
                Startup clear: {this.state.clearCapturedDataOnStartup ? "On" : "Off"}
              </span>
              <span
                style={{
                  backgroundColor: "#e2e8f0",
                  color: "#334155",
                  borderRadius: "999px",
                  padding: "4px 10px",
                  fontSize: "12px",
                  fontWeight: 600,
                }}
              >
                External snippets ack: {this.state.externalSnippetsAcknowledged ? "Accepted" : "Required"}
              </span>
            </div>
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
                    exportSanitizationMode={this.state.exportSanitizationMode}
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
