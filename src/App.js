import "./App.css";
import React from "react";
import { PrimaryButton, getTheme } from "@fluentui/react";
import { FontSizes } from "@fluentui/theme";
import { AppHeader } from "./components/AppHeader";
import {
  saveObjectInLocalStorage,
  getIsActive,
  getCurrentMetrics,
  getStack,
} from "./common/storage.js";
import {
  getHostWebview,
  isFirefoxBrowser,
  sendRuntimeMessage,
} from "./common/extensionApi.js";
import { openOptionsPage } from "./components/CommandMenu.js";

const theme = getTheme();

class App extends React.Component {
  constructor() {
    super();
    this.state = {
      message: "",
      isActive: false,
      stack: [],
      doc: "",
      recentCode: "",
      recentGraphUri: "",
    };
  }

  componentDidMount() {
    // Add listener when component mounts
    this.timerID = setInterval(() => this.getMetrics(), 500);
    // Add listener when component mounts
    this.addListener();
  }

  componentWillUnmount() {
    clearInterval(this.timerID);
  }

  getMetrics = async () => {
    let currentMetrics = await getCurrentMetrics();
    let { urls, tabName } = currentMetrics;
    let isActive = await getIsActive();
    let stack = await getStack();

    //Get the most recent PowerShell command
    let recentGraphUri = "";
    let recentCode = "";
    if (urls.length > 0) {
      for (let i = 0; i < urls.length; i++) {
        recentCode = urls[0].ps;
        if (recentCode !== "") {
          recentGraphUri = urls[i].url;
          break;
        }
      }
    }

    this.setState({
      message: {
        urls,
        tabName,
      },
      stack: stack,
      isActive: isActive,
      recentCode: recentCode,
      recentGraphUri: recentGraphUri,
    });
  };

  addListener() {
    const hostWebview = getHostWebview();
    if (!hostWebview) {
      return;
    }
    hostWebview.addEventListener("message", (event) => {
      console.log("Got message from host!");
      console.log(event.data);
    });
  }

  toggleStart = () => {
    this.setState({ isActive: !this.state.isActive });

    if (this.state.isActive) {
      sendRuntimeMessage({
        method: "start",
      })
        .then((response) => {
          if (response?.farewell) {
            console.log(response.farewell);
          }
        })
        .catch((error) => {
          console.log("Could not send start message:", error);
        });

      saveObjectInLocalStorage({
        isActive: this.state.isActive,
        contextSwitches: 0,
      });
    } else {
      sendRuntimeMessage({
        method: "stop",
      }).catch((error) => {
        console.log("Could not send stop message:", error);
      });
      saveObjectInLocalStorage({
        isActive: this.state.isActive,
      });
    }
  };

  render() {
    const showFirefoxNote = isFirefoxBrowser();

    return (
      <div className="App" style={{ fontSize: FontSizes.size12 }}>
        <AppHeader></AppHeader>
        <div className="App-body">
          <div
            style={{
              boxShadow: theme.effects.elevation16,
              padding: "10px",
              marginBottom: "15px",
            }}
          >
            <h2>Graph call history</h2>
            <p>
              To view Graph calls in real-time open Developer Tools and switch
              to the Graph X-Ray panel.
            </p>
            {showFirefoxNote && (
              <p>
                Firefox note: open the <b>Network</b> tab once before switching
                to <b>Graph X-Ray</b>. Firefox only starts emitting DevTools
                network events after the Network tool has been activated.
              </p>
            )}
            <PrimaryButton
              onClick={openOptionsPage}
              iconProps={{ iconName: "OpenInNewTab" }}
            >
              Show me how
            </PrimaryButton>
          </div>
        </div>
      </div>
    );
  }
}

export default App;
