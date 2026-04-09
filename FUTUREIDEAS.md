# Future Ideas

## Mozilla Signing And AMO Verification

The Firefox fork already generates an unsigned `.xpi` at `build/packages/graphxray-firefox-unsigned-v<version>.xpi`, but normal Firefox Release and Beta installs require a Mozilla-signed package.

### Planned procedure

1. Keep the privacy/disclosure text aligned with the shipped security model.
   - The manifest already declares `browser_specific_settings.gecko.data_collection_permissions`.
   - The repo already uses explicit in-extension consent plus optional permissions for higher-risk features.
2. Document the external data flow clearly.
   - The extension sends request data to the DevX snippet generation endpoint in `src/common/client.js`.
   - This needs matching privacy/disclosure text for AMO submission.
3. Prepare the AMO source submission package.
   - Include matching source code for the submitted build.
   - Include reproducible build instructions.
4. Create an AMO Developer Hub listing as `unlisted` / self-distributed.
5. Upload the unsigned `.xpi` and any required source package.
6. Resolve Mozilla review feedback if the submission is flagged for manual review.
7. Download the signed `.xpi`.
8. Publish the signed `.xpi` in GitHub Releases for manual Firefox installation.

### Notes

- Unsigned `.xpi` files are not enough for standard Firefox installation.
- Temporary local loading via `about:debugging#/runtime/this-firefox` remains the development path until signing is completed.
- If this fork is intended for broader distribution, add a dedicated privacy policy before AMO submission.

## Full SDK-Aware PowerShell Generator

The current local PowerShell fallback already emits `Invoke-MgGraphRequest` snippets with structured request bodies when DevX fails. That restores usability, but it is still transport-oriented rather than truly cmdlet-aware.

### Why this may be needed

- The DevX backend currently fails for PowerShell snippet generation.
- The current local fallback keeps the extension usable and now produces SDK-adjacent `Invoke-MgGraphRequest` snippets, but it still does not emit richer cmdlets such as `Get-Mg*`, `Update-Mg*`, or `New-Mg*`.
- If long-term PowerShell support should match the "knowledge level" of Graph Explorer snippets, a richer local generator is the next logical step.

### Possible implementation direction

1. Keep the current `Invoke-MgGraphRequest` fallback as the safe baseline.
2. Add a separate local PowerShell generator layer that understands:
   - Microsoft Graph metadata/OpenAPI
   - Graph PowerShell SDK naming conventions
   - OData path patterns, functions, actions, and query options
3. Map captured requests to a richer local model:
   - HTTP method
   - Graph path
   - path parameters
   - query parameters
   - request body
4. Generate one of these outputs depending on coverage:
   - preferred: Graph PowerShell SDK cmdlets
   - fallback: `Invoke-MgGraphRequest`
   - final fallback: raw request-oriented output only if a request cannot be mapped safely
5. Add diagnostics that identify which local generation strategy was used.

### Tradeoff

- This would improve PowerShell quality further and reduce dependency on DevX even more.
- It is substantially more complex than the current fallback and should be treated as a dedicated feature, not a small fix.
