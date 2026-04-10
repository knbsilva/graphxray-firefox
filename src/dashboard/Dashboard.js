import React from "react";
import "./Dashboard.css";
import { SearchBox } from "@fluentui/react/lib/SearchBox";
import { DefaultButton, PrimaryButton } from "@fluentui/react/lib/Button";
import { Dropdown } from "@fluentui/react/lib/Dropdown";
import { Toggle } from "@fluentui/react/lib/Toggle";
import { FontSizes } from "@fluentui/theme";
import { getTheme } from "@fluentui/react";
import { AppHeader } from "../components/AppHeader";
import DevToolsCommandBar from "../components/DevToolsCommandBar";
import { CodeView } from "../components/CodeView";
import { isUltraXRayDomain } from "../common/domains.js";
import {
  addStorageChangeListener,
  isFirefoxBrowser,
  openExtensionOptionsPage,
} from "../common/extensionApi.js";
import {
  hasOptionalPermissionScope,
  removeOptionalPermissionScope,
  requestOptionalPermissionScope,
} from "../common/optionalPermissions.js";
import {
  buildDiagnosticEntry,
  DIAGNOSTIC_MODE_STORAGE_KEY,
  MAX_DIAGNOSTIC_LOG_ENTRIES,
} from "../common/diagnostics.js";
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
  clearGraphXRayLocalData,
  getClearCapturedDataOnStartup,
  getExportSanitizationMode,
  getGraphXRaySession,
  getExternalSnippetsAcknowledged,
  getPersistSessionData,
  getSessionRetentionMs,
  getSensitiveCaptureConsentAccepted,
  getUltraXRayAcknowledged,
  getUltraXRayMode,
  saveGraphXRaySession,
  getAllowExternalSnippets,
  saveSensitiveCaptureConsentAccepted,
  saveAllowExternalSnippets,
  saveExternalSnippetsAcknowledged,
  saveUltraXRayAcknowledged,
  saveUltraXRayMode,
} from "../common/storage.js";
import {
  buildDiagnosticExportPayload,
  buildSessionSnapshot,
  createEmptySessionState,
  DEFAULT_SESSION_RETENTION_MS,
  downloadContentAsFile,
  getSaveScriptContentFromStack,
  GRAPHXRAY_SESSION_STORAGE_KEY,
  normalizeSessionState,
} from "../common/session.js";
import { getSnippetLanguageOption } from "../common/snippetLanguages.js";
import {
  buildExportArtifact,
  DEFAULT_EXPORT_SANITIZATION_MODE,
  redactSensitiveText,
  warnLog,
} from "../common/security.js";

const theme = getTheme();
const HTTP_METHOD_OPTIONS = ["GET", "POST", "PATCH", "PUT", "DELETE"].map(
  (method) => ({
    key: method,
    text: method,
  })
);
const filterDropdownStyles = {
  dropdown: { width: 240 },
};

const getEntryMethod = (entry) =>
  (entry?.displayRequestUrl || "").split(" ")[0] || "GRAPH";
const getEntryUrl = (entry) =>
  (entry?.displayRequestUrl || "").split(" ").slice(1).join(" ");

const formatTimestamp = (timestamp) => {
  if (!timestamp) {
    return "No captured session yet";
  }

  try {
    return new Date(timestamp).toLocaleString();
  } catch (error) {
    return timestamp;
  }
};

const formatRetentionLabel = (retentionMs = DEFAULT_SESSION_RETENTION_MS) => {
  if (retentionMs % (60 * 60 * 1000) === 0) {
    const hours = retentionMs / (60 * 60 * 1000);
    return `${hours}h`;
  }

  return `${Math.round(retentionMs / (60 * 1000))}m`;
};

class Dashboard extends React.Component {
  constructor() {
    super();
    this.state = {
      isLoading: true,
      searchText: "",
      selectedMethods: [],
      selectedEntryKey: null,
      sessionRetentionMs: DEFAULT_SESSION_RETENTION_MS,
      session: createEmptySessionState(),
    };
    this.removeStorageChangeListener = null;
  }

  componentDidMount() {
    this.loadSession();
    this.addSessionStorageListener();
  }

