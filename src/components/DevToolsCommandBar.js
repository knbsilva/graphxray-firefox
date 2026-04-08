import * as React from "react";
import { CommandBar } from "@fluentui/react/lib/CommandBar";

class DevToolsCommandBar extends React.Component {
  render() {
    const items = [
      this.props.openDashboard
        ? {
            key: "dashboard",
            text: "Open dashboard",
            onClick: this.props.openDashboard,
            iconProps: { iconName: "OpenInNewTab" },
          }
        : null,
      {
        key: "download",
        text: "Save script",
        onClick: this.props.saveScript,
        iconProps: { iconName: "Download" },
      },
      {
        key: "diagnostics",
        text: "Save logs",
        onClick: this.props.saveLogs,
        iconProps: { iconName: "DiagnosticDataBarTooltip" },
      },
      this.props.clearLocalCache
        ? {
            key: "clear-local",
            text: "Clear local cache",
            onClick: this.props.clearLocalCache,
            iconProps: { iconName: "Broom" },
          }
        : null,
      this.props.toggleCapturePaused
        ? {
            key: "capture",
            text: this.props.capturePaused ? "Resume capture" : "Pause capture",
            onClick: this.props.toggleCapturePaused,
            iconProps: {
              iconName: this.props.capturePaused ? "Play" : "Pause",
            },
          }
        : null,
      {
        key: "clear",
        text: "Clear session",
        onClick: this.props.clearSession,
        iconProps: { iconName: "Delete" },
      },
    ].filter(Boolean);

    return (
      <div>
        <CommandBar items={items} ariaLabel="Graph X-Ray session commands" />
      </div>
    );
  }
}

export default DevToolsCommandBar;
