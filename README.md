# Graph X-Ray Firefox

Firefox-only fork of [merill/graphxray](https://github.com/merill/graphxray).

Graph X-Ray helps Microsoft 365 administrators inspect Microsoft Graph and related admin API calls triggered by portal actions, review the request and response payloads, and export reusable evidence or snippets.

## What it does

- Captures Graph and selected admin API calls from Firefox DevTools.
- Shows requests, responses, and generated snippets in the DevTools panel or standalone dashboard.
- Renders PowerShell locally first with `Invoke-MgGraphRequest`.
- Supports optional external snippet generation for other languages when you explicitly enable it.
- Exports session scripts, per-entry request/response/snippet files, and diagnostic logs.

## Supported clouds

- `https://graph.microsoft.com/`
- `https://graph.microsoft.us/`
- `https://dod-graph.microsoft.us/`
- `https://microsoftgraph.chinacloudapi.cn/`

## Main security defaults

- Capture requires first-use consent.
- External snippet generation is disabled by default.
- Ultra X-Ray requires separate acknowledgement and optional host permissions.
- Export sanitization defaults to `redacted`.
- Session retention is time-bounded.
- `Memory only` mode disables persisted session storage.
- `Clear local cache` resets sensitive state back to safer defaults.

## Install

### Temporary Firefox load

1. Build the extension with `npm run build` or `npm start`.
2. Open `about:debugging#/runtime/this-firefox`.
3. Choose `Load Temporary Add-on`.
4. Select `manifest.json` from `build/firefox` or `dev/firefox`.

### Packaged artifact

Run `npm run package` to create:

- `build/packages/graphxray-firefox-v<version>.zip`
- `build/packages/graphxray-firefox-unsigned-v<version>.xpi`
- `build/packages/graphxray-firefox-source-v<version>.zip`

The `.xpi` is unsigned and intended for AMO self-distribution submission. Standard Firefox installation requires the Mozilla-signed `.xpi` returned after review. See [AMO_SUBMISSION.md](./AMO_SUBMISSION.md).

## Using Graph X-Ray

1. Open a supported Microsoft 365 admin portal such as Entra or Intune.
2. Open Firefox Developer Tools.
3. Open the `Network` tab once.
4. Switch to the `Graph X-Ray` panel.
5. Accept capture consent if prompted.
6. Perform the admin action you want to inspect.

Notes:

- Keep DevTools open while capturing.
- Use `Open dashboard` if you prefer reviewing the same session outside DevTools.
- Session entries are shown newest first in the UI.
- `Save script` stays chronological and deduplicated.
- `Pause capture` stops new entries without clearing the current session.

## Snippet behavior

- PowerShell is local-first and stays usable even when DevX fails.
- Python, C#, JavaScript, Go, Java, and Objective-C require external snippet generation when supported by DevX.
- `Local only` mode blocks external snippet generation.
- When external snippets are enabled, supported request payloads can be sent to the Microsoft Graph DevX snippet service.
- Firefox requests optional consent for website content and personally identifying information before enabling that transmission.

## Privacy and data handling

Graph X-Ray can handle sensitive Microsoft 365 administrative data.

- It may capture request bodies, response bodies, and generated snippets.
- `Memory only` keeps new captures out of persisted extension storage.
- Persisted session data expires automatically after the configured retention window.
- `Clear captured data when Firefox starts` purges persisted captured data on browser startup.
- `Diagnostic Mode` is off by default and its logs are purged when you turn it off.
- `graphxray-*` exports, legacy `GraphXRay*` exports, and `.har` files should not be committed to the repository.

Export modes:

- `raw`: exports captured content as-is
- `redacted`: masks sensitive values
- `summary`: exports metadata-only summaries

Graph X-Ray does not include an analytics SDK. The only intentional external data transfer path is optional DevX snippet generation.

See [PRIVACY.md](./PRIVACY.md) for the complete privacy disclosure.

## Firefox permissions model

- Required host permissions are limited to Microsoft Graph cloud endpoints.
- Ultra X-Ray and DevX use optional host permissions requested only when enabled.
- The Firefox manifest does not ship a content script.

## Developer workflow

### Prerequisites

- Node.js with npm

### Main commands

- `npm ci`
- `npm start`
- `npm run build`
- `npm run package`
- `npm test -- --watchAll=false --runInBand`
- `npm run check:security-posture`
- `npm audit --json --strict-ssl=false --cache .npm-cache`

### Output folders

- `dev/firefox`
- `build/firefox`
- `build/packages`

## Repository notes

- This repository is Firefox-only.
- The Firefox build no longer includes Chromium manifest support or a Firefox content script path.
- Release publication is manual. CI validates builds and security posture before packaging.

## Related project docs

- [SECURITY.md](./SECURITY.md)
- [SAFE_DEBUGGING.md](./SAFE_DEBUGGING.md)
- [PRIVACY.md](./PRIVACY.md)
- [AMO_SUBMISSION.md](./AMO_SUBMISSION.md)
- [AMO_REVIEWER_NOTES.md](./AMO_REVIEWER_NOTES.md)
- [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)
- [FUTUREIDEAS.md](./FUTUREIDEAS.md)

## Archived project docs

- [SECURITY_REMEDIATION_PLAN.md](./docs/archive/SECURITY_REMEDIATION_PLAN.md)
- [SECURITY_AUDIT_LIMITATIONS.md](./docs/archive/SECURITY_AUDIT_LIMITATIONS.md)
- [DEVX_TECHNICAL_REPORT.md](./docs/archive/DEVX_TECHNICAL_REPORT.md)

## Support

- Bugs and problems: [Issues](https://github.com/knbsilva/graphxray-firefox/issues)
- Questions and ideas: [Discussions](https://github.com/knbsilva/graphxray-firefox/discussions)
- Sensitive reports: see [SECURITY.md](./SECURITY.md)

## Acknowledgements

Based on the original project by [merill/graphxray](https://github.com/merill/graphxray).

## License

Licensed under the [GNU Affero General Public License v3.0](./LICENSE), matching the upstream project.
