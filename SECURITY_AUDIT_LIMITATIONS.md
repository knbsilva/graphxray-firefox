# Security Audit Limitations

This document tracks what could not be fully verified during the latest security review, so those gaps can be revisited later with the right access, tooling, or runtime setup.

It is intentionally separate from `SECURITY_REMEDIATION_PLAN.md`.

## 1. Remote GitHub State Was Not Fully Verifiable

Status after follow-up verification: **Partially resolved**

What has now been verified directly via GitHub CLI / GitHub API:

- Remote default branch is `main`.
- Local `main` and remote `origin/main` currently point to the same commit:
  - `0bdf82904232d3b0960985db2922314f7129727c`
- The repository currently has:
  - no published releases
  - no remote tags
  - one active workflow: `Build and Release`
  - no recorded workflow runs at the time of verification
  - no stored GitHub Actions artifacts
  - no environments configured
  - no repository rulesets configured
- Remote repository metadata now confirmed:
  - repository is public
  - branch `main` is not protected
  - GitHub secret scanning is enabled
  - GitHub secret scanning push protection is enabled
  - Dependabot security updates are disabled
  - Dependabot alerts are disabled
  - repository vulnerability alerts are disabled
  - GitHub code scanning default setup is not configured

What still remains unverified:

- Whether any release assets existed in the past and were later deleted.
- Whether historical artifacts outside current GitHub Releases were ever published elsewhere.
- Repository settings not exposed by the currently used API scopes or not yet queried, such as:
  - full branch protection/ruleset history
  - environment protections
  - required reviewers
  - any out-of-band security tooling not visible in repo files
- Whether remote security settings changed over time and were more permissive in the past.

These items are no longer open:

- The exact set of releases currently published on GitHub.
- The exact assets attached to each currently published release.
- Divergence between local `main` and current remote `main`.

Historical release-state questions remain open only insofar as deleted or previously published artifacts could have existed outside the current visible state.

Original concern:

- Whether any historical release asset still contains sensitive or outdated files.
- Repository settings that live outside the codebase, such as:
  - branch protection rules
  - secret scanning configuration
  - Dependabot settings if managed outside the repo
  - GitHub Advanced Security status
  - required reviewers / environment protections

What to do later:

- Review the repository directly on GitHub:
  - Releases
  - Tags
  - Actions
  - Security tab
  - Repository settings
- Compare published release assets against current packaging expectations.

## 2. Full Secret Scanning Across Git History Was Not Completed

Status after follow-up verification: **Mostly resolved**

What has now been verified:

- GitHub secret scanning is enabled for the repository.
- GitHub secret scanning push protection is enabled.
- The repository currently returns no secret-scanning alerts through the GitHub API.
- Targeted history inspection did not find versioned Graph X-Ray export artifacts such as:
  - `graphxray-*.json`
  - `graphxray-*.ps1`
  - `graphxray-*.py`
  - legacy `GraphXRay*.json`
  - legacy `GraphXRay*.ps1`
  - legacy `GraphXRay*.py`
  - `.har`
  - `captures/`
  - `exports/`
- Broader history-wide pattern scans across all reachable revisions did not confirm obvious hardcoded secrets.
- `git-secrets --scan-history` was executed locally against the full repository history with custom patterns for:
  - GitHub PATs
  - AWS access keys
  - long bearer-token strings
- The effective `git-secrets` hits observed in the history scan were limited to non-secret placeholders, primarily:
  - `Authorization = "Bearer $accessToken"` in generated snippet code
- Documentation references such as password-reset examples were also surfaced during broader grep passes, but no real credentials were confirmed.

What was done:

- Targeted `git grep` and history inspection for common secret patterns.
- Broader history-wide pattern scans across all reachable revisions for:
  - common credential/token formats
  - `Authorization`, `Cookie`, `Set-Cookie`, `client_secret`, `access_token`, `refresh_token`
  - filenames/paths suggestive of captures, exports, `.env`, `.pem`, `.key`, `.har`
- Installed `trufflehog` locally and attempted a full git-history scan against the public GitHub repository history.
- Installed `git-secrets` locally and completed `--scan-history`.

What was not completed:

- A second independent full-history scan with `trufflehog`
- GitHub Advanced Security beyond the currently exposed secret-scanning alert state

