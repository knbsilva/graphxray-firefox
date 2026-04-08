# Security Remediation Plan

## Purpose

This document converts the current security audit of the Graph X-Ray Firefox fork into an implementation-ready remediation backlog.

- It is a planning artifact only.
- It does not imply any of the actions below are already implemented.
- The execution order is defined by the numbered items, not just by section position.

## Current Baseline

- Overall risk rating: **High**
- Primary reasons:
  - The extension captures and persists API request/response data from Microsoft 365 administrative workflows.
  - Request payloads can be sent to an external snippet-generation service.
    Current evidence indicates the DevX request includes method, path, headers needed for snippet generation, and request body payloads, but does not intentionally forward response bodies or `Authorization` headers.
  - Sensitive payloads are exposed in local storage, diagnostics, exports, and browser console logs.
  - The extension currently has broader browser reach than strictly necessary in some areas.

## Ordered Remediation Backlog By Risk Rating

### Critical

These items should be implemented first and treated as release blockers for any broader distribution.

1. Add an explicit privacy and data-handling model to the product.
   - Document exactly what is captured, persisted locally, exported, copied, and transmitted externally.
   - Cover request bodies, response bodies, diagnostics, snippets, request-body cache, and session storage.
   - Update README and any release/distribution documentation to avoid implying that the project "does not collect data" if that is not true in practice.

2. Make external DevX submission opt-in instead of implicit.
   - Add a user-facing setting for `Local only` vs `Allow external snippet generation`.
   - Default to the safest mode for first run.
   - Clearly explain that request payload content may be transmitted to the external DevX endpoint when enabled.
   - Be precise in the UI and docs: current evidence supports request-payload transmission, not response-body or auth-header forwarding.
   - Prevent external submission when the setting is disabled.

3. Introduce sensitive-data redaction before diagnostics and logging.
   - Remove or sanitize payload previews before they are written to diagnostic logs.
   - Redact likely secrets and identifiers:
     - bearer tokens
     - `Authorization` values
     - cookies/session identifiers
     - access tokens / refresh tokens
     - UPNs, emails, tenant identifiers, object IDs where practical
   - Apply the same redaction policy to request previews, response previews, and code previews.

4. Remove production `console.log` usage that can print sensitive content.
   - Eliminate logs that currently print request objects, bodies, response content, payloads, URLs with sensitive query values, and background cache entries.
   - Replace ad-hoc logging with a gated debug logger that is off by default.
   - Ensure the debug logger also uses the same redaction rules as diagnostics.

5. Reduce local retention of captured session data.
   - Stop persisting full session content indefinitely by default.
   - Introduce retention controls:
     - session TTL
     - auto-clear on browser/session close when feasible
     - optional memory-only mode
   - Apply retention to:
     - `graphxraySession`
     - diagnostic logs
     - per-entry request/response/snippet state

6. Add first-run warning/consent for high-sensitivity capture features.
   - Explain that the extension can capture and store administrative API data.
   - Explain that exports can contain tenant/user/admin data.
   - Separate baseline capture consent from optional external DevX submission consent if implemented as distinct controls.

7. Preserve a secure local-only operating mode.
   - Ensure the extension remains usable without DevX for sensitive environments.
   - Keep PowerShell local-first and available when external submission is disabled.
   - For languages that do not have a trustworthy local generator yet, fail closed with clear UX instead of silently transmitting data externally.
   - Reserve external snippet generation for explicit user choice.

### High

These items should follow immediately after the critical set and materially reduce attack surface and leakage risk.

8. Narrow content script scope.
   - Replace `http://*/*` and `https://*/*` content script matching with a targeted allowlist of supported admin portal origins.
   - If the content script is no longer essential for current Firefox-first behavior, remove it entirely.
   - Re-test any host/webview integration before finalizing removal.

