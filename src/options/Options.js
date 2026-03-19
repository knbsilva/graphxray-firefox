import React from "react";
import "./Options.css";
import { AppHeader } from "../components/AppHeader";
import { FontSizes } from "@fluentui/theme";
import { getTheme } from "@fluentui/react";
import { isFirefoxBrowser } from "../common/extensionApi.js";

const theme = getTheme();
class Options extends React.Component {
  constructor() {
    super();
    this.state = {
      message: "",
      isActive: false,
      stack: [],
    };
  }

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