  componentWillUnmount() {
    if (this.removeStorageChangeListener) {
      this.removeStorageChangeListener();
    }
  }

  loadSession = async () => {
    const session = normalizeSessionState(await getGraphXRaySession());
    const persistSessionData = await getPersistSessionData();
    const clearCapturedDataOnStartup = await getClearCapturedDataOnStartup();
    const sessionRetentionMs = await getSessionRetentionMs();
    session.modes.allowExternalSnippets = await getAllowExternalSnippets();
    session.modes.captureConsentAccepted =
      await getSensitiveCaptureConsentAccepted();
    session.modes.externalSnippetsAcknowledged =
      await getExternalSnippetsAcknowledged();
    session.modes.exportSanitizationMode = await getExportSanitizationMode();
    session.modes.clearCapturedDataOnStartup = clearCapturedDataOnStartup;
    session.modes.persistSessionData = persistSessionData;
    session.modes.sessionRetentionMs = sessionRetentionMs;
    session.modes.ultraXRayAcknowledged = await getUltraXRayAcknowledged();
    session.modes.ultraXRayMode = await getUltraXRayMode();

    const [externalPermissionGranted, ultraPermissionGranted] =
      await Promise.all([
        hasOptionalPermissionScope("externalSnippets"),
        hasOptionalPermissionScope("ultraXRay"),
      ]);

    if (session.modes.allowExternalSnippets && !externalPermissionGranted) {
      session.modes.allowExternalSnippets = false;
      await saveAllowExternalSnippets(false);
    }

    if (session.modes.ultraXRayMode && !ultraPermissionGranted) {
      session.modes.ultraXRayMode = false;
      await saveUltraXRayMode(false);
      await saveGraphXRaySession(
        buildSessionSnapshot({
          stack: session.stack,
          diagnosticLogs: session.diagnosticLogs,
          modes: session.modes,
          sourceContext: "dashboard",
        })
      );
    }

    this.setState((previousState) => {
      const previousVisibleEntries = this.getVisibleEntries(previousState.session);
      const nextVisibleEntries = this.getVisibleEntries(
        session,
        previousState.searchText,
        previousState.selectedMethods
      );

      return {
        isLoading: false,
        sessionRetentionMs,
        session,
        selectedEntryKey: this.resolveNextSelectedEntryKey({
          previousVisibleEntries,
          nextVisibleEntries,
          previousSelectedEntryKey: previousState.selectedEntryKey,
        }),
      };
    });
  };

