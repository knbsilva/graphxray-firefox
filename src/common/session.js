import { downloadFile as downloadExtensionFile } from "./extensionApi.js";
import {
  buildExportArtifact,
  normalizeExportSanitizationMode,
  warnLog,
} from "./security.js";

const GRAPHXRAY_SESSION_STORAGE_KEY = "graphxraySession";
const DEFAULT_SESSION_RETENTION_MS = 60 * 60 * 1000;
const SESSION_RETENTION_OPTIONS = [
  15 * 60 * 1000,
  DEFAULT_SESSION_RETENTION_MS,
  4 * 60 * 60 * 1000,
];
const normalizeSessionRetentionMs = (value) =>
  SESSION_RETENTION_OPTIONS.includes(Number(value))
    ? Number(value)
    : DEFAULT_SESSION_RETENTION_MS;

const DEFAULT_SESSION_MODES = {
  allowExternalSnippets: false,
  captureConsentAccepted: false,
  capturePaused: false,
  diagnosticMode: false,
  exportSanitizationMode: "redacted",
  persistSessionData: true,
  sessionRetentionMs: DEFAULT_SESSION_RETENTION_MS,
  snippetLanguage: "powershell",
  ultraXRayAcknowledged: false,
  ultraXRayMode: false,
};

const createEmptySessionState = () => ({
  stack: [],
  diagnosticLogs: [],
  modes: { ...DEFAULT_SESSION_MODES },
  updatedAt: null,
  sourceContext: "none",
});

const isSessionExpired = (
  updatedAt,
  retentionMs = DEFAULT_SESSION_RETENTION_MS
) => {
  if (!updatedAt) {
    return false;
  }

  const updatedAtMs = new Date(updatedAt).getTime();
  if (Number.isNaN(updatedAtMs)) {
    return true;
  }

  return Date.now() - updatedAtMs > retentionMs;
};

const normalizeSessionState = (session, retentionMsOverride = null) => {
  const baseState = createEmptySessionState();
  if (!session || typeof session !== "object") {
    return baseState;
  }

  const effectiveRetentionMs = normalizeSessionRetentionMs(
    retentionMsOverride ?? session?.modes?.sessionRetentionMs
  );

  if (isSessionExpired(session.updatedAt, effectiveRetentionMs)) {
    return baseState;
  }

  return {
    stack: Array.isArray(session.stack) ? session.stack : baseState.stack,
    diagnosticLogs: Array.isArray(session.diagnosticLogs)
      ? session.diagnosticLogs
      : baseState.diagnosticLogs,
    modes: {
      ...baseState.modes,
      ...(session.modes || {}),
      sessionRetentionMs: effectiveRetentionMs,
    },
    updatedAt: session.updatedAt || baseState.updatedAt,
    sourceContext: session.sourceContext || baseState.sourceContext,
  };
};

const buildSessionSnapshot = ({
  stack = [],
  diagnosticLogs = [],
  modes = {},
  sourceContext = "unknown",
}) => ({
  stack,
  diagnosticLogs,
  modes: {
    ...DEFAULT_SESSION_MODES,
    ...modes,
  },
  updatedAt: new Date().toISOString(),
  sourceContext,
});

const getSaveScriptContentFromStack = (stack = []) => {
  const sections = [];
  const seenSections = new Set();

  const appendUniqueSection = (section) => {
    const normalizedSection = section && section.trim();
    if (!normalizedSection || seenSections.has(normalizedSection)) {
      return;
    }

    seenSections.add(normalizedSection);
    sections.push(normalizedSection);
  };

  stack.forEach((request) => {
    if (request.code && request.code.trim()) {
      appendUniqueSection(request.code);
    }

    if (request.batchCodeSnippets && request.batchCodeSnippets.length > 0) {
      request.batchCodeSnippets.forEach((snippet) => {
        if (snippet.code && snippet.code.trim()) {
          appendUniqueSection(snippet.code);
        }
      });
    }
  });

  return sections.join("\n\n");
};

const buildDiagnosticExportPayload = (
  session,
  exportSanitizationMode = DEFAULT_SESSION_MODES.exportSanitizationMode
) => {
  const normalizedSession = normalizeSessionState(session);
  const normalizedMode = normalizeExportSanitizationMode(exportSanitizationMode);
  const summaryPayload = {
    generatedAt: new Date().toISOString(),
    userAgent: navigator.userAgent,
    modes: normalizedSession.modes,
    updatedAt: normalizedSession.updatedAt,
    sourceContext: normalizedSession.sourceContext,
    stackSummary: normalizedSession.stack.map((request, index) => ({
      index,
      displayRequestUrl: request.displayRequestUrl,
      hasCode: Boolean(request.code),
      codeLength: request.code ? request.code.length : 0,
      batchSnippetCount: request.batchCodeSnippets
        ? request.batchCodeSnippets.length
        : 0,
      codeSource: request.codeSource || "none",
    })),
  };

  return buildExportArtifact({
    rawContent: JSON.stringify(
      {
        ...summaryPayload,
        logs: normalizedSession.diagnosticLogs,
      },
      null,
      2
    ),
    mode: normalizedMode,
    summary: summaryPayload,
    rawExtension: "json",
    rawMimeType: "application/json",
  });
};

const downloadContentAsFile = async (
  content,
  filename,
  mimeType = "text/plain"
) => {
  const file = new Blob([content], {
    type: mimeType,
  });
  const objectUrl = URL.createObjectURL(file);

  try {
    const downloadResult = await downloadExtensionFile({
      url: objectUrl,
      filename,
      saveAs: true,
    });

    if (downloadResult?.status === "saved") {
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      return {
        status: "saved",
      };
    }

    if (downloadResult?.status === "cancelled") {
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      return {
        status: "cancelled",
      };
    }

    if (downloadResult?.status === "unsupported") {
      warnLog("downloads.download is not available, falling back to anchor click.");
    } else if (downloadResult?.status === "error") {
      warnLog(
        "downloads.download failed, falling back to anchor click",
        downloadResult.error
      );
    }
  } catch (error) {
    warnLog("downloads.download failed, falling back to anchor click", error);
  }

  const element = document.createElement("a");
  element.href = objectUrl;
  element.download = filename;
  element.style.display = "none";
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  return {
    status: "saved",
  };
};

export {
  DEFAULT_SESSION_RETENTION_MS,
  SESSION_RETENTION_OPTIONS,
  GRAPHXRAY_SESSION_STORAGE_KEY,
  DEFAULT_SESSION_MODES,
  createEmptySessionState,
  isSessionExpired,
  normalizeSessionState,
  normalizeSessionRetentionMs,
  buildSessionSnapshot,
  getSaveScriptContentFromStack,
  buildDiagnosticExportPayload,
  downloadContentAsFile,
};
