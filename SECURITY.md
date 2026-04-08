# Security Policy

## Reporting a Vulnerability

If you believe you found a security issue in this repository, please do **not**
open a public GitHub issue with sensitive details.

Use GitHub repository security advisories or contact the maintainer privately if
that channel is available.

When reporting, include:

- affected version or commit
- clear reproduction steps
- expected vs actual behavior
- whether sensitive Microsoft 365 request/response data is involved
- whether the issue requires a privileged browser/admin context

## Supported Scope

This Firefox fork should be treated as a high-sensitivity admin tool because it
can capture Microsoft 365 administrative API requests, responses, and generated
snippets.

Please assume the following are security-relevant:

- request/response capture
- export and clipboard flows
- diagnostics and local persistence
- external snippet-generation behavior
- manifest permissions and host permissions
- build, packaging, and release automation

## Sensitive Data Handling

Do not include live secrets, tokens, cookies, tenant identifiers, or raw admin
captures in public reports. Redact payloads before sharing examples.

## Telemetry And External Traffic

This project does not embed an analytics SDK or usage telemetry pipeline.

However, the extension can still make external requests when the user
explicitly enables external snippet generation. In that mode, supported request
payloads can be sent to the Microsoft Graph DevX snippet service so the
extension can obtain a server-generated snippet.

Treat that traffic as sensitive operational data handling, not as analytics.

## Safe Debugging Expectations

- Do not reintroduce raw `console.log` statements for request bodies, response
  bodies, tokens, cookies, or administrative payloads.
- Prefer existing redacted diagnostics and security helpers.
- If you need temporary debugging, keep it redacted and remove it before merge.

## Release Hygiene

- Continuous integration should validate builds and packaged artifacts on push
  and pull request events.
- Release publication should remain a deliberate manual step.
- Avoid workflows that auto-commit back to `main` or publish artifacts from
  unreviewed changes.
