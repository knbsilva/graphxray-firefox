# Graph X-Ray Privacy Notice

Last updated: August 21, 2026.

Graph X-Ray is a Firefox developer-tools extension for inspecting Microsoft Graph and selected Microsoft administrative API traffic. It is intended for private administrative use and can process sensitive organizational data.

## Data processed locally

After the user accepts capture consent, Graph X-Ray can process request URLs, request bodies, response bodies, generated snippets, and diagnostic metadata from supported API calls. This data is displayed in the extension and may be retained in Firefox extension storage according to the configured retention mode.

The default export mode is `redacted`. Users can explicitly choose raw or metadata-only summary exports. Exported files are written only after a user action.

Graph X-Ray does not include analytics, advertising, tracking pixels, or telemetry SDKs.

## Optional external snippet generation

External snippet generation is disabled by default. If the user explicitly enables it and grants Firefox's optional permissions, Graph X-Ray sends the following data over HTTPS to the Microsoft Graph DevX snippet service hosted at `devxapi-func-prod-eastus.azurewebsites.net`:

- HTTP method;
- normalized Microsoft Graph request path and query;
- selected request headers needed to reproduce the request, such as `ConsistencyLevel`;
- request body, when present.

Graph X-Ray does not intentionally send captured response bodies, cookies, or `Authorization` bearer headers to DevX. Request content can nevertheless contain website content and personally identifying information, which is why Firefox requests explicit optional data-collection consent before this feature is enabled.

The DevX response is used only to display a generated code snippet. Disabling external snippet generation removes the optional DevX host and data-collection permissions.

## Local retention and deletion

- `Memory only` prevents new captured sessions from being persisted for later recovery.
- Persisted sessions expire after the selected retention period.
- `Clear local cache` removes captured session data, request-body correlation data, diagnostics, consent state, and optional feature settings.
- `Clear captured data when Firefox starts` removes persisted captured data when the installed extension receives the Firefox startup event.

## User control

Capture, external snippets, Ultra X-Ray, diagnostics, persistence, retention, and export sanitization are controlled in the extension UI. The extension remains usable for local PowerShell generation without enabling external snippet generation.

## Contact

Report privacy or security concerns through the repository security process:
https://github.com/knbsilva/graphxray-firefox/blob/main/SECURITY.md
