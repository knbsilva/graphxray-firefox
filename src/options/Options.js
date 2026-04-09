import React from "react";
import "./Options.css";
import { AppHeader } from "../components/AppHeader";
import { FontSizes } from "@fluentui/theme";
import {
  Dropdown,
  getTheme,
  MessageBar,
  MessageBarType,
  Toggle,
} from "@fluentui/react";
import { isFirefoxBrowser } from "../common/extensionApi.js";
import {
  getClearCapturedDataOnStartup,
  getExternalSnippetsAcknowledged,
  getExportSanitizationMode,
  getAllowExternalSnippets,
  getPersistSessionData,
  getSessionRetentionMs,
  getSensitiveCaptureConsentAccepted,
  getUltraXRayAcknowledged,
  saveExportSanitizationMode,
  saveAllowExternalSnippets,
  saveClearCapturedDataOnStartup,
  saveExternalSnippetsAcknowledged,
  savePersistSessionData,
  saveSessionRetentionMs,
  saveSensitiveCaptureConsentAccepted,
} from "../common/storage.js";
import { PrimaryButton } from "@fluentui/react/lib/Button";
import {
  DEFAULT_EXPORT_SANITIZATION_MODE,
  EXPORT_SANITIZATION_MODES,
} from "../common/security.js";
import {
  hasOptionalPermissionScope,
  removeOptionalPermissionScope,
  requestOptionalPermissionScope,
} from "../common/optionalPermissions.js";
import {
  DEFAULT_SESSION_RETENTION_MS,
  SESSION_RETENTION_OPTIONS,
} from "../common/session.js";

const theme = getTheme();
class Options extends React.Component {
  constructor() {
    super();
    this.state = {
      message: "",
      isActive: false,
      stack: [],
      allowExternalSnippets: false,
      captureConsentAccepted: false,
      clearCapturedDataOnStartup: false,
      externalSnippetsAcknowledged: false,
      exportSanitizationMode: DEFAULT_EXPORT_SANITIZATION_MODE,
      persistSessionData: true,
      sessionRetentionMs: DEFAULT_SESSION_RETENTION_MS,
      ultraXRayAcknowledged: false,
    };
  }

  async componentDidMount() {
    this.setState({
      allowExternalSnippets: await getAllowExternalSnippets(),
      captureConsentAccepted: await getSensitiveCaptureConsentAccepted(),
      clearCapturedDataOnStartup: await getClearCapturedDataOnStartup(),
      externalSnippetsAcknowledged: await getExternalSnippetsAcknowledged(),
      exportSanitizationMode: await getExportSanitizationMode(),
      persistSessionData: await getPersistSessionData(),
      sessionRetentionMs: await getSessionRetentionMs(),
      ultraXRayAcknowledged: await getUltraXRayAcknowledged(),
    });
    await this.reconcileOptionalPermissionStates();
  }

  reconcileOptionalPermissionStates = async () => {
    const [externalSnippetsAllowed, externalPermissionGranted] =
      await Promise.all([
        getAllowExternalSnippets(),
        hasOptionalPermissionScope("externalSnippets"),
      ]);

    if (externalSnippetsAllowed && !externalPermissionGranted) {
      await saveAllowExternalSnippets(false);
      this.setState({
        allowExternalSnippets: false,
      });
    }
  };

  onAllowExternalSnippetsChange = async (_, checked) => {
    const enabled = Boolean(checked);
    if (
      enabled &&
      !this.state.externalSnippetsAcknowledged &&
      typeof window !== "undefined" &&
      !window.confirm(
        "Enabling external snippet generation allows Graph X-Ray to send supported request payloads to the Microsoft Graph DevX snippet service. Continue?"
      )
    ) {
      return;
    }

    if (enabled && !this.state.externalSnippetsAcknowledged) {
      await saveExternalSnippetsAcknowledged(true);
    }

    if (enabled) {
      const permissionGranted = await requestOptionalPermissionScope(
        "externalSnippets"
      );
      if (!permissionGranted) {
        return;
      }
    } else {
      await removeOptionalPermissionScope("externalSnippets");
    }

    await saveAllowExternalSnippets(enabled);
    this.setState({
      allowExternalSnippets: enabled,
      externalSnippetsAcknowledged: enabled
        ? true
        : this.state.externalSnippetsAcknowledged,
    });
  };

