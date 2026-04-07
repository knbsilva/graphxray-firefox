import { GRAPH_DOMAINS, isUltraXRayDomain } from "./domains.js";
import { createDiagnosticPreview } from "./diagnostics.js";
import { sendRuntimeMessage } from "./extensionApi.js";

const devxEndPoint =
  "https://devxapi-func-prod-eastus.azurewebsites.net/api/graphexplorersnippets";

const emitDiagnosticLog = (
  diagnosticLogger,
  event,
  details = {},
  level = "info",
  source = "client"
) => {
  if (typeof diagnosticLogger === "function") {
    diagnosticLogger({
      source,
      event,
      level,
      details,
    });
  }
};

const isAbsoluteUrl = (value = "") => /^https?:\/\//i.test(value);

const trimTrailingQueryDelimiters = (value = "") =>
  value.replace(/[?&]+$/, "");

const buildAbsoluteGraphUrl = (url) => {
  if (isAbsoluteUrl(url)) {
    return url;
  }

  const normalizedUrl = url.startsWith("/") ? url : `/${url}`;
  return `${GRAPH_DOMAINS.STANDARD[0]}${normalizedUrl}`;
};

const normalizePathSegmentForDevX = (segment) => {
  const odataSegmentMatch = /^([^()]+)\((.+)\)$/.exec(segment);
  if (!odataSegmentMatch) {
    return [segment];
  }

  const collection = odataSegmentMatch[1];
  let identifier = odataSegmentMatch[2].trim();

  if (
    (identifier.startsWith("'") && identifier.endsWith("'")) ||
    (identifier.startsWith('"') && identifier.endsWith('"'))
  ) {
    identifier = identifier.slice(1, -1);
  }

  try {
    identifier = decodeURIComponent(identifier);
  } catch (error) {
    console.log("Could not decode OData identifier:", identifier, error);
  }

  return [collection, encodeURIComponent(identifier)];
};

const normalizeGraphRequestUrlForDevX = (url) => {
  const absoluteUrl = buildAbsoluteGraphUrl(url);
  const urlObject = new URL(absoluteUrl);
  const normalizedSegments = urlObject.pathname
    .split("/")
    .filter(Boolean)
    .flatMap(normalizePathSegmentForDevX);
  const normalizedPathname = `/${normalizedSegments.join("/")}`;
  const normalizedSearch = trimTrailingQueryDelimiters(urlObject.search);
  const path = `${normalizedPathname}${normalizedSearch}`;

  return {
    host: urlObject.host,
    path,
    normalizedUrl: `${urlObject.origin}${path}`,
  };
};

const buildRequestBodyLookupUrls = (requestUrl) => {
  const urlsToTry = new Set([requestUrl]);

  if (isAbsoluteUrl(requestUrl)) {
    return [...urlsToTry];
  }

  const normalizedUrl = requestUrl.startsWith("/") ? requestUrl : `/${requestUrl}`;
  const hasVersionPrefix =
    normalizedUrl.startsWith("/v1.0/") || normalizedUrl.startsWith("/beta/");

  GRAPH_DOMAINS.STANDARD.forEach((domain) => {
    if (hasVersionPrefix) {
      urlsToTry.add(`${domain}${normalizedUrl}`);
      return;
    }

    urlsToTry.add(`${domain}/v1.0${normalizedUrl}`);
    urlsToTry.add(`${domain}/beta${normalizedUrl}`);
  });

  return [...urlsToTry];
};

const formatRequestBodyForFallback = (body) => {
  if (!body) {
    return "";
  }

  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch (error) {
    return body;
  }
};

const buildFallbackRequestUrl = (url) =>
  trimTrailingQueryDelimiters(buildAbsoluteGraphUrl(url));

