import * as React from "react";
import { CommandBar } from "@fluentui/react/lib/CommandBar";
import { DefaultPalette } from "@fluentui/react";
import { ContextualMenuItemType } from "@fluentui/react/lib/ContextualMenu";
import {
  getExtensionUrl,
  openExtensionPage,
  openExtensionOptionsPage,
} from "../common/extensionApi.js";

const styleBlue = {
  root: {
    background: DefaultPalette.themeDarker,
  },
  rootHovered: {
    background: DefaultPalette.themeDarker,
  },
  rootExpandedHovered: {
    background: DefaultPalette.themeDarker,
  },
  rootPressedHovered: {
    background: DefaultPalette.themeDarker,
  },
  rootFocused: {
    background: DefaultPalette.themeDarker,
  },
  rootPressed: {
    background: DefaultPalette.themeDarker,
  },
};

const settingsIcon = {
  iconName: "Settings",
  className: "settingsIcon",
};

const overflowProps = {
  menuIconProps: settingsIcon,
  ariaLabel: "More commands",
  styles: styleBlue,
};

export const openOptionsPage = () => {
  openExtensionOptionsPage().catch((error) => {
    console.log("Could not open options page:", error);
    window.open(getExtensionUrl("options.html"));
  });
};

export const openDashboardPage = () => {
  openExtensionPage("dashboard.html").catch((error) => {
    console.log("Could not open dashboard page:", error);
    window.open(getExtensionUrl("dashboard.html"));
  });
};

const _overflowItems = [
  {
    key: "dashboard",
    text: "Open dashboard",
    onClick: () => openDashboardPage(),
    iconProps: { iconName: "OpenInNewTab" },
  },
  {
    key: "history",
    text: "View Graph calls",
    onClick: () => openOptionsPage(),
    iconProps: { iconName: "OpenInNewTab" },
  },
  {
    key: "divider1",
    itemType: ContextualMenuItemType.Divider,
  },
  {
    key: "feedback",
    text: "Feedback",
    onClick: () =>
      window.open("https://github.com/merill/graphxray/issues"),
    iconProps: { iconName: "Feedback" },
  },
];

export const CommandMenu = () => {
  return (
    <div>
      <CommandBar
        overflowItems={_overflowItems}
        overflowButtonProps={overflowProps}
        ariaLabel="Clear state and open settings window commands"
        styles={styleBlue}
      />
    </div>
  );
};
