# Future Ideas

## Mozilla Signing And AMO Verification

The Firefox fork already generates an unsigned `.xpi` at `build/packages/graphxray-firefox-unsigned-v<version>.xpi`, but normal Firefox Release and Beta installs require a Mozilla-signed package.

### Planned procedure

1. Review the Firefox manifest and add `browser_specific_settings.gecko.data_collection_permissions`.
2. Decide the Firefox support strategy:
   - Require Firefox `140.0+` and use the built-in Firefox data consent flow.
   - Or keep support for older Firefox versions and implement an in-extension consent flow.
3. Document the external data flow clearly.
   - The extension sends request data to the DevX snippet generation endpoint in `src/common/client.js`.
   - This needs matching privacy/disclosure text for AMO submission.
4. Prepare the AMO source submission package.
   - Include matching source code for the submitted build.
   - Include reproducible build instructions.
5. Create an AMO Developer Hub listing as `unlisted` / self-distributed.
6. Upload the unsigned `.xpi` and any required source package.
7. Resolve Mozilla review feedback if the submission is flagged for manual review.
8. Download the signed `.xpi`.
9. Publish the signed `.xpi` in GitHub Releases for manual Firefox installation.

### Notes

- Unsigned `.xpi` files are not enough for standard Firefox installation.
- Temporary local loading via `about:debugging#/runtime/this-firefox` remains the development path until signing is completed.
- If this fork is intended for broader distribution, add a dedicated privacy policy before AMO submission.
