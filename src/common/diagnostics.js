export const DIAGNOSTIC_MODE_STORAGE_KEY = "graphxrayDiagnosticMode";
export const DIAGNOSTIC_LOG_MESSAGE_TYPE = "DIAGNOSTIC_LOG";
export const MAX_DIAGNOSTIC_LOG_ENTRIES = 500;
export const DIAGNOSTIC_PREVIEW_LIMIT = 2000;

const stringifyDiagnosticValue = (value) => {
  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch (error) {
    return String(value);
  }
};

export const createDiagnosticPreview = (
  value,
  limit = DIAGNOSTIC_PREVIEW_LIMIT
) => {
  if (value === undefined || value === null) {
    return value;
  }

  const text = stringifyDiagnosticValue(value);
  if (text.length <= limit) {
    return text;
  }

  return `${text.slice(0, limit)}... [truncated ${text.length - limit} chars]`;
};

export const buildDiagnosticEntry = ({
  source = "unknown",
  event,
  level = "info",
  details = {},
}) => ({
  timestamp: new Date().toISOString(),
  source,
  event,
  level,
  details,
});
