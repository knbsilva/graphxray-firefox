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
  downloadFile as downloadExtensionFile,
  getDevtoolsApi,
  getHostWebview,
  isFirefoxBrowser,
} from "../common/extensionApi.js";

const theme = getTheme();

const dropdownStyles = {
  dropdown: { width: 300 },
};

const options = [
  { key: "powershell", text: "PowerShell", fileExt: "ps1" },
  { key: "python", text: "Python", fileExt: "py" },
  { key: "c#", text: "C#", fileExt: "cs" },
  { key: "javascript", text: "JavaScript", fileExt: "js" },
  { key: "java", text: "Java", fileExt: "java" },
  { key: "objective-c", text: "Objective-C", fileExt: "c" },
  { key: "go", text: "Go", fileExt: "go" },  
];

class DevTools extends React.Component {
  constructor() {
    super();
    // Load ultraXRayMode from localStorage, default to false
    const savedUltraXRayMode = localStorage.getItem('graphxray-ultraXRayMode');
    const ultraXRayMode = savedUltraXRayMode ? JSON.parse(savedUltraXRayMode) : false;
    
    this.state = {
      stack: [],
      snippetLanguage: "powershell",
      ultraXRayMode: ultraXRayMode,
    };
  }

  componentDidMount() {
    // Add listener when component mounts
    this.addListener();
    this.addListenerGraph();
  }

  clearStack = () => {
    this.setState({ stack: [] });
  };

  saveScript = () => {
    const script = this.getSaveScriptContent();
    if (!script.trim()) {
      console.warn("No generated code is available to save yet.");
      return;
    }
    const languageOpt = options.filter((opt) => {
      return opt.key === this.state.snippetLanguage;
    });
    const fileName = "GraphXRaySession." + languageOpt[0].fileExt;
    this.downloadFile(script, fileName);
  };

  copyScript = () => {
    const script = this.getSaveScriptContent();
    if (!script.trim()) {
      console.warn("No generated code is available to copy yet.");
      return;
    }
    navigator.clipboard.writeText(script);
  };

  getSaveScriptContent() {
    const sections = [];

    this.state.stack.forEach((request) => {
      if (request.code && request.code.trim()) {
        sections.push(request.code.trim());
      }

      if (request.batchCodeSnippets && request.batchCodeSnippets.length > 0) {
        request.batchCodeSnippets.forEach((snippet) => {
          if (snippet.code && snippet.code.trim()) {
            sections.push(snippet.code.trim());
          }
        });
      }
    });

    return sections.join("\n\n");
  }

  async downloadFile(content, filename) {
    const file = new Blob([content], {
      type: "text/plain",
    });
    const objectUrl = URL.createObjectURL(file);

    try {
      const downloadId = await downloadExtensionFile({
        url: objectUrl,
        filename,
        saveAs: true,
      });

      if (downloadId !== null && downloadId !== undefined) {
        setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
        return;
      }
    } catch (error) {
      console.log("downloads.download failed, falling back to anchor click:", error);
    }

    const element = document.createElement("a");
    element.href = objectUrl;
    element.download = filename;
    element.style.display = "none";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }

  addListenerGraph() {
    const hostWebview = getHostWebview();
    if (!hostWebview) {
      return;
    }
    hostWebview.addEventListener("message", (event) => {
      console.log("Got message from host!");
      console.log(event.data);
      const msg = JSON.parse(event.data);
      if (msg.eventName === "GraphCall") {
        console.log("Showing graph call.");
        this.showRequest(msg);
      }
    });
  }

  async addRequestToStack(request, version, harEntry = null) {
    console.log("DevTools - addRequestToStack called with:", request, version, harEntry);
    const codeView = await getCodeView(
      this.state.snippetLanguage,
      request,
      version,
      harEntry
    );
    console.log("DevTools - getCodeView returned:", codeView);
    if (codeView) {
      this.setState({ stack: [...this.state.stack, codeView] });
    }
  }

  addListener() {
    const devtoolsApi = getDevtoolsApi();
    if (!devtoolsApi) {
      return;
    }
    devtoolsApi.network.onRequestFinished.addListener(async (harEntry) => {
      try {
        if (
          harEntry.request &&
          harEntry.request.url &&
          isAllowedDomain(harEntry.request.url, this.state.ultraXRayMode)
        ) {
          const request = harEntry.request;

          // Pass both the request and the harEntry (which has getContent method)
          request._harEntry = harEntry;

          try {
            this.showRequest(request, harEntry);
          } catch (error) {
            console.log(error);
          }
        }
      } catch (error) {
        console.log(error);
      }
    });
  }

  async showRequest(request, harEntry = null) {
    console.log("DevTools - showRequest called with:", request, harEntry);
    if (request.url.includes("/$batch")) {
      console.log("Processing batch request - keeping as single unit");
      // For batch requests, treat them as a single unit to preserve request/response matching
      await this.addRequestToStack(request, "", harEntry);
    } else {
      await this.addRequestToStack(request, "", harEntry);
    }
  }

  onLanguageChange = (e, option) => {
    this.setState({ snippetLanguage: option.key });
    this.clearStack();
  };

  onUltraXRayToggle = (e, checked) => {
    this.setState({ ultraXRayMode: checked });
    // Save to localStorage
    localStorage.setItem('graphxray-ultraXRayMode', JSON.stringify(checked));
    this.clearStack(); // Clear the stack when toggling mode
  };
  render() {
    const showFirefoxNote = isFirefoxBrowser();

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
              clearStack={this.clearStack}
              saveScript={this.saveScript}
              copyScript={this.copyScript}
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
              browser tab. Code conversions are only available for published Graph APIs.
              Turn on <strong>Ultra X-Ray</strong> mode to see all API calls (open a <a href="https://github.com/merill/graphxray/issues" target="_blank" rel="noreferrer">GitHub issue</a> if there are admin portals or blades that are not being captured).
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
            <div style={{ 
              display: "flex", 
              alignItems: "flex-end", 
              gap: "20px",
              flexWrap: "wrap" 
            }}>
              <Dropdown
                placeholder="Select an option"
                label="Select language"
                options={options}
                styles={dropdownStyles}
                defaultSelectedKey={this.state.snippetLanguage}
                onChange={this.onLanguageChange}
              />
              
              <div style={{ 
                display: "flex", 
                alignItems: "center",
                gap: "8px",
                marginBottom: "8px" // Align with dropdown bottom margin
              }}>
                <Toggle
                  label="Ultra X-Ray"
                  checked={this.state.ultraXRayMode}
                  onChange={this.onUltraXRayToggle}
                  onText="On"
                  offText="Off"
                  styles={{
                    root: { marginBottom: 0 },
                    label: { fontWeight: "600" }
                  }}
                />
                <TooltipHost
                  content="Enables ultra mode which allows you to see API calls that are not publicly documented by Microsoft. These are meant for educational purposes. These endpoints should not be used in custom scripts as they are not supported by Microsoft and are only meant for internal use."
                  styles={{
                    root: {
                      display: "inline-block"
                    }
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
                        borderRadius: "50%"
                      },
                      rootHovered: {
                        backgroundColor: "rgba(0, 0, 0, 0.05)",
                        color: "#333"
                      }
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
              {this.state.stack.map((request, index) => (
                <div
                  key={index}
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