  addSessionStorageListener = () => {
    this.removeStorageChangeListener = addStorageChangeListener(
      (changes, areaName) => {
        if (areaName !== "local") {
          return;
        }

        this.setState((previousState) => {
          const session = Object.prototype.hasOwnProperty.call(
            changes,
            GRAPHXRAY_SESSION_STORAGE_KEY
          )
            ? normalizeSessionState(changes[GRAPHXRAY_SESSION_STORAGE_KEY]?.newValue)
            : normalizeSessionState(previousState.session);

          if (
            Object.prototype.hasOwnProperty.call(
              changes,
              ALLOW_EXTERNAL_SNIPPETS_STORAGE_KEY
            )
          ) {
            session.modes.allowExternalSnippets = Boolean(
              changes[ALLOW_EXTERNAL_SNIPPETS_STORAGE_KEY]?.newValue
            );
          }

          if (
            Object.prototype.hasOwnProperty.call(
              changes,
              EXTERNAL_SNIPPETS_ACKNOWLEDGED_STORAGE_KEY
            )
          ) {
            session.modes.externalSnippetsAcknowledged = Boolean(
              changes[EXTERNAL_SNIPPETS_ACKNOWLEDGED_STORAGE_KEY]?.newValue
            );
          }

          if (
            Object.prototype.hasOwnProperty.call(
              changes,
              CLEAR_CAPTURED_DATA_ON_STARTUP_STORAGE_KEY
            )
          ) {
            session.modes.clearCapturedDataOnStartup = Boolean(
              changes[CLEAR_CAPTURED_DATA_ON_STARTUP_STORAGE_KEY]?.newValue
            );
          }

          if (
            Object.prototype.hasOwnProperty.call(
              changes,
              EXPORT_SANITIZATION_MODE_STORAGE_KEY
            )
          ) {
            session.modes.exportSanitizationMode =
              changes[EXPORT_SANITIZATION_MODE_STORAGE_KEY]?.newValue ||
              session.modes.exportSanitizationMode;
          }

          if (
            Object.prototype.hasOwnProperty.call(
              changes,
              PERSIST_SESSION_DATA_STORAGE_KEY
            )
          ) {
            session.modes.persistSessionData = Boolean(
              changes[PERSIST_SESSION_DATA_STORAGE_KEY]?.newValue
            );
          }

          if (
            Object.prototype.hasOwnProperty.call(
              changes,
              SESSION_RETENTION_MS_STORAGE_KEY
            )
          ) {
            session.modes.sessionRetentionMs =
              Number(changes[SESSION_RETENTION_MS_STORAGE_KEY]?.newValue) ||
              previousState.sessionRetentionMs;
          }

          if (
            Object.prototype.hasOwnProperty.call(
              changes,
              SENSITIVE_CAPTURE_CONSENT_STORAGE_KEY
            )
          ) {
            session.modes.captureConsentAccepted = Boolean(
              changes[SENSITIVE_CAPTURE_CONSENT_STORAGE_KEY]?.newValue
            );
          }

          if (
            Object.prototype.hasOwnProperty.call(
              changes,
              ULTRA_XRAY_ACKNOWLEDGED_STORAGE_KEY
            )
          ) {
            session.modes.ultraXRayAcknowledged = Boolean(
              changes[ULTRA_XRAY_ACKNOWLEDGED_STORAGE_KEY]?.newValue
            );
          }

          if (
            Object.prototype.hasOwnProperty.call(changes, ULTRA_XRAY_MODE_STORAGE_KEY)
          ) {
            session.modes.ultraXRayMode = Boolean(
              changes[ULTRA_XRAY_MODE_STORAGE_KEY]?.newValue
            );
          }

          if (
            !Object.prototype.hasOwnProperty.call(
              changes,
              GRAPHXRAY_SESSION_STORAGE_KEY
            ) &&
            !Object.prototype.hasOwnProperty.call(
              changes,
              ALLOW_EXTERNAL_SNIPPETS_STORAGE_KEY
            ) &&
            !Object.prototype.hasOwnProperty.call(
              changes,
              EXTERNAL_SNIPPETS_ACKNOWLEDGED_STORAGE_KEY
            ) &&
            !Object.prototype.hasOwnProperty.call(
              changes,
              EXPORT_SANITIZATION_MODE_STORAGE_KEY
            ) &&
            !Object.prototype.hasOwnProperty.call(
              changes,
              PERSIST_SESSION_DATA_STORAGE_KEY
            ) &&
            !Object.prototype.hasOwnProperty.call(
              changes,
              SESSION_RETENTION_MS_STORAGE_KEY
            ) &&
            !Object.prototype.hasOwnProperty.call(
              changes,
              SENSITIVE_CAPTURE_CONSENT_STORAGE_KEY
            ) &&
            !Object.prototype.hasOwnProperty.call(
              changes,
              ULTRA_XRAY_ACKNOWLEDGED_STORAGE_KEY
            ) &&
            !Object.prototype.hasOwnProperty.call(
              changes,
              ULTRA_XRAY_MODE_STORAGE_KEY
            )
          ) {
            return null;
          }

          const previousVisibleEntries = this.getVisibleEntries(previousState.session);
          const nextVisibleEntries = this.getVisibleEntries(
            session,
            previousState.searchText,
            previousState.selectedMethods
          );

          return {
            isLoading: false,
            sessionRetentionMs: session.modes.sessionRetentionMs,
            session,
            selectedEntryKey: this.resolveNextSelectedEntryKey({
              previousVisibleEntries,
              nextVisibleEntries,
              previousSelectedEntryKey: previousState.selectedEntryKey,
            }),
          };
        });
      }
    );
  };

  getEntryKey = (entry, originalIndex) =>
    entry?.requestKey || `${entry?.displayRequestUrl || "entry"}|${originalIndex}`;

