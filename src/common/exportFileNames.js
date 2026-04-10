const sanitizeFileNameSegment = (value = "", fallback = "entry") => {
  const normalized = String(value)
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

  return normalized || fallback;
};

const formatExportTimestamp = (value = new Date()) => {
  const date = value instanceof Date ? value : new Date(value);
  const iso = Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
  return iso.replace(/[-:]/g, "").replace(/\.(\d{3})Z$/, "$1Z");
};

const isLikelyIdentifierSegment = (segment = "") =>
  /^[0-9]+$/i.test(segment) ||
  /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(segment) ||
  /^[0-9a-f]{24,}$/i.test(segment);

const normalizePathSegment = (segment = "") => {
  const decoded = decodeURIComponent(segment)
    .replace(/\([^)]*\)/g, "")
    .replace(/^\$+/, "")
    .replace(/^['"]+|['"]+$/g, "")
    .trim();

  return sanitizeFileNameSegment(decoded, "");
};

const getResourceSlug = (targetUrl = "", fallback = "entry") => {
  try {
    const parsedUrl = targetUrl.startsWith("/")
      ? new URL(targetUrl, "https://graph.microsoft.com")
      : new URL(targetUrl);

    const pathSegments = parsedUrl.pathname
      .split("/")
      .map((segment) => normalizePathSegment(segment))
      .filter(
        (segment) =>
          segment &&
          segment !== "beta" &&
          segment !== "v1-0" &&
          !isLikelyIdentifierSegment(segment)
      );

    const resourceParts = pathSegments.slice(-2);
    if (parsedUrl.searchParams.toString()) {
      resourceParts.push("query");
    }

    return sanitizeFileNameSegment(resourceParts.join("-"), fallback);
  } catch (error) {
    return sanitizeFileNameSegment(targetUrl, fallback);
  }
};

const buildGraphXRayExportFileName = ({
  scope,
  artifact,
  method,
  url,
  language,
  source,
  mode,
  extension,
  extraParts = [],
  timestamp = new Date(),
}) => {
  const segments = [
    "graphxray",
    sanitizeFileNameSegment(scope, "scope"),
    sanitizeFileNameSegment(artifact, "artifact"),
  ];

  if (method) {
    segments.push(sanitizeFileNameSegment(method, "method"));
  }

  if (url) {
    segments.push(getResourceSlug(url));
  }

  if (language) {
    segments.push(sanitizeFileNameSegment(language, "language"));
  }

  if (source) {
    segments.push(sanitizeFileNameSegment(source, "source"));
  }

  segments.push(
    ...extraParts
      .map((part) => sanitizeFileNameSegment(part, "part"))
      .filter(Boolean)
  );

  segments.push(
    sanitizeFileNameSegment(mode || "raw", "raw"),
    formatExportTimestamp(timestamp)
  );

  return `${segments.filter(Boolean).join("-")}.${sanitizeFileNameSegment(
    extension,
    "txt"
  )}`;
};

export {
  buildGraphXRayExportFileName,
  formatExportTimestamp,
  getResourceSlug,
  sanitizeFileNameSegment,
};
