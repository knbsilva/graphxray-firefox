# Safe Debugging Guide

Use this project as if every captured request or response might contain
sensitive Microsoft 365 administrative data.

## Approved Debugging Patterns

- Prefer the structured diagnostic flow instead of ad-hoc console logging.
- Keep debug logging disabled by default.
- Use the redaction helpers in `src/common/security.js` before printing or
  exporting any dynamic value.
- When you need an example payload in docs or comments, replace tenant-specific
  values with placeholders.

## Avoid

- Logging raw request bodies.
- Logging raw response bodies.
- Logging `Authorization`, `Cookie`, or token values.
- Checking captured exports into the repository.
- Adding sample captures under `public/`, `src/`, or the repo root.

## Before Opening A PR

- Remove temporary debug statements.
- Clear local captures and exports created during testing.
- Confirm no `GraphXRay*` files or `.har` files are staged.
- Re-run the normal build/package commands used by the repo.