  getVisibleEntries = (
    session = this.state.session,
    searchText = this.state.searchText,
    selectedMethods = this.state.selectedMethods
  ) => {
    const query = searchText.trim().toLowerCase();
    const entries = session.stack || [];

    return entries
      .map((entry, originalIndex) => ({
        entry,
        entryKey: this.getEntryKey(entry, originalIndex),
        originalIndex,
      }))
      .filter(({ entry }) => {
        const methodMatches =
          selectedMethods.length === 0 ||
          selectedMethods.includes(getEntryMethod(entry));

        if (!methodMatches) {
          return false;
        }

        if (!query) {
          return true;
        }

        const haystack = [
          entry.displayRequestUrl,
          entry.requestBody,
          entry.responseContent,
          entry.code,
          entry.codeSource,
        ]
          .filter(Boolean)
          .join("\n")
          .toLowerCase();

        return haystack.includes(query);
      })
      .reverse();
  };

  resolveNextSelectedEntryKey = ({
    previousVisibleEntries = [],
    nextVisibleEntries = [],
    previousSelectedEntryKey = null,
  }) => {
    if (nextVisibleEntries.length === 0) {
      return null;
    }

    const newestNextEntryKey = nextVisibleEntries[0].entryKey;
    if (!previousSelectedEntryKey) {
      return newestNextEntryKey;
    }

    const previousNewestEntryKey = previousVisibleEntries[0]?.entryKey || null;
    if (
      previousSelectedEntryKey === previousNewestEntryKey &&
      newestNextEntryKey !== previousSelectedEntryKey
    ) {
      return newestNextEntryKey;
    }

    const selectedStillExists = nextVisibleEntries.some(
      ({ entryKey }) => entryKey === previousSelectedEntryKey
    );

    return selectedStillExists ? previousSelectedEntryKey : newestNextEntryKey;
  };

  handleSearchChange = (_, newValue) => {
    this.setState((previousState) => {
      const nextSearchText = newValue || "";
      const previousVisibleEntries = this.getVisibleEntries(
        previousState.session,
        previousState.searchText,
        previousState.selectedMethods
      );
      const nextVisibleEntries = this.getVisibleEntries(
        previousState.session,
        nextSearchText,
        previousState.selectedMethods
      );

      return {
        searchText: nextSearchText,
        selectedEntryKey: this.resolveNextSelectedEntryKey({
          previousVisibleEntries,
          nextVisibleEntries,
          previousSelectedEntryKey: previousState.selectedEntryKey,
        }),
      };
    });
  };

  handleMethodFilterChange = (_, option) => {
    if (!option) {
      return;
    }

    this.setState((previousState) => {
      const nextMethods = option.selected
        ? [...previousState.selectedMethods, option.key]
        : previousState.selectedMethods.filter(
            (method) => method !== option.key
          );

      return {
        selectedMethods: nextMethods,
        selectedEntryKey: this.resolveNextSelectedEntryKey({
          previousVisibleEntries: this.getVisibleEntries(
            previousState.session,
            previousState.searchText,
            previousState.selectedMethods
          ),
          nextVisibleEntries: this.getVisibleEntries(
            previousState.session,
            previousState.searchText,
            nextMethods
          ),
          previousSelectedEntryKey: previousState.selectedEntryKey,
        }),
      };
    });
  };

  selectEntry = (selectedEntryKey) => {
    this.setState({ selectedEntryKey });
  };

  toggleCapturePaused = async () => {
    const nextCapturePaused = !this.state.session.modes.capturePaused;
    const nextDiagnosticLogs = this.state.session.modes.diagnosticMode
      ? [
          ...this.state.session.diagnosticLogs,
          buildDiagnosticEntry({
            source: "dashboard",
            event: nextCapturePaused ? "capture_paused" : "capture_resumed",
            level: "info",
            details: {
              snippetLanguage: this.state.session.modes.snippetLanguage,
              ultraXRayMode: this.state.session.modes.ultraXRayMode,
            },
          }),
        ].slice(-MAX_DIAGNOSTIC_LOG_ENTRIES)
      : this.state.session.diagnosticLogs;

    const nextSession = buildSessionSnapshot({
      stack: this.state.session.stack,
      diagnosticLogs: nextDiagnosticLogs,
      modes: {
        ...this.state.session.modes,
        capturePaused: nextCapturePaused,
      },
      sourceContext: "dashboard",
    });
    await saveGraphXRaySession(nextSession);
  };

