import React from "react";
import "./Options.css";
import { AppHeader } from "../components/AppHeader";
import { FontSizes } from "@fluentui/theme";
import { getTheme, MessageBar, MessageBarType, Toggle } from "@fluentui/react";
import { isFirefoxBrowser } from "../common/extensionApi.js";
import {
  getAllowExternalSnippets,
  getSensitiveCaptureConsentAccepted,
  saveAllowExternalSnippets,
  saveSensitiveCaptureConsentAccepted,
} from "../common/storage.js";
import { PrimaryButton } from "@fluentui/react/lib/Button";

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
    };
  }

  async componentDidMount() {
    this.setState({
      allowExternalSnippets: await getAllowExternalSnippets(),
      captureConsentAccepted: await getSensitiveCaptureConsentAccepted(),
    });
  }

  onAllowExternalSnippetsChange = async (_, checked) => {
    const enabled = Boolean(checked);
    await saveAllowExternalSnippets(enabled);
    this.setState({
      allowExternalSnippets: enabled,
    });
  };

  acknowledgeCaptureConsent = async () => {
    await saveSensitiveCaptureConsentAccepted(true);
    this.setState({
      captureConsentAccepted: true,
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
