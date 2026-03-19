# DevX Technical Report

## Scope

This document records the technical findings from the Firefox fork investigation around DevX snippet generation failures observed on March 18, 2026.

## Executive Summary

The Graph X-Ray Firefox fork is functioning correctly in the following areas:

- DevTools panel loads in Firefox.
- Graph requests are captured and rendered.
- Request and response payloads are displayed.
- Diagnostic logs are generated and exported.
- `Save script` exports a PowerShell session file.
- Local PowerShell fallback snippets are generated when DevX fails.

The remaining problem is upstream of the extension:

- The DevX snippet service currently fails for PowerShell snippet generation, including a minimal `GET /v1.0/me` request.
- Some Microsoft Graph beta/Intune routes are also absent from the DevX/OpenAPI coverage across languages.

## What Works

### Firefox Extension Runtime

- The Firefox build loads as a temporary add-on.
- The `Graph X-Ray` tab appears in Firefox DevTools.
- Captured requests are processed and shown in the session stack.
- The panel can generate a code block via local fallback when DevX fails.

### Diagnostics

- Diagnostic mode captures the request lifecycle end to end.
- Diagnostic exports prove whether code came from DevX or from local fallback.
- `Save script` now exports:
  - non-empty files
  - PowerShell-safe URLs using single-quoted strings
  - original captured URLs for OData/function-style endpoints
  - deduplicated blocks for repeated identical requests

## What Does Not Work

### DevX PowerShell Snippet Generation

Direct tests against the DevX service show that PowerShell snippet generation is currently broken even for a simple supported route:

- `GET /v1.0/me` with `lang=powershell` -> `500`
- `GET /v1.0/me` with `lang=powershell&generation=openapi` -> `500`

At the same time, the same minimal request succeeds for other languages:

- `lang=csharp` -> `200`
- `lang=javascript` -> `200`
- `lang=java` -> `200`
- `lang=go&generation=openapi` -> `200`
- `lang=python&generation=openapi` -> `200`

Conclusion:

- The current PowerShell failure is not caused by Firefox.
- The current PowerShell failure is not caused by Graph X-Ray request capture.
- The current PowerShell failure is not caused by the recent fallback/export changes.
- The current PowerShell failure is an upstream DevX service issue.

### Missing DevX/OpenAPI Coverage for Some Routes

Some routes fail across languages, not just in PowerShell. These appear to be missing from the DevX/OpenAPI coverage rather than being Firefox-specific:

- `GET /beta/deviceManagement/settings` -> `404` in Python/OpenAPI
- `GET /beta/deviceManagement/getEffectivePermissions(scope='*')` -> `404` in Python/OpenAPI
- `GET /beta/deviceManagement/retrieveProjectFlightingStatuses(projectNames=null)` -> `404` in Python/OpenAPI

Other Intune routes do succeed in non-PowerShell generators:

- `GET /beta/deviceManagement/managedDevices` -> `200` in Python/OpenAPI
- `GET /beta/deviceManagement/remoteAssistanceSettings` -> `200` in Python/OpenAPI
- `GET /beta/deviceManagement/remoteAssistancePartners` -> `200` in Python/OpenAPI

Conclusion:

- There are two separate upstream problems:
  - a broad PowerShell generator failure
  - incomplete OpenAPI coverage for some beta/Intune endpoints

## Evidence Summary

### Firefox Diagnostic Exports

Observed across multiple diagnostic exports generated during Firefox testing:

Key repeated pattern:

- `devx_request_failed` for PowerShell requests
- `devx_request_succeeded` count remained `0` in the tested PowerShell sessions
- `fallback_snippet_generated` occurred for all usable PowerShell snippets

### Direct DevX Service Tests

Confirmed by direct HTTPS calls from the local environment on March 18, 2026:

- PowerShell failed for `GET /v1.0/me`
- Python, Go, JavaScript, Java, and C# succeeded for `GET /v1.0/me`
- Some specific beta/Intune routes returned `404` even in Python/OpenAPI

### External/Public Signals

