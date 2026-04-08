## Summary

- What changed:
- Why:

## Security Review Checklist

- [ ] Does this change capture any new data?
- [ ] Does this change persist any new data locally?
- [ ] Does this change transmit any new data externally?
- [ ] Does this change add or expand browser permissions or host permissions?
- [ ] Does this change touch request/response rendering, export, diagnostics, or clipboard flows?
- [ ] Did I avoid adding raw sensitive logging?
- [ ] Did I avoid committing captured exports such as `GraphXRay*` or `.har` files?

## Validation

- [ ] `npm run build`
- [ ] `npm run package` when packaging logic changed
- [ ] Manual Firefox validation when UI/capture behavior changed
