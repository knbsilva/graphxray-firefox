# AMO Reviewer Notes

## Distribution

This submission is intended for Firefox desktop self-distribution (`On your own` / unlisted). It is not intended for Firefox for Android.

## Build environment used for version 1.0.6

- Windows 11
- Node.js 22.22.2
- npm 11.4.2

The project uses webpack and minification, so the matching source archive is supplied with every AMO submission.

## Reproducible build

From the root of the submitted source archive:

```powershell
npm ci
npm test -- --watchAll=false --runInBand
npm run check:security-posture
npm run build
```

The unpacked extension is generated in `build/firefox`. Its contents correspond to the files inside `graphxray-firefox-unsigned-v1.0.6.xpi`.

To generate all submission artifacts, including the source archive:

```powershell
npm run package
```

Generated artifacts:

- `build/packages/graphxray-firefox-unsigned-v1.0.6.xpi`
- `build/packages/graphxray-firefox-v1.0.6.zip`
- `build/packages/graphxray-firefox-source-v1.0.6.zip`

No proprietary or web-hosted build tools are required. Dependencies are installed only from the npm registry using the committed lockfile.

## Functional review

1. Install the add-on in Firefox desktop.
2. Open a Microsoft 365 admin portal and Firefox Developer Tools.
3. Open the Network panel once, then select the Graph X-Ray panel.
4. Accept the in-product capture disclosure.
5. Perform a Microsoft Graph-backed portal action.
6. Confirm the request, response, and local PowerShell snippet appear.

A Microsoft 365 administrative account is required to exercise real portal traffic. No reviewer credentials are included in the source package.

## Data handling

- Capture requires explicit in-product consent.
- External snippet generation is disabled by default.
- Enabling external snippets requests both the optional DevX host permission and Firefox optional data-collection permissions for `websiteContent` and `personallyIdentifyingInfo`.
- The DevX request contains the HTTP method, normalized Graph path/query, required reproduction headers, and request body when present.
- Captured response bodies, cookies, and Authorization bearer headers are not intentionally sent to DevX.
- There is no analytics or telemetry SDK.

See `PRIVACY.md` for the complete disclosure.

## Linter warnings

Any remaining `UNSAFE_VAR_ASSIGNMENT` warnings reported against minified bundles originate from released React/Fluent UI runtime dependencies. The authored files under `src` do not use `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `dangerouslySetInnerHTML`, `eval`, or the `Function` constructor.

The linter can also report that Firefox for Android introduced `data_collection_permissions` in version 142 while the desktop minimum is 140. This submission targets Firefox desktop only; Firefox desktop supports the built-in consent API from version 140.

## Third-party source references

See `THIRD_PARTY_NOTICES.md`. Exact installed versions are locked in `package-lock.json`.
