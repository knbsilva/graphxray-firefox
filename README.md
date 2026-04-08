# Graph X-Ray Firefox

Firefox-focused fork of [merill/graphxray](https://github.com/merill/graphxray), adapted to run as a Firefox DevTools extension and to ship Firefox-specific build artifacts.

Graph X-Ray helps you understand what Microsoft 365 admin portals are doing in the background by capturing the Microsoft Graph and related API calls triggered by your actions.

Use it to inspect requests and responses, generate snippets, export evidence, and move faster from portal interaction to repeatable automation.

## Key Features

- **API Call Inspection**: Capture and inspect all Microsoft Graph API requests (GET, POST, PATCH, DELETE) and their full responses directly within your browser's developer tools.

- **Snippet Generation**: Convert recorded API calls into code snippets, with PowerShell rendered locally first and external DevX snippet generation available only when you explicitly enable it.

- **Standalone Dashboard**: Review the active captured session in a separate extension page instead of staying inside the Web Developer Tools panel.

- **Diagnostics and Export**: Save the full session, structured logs, individual snippets, and individual responses for troubleshooting and reuse.

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

Use Firefox to turn captured admin actions into something you can inspect, export, and automate.

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

If there are admin portals where you are not seeing Graph X-Ray work as expected, please report the problem in [GitHub Issues](https://github.com/knbsilva/graphxray-firefox/issues). If you want to contribute support for additional endpoints, see [Adding non-Graph API calls to Ultra X-Ray](#adding-non-graph-api-calls-to-ultra-x-ray).

## Using Graph X-Ray

### Viewing the Graph call stack trace

To view Graph calls in real-time:

- Browse to the **Microsoft admin portal (Entra, Intune...)**
- Open **Developer Tools**
- If you are using **Firefox**, open the **Network** tab once first
- Open the **Graph X-Ray panel** in Developer Tools
- Make changes in the portal to record and view the corresponding Graph API calls and PowerShell commands
- Optional: use **Open dashboard** to review the captured session in a separate extension page without staying inside Developer Tools

Notes:

- Graph X-Ray currently depends on Firefox DevTools network capture. Keep Developer Tools open while capturing.
- External snippet generation is opt-in. Local only mode prevents request payloads from being sent to the Microsoft Graph DevX snippet service.
- Snippet generation quality depends on endpoint coverage in the Microsoft Graph snippet service when external snippets are enabled.
- For PowerShell, this fork renders a local `Invoke-MgGraphRequest` snippet immediately and only upgrades it if DevX later returns a valid snippet.
- Session entries are shown newest first in the UI, while `Save script` keeps the captured session export in chronological order.
- `Pause capture` stops new entries from being appended without clearing the current session.
- Per-entry `Save request` is only shown when the request actually has a body.
- If you cancel the Firefox save dialog, Graph X-Ray should not fall back to the browser's default download folder.

### Step by step guide

#### Open Developer Tools

- Press **F12** in Firefox, or open the Firefox application menu from the top right, choose **More tools**, and then **Web Developer Tools**.

#### Open the Graph X-Ray panel

Expand the tabs in Developer Tools and select the Graph X-Ray panel.

If you are using Firefox, open the **Network** tab once before switching to **Graph X-Ray**. Firefox only starts sending the DevTools network events after the Network tool has been activated.

If you don't see the Graph X-Ray panel you may need to restart your browser.

#### View Graph call stack trace

Make changes in the Azure Portal to view the corresponding Graph API calls and PowerShell commands for the action (e.g. edit a user's profile information and click Save).

Scroll down in the Graph X-Ray panel to view the new stack trace.

You can also click **Open dashboard** from the Graph X-Ray panel or extension popup to review the same captured session in a standalone page.

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

Builds the Firefox development output into `dev/firefox`.

After running it, open `about:debugging#/runtime/this-firefox`, choose `Load Temporary Add-on`, and select the generated `manifest.json` from `dev/firefox`.

The development build refreshes as you edit files, and build/lint errors are shown in the terminal.

### `npm run build`

Builds the Firefox production output into `build/firefox`.

This is the folder you should use for temporary loading in Firefox when you want to validate a production-style build locally.

## Snippet Behavior

- External snippet generation is disabled by default. Enable it from the Graph X-Ray options page if you want to allow request payloads to be sent to the DevX snippet service.
- C#, JavaScript, Java, Go, Python, and Objective-C require the external Microsoft Graph snippet service when the endpoint is supported.
- PowerShell is rendered locally first as an `Invoke-MgGraphRequest` snippet, then optionally upgraded if DevX is enabled and returns a valid server-side snippet.
- PowerShell fallback snippets preserve the original captured URL, structure JSON bodies into a readable `$params` block when possible, and carry `ConsistencyLevel: eventual` for matching `GET` requests.

## Privacy and Data Handling

- Graph X-Ray can capture sensitive Microsoft 365 administrative request bodies, response bodies, and generated snippets.
- Diagnostic exports can contain redacted troubleshooting data, but should still be treated as sensitive.
- In `Local only` mode, Graph X-Ray does not submit captured request payloads to the external DevX snippet service.
- If you enable external snippets, request payload content for supported languages can be sent to the DevX endpoint for snippet generation.

## Session Controls

- `Save script` exports the deduplicated generated snippets for the current session.
- `Save logs` exports the diagnostic session when Diagnostic Mode is enabled.
- `Pause capture` / `Resume capture` controls whether new requests are appended while keeping the current session available for review and export.
- Individual entries can export:
  - `Request` when a request body exists
  - `Response` when response content exists
  - `Snippet` when generated code exists

## Adding non-Graph API calls to Ultra X-Ray

Ultra X-Ray shows calls to non-Graph API endpoints. Unfortunately, we need to explicitly add each endpoint to the extension.

To add support for a new endpoint.

1. **Figure out the API endpoint** - View the network requests in the browser's developer tools and find out the domain where the API is hosted.
1. **Add domain to [domains.js](./src/common/domains.js)** - Add the new domain to the list of domains in the `domains.js` file.
1. **Add domain to the Firefox manifest** - Update [manifest.firefox.json](./public/manifest.firefox.json). Note the manifest requires the / at the end of the domain.
1. **Test the endpoint** - Make a request to the new blade and verify that it appears in Graph X-Ray.

## Feedback and Support

This is an independently developed application and is not endorsed or supported by Microsoft.

- Report bugs and problems in [GitHub Issues](https://github.com/knbsilva/graphxray-firefox/issues).
- Use [GitHub Discussions](https://github.com/knbsilva/graphxray-firefox/discussions) for ideas, questions, and general discussion.

## Acknowledgements

This fork is based on the original project by [merill/graphxray](https://github.com/merill/graphxray).

This project was originally a hackathon project by [Eunice](https://twitter.com/Eunixnho), Dhruv, Clement, [Monica](https://twitter.com/mumbihere)  & [@merill](https://twitter.com/merill).