9. Tighten host permissions to least privilege.
   - Review every host in the Firefox manifest and classify it as:
     - required
     - optional
     - legacy
     - experimental/Ultra X-Ray only
   - Remove unused or stale hosts.
   - Keep Ultra X-Ray hosts isolated and clearly labeled as optional/high-risk.

10. Replace substring-based domain checks with strict origin validation.
    - Stop using `url.includes(...)` for trusted-domain decisions.
    - Parse URLs with `new URL(...)` and compare `origin` against an allowlist.
    - Apply the same fix to:
      - standard capture allowlisting
      - Ultra X-Ray domain detection
      - any helper that derives host/path from captured URLs
    - Add regression tests for spoofed hosts such as:
      - `https://graph.microsoft.com.evil.example/...`
      - attacker-controlled URLs that embed allowed-domain strings in the path or query

11. Split standard capture from Ultra X-Ray privilege where feasible.
    - Avoid granting broad internal/admin API visibility to users who do not need it.
    - Prefer one of:
      - optional permission request flow
      - separate build flavor
      - explicit feature gate that also constrains host matching and capture logic

12. Add export sanitization options.
    - Allow exports with:
      - raw data
      - redacted data
      - metadata-only summaries
    - Apply this to:
      - request export
      - response export
      - diagnostic export
      - session export / `Save script` where relevant

13. Harden clipboard and export affordances.
    - Add visible warnings that copied/exported content may contain sensitive Microsoft 365 administrative data.
    - Add optional confirmation for response export and diagnostics export.
    - Mark generated files clearly as potentially sensitive.

14. Add explicit retention and clear-state controls to the UI.
    - Surface current storage/retention behavior in the dashboard/options.
    - Provide `Clear session and local cache` as a distinct action from `Clear session view`.
    - Ensure request-body correlation cache is also cleared when the user intends a full purge.

15. Add repository guardrails against accidental capture commits.
    - Expand `.gitignore` to cover likely local artifacts:
      - `GraphXRay*.json`
      - `GraphXRay*.ps1`
      - `GraphXRay*.py`
      - `GraphXRay*.txt`
      - `*.har`
      - capture/export folders if introduced
    - Add documentation that captured exports must never be committed.

16. Add secret scanning to the repository workflow.
    - Recommended minimum:
      - `git-secrets`
      - `trufflehog`
      - GitHub secret scanning / GitHub Advanced Security where available
    - Run both on the working tree and full git history.

17. Modernize high-risk dependency and build tooling.
    - Address the current `npm audit` posture, especially direct dependencies with critical/high severity.
    - Prioritize build chain modernization:
      - Babel/CRA/webpack toolchain
      - `webpack-dev-server`
      - `axios` if still unused
    - Remove unused dependencies before upgrading to reduce noise and attack surface.

### Medium

These items improve defense-in-depth, operational safety, and release hygiene.

18. Add a dedicated privacy/security section to README.
    - Describe:
      - what is captured
      - what is stored locally
      - what can be exported
      - what can be sent externally
      - how to clear or limit stored data

19. Add a `SECURITY.md` or equivalent security policy document.
    - Include reporting guidance.
    - Include supported versions/builds.
    - Include a statement about handling of captured admin data.

20. Add build-time artifact allowlisting.
    - Replace broad `public/` copy behavior with an explicit allowlist where practical.
    - Prevent arbitrary files dropped into `public/` from being packaged into releases accidentally.

21. Review GitHub Actions release workflow for safety.
    - Pin third-party actions by commit SHA where practical.
    - Prefer deterministic installs (`npm ci`) over `npm install` in CI.
    - Reassess whether mutating `main` from the workflow (`git commit` / `git push`) is necessary, or replace it with a safer release/versioning flow.
    - Ensure release assets are only built from intended directories.
    - Add validation that release archives do not include:
      - local exports
      - diagnostics
      - untracked capture artifacts
      - unexpected files from `public/`