- A public article from Petri published on September 8, 2025 describes Graph Explorer PowerShell snippets as an active feature and explicitly notes that coverage varies by API, especially for non-GET operations.
- The historically referenced public repository `microsoftgraph/microsoft-graph-devx-api` is no longer publicly accessible as of March 18, 2026; direct GitHub access returns `404`.
- Cached GitHub search results still describe that repository as the backend REST API used by Graph Explorer, PowerShell SDK, and OpenAPI descriptions, which suggests the service likely still exists but is no longer public.

## Root Cause Assessment

### Primary Root Cause

The PowerShell snippet generator behind DevX is currently failing upstream.

Confidence: high

Reason:

- Reproduced outside the extension
- Reproduced on a minimal supported Graph route
- Other languages still work against the same endpoint

### Secondary Root Cause

Some beta/Intune endpoints are not present in the DevX/OpenAPI path resolution catalog.

Confidence: high

Reason:

- Reproduced outside the extension
- Reproduced in Python/OpenAPI, which removes Firefox and PowerShell from the equation

## Repository Assessment

### `microsoftgraph/microsoft-graph-devx-api`

This appears to be the historically correct upstream service repository, but it is not publicly accessible now.

Why:

- Cached GitHub results describe it as the backend REST API for Graph Explorer, PowerShell SDK, and OpenAPI descriptions.
- Those cached results explicitly mention the snippet generator endpoint and the OpenAPI resources used by Graph Explorer and PowerShell SDK.
- Direct GitHub access to the repository currently returns `404`.

Conclusion:

- The service behavior still points strongly to this backend or its internal successor.
- However, a public GitHub issue in this repository is not currently possible unless Microsoft restores public access.

### `microsoftgraph/microsoft-graph-devx-content`

This is public and active, but it does not appear to be the right primary repository for the PowerShell runtime generator failure.

Why:

- Its public README describes it as content used by the DevX API to enhance clients and tooling.
- Its README explicitly calls out content such as permissions and samples.
- The public repo structure is content-oriented:
  - `permissions`
  - `sample-queries`
  - `messages`
  - `ge-tour`

Inference:

- `microsoft-graph-devx-content` may influence sample queries, permissions, and related content-driven experiences.
- It is unlikely to contain the runtime snippet generation logic that is currently failing for PowerShell on `GET /v1.0/me`.
- It may still be tangentially relevant to content-driven gaps, but the observed PowerShell regression points much more strongly to the non-public DevX API service/backend.

### Unofficial Copies or Mirrors

An unofficial copy such as `ehtick/microsoft-graph-devx-api` should not be treated as the current source of truth for the live DevX backend.

Why:

- The production DevX endpoint is still active, which means Microsoft is still running a service behind it.
- The historical public repository is no longer publicly accessible, so there is no public way to verify whether an unofficial copy matches the service currently deployed by Microsoft.
- The observed runtime behavior on March 18, 2026 reflects the live Microsoft-hosted backend, not a community mirror.

Conclusion:

- An unofficial copy may still be useful for historical inspection or architectural clues.
- It should not be treated as authoritative for current troubleshooting, correctness, or fix validation.

## Recommended Upstream Actions

1. Treat `microsoftgraph/microsoft-graph-devx-api` as the likely historical backend, but do not assume a public GitHub issue can be filed there today.
2. Use the prepared issue draft as a report body for whichever Microsoft-owned channel is currently available.
3. Keep the minimal repro centered on `GET /v1.0/me`.
4. Mention that other languages succeed while PowerShell fails.
5. Treat route coverage gaps as a separate problem from the PowerShell generator regression.
6. If Microsoft confirms a content-only issue, then consider `microsoft-graph-devx-content` only for paths such as:
   - `deviceManagement/settings`
   - `deviceManagement/getEffectivePermissions(scope='*')`
   - `deviceManagement/retrieveProjectFlightingStatuses(projectNames=null)`

## Current Local Mitigation

The Firefox fork now uses a local PowerShell fallback when DevX fails, which restores usability for:

- on-screen snippet rendering
- copy script
- save script

This mitigation is appropriate to keep the extension usable until the upstream DevX issue is resolved.