  acknowledgeCaptureConsent = async () => {
    await saveSensitiveCaptureConsentAccepted(true);
    this.setState({
      captureConsentAccepted: true,
    });
  };

  onExportSanitizationModeChange = async (_, option) => {
    if (!option) {
      return;
    }

    await saveExportSanitizationMode(option.key);
    this.setState({
      exportSanitizationMode: option.key,
    });
  };

  onSessionRetentionChange = async (_, option) => {
    if (!option) {
      return;
    }

    await saveSessionRetentionMs(option.key);
    this.setState({
      sessionRetentionMs: option.key,
    });
  };

  onPersistSessionDataChange = async (_, checked) => {
    const enabled = Boolean(checked);
    await savePersistSessionData(enabled);
    this.setState({
      persistSessionData: enabled,
    });
  };

  onClearCapturedDataOnStartupChange = async (_, checked) => {
    const enabled = Boolean(checked);
    await saveClearCapturedDataOnStartup(enabled);
    this.setState({
      clearCapturedDataOnStartup: enabled,
    });
  };

  render() {
    const showFirefoxNote = isFirefoxBrowser();

    return (
      <div className="App" style={{ fontSize: FontSizes.size12 }}>
        <AppHeader hideSettings={true}></AppHeader>
        <header className="App-header">
          <div
            style={{
              boxShadow: theme.effects.elevation16,
              padding: "16px",
              marginBottom: "15px",
            }}
          >
            <div
              style={{
                boxShadow: theme.effects.elevation8,
                padding: "16px",
                margin: "20px",
              }}
            >
              <h2>Viewing the Graph call stack trace</h2>
              <p>
                Use Graph X-Ray in Firefox to capture Microsoft Graph requests
                while you work in portals such as Entra and Intune.
              </p>
              <MessageBar
                messageBarType={MessageBarType.warning}
                styles={{ root: { marginBottom: "16px" } }}
              >
                Graph X-Ray can capture sensitive administrative requests,
                responses, and generated snippets. Treat exports and diagnostic
                logs as sensitive data.
              </MessageBar>
              {!this.state.captureConsentAccepted && (
                <div
                  style={{
                    boxShadow: theme.effects.elevation4,
                    padding: "16px",
                    marginBottom: "20px",
                    borderRadius: "8px",
                    border: "1px solid #f59e0b",
                    backgroundColor: "#fffbeb",
                  }}
                >
                  <h3 style={{ marginTop: 0 }}>First-use consent</h3>
                  <p>
                    Before using Graph X-Ray to capture Microsoft 365
                    administrative traffic, confirm that you understand it can
                    store and export sensitive API data locally.
                  </p>
                  <PrimaryButton onClick={this.acknowledgeCaptureConsent}>
                    I understand and want to enable capture
                  </PrimaryButton>
                </div>
              )}
              <div
                style={{
                  boxShadow: theme.effects.elevation4,
                  padding: "16px",
                  marginBottom: "20px",
                  borderRadius: "8px",
                }}
              >
                <h3 style={{ marginTop: 0 }}>Snippet generation mode</h3>
                <Toggle
                  label="Allow external snippet generation"
                  checked={this.state.allowExternalSnippets}
                  onChange={this.onAllowExternalSnippetsChange}
                  onText="Enabled"
                  offText="Local only"
                />
                <p style={{ marginBottom: 0, color: "#475569" }}>
                  When enabled, Graph X-Ray can send captured request payloads
                  to the Microsoft Graph DevX snippet service for languages that
                  do not have a local generator. When disabled, PowerShell stays
                  local and other languages fail closed without external
                  submission.
                </p>
                <p style={{ marginBottom: 0, color: "#475569" }}>
                  Firefox will request the optional DevX host permission the
                  first time you enable this setting, and remove it again when
                  you disable the setting or clear the local cache.
                </p>
                <p style={{ marginBottom: 0, color: "#475569" }}>
                  Current acknowledgement state:{" "}
                  <strong>
                    {this.state.externalSnippetsAcknowledged
                      ? "accepted"
                      : "required"}
                  </strong>
                </p>
              </div>
              <div
                style={{
                  boxShadow: theme.effects.elevation4,
                  padding: "16px",
                  marginBottom: "20px",
                  borderRadius: "8px",
                }}
              >
                <h3 style={{ marginTop: 0 }}>Export sanitization</h3>
                <Dropdown
                  label="Default export mode"
                  selectedKey={this.state.exportSanitizationMode}
                  options={EXPORT_SANITIZATION_MODES.map((mode) => ({
                    key: mode,
                    text:
                      mode === "raw"
                        ? "Raw"
                        : mode === "summary"
                        ? "Summary"
                        : "Redacted",
                  }))}
                  onChange={this.onExportSanitizationModeChange}
                />
                <p style={{ marginBottom: 0, color: "#475569" }}>
                  Raw exports preserve captured content as-is. Redacted exports
                  mask sensitive tokens, emails, GUIDs, and common credential
                  fields. Summary exports save metadata-only JSON instead of the
                  full request, response, or snippet body.
                </p>
              </div>
              <div
                style={{
                  boxShadow: theme.effects.elevation4,
                  padding: "16px",
                  marginBottom: "20px",
                  borderRadius: "8px",
                }}
              >
                <h3 style={{ marginTop: 0 }}>Persistence mode</h3>
                <Toggle
                  label="Persist session data to browser storage"
                  checked={this.state.persistSessionData}
                  onChange={this.onPersistSessionDataChange}
                  onText="Persisted"
                  offText="Memory only"
                />
                <p style={{ marginBottom: 0, color: "#475569" }}>
                  When disabled, Graph X-Ray keeps new captures in the current
                  DevTools session only. The standalone dashboard and persisted
                  session recovery will no longer mirror new entries until
                  persistence is enabled again.
                </p>
              </div>
              <div
                style={{
                  boxShadow: theme.effects.elevation4,
                  padding: "16px",
                  marginBottom: "20px",
                  borderRadius: "8px",
                }}
              >
                <h3 style={{ marginTop: 0 }}>Local retention</h3>
                <Dropdown
                  label="Persisted session retention"
                  selectedKey={this.state.sessionRetentionMs}
                  options={SESSION_RETENTION_OPTIONS.map((retentionMs) => ({
                    key: retentionMs,
                    text:
                      retentionMs === 15 * 60 * 1000
                        ? "15 minutes"
                        : retentionMs === 60 * 60 * 1000
                        ? "60 minutes"
                        : "4 hours",
                  }))}
                  onChange={this.onSessionRetentionChange}
                />
                <p style={{ marginBottom: 0, color: "#475569" }}>
                  Persisted session state in extension storage is purged after
                  the selected idle period. Shorter retention reduces local
                  exposure of captured Microsoft 365 administrative data.
                </p>
                <div style={{ marginTop: "16px" }}>
                  <Toggle
                    label="Clear captured data when Firefox starts"
                    checked={this.state.clearCapturedDataOnStartup}
                    onChange={this.onClearCapturedDataOnStartupChange}
                    onText="Enabled"
                    offText="Disabled"
                  />
                  <p style={{ marginBottom: 0, color: "#475569" }}>
                    When enabled, Graph X-Ray clears the persisted session
                    snapshot and request-body correlation cache on browser
                    startup while preserving your consent and snippet settings.
                  </p>
                </div>
              </div>
              <div
                style={{
                  boxShadow: theme.effects.elevation4,
                  padding: "16px",
                  marginBottom: "20px",
                  borderRadius: "8px",
                }}
              >
                <h3 style={{ marginTop: 0 }}>Ultra X-Ray safeguard</h3>
                <p style={{ marginBottom: 0, color: "#475569" }}>
                  Ultra X-Ray is disabled by default and requires a warning
                  acknowledgement the first time you enable it from the DevTools
                  panel. It can expose undocumented or internal Microsoft admin
                  APIs that carry higher data-handling risk.
                </p>
                <p style={{ marginBottom: 0, color: "#475569" }}>
                  Firefox also requests optional host permissions for the
                  higher-risk admin endpoints the first time Ultra X-Ray is
                  enabled.
                </p>
                <p style={{ marginBottom: 0, color: "#475569" }}>
                  Current acknowledgement state:{" "}
                  <strong>
                    {this.state.ultraXRayAcknowledged ? "accepted" : "required"}
                  </strong>
                </p>
              </div>
              <ul>
                <li>
                  Open a Microsoft admin portal page in Firefox.
                </li>
                <li>
                  Open <b>Web Developer Tools</b>.
                </li>
                {showFirefoxNote && (
                  <li>
                    Open the <b>Network</b> tab once before switching to the{" "}
                    <b>Graph X-Ray</b> panel.
                  </li>
                )}
                <li>
                  Open the <b>Graph X-Ray</b> panel.
                </li>
                <li>
                  Perform an action in the portal and review the captured
                  request, response, and generated snippet.
                </li>
                <li>
                  Optional: use <b>Open dashboard</b> to review the same
                  captured session outside Developer Tools.
                </li>
                <li>
                  Use <b>Local only</b> mode if you do not want captured request
                  payloads sent to the external DevX snippet service.
                </li>
              </ul>
            </div>
            <div
              style={{
                boxShadow: theme.effects.elevation4,
                padding: "16px",
                margin: "20px",
              }}
            >
              <h2>Step by step guide</h2>
              <div
                style={{
                  boxShadow: theme.effects.elevation8,
                  padding: "16px",
                  margin: "20px",
                }}
              >
                <h3>Open Web Developer Tools</h3>
                <ul>
                  <li>
                    Press <b>F12</b> in Firefox.
                  </li>
                  <li>
                    Or open the Firefox application menu, choose{" "}
                    <b>More tools</b>, and then <b>Web Developer Tools</b>.
                  </li>
                </ul>
              </div>
              <div
                style={{
                  boxShadow: theme.effects.elevation4,
                  padding: "16px",
                  margin: "20px",
                }}
              >
                <h3>Open the Graph X-Ray panel</h3>
                <p>
                  Expand the tabs in Developer Tools and select the Graph X-Ray
                  panel.
                </p>
                {showFirefoxNote && (
                  <p>
                    In Firefox, click the <b>Network</b> tab once before moving
                    to <b>Graph X-Ray</b>.
                  </p>
                )}
                <p>
                  If you don't see the Graph X-Ray panel you may need to restart
                  your browser.
                </p>
              </div>
              <div
                style={{
                  boxShadow: theme.effects.elevation8,
                  padding: "16px",
                  margin: "20px",
                }}
              >
                <h3>View Graph call stack trace</h3>
                <p>
                  Make changes in the Azure Portal to view the corresponding
                  Graph API calls and PowerShell commands for the action (e.g.
                  edit a user's profile information and click Save).
                </p>
                <p>
                  Scroll down in the Graph X-Ray panel to view the new stack
                  trace.
                </p>
                <p>
                  If you prefer a separate interface, click{" "}
                  <b>Open dashboard</b> from Graph X-Ray to inspect the same
                  captured session in a standalone page.
                </p>
              </div>
            </div>
          </div>
        </header>
      </div>
    );
  }
}

export default Options;
