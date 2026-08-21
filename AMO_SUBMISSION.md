# Private Mozilla Add-on Submission

Use this checklist to submit Graph X-Ray for private self-distribution through addons.mozilla.org (AMO).

## Artifacts

Run:

```powershell
npm ci
npm run package
```

Upload these files:

- Add-on: `build/packages/graphxray-firefox-unsigned-v1.0.6.xpi`
- Source code: `build/packages/graphxray-firefox-source-v1.0.6.zip`

Keep `graphxray-firefox-v1.0.6.zip` only as an equivalent unsigned archive for local inspection.

## AMO flow

1. Open the AMO Developer Hub and choose **Submit a New Add-on**.
2. Choose **On your own** to create an unlisted/self-distributed submission.
3. Upload the unsigned `.xpi` and select Firefox desktop only.
4. Confirm that source code is required and upload the matching source ZIP.
5. Copy the relevant content from `AMO_REVIEWER_NOTES.md` into **Notes for Reviewers**.
6. Use `PRIVACY.md` as the privacy disclosure. The public repository URL is:
   `https://github.com/knbsilva/graphxray-firefox/blob/main/PRIVACY.md`
7. Declare optional transmission of website content and personally identifying information for external DevX snippet generation.
8. Submit for signing and review.
9. After approval, download the Mozilla-signed `.xpi`. Distribute only that signed file to normal Firefox Release or ESR installations.

## Important

- Do not upload the source ZIP as the installable add-on.
- Do not distribute the unsigned `.xpi` as a normal-install package.
- Keep the add-on ID `graph-x-ray@graphxray.local` unchanged after the first accepted submission, because Firefox uses it as the update identity.
- Increment the version in `package.json` for every later AMO upload; `npm run package` synchronizes the Firefox manifest.
