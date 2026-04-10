# Changelog

## Unreleased

- Fixed the external snippet permission flow so Firefox optional permission prompts are requested before persistence side effects can break the original user gesture.
- Added direct `External snippets` and `Ultra X-Ray` toggles to the standalone dashboard and to the options page.
- Persisted `Ultra X-Ray` mode in extension storage for more reliable cross-page synchronization and permission reconciliation.
- Moved `Save request` to an always-visible request summary row instead of hiding it behind the expanded request block.
- Added live storage synchronization to the guide/options page so toggle and cache-reset state changes reflect immediately.
- Clarified how to enable `Memory only` mode in the guide/options page.
- Standardized export file names across entry, session, and diagnostic artifacts to use a clearer `graphxray-{scope}-{artifact}-...-{mode}-{timestamp}` convention.

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

### Security Hardening Continuation

- Added `Clear captured data when Firefox starts` so the persisted session snapshot and request-body cache can be purged automatically on browser startup.
- Replaced the old Firefox `webpack-dev-server` flow with direct `webpack.watch` output into `dev/firefox`.
- Removed unused legacy build-chain packages tied to the previous dev-server/SASS/SVG pipeline.
- Simplified the Firefox CSS pipeline by removing the legacy PostCSS/CSS minification chain and upgrading `css-loader` out of the vulnerable `4.x` range.
- Removed unused Yarn Plug'n'Play integration from the Firefox build configuration and toolchain dependencies.
- Removed legacy Jest watch/typeahead and direct resolve dependencies that were no longer needed by the Firefox fork's test runner.
- Removed the obsolete `react-app-polyfill/jsdom` test setup dependency from the Jest configuration.
- Upgraded the Jest stack from `26.x` to `29.x`, including explicit `jest-environment-jsdom`, to reduce the remaining development-time audit backlog without changing runtime behavior.

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
- Added a shared export sanitization mode (`raw`, `redacted`, `summary`) in the options page and synchronized it across DevTools and the standalone dashboard.
- Applied export sanitization to request, response, snippet, script, and diagnostic exports, with `redacted` as the secure default.
- Rejected untrusted runtime message senders and hardened host/webview message parsing so malformed or spoofed payloads are ignored instead of being processed directly.
- Added package-time validation to block suspicious capture artifacts such as `GraphXRay*` exports, `.har` files, or local capture folders from entering Firefox release bundles.
- Replaced the developer-local Jest runner path with a repo-relative path to remove machine-specific metadata from `package.json`.
- Added an explicit first-enable acknowledgement flow for Ultra X-Ray and a persistent warning banner while the higher-risk mode is enabled.
- Added a telemetry stance to the docs, a safe debugging guide, and a pull-request security checklist to reduce future regression risk.
- Changed GitHub Actions so push/PR runs are validation-only and release publication is a manual workflow dispatch instead of an automatic mutation of `main`.
- Added a production dependency audit script and a scheduled/manual GitHub Actions workflow that uploads an `npm audit` report artifact without silently ignoring dependency drift.
- Aligned per-entry clipboard actions and `Copy script` with the selected export sanitization mode so raw request, response, and snippet content is no longer copied by default when sanitization is enabled.
- Declared Firefox `data_collection_permissions` metadata so the manifest reflects that external data transfer is optional and tied to external snippet generation rather than implicit telemetry.
- Pinned the current GitHub Actions used in build/release and dependency-audit workflows to immutable commit SHAs.
- Wired the new unit/security test suite into the main GitHub Actions validation and release workflows.
- Added a dedicated TruffleHog secret-scanning workflow for verified secrets on push, pull request, schedule, and manual runs.
- Made persisted session retention configurable from the options page and surfaced the active retention window in the standalone dashboard.
- Added an opt-in `Memory only` persistence mode that keeps new captures out of persisted extension storage and clears the stored session snapshot when the mode is enabled.
- Surfaced the current persistence mode and retention window directly in the DevTools security/status area.
- Stopped producing `contentScript.bundle.js` in Firefox builds now that the Firefox manifest no longer injects a content script.
- Removed unused direct dependencies (`axios`, `react-csv`, `react-markdown`, `react-scroll-to-bottom`, `uuid`, `web-vitals`, `@fluentui/react-icons-mdl2-branded`) from the Firefox fork.
- Added tests that assert `Local only` blocks DevX for non-local languages while keeping PowerShell local.
- Added a separate first-enable acknowledgement for external snippet generation so DevX submission is not enabled silently.
- Aligned `Memory only` mode with the request-body correlation cache so persisted request-body entries are cleared and no longer written while persistence is disabled.
- Updated the background request-body capture path to respect capture consent, pause state, and Ultra X-Ray mode instead of only filtering after interception.
- Scoped Firefox `webRequest` request-body interception to the currently active domain set, disabling the listener entirely when capture is blocked and excluding Ultra X-Ray hosts while Ultra mode is off.
- Hardened `Clear local cache` so it also resets external snippets, diagnostic mode, Ultra X-Ray, and related acknowledgements back to safe defaults instead of leaving risky controls enabled after a purge.
- Moved the DevX endpoint and Ultra X-Ray admin hosts out of required Firefox host permissions and into optional host permissions requested only when those features are enabled.
- Added permission-gated toggles for `Allow external snippet generation` and `Ultra X-Ray`, and made `Clear local cache` remove those optional permissions again.
- Added reconciliation on load so Graph X-Ray disables `Ultra X-Ray` or external snippets if their optional Firefox host permissions were revoked outside the extension UI.
- Changed the release workflow to publish exactly the validated package artifacts from the build job instead of rebuilding during release publication.
- Reduced GitHub Actions default write scope by leaving `contents: write` only on the manual release job.
- Reduced the runtime dependency surface so the Firefox package keeps only UI/runtime libraries in `dependencies`, while CRA/webpack/jest/eslint tooling now lives in `devDependencies`.
- Removed unused direct packages `prompts` and `prism-react-renderer` from the Firefox fork dependency graph.
- Added an explicit `check:security-posture` validator for the Firefox manifest and package dependency boundaries, and wired it into packaging and CI.
- Hardened the dependency-audit workflow so it installs with `--ignore-scripts`, always uploads the JSON report, and now fails explicitly when production-critical or production-high vulnerabilities remain.
- Tightened diagnostic-session handling so disabling `Diagnostic Mode` purges the active diagnostic log set instead of leaving previously captured logs persisted in the session snapshot.
- Added regression tests for secure download behavior so canceling the Firefox save dialog no longer regresses into an automatic anchor-based fallback download.
- Upgraded `react-syntax-highlighter` and switched `CodeView` to the explicit highlight.js entrypoint, removing the remaining moderate production audit findings tied to `prismjs` / `refractor`.
- Added structured `dataClassification` metadata to summary exports and diagnostic entries so redacted vs summary-safe artifacts are explicitly labeled in the exported JSON.
- Tightened the production dependency-audit gate again so CI now fails on `moderate` runtime vulnerabilities too, not just `high` and `critical`.
- Added a `Clear captured data when Firefox starts` control that clears the persisted session snapshot and request-body correlation cache on browser startup without wiping the safer preference defaults.
- Replaced the Firefox development server flow with direct `webpack.watch` output into `dev/firefox`, removing `webpack-dev-server`, `write-file-webpack-plugin`, and `workbox-webpack-plugin` from the Firefox fork toolchain.
- Removed the unused SASS and SVG-component loader chain from the Firefox fork, cutting `@svgr/webpack`, `babel-plugin-named-asset-import`, `resolve-url-loader`, and `sass-loader`.
- Upgraded selected build-chain packages (`react-dev-utils`, `@babel/core`, `babel-preset-react-app`, `semver`) and adapted the webpack config to the newer helper surface without changing Firefox runtime behavior.
- Migrated the Firefox build fully onto the webpack `5.x` / `terser-webpack-plugin 5.x` asset pipeline, replacing legacy `file-loader` and `url-loader` usage with webpack asset modules.
- Upgraded the remaining Jest toolchain from `29.x` to `30.x`, aligned the explicit `jest-circus` runner path, and kept the Firefox test suite green after the upgrade.
- Added targeted dependency overrides plus non-breaking audit fixes so the Firefox fork now validates with `npm audit` at `0` known vulnerabilities in the current lockfile.
- Removed the last dead `webpack-dev-server` and `contentScript` entry wiring from the Firefox webpack config so the build graph now matches the shipped Firefox-only package layout.
- Removed the unused Chromium manifest and the no-op content script source from the Firefox fork.
- Simplified the browser-target helpers and build/path scripts so they now describe Firefox-only behavior directly.
- Rewrote the README to match the current Firefox-only architecture, security defaults, and developer workflow.
