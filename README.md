# Graph X-Ray Firefox

Firefox-focused fork of [merill/graphxray](https://github.com/merill/graphxray), adapted to run as a Firefox DevTools extension and to ship Firefox-specific build artifacts.

Unlock the power of automation and learning in the Microsoft 365 ecosystem. Graph X-Ray is a developer tool that demystifies the Microsoft admin portals by revealing the exact Microsoft Graph API calls being made in the background as you work.

Stop spending hours digging through documentation to figure out how to automate a task. Simply perform the action in the portal, and Graph X-Ray will provide you with the corresponding, ready-to-use script. It's the ultimate "learn by doing" tool for Microsoft Graph.

![Demo of opening Graph X-Ray panel](./public/img/tutorial/graphxraydemo.gif)

## Key Features

- **API Call Inspection**: Capture and inspect all Microsoft Graph API requests (GET, POST, PATCH, DELETE) and their full responses directly within your browser's developer tools.

- **Instant Script Generation**: Automatically convert recorded API calls into functional code snippets.

- **Multi-Language Support**: Generate scripts in the most popular languages for M365 automation, including:

  - Microsoft Graph PowerShell
  - Python
  - C#
  - JavaScript
  - Go
  - Java
  - Objective-C

- **Accelerate Automation**: Go from a manual, repetitive task in the UI to a fully automated script in seconds.

## Who is this for?

- **Microsoft 365 Administrators** wanting to automate user management, policy configuration, and reporting.

- **DevOps Engineers** building CI/CD pipelines for Microsoft 365 and Azure environments.

- **Developers** creating applications that integrate with Microsoft Graph.

- **IT Consultants & Support Professionals** who need to quickly script solutions for clients.

Supercharge your Microsoft 365 workflow in Firefox and turn your clicks into code.

## Install

### Manual Install

To manually install the Firefox fork, download the latest release from the [GitHub Releases page](https://github.com/knbsilva/graphxray-firefox/releases) and follow the Firefox instructions below.

- Firefox local testing:
  - Download or build the Firefox output, then use `about:debugging#/runtime/this-firefox`.
  - Click `Load Temporary Add-on`.
  - Select the `manifest.json` from the unpacked Firefox build folder.
- Firefox signed install:
  - A normal Firefox release requires a signed `.xpi`.
  - The generated `graphxray-firefox-unsigned-*.xpi` is intended for signing/upload workflows, not direct installation in standard Firefox.

### Firefox Development Load

For Firefox local testing, use a temporary add-on:

- Build or prepare the Firefox output.
- Open `about:debugging#/runtime/this-firefox`.
- Click `Load Temporary Add-on`.
- Select the generated `manifest.json` from `build/firefox` or `dev/firefox`.

If you want to install a `.xpi` directly in normal Firefox releases, it must be signed. Temporary loading from `manifest.json` is the supported local development flow.

## Supported Microsoft Graph Endpoints

The extension detects and generates code snippets for Microsoft Graph calls across:

- **graph.microsoft.com** (Public cloud)
- **graph.microsoft.us** (US Government cloud - GCC High)
- **dod-graph.microsoft.us** (US Department of Defense)
- **microsoftgraph.chinacloudapi.cn** (China cloud)

## Supported Microsoft Admin Portal Environments

The extension works with any web page that makes Graph API calls. We've primarily tested with

- Microsoft Entra
- Microsoft Intune

If there are admin portals where you are not seeing Graph X-Ray work as expected, please open an [issue](https://github.com/knbsilva/graphxray-firefox/issues), even better, submit a pull request by following the steps in [Adding non-Graph API calls to Ultra X-Ray](#adding-non-graph-api-calls-to-ultra-x-ray).

## Using Graph X-Ray

### Viewing the Graph call stack trace

To view Graph calls in real-time:

- Browse to the **Microsoft admin portal (Entra, Intune...)**
- Open **Developer Tools**
- If you are using **Firefox**, open the **Network** tab once first
- Open the **Graph X-Ray panel** in Developer Tools
- Make changes in the portal to record and view the corresponding Graph API calls and PowerShell commands

![Demo of opening Graph X-Ray panel](./public/img/tutorial/graphxraydemo.gif)

### Step by step guide

#### Open Developer Tools

##### Using the keyboard

- Press **F12** on Windows
- Press **Cmd+Opt+I** on macOS

##### Using the menu

- Open the Firefox application menu from the top right.
- Select **More tools**.
- Select **Web Developer Tools**.

![Screenshot of selecting Developer Tools in Firefox](./public/img/tutorial/Tutorial-1.png)

#### Open the Graph X-Ray panel

Expand the tabs in Developer Tools and select the Graph X-Ray panel.

If you are using Firefox, open the **Network** tab once before switching to **Graph X-Ray**. Firefox only starts sending the DevTools network events after the Network tool has been activated.

If you don't see the Graph X-Ray panel you may need to restart your browser.

![Screenshot of opening Graph X-Ray pane](./public/img/tutorial/Tutorial-2.png)

#### View Graph call stack trace

Make changes in the Azure Portal to view the corresponding Graph API calls and PowerShell commands for the action (e.g. edit a user's profile information and click Save).

Scroll down in the Graph X-Ray panel to view the new stack trace.

![Screenshot of viewing graph changes](./public/img/tutorial/Tutorial-3.png)

## Developer Guide

### Pre-requisites

- Install [Node.js](https://nodejs.org/) (which includes npm)
- Run `npm install` to install dependencies

### Build the extension

`npm start` to compile and debug

To prepare the Firefox development build, run `npm start`, open `about:debugging#/runtime/this-firefox`, choose `Load Temporary Add-on`, and select the `manifest.json` from `./dev/firefox`.

### Production build

Production builds are automatically created in GitHub with the right version number.

If you want to create a production build of the extension on your desktop, run `npm run build`.

The Firefox build artifacts will be placed in `build/firefox`.

### Packaged artifacts

Use the packaging scripts when you need releasable files instead of just unpacked folders:

- `npm run package` builds Firefox and creates:
  - `build/packages/graphxray-firefox-v<version>.zip`
  - `build/packages/graphxray-firefox-unsigned-v<version>.xpi`

The Firefox `.xpi` is unsigned. Use the unpacked Firefox build for `about:debugging`, or submit the unsigned `.xpi` to the Mozilla signing flow before normal installation.

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.\
You will also see any lint errors in the console.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

## Adding non-Graph API calls to Ultra X-Ray

Ultra X-Ray shows calls to non-Graph API endpoints. Unfortunately, we need to explicitly add each endpoint to the extension.

To add support for a new endpoint.

1. **Figure out the API endpoint** - View the network requests in the browser's developer tools and find out the domain where the API is hosted.
1. **Add domain to [domains.js](./src/common/domains.js)** - Add the new domain to the list of domains in the `domains.js` file.
1. **Add domain to the Firefox manifest** - Update [manifest.firefox.json](./public/manifest.firefox.json). Note the manifest requires the / at the end of the domain.
1. **Test the endpoint** - Make a request to the new blade and verify that it appears in Graph X-Ray.

## Feedback and Support

This is an independently developed application and is not endorsed or supported by Microsoft.

Please share feedback and report issues on [GitHub](https://github.com/knbsilva/graphxray-firefox/issues).

## Acknowledgements

This fork is based on the original project by [merill/graphxray](https://github.com/merill/graphxray).

This project was originally a hackathon project by [Eunice](https://twitter.com/Eunixnho), Dhruv, Clement, [Monica](https://twitter.com/mumbihere)  & [@merill](https://twitter.com/merill).