22. Add dependency hygiene automation.
    - Enable Dependabot.
    - Add scheduled `npm audit` or equivalent dependency review.
    - Consider Snyk if the team already uses it.

23. Clean up sensitive historical/developer metadata leaks.
    - Remove or normalize machine-specific paths and developer-local references in config files.
    - Review docs and examples for real tenant/user data and replace with sanitized placeholders.

24. Add structured classification for data types in diagnostics and session objects.
    - Tag fields as:
      - sensitive
      - redacted
      - safe summary
    - This makes future export and privacy controls easier to maintain.

25. Add targeted tests for data leakage regressions.
    - Tests should verify:
      - secrets are redacted from diagnostics
      - canceling save dialogs does not write files unexpectedly
      - session retention/TTL behaves correctly
      - disabled external submission truly blocks DevX requests

### Low

These items are useful follow-ups once the primary leakage and privilege issues are addressed.

26. Add developer documentation for safe debugging.
    - Define how to troubleshoot without reintroducing raw payload logging.
    - Provide approved redacted logging patterns.

27. Add telemetry stance documentation.
    - Even if there is no analytics SDK, document that explicitly.
    - Distinguish analytics from external snippet-generation traffic.

28. Add internal review checklist for future features.
    - New feature PRs should answer:
      - does it capture new data?
      - does it persist new data?
      - does it transmit new data externally?
      - does it require more browser permissions?

29. Reassess whether Ultra X-Ray should remain part of the same extension package.
    - If its risk profile stays materially higher than standard Graph capture, consider isolating it.

## Execution Groups

### Group A — Immediate blockers

Implement in this exact order:

1. Privacy/data-handling disclosure
2. DevX opt-in
3. Diagnostic/log redaction
4. Remove sensitive console logging
5. Session retention/TTL
6. First-run consent/warning
7. Local-only secure mode validation

### Group B — Attack surface reduction

Implement after Group A:

8. Narrow content script scope
9. Tighten host permissions
10. Strict origin validation for trusted-domain checks
11. Separate standard vs Ultra X-Ray privilege
12. Export sanitization options
13. Clipboard/export warnings
14. Full clear-state controls

### Group C — Repo and supply-chain hardening

Implement after Group B:

15. `.gitignore` hardening
16. Secret scanning in repo/history
17. Dependency modernization
18. Privacy/security docs
19. `SECURITY.md`
20. Build artifact allowlisting
21. GitHub Actions safety checks
22. Dependabot / dependency automation

### Group D — Sustained governance

Implement after Groups A-C:

23. Historical/developer metadata cleanup
24. Data classification in session/diagnostics
25. Leakage regression tests
26. Safe debugging guide
27. Telemetry stance docs
28. Future feature review checklist
29. Ultra X-Ray packaging reassessment

## Validation Criteria

The remediation work should not be considered complete until all of the following are true:

- Sensitive request/response data is no longer logged raw to the browser console in production.
- The extension can be used in a mode that does not transmit captured payloads externally.
- DevX opt-in/off behavior is accurate and documented, including the fact that request payloads are the primary externally transmitted data based on current evidence.
- Local persistence of session data is bounded by TTL, mode, or both.
- Capture exports and diagnostics can be redacted or clearly marked as sensitive.
- Trusted Graph/Admin host validation is based on parsed URL origins, not substring matching.
- Content script scope and host permissions are limited to justified origins.
- The repository blocks or detects accidental commits of captures and secrets.
- Dependency and workflow risk are materially reduced and continuously monitored.

## Suggested Tooling

- `git-secrets`
- `trufflehog`
- GitHub Advanced Security / GitHub secret scanning
- Dependabot
- `npm audit`
- optional Snyk

## Notes

- This plan is based on the current Firefox fork architecture and current audit findings.
- It is intentionally conservative because the extension operates in a Microsoft 365 administrative context.
- If any remediation changes functionality, security should take precedence over convenience for defaults.