  clearSession = async () => {
    const nextSession = buildSessionSnapshot({
      stack: [],
      diagnosticLogs: [],
      modes: this.state.session.modes,
      sourceContext: "dashboard",
    });
    await saveGraphXRaySession(nextSession);
  };

  clearLocalCache = async () => {
    await Promise.allSettled([
      removeOptionalPermissionScope("externalSnippets"),
      removeOptionalPermissionScope("ultraXRay"),
    ]);
    await clearGraphXRayLocalData();
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(DIAGNOSTIC_MODE_STORAGE_KEY, JSON.stringify(false));
    }
    const nextSession = buildSessionSnapshot({
      stack: [],
      diagnosticLogs: [],
      modes: {
        ...createEmptySessionState().modes,
        captureConsentAccepted: false,
      },
      sourceContext: "dashboard",
    });
    await saveGraphXRaySession(nextSession);
    this.setState((previousState) => ({
      searchText: "",
      selectedMethods: [],
      selectedEntryKey: null,
      session: {
        ...createEmptySessionState(),
        modes: {
          ...createEmptySessionState().modes,
          exportSanitizationMode: DEFAULT_EXPORT_SANITIZATION_MODE,
        },
      },
      sessionRetentionMs: DEFAULT_SESSION_RETENTION_MS,
    }));
  };

  acknowledgeCaptureConsent = async () => {
    await saveSensitiveCaptureConsentAccepted(true);
    const nextDiagnosticLogs = this.state.session.modes.diagnosticMode
      ? [
          ...this.state.session.diagnosticLogs,
          buildDiagnosticEntry({
            source: "dashboard",
            event: "capture_consent_acknowledged",
            level: "info",
            details: {
              snippetLanguage: this.state.session.modes.snippetLanguage,
              ultraXRayMode: this.state.session.modes.ultraXRayMode,
            },
          }),
        ].slice(-MAX_DIAGNOSTIC_LOG_ENTRIES)
      : this.state.session.diagnosticLogs;

    const nextSession = buildSessionSnapshot({
      stack: this.state.session.stack,
      diagnosticLogs: nextDiagnosticLogs,
      modes: {
        ...this.state.session.modes,
        captureConsentAccepted: true,
      },
      sourceContext: "dashboard",
    });
    await saveGraphXRaySession(nextSession);
  };

  onAllowExternalSnippetsToggle = async (_, checked) => {
    const enabled = Boolean(checked);
    const acknowledgementRequired =
      enabled && !this.state.session.modes.externalSnippetsAcknowledged;

    if (
      acknowledgementRequired &&
      typeof window !== "undefined" &&
      !window.confirm(
        "Enabling external snippet generation allows Graph X-Ray to send supported request payloads to the Microsoft Graph DevX snippet service. Continue?"
      )
    ) {
      return;
    }

    if (enabled) {
      const permissionGranted = await requestOptionalPermissionScope(
        "externalSnippets"
      );
      if (acknowledgementRequired) {
        await saveExternalSnippetsAcknowledged(true);
      }
      if (!permissionGranted) {
        return;
      }
    } else {
      await removeOptionalPermissionScope("externalSnippets");
    }

    await saveAllowExternalSnippets(enabled);
  };

  onUltraXRayToggle = async (_, checked) => {
    const enabled = Boolean(checked);
    const acknowledgementRequired =
      enabled && !this.state.session.modes.ultraXRayAcknowledged;

    if (
      acknowledgementRequired &&
      typeof window !== "undefined" &&
      !window.confirm(
        "Ultra X-Ray exposes undocumented or internal Microsoft admin APIs. These endpoints are unsupported and can surface higher-risk data. Enable Ultra X-Ray?"
      )
    ) {
      return;
    }

    if (enabled) {
      const permissionGranted = await requestOptionalPermissionScope("ultraXRay");
      if (acknowledgementRequired) {
        await saveUltraXRayAcknowledged(true);
      }
      if (!permissionGranted) {
        return;
      }
    } else {
      await removeOptionalPermissionScope("ultraXRay");
    }

    await saveUltraXRayMode(enabled);
    await saveGraphXRaySession(
      buildSessionSnapshot({
        stack: [],
        diagnosticLogs: this.state.session.diagnosticLogs,
        modes: {
          ...this.state.session.modes,
          ultraXRayAcknowledged: enabled
            ? true
            : this.state.session.modes.ultraXRayAcknowledged,
          ultraXRayMode: enabled,
        },
        sourceContext: "dashboard",
      })
    );
  };

  saveScript = async () => {
    const script = getSaveScriptContentFromStack(this.state.session.stack);
    if (!script.trim()) {
      return;
    }

    const language = this.state.session.modes.snippetLanguage;
    const languageOption = getSnippetLanguageOption(language);
    const exportMode = this.state.session.modes.exportSanitizationMode;
    const scriptArtifact =
      exportMode === "summary"
        ? buildExportArtifact({
            rawContent: script,
            mode: exportMode,
            summary: {
              kind: "script-summary",
              language,
              snippetCount: this.state.session.stack.filter(
                (entry) => entry.code && entry.code.trim()
              ).length,
              batchSnippetCount: this.state.session.stack.reduce(
                (total, entry) =>
                  total + (entry.batchCodeSnippets?.length || 0),
                0
              ),
            },
          })
        : {
            content:
              exportMode === "redacted" ? redactSensitiveText(script) : script,
            extension: languageOption.fileExt,
            mimeType: "text/plain",
          };
    await downloadContentAsFile(
      scriptArtifact.content,
      `GraphXRaySession.${scriptArtifact.extension || languageOption.fileExt}`,
      scriptArtifact.mimeType
    );
  };

  saveLogs = async () => {
    if (this.state.session.diagnosticLogs.length === 0) {
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
      buildSessionSnapshot({
        stack: this.state.session.stack,
        diagnosticLogs: this.state.session.diagnosticLogs,
        modes: this.state.session.modes,
        sourceContext: "dashboard",
      }),
      this.state.session.modes.exportSanitizationMode
    );
    const fileName = `GraphXRayDiagnostics-${new Date()
      .toISOString()
      .replace(/[:.]/g, "-")}.${logArtifact.extension || "json"}`;

    await downloadContentAsFile(
      logArtifact.content,
      fileName,
      logArtifact.mimeType
    );
  };

  openGuide = () => {
    openExtensionOptionsPage().catch((error) => {
      warnLog("Could not open Graph X-Ray guide", error);
    });
  };

  renderList(entries) {
    if (entries.length === 0) {
      return (
        <div className="DashboardEmpty">
          <h2 className="DashboardEmptyTitle">No matching calls</h2>
          <p className="DashboardEmptyCopy">
            Try a different search term or clear the filter to see the current
            Graph X-Ray session.
          </p>
        </div>
      );
    }

    return (
      <div className="DashboardList">
        {entries.map(({ entry, entryKey }) => {
          const method = getEntryMethod(entry);
          const isActive = entryKey === this.state.selectedEntryKey;

          return (
            <button
              type="button"
              key={entryKey}
              className={`DashboardListItem${isActive ? " Active" : ""}`}
              onClick={() => this.selectEntry(entryKey)}
            >
              <div className="DashboardListMethod">{method}</div>
              <div className="DashboardListUrl">{entry.displayRequestUrl}</div>
              <div className="DashboardListMeta">
                {entry.codeSource && (
                  <span className="DashboardBadge">{entry.codeSource}</span>
                )}
                {isUltraXRayDomain(getEntryUrl(entry)) && (
                  <span
                    className="DashboardBadge"
                    style={{
                      backgroundColor: "#fef3c7",
                      color: "#92400e",
                    }}
                  >
                    Internal API
                  </span>
                )}
                {entry.batchCodeSnippets?.length > 0 && (
                  <span className="DashboardBadge">
                    Batch {entry.batchCodeSnippets.length}
                  </span>
                )}
                {entry.requestBody && (
                  <span className="DashboardBadge">Request body</span>
                )}
                {entry.responseContent && (
                  <span className="DashboardBadge">Response</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  renderEmptySession() {
    return (
      <div className="DashboardCard DashboardEmpty">
        <div className="DashboardCardInner">
          <h2 className="DashboardEmptyTitle">Standalone dashboard is ready</h2>
          <p className="DashboardEmptyCopy">
            This page mirrors the active Graph X-Ray session, but it does not
            replace the DevTools capture source. Open Developer Tools, visit the
            Graph X-Ray panel, and interact with the Microsoft 365 admin portal
            to populate this dashboard.
          </p>
          <PrimaryButton
            text="Open guide"
            iconProps={{ iconName: "OpenInNewTab" }}
            onClick={this.openGuide}
          />
          {isFirefoxBrowser() && (
            <div className="DashboardHint">
              Firefox note: open the <strong>Network</strong> tab once before
              switching to <strong>Graph X-Ray</strong>. Firefox only starts
              raising `devtools.network.onRequestFinished` after the Network
              tool has been activated.
            </div>
          )}
        </div>
      </div>
    );
  }

  render() {
    const { isLoading, session } = this.state;
    const visibleEntries = this.getVisibleEntries();
    const selectedEntry =
      visibleEntries.find(
        ({ entryKey }) => entryKey === this.state.selectedEntryKey
      )?.entry ||
      visibleEntries[0]?.entry ||
      null;
    const hasEntries = session.stack.length > 0;

    return (
      <div className="DashboardPage" style={{ fontSize: FontSizes.size12 }}>
        <AppHeader />
        <DevToolsCommandBar
          capturePaused={session.modes.capturePaused}
          clearSession={this.clearSession}
          clearLocalCache={this.clearLocalCache}
          saveScript={this.saveScript}
          saveLogs={this.saveLogs}
          toggleCapturePaused={this.toggleCapturePaused}
        />
        <div className="DashboardBody">
          <div className="DashboardHero">
            <div
              className="DashboardCard"
              style={{ boxShadow: theme.effects.elevation16 }}
            >
              <div className="DashboardCardInner">
                <h1 className="DashboardTitle">Graph X-Ray Dashboard</h1>
                <p className="DashboardDescription">
                  A standalone extension view for reviewing the current captured
                  Microsoft Graph session without staying inside the Web
                  Developer Tools panel.
                </p>
                <div className="DashboardMeta">
                  <span className="DashboardMetaChip">
                    Language: {session.modes.snippetLanguage}
                  </span>
                  <span className="DashboardMetaChip">
                    Ultra X-Ray: {session.modes.ultraXRayMode ? "On" : "Off"}
                  </span>
                  <span className="DashboardMetaChip">
                    Diagnostic: {session.modes.diagnosticMode ? "On" : "Off"}
                  </span>
                  <span className="DashboardMetaChip">
                    Capture: {session.modes.capturePaused ? "Paused" : "Running"}
                  </span>
                  <span className="DashboardMetaChip">
                    External snippets: {session.modes.allowExternalSnippets ? "On" : "Off"}
                  </span>
                  <span className="DashboardMetaChip">
                    External snippets ack: {session.modes.externalSnippetsAcknowledged ? "Accepted" : "Required"}
                  </span>
                  <span className="DashboardMetaChip">
                    Export mode: {session.modes.exportSanitizationMode}
                  </span>
                  <span className="DashboardMetaChip">
                    Persistence: {session.modes.persistSessionData ? "Persisted" : "Memory only"}
                  </span>
                  <span className="DashboardMetaChip">
                    Retention: {formatRetentionLabel(session.modes.sessionRetentionMs)}
                  </span>
                  <span className="DashboardMetaChip">
                    Startup clear: {session.modes.clearCapturedDataOnStartup ? "On" : "Off"}
                  </span>
                  <span className="DashboardMetaChip">
                    Ultra X-Ray ack: {session.modes.ultraXRayAcknowledged ? "Accepted" : "Required"}
                  </span>
                  <span className="DashboardMetaChip">
                    Consent: {session.modes.captureConsentAccepted ? "Accepted" : "Required"}
                  </span>
                  <span className="DashboardMetaChip">
                    Updated: {formatTimestamp(session.updatedAt)}
                  </span>
                </div>
              </div>
            </div>

            <div
              className="DashboardCard"
              style={{ boxShadow: theme.effects.elevation16 }}
            >
              <div className="DashboardCardInner">
                <div className="DashboardSummaryGrid">
                  <div className="DashboardStat">
                    <span className="DashboardStatLabel">Captured calls</span>
                    <span className="DashboardStatValue">
                      {session.stack.length}
                    </span>
                  </div>
                  <div className="DashboardStat">
                    <span className="DashboardStatLabel">Diagnostic logs</span>
                    <span className="DashboardStatValue">
                      {session.diagnosticLogs.length}
                    </span>
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "16px",
                    marginTop: "16px",
                  }}
                >
                  <Toggle
                    label="External snippets"
                    checked={session.modes.allowExternalSnippets}
                    onChange={this.onAllowExternalSnippetsToggle}
                    onText="Enabled"
                    offText="Local only"
                  />
                  <Toggle
                    label="Ultra X-Ray"
                    checked={session.modes.ultraXRayMode}
                    onChange={this.onUltraXRayToggle}
                    onText="Enabled"
                    offText="Disabled"
                  />
                </div>
                <div className="DashboardSearch">
                  <div className="DashboardFilters">
                    <SearchBox
                      placeholder="Search URL, request body, response, or code"
                      value={this.state.searchText}
                      onChange={this.handleSearchChange}
                    />
                    <Dropdown
                      placeholder="Filter by HTTP method"
                      label="HTTP methods"
                      multiSelect
                      selectedKeys={this.state.selectedMethods}
                      options={HTTP_METHOD_OPTIONS}
                      styles={filterDropdownStyles}
                      onChange={this.handleMethodFilterChange}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {!session.modes.captureConsentAccepted && (
            <div
              className="DashboardCard"
              style={{ boxShadow: theme.effects.elevation16, marginBottom: "24px" }}
            >
              <div className="DashboardCardInner">
                <div
                  style={{
                    borderLeft: "4px solid #d97706",
                    backgroundColor: "#fffbeb",
                    color: "#7c2d12",
                    padding: "12px 14px",
                    borderRadius: "8px",
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
              </div>
            </div>
          )}

          {session.modes.ultraXRayMode && (
            <div
              className="DashboardCard"
              style={{ boxShadow: theme.effects.elevation16, marginBottom: "24px" }}
            >
              <div className="DashboardCardInner">
                <div
                  style={{
                    borderLeft: "4px solid #b45309",
                    backgroundColor: "#fffbeb",
                    color: "#92400e",
                    padding: "12px 14px",
                    borderRadius: "8px",
                  }}
                >
                  Ultra X-Ray is enabled. Internal or undocumented Microsoft
                  admin APIs can appear in this session and should be treated as
                  higher-risk data.
                </div>
              </div>
            </div>
          )}

          {!hasEntries && !isLoading && this.renderEmptySession()}

          {hasEntries && (
            <div className="DashboardShell">
              <div
                className="DashboardCard"
                style={{ boxShadow: theme.effects.elevation16 }}
              >
                <div className="DashboardCardInner">
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "12px",
                    }}
                  >
                    <div>
                      <h2
                        style={{
                          margin: 0,
                          fontSize: "20px",
                          color: "#0f172a",
                        }}
                      >
                        Session entries
                      </h2>
                      <p
                        style={{
                          margin: "6px 0 0",
                          color: "#475569",
                        }}
                      >
                        {visibleEntries.length} visible of {session.stack.length}
                      </p>
                    </div>
                    <DefaultButton
                      text="Guide"
                      iconProps={{ iconName: "Info" }}
                      onClick={this.openGuide}
                    />
                  </div>
                  {this.renderList(visibleEntries)}
                </div>
              </div>

              <div
                className="DashboardCard"
                style={{ boxShadow: theme.effects.elevation16 }}
              >
                <div className="DashboardCardInner">
                  {selectedEntry ? (
                    <CodeView
                      request={selectedEntry}
                      exportSanitizationMode={
                        session.modes.exportSanitizationMode
                      }
                      lightUrl={true}
                      snippetLanguage={session.modes.snippetLanguage}
                    />
                  ) : (
                    <div className="DashboardEmpty">
                      <h2 className="DashboardEmptyTitle">Select a request</h2>
                      <p className="DashboardEmptyCopy">
                        Choose a captured entry on the left to inspect the
                        request, response, and generated snippet.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }
}

export default Dashboard;
