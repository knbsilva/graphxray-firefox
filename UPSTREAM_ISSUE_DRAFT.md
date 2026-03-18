# Upstream Issue Draft

## Title

PowerShell snippet generation fails with 500 for minimal requests while other languages succeed

## Intended Target

Historically this issue would belong in `microsoftgraph/microsoft-graph-devx-api`.

Note:

- As of March 18, 2026, the public GitHub URL for that repository returns `404`.
- This draft should therefore be treated as the issue body to use in whichever Microsoft-owned support or engineering channel is currently available.

## Summary

The DevX snippet endpoint is currently failing for PowerShell generation even on a minimal supported Microsoft Graph request, while the same request succeeds for other languages.

This was reproduced on March 18, 2026 from a local Firefox-based extension workflow and then confirmed with direct HTTPS requests outside the extension.

## Repro

### Endpoint

`POST https://devxapi-func-prod-eastus.azurewebsites.net/api/graphexplorersnippets?lang=powershell&generation=openapi`

### Headers

`Content-Type: application/http`

### Body

```http
GET /v1.0/me HTTP/1.1
Host: graph.microsoft.com
Content-Type: application/json

```

## Actual Result

Status:

```text
500
```

Response body:

```json
{
  "StatusCode": 500,
  "Message": "Response status code does not indicate success: 404 (Not Found)."
}
```

## Expected Result

A valid PowerShell snippet should be returned for a minimal supported Graph request such as `GET /v1.0/me`.

## Comparison With Other Languages

Using the same request payload:

- `lang=csharp` -> `200`
- `lang=javascript` -> `200`
- `lang=java` -> `200`
- `lang=go&generation=openapi` -> `200`
- `lang=python&generation=openapi` -> `200`
- `lang=powershell` -> `500`
- `lang=powershell&generation=openapi` -> `500`

This suggests the issue is specific to the PowerShell generator path, not to the request payload format in general.

## Additional Notes

I also observed that some beta/Intune endpoints appear to be absent from DevX/OpenAPI coverage across languages, for example:

- `GET /beta/deviceManagement/settings`
- `GET /beta/deviceManagement/getEffectivePermissions(scope='*')`
- `GET /beta/deviceManagement/retrieveProjectFlightingStatuses(projectNames=null)`

However, that seems to be a separate coverage problem. The main bug reported here is that PowerShell currently fails even for a simple supported route like `/v1.0/me`.

## Impact

This breaks PowerShell snippet generation for clients that depend on DevX, even when request capture and payload formatting are otherwise correct.

## Environment

- Reproduced on March 18, 2026
- Reproduced from a Firefox-based Graph X-Ray extension workflow
- Reproduced again with direct HTTPS calls outside the extension

## Suggested Investigation

- Verify whether the PowerShell snippet generator backend is currently resolving `/v1.0/me` correctly.
- Compare the PowerShell generation pipeline with Python/Go/C#/JavaScript for the same payload.
- Check whether the PowerShell generator is resolving through a separate OpenAPI or SDK mapping path that is currently returning `404`.
