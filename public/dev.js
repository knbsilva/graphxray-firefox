const devtoolsApi =
  typeof browser !== "undefined" ? browser.devtools : chrome.devtools;

const panelTitle = "Graph X-Ray";
const panelIconPath = "/img/icon-16.png";
const panelPagePath = "/devtools.html";

if (typeof browser !== "undefined") {
  browser.devtools.panels
    .create(panelTitle, panelIconPath, panelPagePath)
    .then((panel) => {
      console.log("Graph X-Ray panel created:", panel);
    })
    .catch((error) => {
      console.error("Could not create Graph X-Ray panel:", error);
    });
} else {
  devtoolsApi.panels.create(
    panelTitle,
    panelIconPath,
    panelPagePath,
    function (panel) {
      console.log("Graph X-Ray panel created:", panel);
    }
  );
}