What blocked full closure:

- `trufflehog` was installed and could clone the repository into the local workspace, but in this Windows environment it exited with code `1` after the clone step without emitting findings or a conclusive scan error beyond setup/clone logging.

Local tooling availability check:

- `trufflehog`: installed locally for this follow-up pass, but full-history scan did not complete conclusively
- `git-secrets`: installed locally for this follow-up pass and `--scan-history` completed

Why this still matters:

- An additional independent scanner would still be useful to corroborate the already-clean `git-secrets` result.
- The current remote alert state still does not prove that no now-deleted remote state ever existed.

What to do later:

- Retry `trufflehog` against the full repository history in an environment where local git clone/scanner execution is known-good, or from a Linux/macOS runner if Windows continues to behave inconsistently.
- Re-run `git-secrets --scan-history` only if new history is added or if broader custom patterns are needed.
- If `trufflehog` later works cleanly, compare its output against the already-clean `git-secrets` pass.

## 3. Live Dependency Audit Could Not Be Reliably Revalidated

Status after follow-up verification: **Resolved**

What happened:

- A fresh `npm audit --json` attempt failed because of a local certificate-chain problem:
  - `self-signed certificate in certificate chain`

What was done later:

- `npm audit --json` was re-run successfully outside the sandbox.

What is now known:

- The dependency picture remains materially risky.
- The successful audit reported:
  - `13` critical
  - `46` high
  - `115` moderate
  - `10` low
  - `184` total vulnerabilities
- Notable direct package exposure confirmed in the fresh audit includes:
  - `axios`
  - `webpack`
  - `webpack-dev-server`
  - `workbox-webpack-plugin`
  - `@svgr/webpack`

What this no longer limits:

- The exact current advisory list for the current dependency tree.
- The ability to treat dependency risk as evidence-backed in the current state.

What to do later:

- Optionally refine this further with:
  - `npm audit --omit=dev`
  - Snyk
  - Dependabot alerts review

## 4. Dynamic Runtime Validation Was Only Partially Performed

Status after follow-up verification: **Partially resolved**

This review began as static and repository-based, but a limited Firefox runtime validation was completed afterward in an isolated temporary profile.

What has now been verified directly:

- The Firefox build completes successfully from the current source tree.
- `web-ext lint` validates the built Firefox package with:
  - `0` errors
  - `0` notices
  - `22` warnings
- The lint warnings currently observed are primarily:
  - missing `browser_specific_settings.gecko.data_collection_permissions`
  - `options_page` minimum-version compatibility warnings
  - icon size mismatch for `img/icon-48.png`
  - bundle-level `innerHTML` / `Function` constructor warnings
- Direct source searches in `src/`, `public/`, `config/`, and `scripts/` did not find matching `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `dangerouslySetInnerHTML`, or `Function(...)` patterns, which suggests the bundle-level warnings are coming from bundled dependencies/tooling rather than obvious first-party source sinks.
- A headed `web-ext run` session successfully launched Firefox with an isolated profile and installed the extension as a temporary add-on:
  - `graph-x-ray@graphxray.local`
- A headless `web-ext run` attempt did not complete successfully in this Windows environment because the remote debugger handshake kept failing.
- The isolated Firefox profile now provides direct evidence that the extension uses Firefox WebExtension IndexedDB-backed local storage:
  - the profile contains `moz-extension://...` IndexedDB databases named `webExtensions-storage-local`
  - one verified extension storage database contains the expected initialized keys from the codebase:
    - `contextSwitches`
    - `currentMetrics`
    - `isActive`
    - `requestBodiesCache`
    - `stack`

What this still does not prove:

- That a real captured Graph admin session writes sensitive request/response values into storage exactly as inferred from code.
- A packet-level confirmation of the exact DevX payload sent at runtime.
- A live spoofing test proving the `url.includes(...)` domain check issue end to end.
- Browser-console capture of sensitive logs in a real admin session.
- Real-world behavior of pause, retention, and export flows under incident-style usage.
- The `Clear captured data when Firefox starts` feature cannot be conclusively validated with the current temporary add-on workflow alone, because `runtime.onStartup` runs on browser startup, while a temporary add-on loaded manually through `about:debugging` is attached only after startup has already passed.

