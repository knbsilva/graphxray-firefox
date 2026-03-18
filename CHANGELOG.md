# Changelog

## 2026-03-18

### Phase 1

- Split the manifest strategy by browser target.
- Added `public/manifest.firefox.json` and `public/manifest.chromium.json`.
- Updated the build pipeline to emit a dedicated Firefox output in `build/firefox`.
- Added target-aware path resolution and public asset copying.

### Phase 2

- Added `src/common/extensionApi.js` to normalize extension APIs across browsers.
- Replaced several direct `chrome.*` calls with compatibility helpers.
- Updated DevTools, background, content script, storage, tabs, popup, and options flows to use the shared extension API layer.

### Phase 3

- Adapted the background flow for Firefox lifecycle behavior.
- Persisted request body correlation data in `storage.local` to survive background suspension.
- Normalized runtime message listeners and message responses for Firefox compatibility.

### Phase 4

- Fixed Firefox DevTools panel creation.
- Adjusted HAR response and request body extraction to support both callback and Promise-based browser APIs.
- Improved request-body correlation to reduce mismatches for repeated or batch requests.
- Validated that the Graph X-Ray panel appears in Firefox and captures Graph entries after the Network tool is opened once.

### Phase 5

- Added Firefox-specific guidance in the UI and README.
- Documented the requirement to open the Firefox Network tab once before using Graph X-Ray.
- Updated options and in-app messaging for Firefox local loading.

### Phase 6

- Added packaging automation for Firefox and Chromium builds.
- Created packaged artifacts in `build/packages`.
- Updated the GitHub Actions workflow to work with split manifests and packaged release assets.

### Firefox-Only Fork Adjustments

- Reoriented the repository defaults toward Firefox.
- Simplified release and packaging guidance for the Firefox fork.
- Updated documentation links to the new fork target.
- Added `FUTUREIDEAS.md` to track the postponed AMO signing and verification flow.

### Post-Fork Fixes

- Added Firefox permission coverage for the external DevX snippet generation endpoint.
- Added Firefox `downloads` permission and switched script saving to the WebExtensions downloads API with anchor fallback.
- Fixed exported script assembly so saved files include generated batch snippets when present.
- Prevented empty save/copy operations when no generated code is available yet.
- Fixed DevX snippet handling so generated code is awaited and stored as text instead of a pending Promise.
- Added a structured Diagnostic Mode with `Save logs` for Firefox troubleshooting.
- Added diagnostic logging for DevTools, background request-body capture, DevX snippet generation, and export operations.
- Normalized Graph request URLs before sending them to DevX to avoid double-encoded query strings.
- Normalized OData-style path segments such as `manageddevices('id')` before snippet generation requests.
- Fixed request-body lookup URL generation so absolute Graph URLs are no longer prefixed with invalid fallback domains.
- Added a local PowerShell fallback snippet when DevX fails, so Firefox can still show and save a usable script.
- Added a visible UI warning when snippet generation fails and no code is available for a request.
- Fixed saved PowerShell fallback snippets to preserve the original Graph URL safely using PowerShell single-quoted strings, avoiding `$filter`/`$select` interpolation issues.
- Changed fallback generation to keep the original captured Graph URL for saved PowerShell snippets, while still using the normalized URL only for DevX attempts.
- Deduplicated repeated snippet blocks in `Save script` output so identical captured calls are only exported once.
