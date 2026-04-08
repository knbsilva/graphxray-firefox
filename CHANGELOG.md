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

### Standalone Dashboard

- Added a second extension UI at `dashboard.html` so captured sessions can be reviewed outside the Web Developer Tools panel.
- Kept the current DevTools flow as the primary capture source and mirrored its session state into shared extension storage.
- Added shared session helpers for script export, diagnostic export, and snippet language metadata.
- Added storage-based session synchronization so the standalone dashboard and DevTools panel stay aligned without replacing the existing panel behavior.
- Added `Open dashboard` entry points from the DevTools command bar, popup, and command menu.
- Added a searchable standalone dashboard UI with session summary, request list, detailed request view, and the existing `Save script`/`Save logs`/`Clear session` actions.

### Dashboard And Guide Refinements

- Added collapsible snippet sections to both the DevTools panel and the standalone dashboard so generated code can be expanded only when needed.
- Added HTTP method filtering in the standalone dashboard for `GET`, `POST`, `PATCH`, `PUT`, and `DELETE`.
- Reworked the built-in usage guide to be Firefox-only and text-only, removing screenshots, GIFs, and references to non-Firefox browsers.
- Updated repository links so feedback goes to the Firefox fork and README support guidance distinguishes between Issues for bugs and Discussions for general conversation.

### Session Export And Internal API Labels

- Added per-entry export actions for generated snippets and captured responses.
- Added visual labels for Ultra X-Ray internal API calls in the session UI where the request domain can be identified as an internal endpoint.
- Tightened the README so it reflects the actual Firefox workflow, standalone dashboard behavior, and current snippet-generation limitations more accurately.

### Upstream PowerShell And Domain Imports

- Replaced the local PowerShell fallback style with `Invoke-MgGraphRequest` so fallback snippets are closer to the Microsoft Graph PowerShell SDK model used upstream.
- Added structured PowerShell body generation that converts JSON request payloads into readable `$params` blocks and keeps a raw-body fallback when parsing is not possible.
- Propagated `ConsistencyLevel: eventual` into both DevX requests and local PowerShell fallback snippets for matching `GET` requests and batch subrequests.
- Added the upstream `admin.powerplatform.microsoft.com` and `admin.cloud.microsoft` Ultra X-Ray domains to the centralized domain list and Firefox host permissions.
- Fixed request-body cache correlation so `GET` requests no longer inherit bodies from nearby `PATCH` or `POST` calls to the same URL.
- Switched PowerShell snippet rendering to a local-first flow so DevTools shows a local `Invoke-MgGraphRequest` snippet immediately and only upgrades it if DevX returns a valid snippet later.
- Added explicit diagnostic events for local PowerShell rendering, DevX upgrade attempts, successful upgrades, and cases where the local snippet is kept after DevX failure.
- Reduced request-body diagnostic noise by skipping missing-body warnings for methods that normally do not send payloads.
- Moved the per-entry snippet download action into the snippet collapse header so it remains visible even when the snippet body is still collapsed.
- Added visible snippet-source badges (`Local snippet`, `Local fallback`, `DevX snippet`) so the UI makes the current origin of each snippet explicit.
- Reworked per-entry export file naming to include method, host, route context, and a stable short hash, reducing ambiguity between similar endpoints.
- Added per-entry `Save request` actions for entries that include a request body.
- Fixed Firefox save-dialog cancellation so canceling an export no longer falls back to the browser's default download folder.
- Switched the visible session order in DevTools and the standalone dashboard to newest-first while preserving chronological session exports.
- Added a shared `Pause capture` / `Resume capture` command so DevTools and dashboard can stop or resume appending new entries without clearing the current session.
- Added capture status UI and matching diagnostics for pause/resume and skipped captures while paused.

### Security Phase 1

- Added a shared security helper for redacting tokens, cookies, emails, GUIDs, and common credential fields before diagnostics or debug logging.
- Switched diagnostic previews and diagnostic entry details to store redacted values instead of raw request/response snippets.
- Removed or downgraded raw runtime `console.log` usage across DevTools, background capture, request/response rendering, and host messaging paths.
- Added an explicit `Allow external snippet generation` setting with a secure default of `Local only`.
- Blocked external DevX submission when local-only mode is active and made non-local languages fail closed instead of silently sending payloads.
- Surfaced the external-snippet mode in the Firefox options page, DevTools panel, dashboard summary, and README.
- Replaced substring-based trusted-domain checks with strict `URL.origin` validation to prevent spoofed hosts from matching trusted Microsoft domains.

### Security Phase 2

- Removed the Firefox content script from the production manifest because the current Firefox capture flow does not require page-wide injection.
- Removed unused Firefox host permissions for `portal.azure.com` and `portal.azure.us`.
- Added repository guardrails in `.gitignore` for Graph X-Ray exports and `.har` captures.
- Added `SECURITY.md` with a basic private-reporting and sensitive-data handling policy.
- Added `Clear local cache` so DevTools and the dashboard can purge the current session plus local request-body cache and legacy capture state.
- Added confirmation prompts for request, response, and diagnostic log exports because those files can contain sensitive administrative data.
- Added visible sensitive-data labels on request and response panels before individual exports.
- Added a default local session retention TTL of roughly 60 minutes and purge-on-read behavior for expired persisted sessions.

### Security Phase 3

- Added explicit first-use consent storage and UI so Graph X-Ray blocks new captures until the user acknowledges that sensitive Microsoft 365 API data can be stored and exported locally.
- Propagated the capture-consent state across the options page, DevTools panel, standalone dashboard, and persisted session snapshot.
- Reset the persisted consent acknowledgement as part of `Clear local cache` so capture does not silently restart after a local purge.
- Hardened the GitHub Actions workflow with explicit `contents: write` permissions, concurrency control, and `npm ci` for deterministic dependency installation.
- Added a basic `Dependabot` configuration for npm packages and GitHub Actions updates.
- Switched public-asset packaging from broad folder copy to an explicit allowlist of required extension pages and icons.