What blocked full closure:

- The headed runtime check was enough to validate installation and storage structure, but it did not include a sanitized tenant flow that generated representative captured requests and responses.
- Firefox stores extension local data in IndexedDB/SQLite form, not as simple plaintext files, so confirming actual persisted values requires either:
  - a live captured session and deeper structured-clone inspection, or
  - runtime extraction through the extension/browser context
- The headless `web-ext run` path remained unreliable on this Windows machine because of repeated remote debugger connection failures.
- The current manual validation path relies on temporary add-on loading. That is good enough for most interactive checks, but it is not a faithful way to validate startup-triggered behavior that depends on the extension already being installed when Firefox launches.

What to do later:

- Run controlled browser tests with a sanitized tenant or mock environment and generate representative captures.
- Capture DevX traffic using browser/network tooling during those tests.
- Inspect `browser.storage.local` after representative admin actions, either through runtime extraction or deeper SQLite/structured-clone inspection.
- Reproduce host-spoofing test cases in a safe environment.
- Re-test `Clear captured data when Firefox starts` using a persistently installed extension, not a temporary add-on reloaded manually after browser startup.

## 5. Remote Artifact Inspection Was Not Performed

Status after follow-up verification: **Partially resolved**

What has now been verified:

- There are currently no published GitHub Releases in the remote repository.
- There are currently no remote tags in the remote repository.

What remains unverified:

- Whether releases/assets existed in the past and were deleted before this verification.
- Any non-GitHub distribution channel or external artifact hosting.

What to do later:

- If releases are created in the future:
  - download published `.zip` / `.xpi` artifacts
  - unpack and diff them against current build/package output
  - verify no captures, diagnostics, or accidental public assets are present
- If historical publication becomes relevant, inspect deleted release/tag history through GitHub UI, audit logs, or maintainer records.

## 6. Release/Tag Divergence Beyond the Local Clone Is Not Fully Proven

Status after follow-up verification: **Mostly resolved**

What is known locally:

- Local `main` and `origin/main` currently point to the same commit in this clone.
- Local tags only go up to the tags fetched into this repository.

What is now additionally known from remote verification:

- Remote `origin/main` points to `0bdf82904232d3b0960985db2922314f7129727c`.
- The remote repository currently exposes no tags.
- The remote repository currently exposes no releases.

What is still not fully proven:

- Whether the remote GitHub repository has releases, artifacts, or state not represented in the local clone metadata alone.

What to do later:

- Cross-check GitHub tags and releases directly in the remote repository UI or API.

## 7. No Claims Were Made About AMO / Firefox Signing State

What was intentionally not verified:

- Mozilla AMO submission state
- signing status of any `.xpi`
- review findings from Mozilla

Why:

- The project is not currently being prepared for public AMO distribution in this phase.

What to do later if needed:

- Review AMO package requirements and submission records separately from the code audit.

## 8. No Automated Abuse Simulation Was Run

What was not simulated:

- Malicious insider using exports/diagnostics for exfiltration at scale
- Compromised dependency manipulating release output
- Host-page or webview message abuse beyond static reasoning

What to do later:

- Add tabletop threat-model exercises.
- Add targeted abuse-case tests for:
  - mass export
  - diagnostic redaction bypass attempts
  - spoofed trusted-domain URLs
  - malicious batch payloads

## 9. Current Status of These Limitations

These limitations do **not** invalidate the main findings already supported directly by code and workflow evidence.

Several gaps were reduced in the follow-up pass, especially around:

- current remote GitHub state
- current release/tag presence
- current secret-scanning status in GitHub
- current Dependabot / vulnerability-alert / code-scanning configuration state
- Firefox package build/lint validation
- Firefox temporary-install runtime validation and extension storage structure

They mainly still affect:

- precision of remote-state conclusions
- independent confirmation of historical secret verification beyond the completed `git-secrets` pass, targeted history grep, and GitHub secret-scanning checks
- live exploit confirmation in Firefox runtime with real captured data

## Suggested Next Verification Pass

When revisiting this later, prioritize in this order:

1. Live runtime validation in Firefox with sanitized admin traffic
2. A conclusive `trufflehog` run in a compatible environment
3. Historical release/artifact verification if releases are ever created or if deleted artifacts become relevant
