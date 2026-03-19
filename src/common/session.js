import { downloadFile as downloadExtensionFile } from "./extensionApi.js";

const GRAPHXRAY_SESSION_STORAGE_KEY = "graphxraySession";

const DEFAULT_SESSION_MODES = {
  diagnosticMode: false,
  snippetLanguage: "powershell",
  ultraXRayMode: false,
};

const createEmptySessionState = () => ({
  stack: [],
  diagnosticLogs: [],
  modes: { ...DEFAULT_SESSION_MODES },
  updatedAt: null,
  sourceContext: "none",
});

const normalizeSessionState = (session) => {
  const baseState = createEmptySessionState();
  if (!session || typeof session !== "object") {
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

const buildDiagnosticExportPayload = (session) => {
  const normalizedSession = normalizeSessionState(session);

  return {
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
    logs: normalizedSession.diagnosticLogs,
  };
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
    const downloadId = await downloadExtensionFile({
      url: objectUrl,
      filename,
      saveAs: true,
    });

    if (downloadId !== null && downloadId !== undefined) {
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      return;
    }
  } catch (error) {
    console.log(
      "downloads.download failed, falling back to anchor click:",
      error
    );
  }

  const element = document.createElement("a");
  element.href = objectUrl;
  element.download = filename;
  element.style.display = "none";
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
};

export {
  GRAPHXRAY_SESSION_STORAGE_KEY,
  DEFAULT_SESSION_MODES,
  createEmptySessionState,
  normalizeSessionState,
  buildSessionSnapshot,
  getSaveScriptContentFromStack,
  buildDiagnosticExportPayload,
  downloadContentAsFile,
};
