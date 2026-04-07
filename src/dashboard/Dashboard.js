import React from "react";
import "./Dashboard.css";
import { SearchBox } from "@fluentui/react/lib/SearchBox";
import { DefaultButton, PrimaryButton } from "@fluentui/react/lib/Button";
import { Dropdown } from "@fluentui/react/lib/Dropdown";
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
  buildDiagnosticEntry,
  MAX_DIAGNOSTIC_LOG_ENTRIES,
} from "../common/diagnostics.js";
import {
  getGraphXRaySession,
  saveGraphXRaySession,
} from "../common/storage.js";
import {
  buildDiagnosticExportPayload,
  buildSessionSnapshot,
  createEmptySessionState,
  downloadContentAsFile,
  getSaveScriptContentFromStack,
  GRAPHXRAY_SESSION_STORAGE_KEY,
  normalizeSessionState,
} from "../common/session.js";
import { getSnippetLanguageOption } from "../common/snippetLanguages.js";

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

class Dashboard extends React.Component {
  constructor() {
    super();
    this.state = {
      isLoading: true,
      searchText: "",
      selectedMethods: [],
      selectedEntryKey: null,
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
    this.setState((previousState) => {
      const previousVisibleEntries = this.getVisibleEntries(previousState.session);
      const nextVisibleEntries = this.getVisibleEntries(
        session,
        previousState.searchText,
        previousState.selectedMethods
      );

      return {
        isLoading: false,
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
        if (
          areaName !== "local" ||
          !Object.prototype.hasOwnProperty.call(
            changes,
            GRAPHXRAY_SESSION_STORAGE_KEY
          )
        ) {
          return;
        }

        const session = normalizeSessionState(
          changes[GRAPHXRAY_SESSION_STORAGE_KEY]?.newValue
        );

        this.setState((previousState) => {
          const previousVisibleEntries = this.getVisibleEntries(previousState.session);
          const nextVisibleEntries = this.getVisibleEntries(
            session,
            previousState.searchText,
            previousState.selectedMethods
          );

          return {
            isLoading: false,
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

  saveScript = async () => {
    const script = getSaveScriptContentFromStack(this.state.session.stack);
    if (!script.trim()) {
      return;
    }

    const language = this.state.session.modes.snippetLanguage;
    const languageOption = getSnippetLanguageOption(language);
    await downloadContentAsFile(
      script,
      `GraphXRaySession.${languageOption.fileExt}`
    );
  };

  saveLogs = async () => {
    if (this.state.session.diagnosticLogs.length === 0) {
      return;
    }

    const logPayload = buildDiagnosticExportPayload(
      buildSessionSnapshot({
        stack: this.state.session.stack,
        diagnosticLogs: this.state.session.diagnosticLogs,
        modes: this.state.session.modes,
        sourceContext: "dashboard",
      })
    );
    const fileName = `GraphXRayDiagnostics-${new Date()
      .toISOString()
      .replace(/[:.]/g, "-")}.json`;

    await downloadContentAsFile(
      JSON.stringify(logPayload, null, 2),
      fileName,
      "application/json"
    );
  };

  openGuide = () => {
    openExtensionOptionsPage().catch((error) => {
      console.log("Could not open Graph X-Ray guide:", error);
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
