# Future Ideas

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

## Startup-Clear Fallback For Temporary Add-On / Manual Reload Scenarios

The current `Clear captured data when Firefox starts` behavior relies on `runtime.onStartup`, which is the right browser lifecycle hook for a persistently installed extension. That does not cover the temporary add-on workflow used in local development, because the extension is often reloaded manually after Firefox has already started.

### Why this may be needed

- Local/manual validation can show the previous session still present even though startup clear is enabled.
- In that workflow, the extension is attached after browser startup, so the existing `runtime.onStartup` hook may never run for that extension load.
- This creates a mismatch between development testing and how the feature would behave for a normally installed extension.

### Possible implementation direction

1. Keep `runtime.onStartup` as the primary and correct mechanism for installed-extension behavior.
2. Add a secondary startup-session marker check when the background initializes:
   - store a browser-session marker or last-seen startup epoch
   - compare it against the current runtime initialization
   - if startup clear is enabled and the browser session changed, clear captured data
3. Apply the fallback only to captured-session data:
   - persisted session snapshot
   - request-body correlation cache
   - optional diagnostic residue if still present
4. Preserve safe/user-choice state:
   - capture consent
   - export mode
   - optional-permission acknowledgements
   - snippet settings
5. Add diagnostics that show which path cleared the data:
   - `startup_clear_runtime_onstartup`
   - `startup_clear_background_fallback`

### Tradeoff

- This would make the feature easier to validate during development and more resilient to lifecycle quirks.
- It adds state and lifecycle complexity, so it should only be implemented if the current `runtime.onStartup` behavior proves too limiting in practice.