const escapePowerShellSingleQuotedString = (value = "") =>
  value.replace(/'/g, "''");

const escapePowerShellDoubleQuotedString = (value = "") =>
  value.replace(/[`$"]/g, "`$&");

const formatPowerShellValue = (value, indent = "") => {
  if (value === null) {
    return "$null";
  }

  if (typeof value === "boolean") {
    return value ? "$true" : "$false";
  }

  if (typeof value === "number") {
    return String(value);
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return "@()";
    }

    const items = value.map(
      (entry) =>
        `${indent}  ${formatPowerShellValue(entry, `${indent}  `)}`
    );
    return `@(\n${items.join("\n")}\n${indent})`;
  }

  if (typeof value === "object") {
    const entries = Object.entries(value).map(
      ([key, entryValue]) =>
        `${indent}  "${escapePowerShellDoubleQuotedString(
          key
        )}" = ${formatPowerShellValue(entryValue, `${indent}  `)}`
    );
    return `@{\n${entries.join("\n")}\n${indent}}`;
  }

  return `"${escapePowerShellDoubleQuotedString(String(value))}"`;
};

const buildPowerShellBodyBlock = (body) => {
  if (!body) {
    return null;
  }

  try {
    const parsedBody = JSON.parse(body);
    const formattedBody = formatPowerShellValue(parsedBody);
    const [firstLine, ...restLines] = formattedBody.split("\n");
    const lines = [`$params = ${firstLine}`, ...restLines];
    return {
      lines,
      commandSuffix:
        ' -Body ($params | ConvertTo-Json -Depth 10) -ContentType "application/json"',
    };
  } catch (error) {
    const lines = ["$body = @'"];
    lines.push(formatRequestBodyForFallback(body));
    lines.push("'@");
    return {
      lines,
      commandSuffix: ' -Body $body -ContentType "application/json"',
    };
  }
};

const hasConsistencyLevelHeader = (headers) => {
  if (!headers) {
    return false;
  }

  if (Array.isArray(headers)) {
    return headers.some(
      (header) =>
        header &&
        typeof header.name === "string" &&
        header.name.toLowerCase() === "consistencylevel" &&
        String(header.value ?? "").toLowerCase() === "eventual"
    );
  }

  if (typeof headers === "object") {
    return Object.entries(headers).some(
      ([headerName, value]) =>
        headerName.toLowerCase() === "consistencylevel" &&
        String(value ?? "").toLowerCase() === "eventual"
    );
  }

  return false;
};

const buildPowerShellFallbackSnippet = (method, url, body, options = {}) => {
  const requestUrl = buildFallbackRequestUrl(url);
  const upperMethod = method.toUpperCase();
  const bodyBlock = buildPowerShellBodyBlock(body);
  const lines = [
    "# Generated local fallback because DevX snippet generation failed.",
    "# Authenticate first with Microsoft Graph PowerShell SDK before running this snippet.",
    '# Example: Connect-MgGraph -Scopes "<SCOPES>"',
    `$uri = '${escapePowerShellSingleQuotedString(requestUrl)}'`,
  ];

  if (options.includeConsistencyLevelHeader) {
    lines.push('$headers = @{ "ConsistencyLevel" = "eventual" }');
  }

  if (bodyBlock) {
    lines.push(...bodyBlock.lines);
  }

  let command = `Invoke-MgGraphRequest -Method ${upperMethod} -Uri $uri`;
  if (options.includeConsistencyLevelHeader) {
    command += " -Headers $headers";
  }
  if (bodyBlock) {
    command += bodyBlock.commandSuffix;
  }

  lines.push(command);
  lines.push("$response");
  return lines.join("\n");
};

const buildFallbackSnippet = (snippetLanguage, method, url, body, options = {}) => {
  if (snippetLanguage === "powershell") {
    return buildPowerShellFallbackSnippet(method, url, body, options);
  }

  return null;
};

const resolveSnippetInvocationArgs = (optionsOrLogger, maybeLogger) => {
  if (typeof optionsOrLogger === "function") {
    return {
      options: {},
      diagnosticLogger: optionsOrLogger,
    };
  }

  return {
    options: optionsOrLogger ?? {},
    diagnosticLogger: maybeLogger,
  };
};

const getPowershellCmd = async function (
  snippetLanguage,
  method,
  url,
  body,
  optionsOrLogger = {},
  maybeLogger = null
) {
  const { options, diagnosticLogger } = resolveSnippetInvocationArgs(
    optionsOrLogger,
    maybeLogger
  );
  console.log("Get code snippet from DevX:", url, method);
  
  // Check if the URL is from an Ultra X-Ray domain - if so, don't call devx
  if (isUltraXRayDomain(url)) {
    console.log("Skipping DevX call for Ultra X-Ray domain:", url);
    emitDiagnosticLog(diagnosticLogger, "devx_skipped_ultra_xray", {
      snippetLanguage,
      method,
      url,
    });
    return null;
  }
  
  const bodyText = body ?? ""; //Cast undefined and null to string
  const { host, path, normalizedUrl } = normalizeGraphRequestUrlForDevX(url);
  let payloadHeaders = `Host: ${host}\r\nContent-Type: application/json`;
  if (method.toUpperCase() === "GET" && options.includeConsistencyLevelHeader) {
    payloadHeaders += "\r\nConsistencyLevel: eventual";
  }
  const payload = `${method} ${path} HTTP/1.1\r\n${payloadHeaders}\r\n\r\n${bodyText}`;
  console.log("Payload:", payload);

  const snippetParam = "?lang=%snippetLanguage%".replace(
    "%snippetLanguage%",
    snippetLanguage
  );
  const openApiParam = "&generation=openapi";

  let devxSnippetUri = devxEndPoint;
  if (snippetLanguage === "c#") {
    devxSnippetUri = devxEndPoint;
  } else if (["javascript", "java", "objective-c"].includes(snippetLanguage)) {
    devxSnippetUri = devxEndPoint + snippetParam;
  } else if (["go", "powershell", "python"].includes(snippetLanguage)) {
    devxSnippetUri = devxEndPoint + snippetParam + openApiParam;
  }

  emitDiagnosticLog(diagnosticLogger, "devx_request_started", {
    snippetLanguage,
    method,
    url,
    normalizedUrl,
    endpoint: devxSnippetUri,
    requestBodyLength: bodyText.length,
    payloadPreview: createDiagnosticPreview(payload),
  });

  try {
    const response = await fetch(devxSnippetUri, {
      headers: {
        "content-type": "application/http",
      },
      method: "POST",
      body: payload,
    });
    console.log("DevX responded");
    if (response.ok) {
      const responseText = await response.text();
      console.log("DevX-Response", responseText);
      emitDiagnosticLog(diagnosticLogger, "devx_request_succeeded", {
        snippetLanguage,
        method,
        url,
        normalizedUrl,
        endpoint: devxSnippetUri,
        status: response.status,
        responseLength: responseText.length,
        responsePreview: createDiagnosticPreview(responseText),
      });
      return {
        code:
          typeof responseText === "string" ? responseText : String(responseText),
        error: null,
        source: "devx",
      };
    } else {
      const errorText = await response.text();
      const errorMsg = `DevXError: ${response.status} ${response.statusText} for ${method} ${url} - Response: ${errorText}`;
      console.log(errorMsg);
      const fallbackCode = buildFallbackSnippet(
        snippetLanguage,
        method,
        url,
        bodyText,
        options
      );
      emitDiagnosticLog(
        diagnosticLogger,
        "devx_request_failed",
        {
          snippetLanguage,
          method,
          url,
          normalizedUrl,
          endpoint: devxSnippetUri,
          status: response.status,
          statusText: response.statusText,
          errorPreview: createDiagnosticPreview(errorText),
          fallbackGenerated: Boolean(fallbackCode),
        },
        "error"
      );
      if (fallbackCode) {
        emitDiagnosticLog(diagnosticLogger, "fallback_snippet_generated", {
          snippetLanguage,
          method,
          url,
          normalizedUrl,
          source: "local",
          codeLength: fallbackCode.length,
        });
      }
      return {
        code: fallbackCode,
        error: errorText,
        source: fallbackCode ? "fallback" : "none",
      };
    }
  } catch (error) {
    const errorMsg = `DevXError: Network/Request error for ${method} ${url} - ${
      error.message || error
    }`;
    console.log(errorMsg, error);
    const fallbackCode = buildFallbackSnippet(
      snippetLanguage,
      method,
      url,
      bodyText,
      options
    );
    emitDiagnosticLog(
      diagnosticLogger,
      "devx_request_exception",
      {
        snippetLanguage,
        method,
        url,
        normalizedUrl,
        endpoint: devxSnippetUri,
        error: error?.message || String(error),
        fallbackGenerated: Boolean(fallbackCode),
      },
      "error"
    );
    if (fallbackCode) {
      emitDiagnosticLog(diagnosticLogger, "fallback_snippet_generated", {
        snippetLanguage,
        method,
        url,
        normalizedUrl,
        source: "local",
        codeLength: fallbackCode.length,
      });
    }
    return {
      code: fallbackCode,
      error: error?.message || String(error),
      source: fallbackCode ? "fallback" : "none",
    };
  }
};

const getRequestBody = async function (request, diagnosticLogger = null) {
  let requestBody = "";
  
  console.log("getRequestBody - request object:", request);
  console.log("getRequestBody - request.method:", request.method);
  console.log("getRequestBody - request.url:", request.url);
  
  // First, check if the request object directly has a body property (seems to be the case!)
  if (request.body) {
    if (typeof request.body === 'string') {
      requestBody = request.body;
    } else {
      requestBody = JSON.stringify(request.body);
    }
    console.log("getRequestBody - found body in request.body:", requestBody);
    emitDiagnosticLog(diagnosticLogger, "request_body_resolved", {
      url: request.url,
      method: request.method,
      source: "request.body",
      bodyLength: requestBody.length,
      bodyPreview: createDiagnosticPreview(requestBody),
    });
    return requestBody;
  }
  
  // Second, try to get from the standard devtools API (limited access)
  if (request.postData && request.postData.text) {
    requestBody = request.postData.text;
    console.log("getRequestBody - found body in postData:", requestBody);
    emitDiagnosticLog(diagnosticLogger, "request_body_resolved", {
      url: request.url,
      method: request.method,
      source: "request.postData.text",
      bodyLength: requestBody.length,
      bodyPreview: createDiagnosticPreview(requestBody),
    });
    return requestBody;
  }
  
  // If no body found, try to get from background script using URL
  if (!requestBody && request.url) {
    console.log("getRequestBody - trying background script with URL:", request.url);
    try {
      const startedDateTime = request._harEntry?.startedDateTime;
      const urlsToTry = buildRequestBodyLookupUrls(request.url);
      
      for (const url of urlsToTry) {
        const response = await sendRuntimeMessage({
          type: "GET_REQUEST_BODY",
          url: url,
          method: request.method,
          startedDateTime: startedDateTime,
        });
        console.log("getRequestBody - background script response for", url, ":", response);
        if (response && response.body) {
          requestBody = response.body;
          console.log("getRequestBody - found body from background script:", requestBody);
          emitDiagnosticLog(diagnosticLogger, "request_body_resolved", {
            url: request.url,
            method: request.method,
            source: "background",
            requestedUrl: url,
            bodyLength: requestBody.length,
            bodyPreview: createDiagnosticPreview(requestBody),
          });
          return requestBody;
        }
      }
    } catch (error) {
      console.log("Could not get request body from background script:", error);
      emitDiagnosticLog(
        diagnosticLogger,
        "request_body_lookup_failed",
        {
          url: request.url,
          method: request.method,
          error: error?.message || String(error),
        },
        "warning"
      );
    }
  }
  
  console.log("getRequestBody - final result (should only be REQUEST body):", requestBody);
  emitDiagnosticLog(
    diagnosticLogger,
    "request_body_missing",
    {
      url: request.url,
      method: request.method,
    },
    "warning"
  );
  return requestBody;
};

const getResponseContent = async function (harEntry, diagnosticLogger = null) {
  let responseContent = "";
  
  console.log("getResponseContent - harEntry:", harEntry);
  console.log("getResponseContent - harEntry type:", typeof harEntry);
  
  // Try to get response content from harEntry
  if (harEntry && harEntry.response) {
    console.log("getResponseContent - response object:", harEntry.response);
    console.log("getResponseContent - response status:", harEntry.response.status);
    console.log("getResponseContent - response headers:", harEntry.response.headers);
    console.log("getResponseContent - response content object:", harEntry.response.content);
    
    // Check if response has content directly in the content.text property
    if (harEntry.response.content && harEntry.response.content.text !== undefined) {
      responseContent = harEntry.response.content.text;
      console.log("getResponseContent - raw content.text:", responseContent, "length:", responseContent.length);
      
      // If it's base64 encoded, decode it
      if (harEntry.response.content.encoding === 'base64') {
        try {
          responseContent = atob(harEntry.response.content.text);
          console.log("getResponseContent - decoded base64 content:", responseContent);
        } catch (e) {
          console.log("Failed to decode base64 content:", e);
          // Keep the original text if decoding fails
        }
      }
      
      console.log("getResponseContent - found content in response.content.text:", responseContent);
      if (responseContent && responseContent.length > 0) {
        emitDiagnosticLog(diagnosticLogger, "response_content_resolved", {
          source: "harEntry.response.content.text",
          status: harEntry.response.status,
          contentLength: responseContent.length,
          contentPreview: createDiagnosticPreview(responseContent),
        });
        return responseContent;
      }
    }
    
    // Try using getResponseBody() method if available (this is different from getContent)
    if (typeof harEntry.getResponseBody === 'function') {
      console.log("getResponseContent - trying getResponseBody() method");
      try {
        const { content, meta } = await getHarEntryResponseBody(harEntry);
        console.log("getResponseContent - getResponseBody returned:", content, meta);
        if (content) {
          responseContent = content;
          console.log("getResponseContent - found content from getResponseBody:", responseContent);
          emitDiagnosticLog(diagnosticLogger, "response_content_resolved", {
            source: "harEntry.getResponseBody",
            status: harEntry.response.status,
            contentLength: responseContent.length,
            contentPreview: createDiagnosticPreview(responseContent),
            meta,
          });
          return responseContent;
        }
      } catch (error) {
        console.log("getResponseContent - getResponseBody failed:", error);
        emitDiagnosticLog(
          diagnosticLogger,
          "response_content_lookup_failed",
          {
            source: "harEntry.getResponseBody",
            status: harEntry.response.status,
            error: error?.message || String(error),
          },
          "warning"
        );
      }
    }
    
    // Try using getContent() method which should get the response content for completed requests
    if (typeof harEntry.getContent === 'function') {
      console.log("getResponseContent - trying getContent() method for response content");
      try {
        const { content, meta } = await getHarEntryContent(harEntry);
        console.log("getResponseContent - getContent returned:", content, "meta:", meta, "content length:", content ? content.length : 0);
        if (content && content.length > 0) {
          responseContent = content;
          console.log("getResponseContent - found content from getContent:", responseContent.substring(0, 200) + "...");
          emitDiagnosticLog(diagnosticLogger, "response_content_resolved", {
            source: "harEntry.getContent",
            status: harEntry.response.status,
            contentLength: responseContent.length,
            contentPreview: createDiagnosticPreview(responseContent),
            meta,
          });
          return responseContent;
        }
      } catch (error) {
        console.log("getResponseContent - getContent failed:", error);
        emitDiagnosticLog(
          diagnosticLogger,
          "response_content_lookup_failed",
          {
            source: "harEntry.getContent",
            status: harEntry.response.status,
            error: error?.message || String(error),
          },
          "warning"
        );
      }
    }
    
    // Final attempt: check if there's any content object with size > 0
    if (harEntry.response.content && harEntry.response.content.size > 0) {
      console.log("getResponseContent - response has content with size:", harEntry.response.content.size);
      // Sometimes the content is there but text property is empty string
      if (harEntry.response.content.text === "") {
        console.log("getResponseContent - content.text is empty string but size > 0, this might be an issue with content retrieval");
      }
    }
  }
  
  console.log("getResponseContent - final result:", responseContent);
  emitDiagnosticLog(
    diagnosticLogger,
    "response_content_missing",
    {
      status: harEntry?.response?.status,
    },
    "warning"
  );
  return responseContent;
};

const getHarEntryContent = async function (harEntry) {
  const getContentResult =
    harEntry.getContent.length === 0
      ? harEntry.getContent()
      : new Promise((resolve, reject) => {
          try {
            harEntry.getContent((content, meta) => {
              resolve([content, meta]);
            });
          } catch (error) {
            reject(error);
          }
        });

  const resolved = await getContentResult;
  if (Array.isArray(resolved)) {
    return {
      content: resolved[0],
      meta: resolved[1],
    };
  }

  return {
    content: resolved,
    meta: undefined,
  };
};

const getHarEntryResponseBody = async function (harEntry) {
  const getResponseBodyResult =
    harEntry.getResponseBody.length === 0
      ? harEntry.getResponseBody()
      : new Promise((resolve, reject) => {
          try {
            harEntry.getResponseBody((content, meta) => {
              resolve([content, meta]);
            });
          } catch (error) {
            reject(error);
          }
        });

  const resolved = await getResponseBodyResult;
  if (Array.isArray(resolved)) {
    return {
      content: resolved[0],
      meta: resolved[1],
    };
  }

  return {
    content: resolved,
    meta: undefined,
  };
};

const getBatchCodeSnippets = async function (
  snippetLanguage,
  requestBody,
  baseUrl,
  diagnosticLogger = null
) {
  console.log("Generating code snippets for batch request");
  
  if (!requestBody) {
    emitDiagnosticLog(
      diagnosticLogger,
      "batch_snippets_skipped",
      {
        reason: "missing_request_body",
        snippetLanguage,
        baseUrl,
      },
      "warning"
    );
    return [];
  }
  
  try {
    const batchData = JSON.parse(requestBody);
    if (!batchData.requests) {
      emitDiagnosticLog(
        diagnosticLogger,
        "batch_snippets_skipped",
        {
          reason: "invalid_batch_structure",
          snippetLanguage,
          baseUrl,
        },
        "warning"
      );
      return [];
    }
    
    const codeSnippets = [];
    emitDiagnosticLog(diagnosticLogger, "batch_snippets_started", {
      snippetLanguage,
      baseUrl,
      requestCount: batchData.requests.length,
    });
    
    for (const request of batchData.requests) {
      console.log("Generating snippet for batch request:", request.id, request.method, request.url);
      
      // Construct full URL for the individual request
      const fullUrl = `${baseUrl}${request.url}`;
      
      // Get the body for this individual request
      const requestBodyText = request.body ? JSON.stringify(request.body) : "";
      const includeConsistencyLevelHeader = hasConsistencyLevelHeader(
        request.headers
      );
      
      // Generate code snippet for this individual request
      const snippetResult = await getPowershellCmd(
        snippetLanguage,
        request.method,
        fullUrl,
        requestBodyText,
        { includeConsistencyLevelHeader },
        diagnosticLogger
      );
      
      if (snippetResult?.code) {
        codeSnippets.push({
          id: request.id,
          method: request.method,
          url: request.url,
          code: snippetResult.code,
          codeSource: snippetResult.source || "devx",
          codeError: snippetResult.error || null,
        });
      }
    }
    
    console.log("Generated", codeSnippets.length, "code snippets for batch request");
    emitDiagnosticLog(diagnosticLogger, "batch_snippets_completed", {
      snippetLanguage,
      baseUrl,
      generatedCount: codeSnippets.length,
    });
    return codeSnippets;
  } catch (error) {
    console.log("Error generating batch code snippets:", error);
    emitDiagnosticLog(
      diagnosticLogger,
      "batch_snippets_failed",
      {
        snippetLanguage,
        baseUrl,
        error: error?.message || String(error),
      },
      "error"
    );
    return [];
  }
};

const getCodeView = async function (
  snippetLanguage,
  request,
  version,
  harEntry = null,
  diagnosticLogger = null
) {
  if (["OPTIONS"].includes(request.method)) {
    emitDiagnosticLog(diagnosticLogger, "code_view_skipped", {
      method: request.method,
      url: request.url,
      reason: "options_request",
    });
    return null;
  }
  console.log("GetCodeView", snippetLanguage, request, harEntry);
  emitDiagnosticLog(diagnosticLogger, "code_view_started", {
    snippetLanguage,
    method: request.method,
    url: request.url,
    hasHarEntry: Boolean(harEntry),
  });
  const requestBody = await getRequestBody(request, diagnosticLogger);
  const responseContent = harEntry
    ? await getResponseContent(harEntry, diagnosticLogger)
    : "";
  const includeConsistencyLevelHeader = hasConsistencyLevelHeader(
    request.headers
  );
  
  let code = null;
  let codeError = null;
  let codeSource = "none";
  let batchCodeSnippets = [];
  
  // Check if this is a batch request
  if (request.url.includes("/$batch")) {
    console.log("Processing batch request for code generation");
    // Extract base URL for batch requests
    const baseUrl = request.url.split("/$batch")[0];
    batchCodeSnippets = await getBatchCodeSnippets(
      snippetLanguage,
      requestBody,
      baseUrl,
      diagnosticLogger
    );
    
    // Also generate a code snippet for the main batch request
    const snippetResult = await getPowershellCmd(
      snippetLanguage,
      request.method,
      version + request.url,
      requestBody,
      { includeConsistencyLevelHeader },
      diagnosticLogger
    );
    code = snippetResult?.code ?? null;
    codeError = snippetResult?.error ?? null;
    codeSource = snippetResult?.source ?? "none";
  } else {
    // Regular single request
    const snippetResult = await getPowershellCmd(
      snippetLanguage,
      request.method,
      version + request.url,
      requestBody,
      { includeConsistencyLevelHeader },
      diagnosticLogger
    );
    code = snippetResult?.code ?? null;
    codeError = snippetResult?.error ?? null;
    codeSource = snippetResult?.source ?? "none";
  }
  
  const codeView = {
    displayRequestUrl: request.method + " " + request.url,
    requestBody: requestBody,
    responseContent: responseContent,
    code: code,
    codeError: codeError,
    codeSource: codeSource,
    batchCodeSnippets: batchCodeSnippets, // Add batch code snippets to the result
  };
  console.log("CodeView", codeView);
  emitDiagnosticLog(diagnosticLogger, "code_view_completed", {
    snippetLanguage,
    method: request.method,
    url: request.url,
    hasCode: Boolean(code),
    codeLength: code ? code.length : 0,
    requestBodyLength: requestBody ? requestBody.length : 0,
    responseContentLength: responseContent ? responseContent.length : 0,
    batchSnippetCount: batchCodeSnippets.length,
    codeSource,
    errorPreview: codeError ? createDiagnosticPreview(codeError) : null,
    codePreview: code ? createDiagnosticPreview(code) : null,
  });
  return codeView;
};
export {
  getPowershellCmd,
  getRequestBody,
  getResponseContent,
  getCodeView,
  getBatchCodeSnippets,
};
