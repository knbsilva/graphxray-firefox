const DEBUG_LOGGING_STORAGE_KEY = "graphxrayDebugLogging";
const EXPORT_SANITIZATION_MODES = ["raw", "redacted", "summary"];
const DEFAULT_EXPORT_SANITIZATION_MODE = "redacted";
const EXPORT_DATA_CLASSIFICATIONS = {
  raw: {
    level: "sensitive",
    handling: "raw",
  },
  redacted: {
    level: "sensitive",
    handling: "redacted",
  },
  summary: {
    level: "summary-safe",
    handling: "summary",
  },
};

const REDACTION_PATTERNS = [
  {
    pattern: /Bearer\s+[A-Za-z0-9._~+/-]+=*/gi,
    replacement: "Bearer [REDACTED]",
  },
  {
    pattern:
      /((?:Authorization|authorization)["']?\s*[:=]\s*["']?(?:Bearer\s+)?)["']?[^"',\r\n}]+/g,
    replacement: "$1[REDACTED]",
  },
  {
    pattern: /((?:Cookie|Set-Cookie)\s*:\s*)[^\r\n]+/gi,
    replacement: "$1[REDACTED]",
  },
  {
    pattern:
      /("?(?:access_token|refresh_token|id_token|client_secret)"?\s*:\s*")[^"]+(")/gi,
    replacement: '$1[REDACTED]$2',
  },
  {
    pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
    replacement: "[REDACTED_EMAIL]",
  },
  {
    pattern:
      /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi,
    replacement: "[REDACTED_GUID]",
  },
];

const redactSensitiveText = (value = "") => {
  let sanitized = String(value);
  REDACTION_PATTERNS.forEach(({ pattern, replacement }) => {
    sanitized = sanitized.replace(pattern, replacement);
  });
  return sanitized;
};

const SENSITIVE_VALUE_KEYS = new Set([
  "access_token",
  "refresh_token",
  "id_token",
  "client_secret",
  "authorization",
  "cookie",
  "set-cookie",
]);

const isSensitiveObjectKey = (key = "") =>
  SENSITIVE_VALUE_KEYS.has(String(key).trim().toLowerCase());

const normalizeExportSanitizationMode = (value) =>
  EXPORT_SANITIZATION_MODES.includes(value)
    ? value
    : DEFAULT_EXPORT_SANITIZATION_MODE;

const getExportDataClassification = (
  mode = DEFAULT_EXPORT_SANITIZATION_MODE,
  kind = "export-artifact"
) => {
  const normalizedMode = normalizeExportSanitizationMode(mode);
  return {
    kind,
    ...EXPORT_DATA_CLASSIFICATIONS[normalizedMode],
  };
};

const tryParseJsonContent = (content) => {
  if (typeof content !== "string") {
    return {
      ok: false,
    };
  }

  try {
    return {
      ok: true,
      value: JSON.parse(content.trim()),
    };
  } catch (error) {
    return {
      ok: false,
    };
  }
};

const buildExportArtifact = ({
  rawContent = "",
  mode = DEFAULT_EXPORT_SANITIZATION_MODE,
  summary = {},
  rawExtension = "txt",
  rawMimeType = "text/plain",
}) => {
  const normalizedMode = normalizeExportSanitizationMode(mode);

  if (normalizedMode === "summary") {
    return {
      content: JSON.stringify(
        redactSensitiveValue({
          generatedAt: new Date().toISOString(),
          exportMode: normalizedMode,
          dataClassification:
            summary.dataClassification ||
            getExportDataClassification(normalizedMode, summary.kind),
          ...summary,
        }),
        null,
        2
      ),
      extension: "json",
      mimeType: "application/json",
      dataClassification: getExportDataClassification(normalizedMode, summary.kind),
    };
  }

  if (normalizedMode === "redacted") {
    const parsed = tryParseJsonContent(rawContent);
    return {
      content: parsed.ok
        ? JSON.stringify(redactSensitiveValue(parsed.value), null, 2)
        : redactSensitiveText(rawContent),
      extension: parsed.ok ? "json" : rawExtension,
      mimeType: parsed.ok ? "application/json" : rawMimeType,
      dataClassification: getExportDataClassification(normalizedMode),
    };
  }

  return {
    content: rawContent,
    extension: rawExtension,
    mimeType: rawMimeType,
    dataClassification: getExportDataClassification(normalizedMode),
  };
};

const redactSensitiveValue = (value, depth = 0) => {
  if (depth > 5 || value === null || value === undefined) {
    return value;
  }

  if (typeof value === "string") {
    return redactSensitiveText(value);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => redactSensitiveValue(entry, depth + 1));
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactSensitiveText(value.message || String(value)),
    };
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => [
        key,
        isSensitiveObjectKey(key)
          ? "[REDACTED]"
          : redactSensitiveValue(entryValue, depth + 1),
      ])
    );
  }

  return redactSensitiveText(String(value));
};

const isDebugLoggingEnabled = () => {
  if (typeof process !== "undefined" && process.env.NODE_ENV !== "production") {
    return true;
  }

  if (typeof localStorage !== "undefined") {
    return localStorage.getItem(DEBUG_LOGGING_STORAGE_KEY) === "true";
  }

  return false;
};

const sanitizeLogArgs = (args) => args.map((entry) => redactSensitiveValue(entry));

const debugLog = (...args) => {
  if (!isDebugLoggingEnabled()) {
    return;
  }

  console.log(...sanitizeLogArgs(args));
};

const warnLog = (...args) => {
  console.warn(...sanitizeLogArgs(args));
};

const errorLog = (...args) => {
  console.error(...sanitizeLogArgs(args));
};

export {
  DEFAULT_EXPORT_SANITIZATION_MODE,
  DEBUG_LOGGING_STORAGE_KEY,
  EXPORT_SANITIZATION_MODES,
  EXPORT_DATA_CLASSIFICATIONS,
  buildExportArtifact,
  getExportDataClassification,
  normalizeExportSanitizationMode,
  redactSensitiveText,
  redactSensitiveValue,
  debugLog,
  warnLog,
  errorLog,
};
