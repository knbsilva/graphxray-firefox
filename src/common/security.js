const DEBUG_LOGGING_STORAGE_KEY = "graphxrayDebugLogging";

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
        redactSensitiveValue(entryValue, depth + 1),
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
  DEBUG_LOGGING_STORAGE_KEY,
  redactSensitiveText,
  redactSensitiveValue,
  debugLog,
  warnLog,
  errorLog,
};
