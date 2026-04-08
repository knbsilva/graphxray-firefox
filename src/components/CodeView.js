import React, { useState } from "react";
import SyntaxHighlighter from "react-syntax-highlighter";
import {
  atomOneDark,
  atomOneLight,
} from "react-syntax-highlighter/dist/esm/styles/hljs";
import { IconButton } from "@fluentui/react/lib/Button";
import { isUltraXRayDomain } from "../common/domains.js";
import { downloadContentAsFile } from "../common/session.js";
import { getSnippetLanguageOption } from "../common/snippetLanguages.js";
import { warnLog } from "../common/security.js";

export const CodeView = ({ request, lightUrl, snippetLanguage }) => {
  const [isRequestBodyExpanded, setIsRequestBodyExpanded] = useState(false);
  const [isSnippetExpanded, setIsSnippetExpanded] = useState(false);
  const [isBatchSnippetsExpanded, setIsBatchSnippetsExpanded] = useState(false);
  const [hoveredButton, setHoveredButton] = useState(null);
  const requestUrl = (request?.displayRequestUrl || "").split(" ").slice(1).join(" ");
  const requestMethod = (request?.displayRequestUrl || "").split(" ")[0] || "GRAPH";
  const isUltraXRayRequest = isUltraXRayDomain(requestUrl);

  let urlStyle = atomOneDark;
  if (lightUrl) {
    urlStyle = atomOneLight;
  }

  let syntaxLanguage = snippetLanguage;

  // Function to format JSON content
  const formatJsonContent = (content) => {
    if (!content || typeof content !== 'string') {
      return content;
    }
    
    try {
      const parsed = JSON.parse(content.trim());
      return JSON.stringify(parsed, null, 2);
    } catch (e) {
      return content;
    }
  };

  // Function to handle batch request/response matching
  const processBatchContent = (requestBody, responseContent) => {
    // Check if this is a batch endpoint
    const isBatchEndpoint = request.displayRequestUrl && request.displayRequestUrl.includes('/$batch');
    
    if (!requestBody || !responseContent) {
      return { requestBody, responseContent };
    }

    try {
      const requestData = JSON.parse(requestBody);
      const responseData = JSON.parse(responseContent);

      // Check if this is a batch request/response
      const hasBatchStructure = requestData.requests && responseData.responses;
      
      if (isBatchEndpoint && hasBatchStructure) {
        // Create a map of responses by ID
        const responseMap = {};
        responseData.responses.forEach(response => {
          if (response.id) {
            responseMap[response.id] = response;
          }
        });

        // Match requests with their responses
        const matchedPairs = [];
        requestData.requests.forEach(request => {
          if (request.id && responseMap[request.id]) {
            const response = responseMap[request.id];
            matchedPairs.push({
              id: request.id,
              request: request,
              response: response,
              responseBody: response.body ? JSON.stringify(response.body, null, 2) : null
            });
          }
        });
        
        return { 
          isBatch: true, 
          matchedPairs: matchedPairs,
          originalRequest: requestBody,
          originalResponse: responseContent
        };
      }
    } catch (e) {
      warnLog("Error processing batch content", e);
    }
    return { requestBody, responseContent };
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      warnLog("Failed to copy text", err);
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
  };

  const createStableHash = (value = "") => {
    let hash = 2166136261;

    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }

    return (hash >>> 0).toString(36);
  };

  const sanitizeFileNameSegment = (value = "") =>
    value
      .replace(/^https?:\/\//i, "")
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "entry";

  const getEntryFileNameBase = (
    targetUrl = requestUrl || request.displayRequestUrl || "graphxray-entry",
    targetMethod = requestMethod,
    extraParts = []
  ) => {
    try {
      const url = new URL(targetUrl);
      const pathSegments = url.pathname
        .split("/")
        .filter(Boolean)
        .map((segment) => sanitizeFileNameSegment(segment).slice(0, 24))
        .filter(Boolean)
        .slice(-4);
      const queryKeys = [...url.searchParams.keys()]
        .map((key) => sanitizeFileNameSegment(`q-${key}`).slice(0, 18))
        .filter(Boolean)
        .slice(0, 2);
      const hash = createStableHash(`${targetMethod} ${targetUrl}`).slice(0, 8);

      return [
        sanitizeFileNameSegment(targetMethod.toUpperCase()),
        sanitizeFileNameSegment(url.host).slice(0, 32),
        ...pathSegments,
        ...queryKeys,
        ...extraParts.map((part) => sanitizeFileNameSegment(part)).filter(Boolean),
        hash,
      ]
        .filter(Boolean)
        .join("-")
        .slice(0, 160);
    } catch (error) {
      const hash = createStableHash(`${targetMethod} ${targetUrl}`).slice(0, 8);
      return [
        sanitizeFileNameSegment(targetMethod.toUpperCase()),
        sanitizeFileNameSegment(targetUrl).slice(0, 96),
        ...extraParts.map((part) => sanitizeFileNameSegment(part)).filter(Boolean),
        hash,
      ]
        .filter(Boolean)
        .join("-")
        .slice(0, 160);
    }
  };

  const getContentFileDescriptor = (content) => {
    if (!content || typeof content !== "string") {
      return {
        extension: "txt",
        mimeType: "text/plain",
      };
    }

    try {
      JSON.parse(content);
      return {
        extension: "json",
        mimeType: "application/json",
      };
    } catch (error) {
      return {
        extension: "txt",
        mimeType: "text/plain",
      };
    }
  };

  const saveRequestToFile = async (content, suffix = "request") => {
    if (!content || !content.trim()) {
      return;
    }

    const descriptor = getContentFileDescriptor(content);
    await downloadContentAsFile(
      content,
      `GraphXRay-${suffix}-${getEntryFileNameBase()}.${descriptor.extension}`,
      descriptor.mimeType
    );
  };

  const saveResponseToFile = async (content, suffix = "response") => {
    if (!content || !content.trim()) {
      return;
    }

    const descriptor = getContentFileDescriptor(content);
    await downloadContentAsFile(
      content,
      `GraphXRay-${suffix}-${getEntryFileNameBase()}.${descriptor.extension}`,
      descriptor.mimeType
    );
  };

  const saveSnippetToFile = async (
    content,
    suffix = "snippet",
    targetUrl = requestUrl || request.displayRequestUrl || "graphxray-entry",
    targetMethod = requestMethod,
    extraParts = []
  ) => {
    if (!content || !content.trim()) {
      return;
    }

    const languageOption = getSnippetLanguageOption(snippetLanguage);
    await downloadContentAsFile(
      content,
      `GraphXRay-${suffix}-${getEntryFileNameBase(
        targetUrl,
        targetMethod,
        extraParts
      )}.${languageOption.fileExt}`
    );
  };

  const toggleRequestBody = () => {
    setIsRequestBodyExpanded(!isRequestBodyExpanded);
  };

  const toggleSnippet = () => {
    setIsSnippetExpanded(!isSnippetExpanded);
  };

  const toggleBatchSnippets = () => {
    setIsBatchSnippetsExpanded(!isBatchSnippetsExpanded);
  };

  const getSnippetSourceMeta = (source) => {
    if (source === "local") {
      return {
        label: "Local snippet",
        subtitle:
          "Rendered locally first. Graph X-Ray can still replace it if DevX returns a snippet later.",
        styles: {
          backgroundColor: "#dcfce7",
          color: "#166534",
        },
      };
    }

    if (source === "fallback") {
      return {
        label: "Local fallback",
        subtitle: "Generated locally because DevX did not return a snippet.",
        styles: {
          backgroundColor: "#fef3c7",
          color: "#92400e",
        },
      };
    }

    if (source === "devx") {
      return {
        label: "DevX snippet",
        subtitle: "Generated by the Microsoft Graph snippet service.",
        styles: {
          backgroundColor: "#dbeafe",
          color: "#1d4ed8",
        },
      };
    }

    return null;
  };

  const renderCollapseHeader = (
    expanded,
    onToggle,
    label,
    subtitle = "",
    actions = null
  ) => (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "10px",
        marginTop: "12px",
        marginBottom: "8px",
        padding: "8px 10px",
        borderRadius: "8px",
        backgroundColor: "rgba(15, 23, 42, 0.04)",
        border: "1px solid rgba(15, 23, 42, 0.08)",
      }}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onToggle();
          }
        }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          border: "none",
          background: "transparent",
          padding: 0,
          cursor: "pointer",
          color: "#0f172a",
          font: "inherit",
        }}
      >
        <IconButton
          iconProps={{ iconName: expanded ? "ChevronDown" : "ChevronRight" }}
          title={expanded ? `Collapse ${label}` : `Expand ${label}`}
          styles={{
            root: {
              minWidth: "24px",
              width: "24px",
              height: "24px",
              color: "#0f172a",
            },
          }}
        />
        <div>
          <div
            style={{
              fontSize: "14px",
              fontWeight: 700,
              textAlign: "left",
            }}
          >
            {label}
          </div>
          {subtitle && (
            <div
              style={{
                fontSize: "12px",
                color: "#64748b",
                textAlign: "left",
              }}
            >
              {subtitle}
            </div>
          )}
        </div>
      </div>
      {actions && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            flexWrap: "wrap",
          }}
        >
          {actions}
        </div>
      )}
    </div>
  );

  const renderStatusBadge = (label, styles = {}) => (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "4px 8px",
        borderRadius: "999px",
        fontSize: "11px",
        fontWeight: 700,
        backgroundColor: "#eef2ff",
        color: "#3730a3",
        ...styles,
      }}
    >
      {label}
    </span>
  );

  // Process batch content if applicable
  const batchData = processBatchContent(request.requestBody, request.responseContent);
  const snippetSourceMeta = getSnippetSourceMeta(request.codeSource);
  const isLocalOnlySnippetError =
    typeof request.codeError === "string" &&
    request.codeError.includes("Local only mode");

  return (
    <div>
      {request.displayRequestUrl && request.displayRequestUrl.length > 0 && (
        <div>
          <div style={{ display: "flex", alignItems: "center", marginBottom: "8px" }}>
            {((request.requestBody && request.requestBody.length > 0) || (request.responseContent && request.responseContent.length > 0)) && (
              <IconButton
                iconProps={{ iconName: isRequestBodyExpanded ? "ChevronDown" : "ChevronRight" }}
                title={isRequestBodyExpanded ? "Collapse request/response" : "Expand request/response"}
                onClick={toggleRequestBody}
                onMouseEnter={() => setHoveredButton('expand')}
                onMouseLeave={() => setHoveredButton(null)}
                styles={{
                  root: {
                    minWidth: "24px",
                    width: "24px",
                    height: "24px",
                    marginRight: "8px",
                    color: lightUrl ? "#333" : "#fff",
                    backgroundColor: hoveredButton === 'expand'
                      ? (lightUrl ? "rgba(0, 0, 0, 0.1)" : "rgba(255, 255, 255, 0.1)")
                      : "transparent",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    transition: "background-color 0.2s ease"
                  },
                  rootHovered: {
                    backgroundColor: lightUrl ? "rgba(0, 0, 0, 0.1)" : "rgba(255, 255, 255, 0.1)"
                  }
                }}
              />
            )}
            <div style={{ position: "relative", flex: 1 }}>
              <SyntaxHighlighter
                language="jboss-cli"
                style={urlStyle}
                wrapLongLines={true}
                customStyle={{
                  borderRadius: "8px",
                  padding: "12px",
                  paddingRight: "50px",
                  margin: 0
                }}
              >
                {request.displayRequestUrl}
              </SyntaxHighlighter>
              <IconButton
                iconProps={{ iconName: "Copy" }}
                title="Copy URL to clipboard"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  copyToClipboard(request.displayRequestUrl);
                }}
                onMouseEnter={() => setHoveredButton('url-copy')}
                onMouseLeave={() => setHoveredButton(null)}
                styles={{
                  root: {
                    position: "absolute",
                    top: "8px",
                    right: "8px",
                    backgroundColor: hoveredButton === 'url-copy'
                      ? (lightUrl ? "rgba(0, 0, 0, 0.15)" : "rgba(255, 255, 255, 0.25)")
                      : (lightUrl ? "rgba(0, 0, 0, 0.08)" : "rgba(255, 255, 255, 0.1)"),
                    color: lightUrl ? "#333" : "#fff",
                    border: hoveredButton === 'url-copy'
                      ? (lightUrl ? "1px solid rgba(0, 0, 0, 0.2)" : "1px solid rgba(255, 255, 255, 0.3)")
                      : "1px solid transparent",
                    borderRadius: "4px",
                    padding: "4px",
                    cursor: "pointer",
                    minWidth: "32px",
                    width: "32px",
                    height: "32px",
                    transition: "all 0.2s ease",
                    boxShadow: hoveredButton === 'url-copy'
                      ? "0 2px 4px rgba(0, 0, 0, 0.1)"
                      : "none"
                  }
                }}
              />
            </div>
          </div>

          {isUltraXRayRequest && (
            <div style={{ marginBottom: "10px" }}>
              {renderStatusBadge("Internal API (Ultra X-Ray)", {
                backgroundColor: "#fef3c7",
                color: "#92400e",
              })}
            </div>
          )}

          {isRequestBodyExpanded && ((request.requestBody && request.requestBody.length > 0) || (request.responseContent && request.responseContent.length > 0)) && (
            <div style={{
              border: "2px solid rgba(0, 0, 0, 0.2)",
              borderRadius: "8px",
              padding: "12px",
              marginBottom: "10px",
              backgroundColor: "rgba(0, 0, 0, 0.02)"
            }}>
              {batchData.isBatch ? (
                // Special handling for batch requests
                <div>
                  <div style={{
                    fontSize: "16px",
                    fontWeight: "bold",
                    color: "#333",
                    marginBottom: "16px"
                  }}>
                    Batch Request/Response Pairs
                  </div>
                  {batchData.matchedPairs.map((pair, index) => (
                    <div key={pair.id} style={{
                      border: "1px solid rgba(0, 0, 0, 0.1)",
                      borderRadius: "6px",
                      padding: "12px",
                      marginBottom: index < batchData.matchedPairs.length - 1 ? "16px" : "0",
                      backgroundColor: "rgba(255, 255, 255, 0.5)"
                    }}>
                      <div style={{
                        fontSize: "14px",
                        fontWeight: "bold",
                        color: "#666",
                        marginBottom: "8px"
                      }}>
                        Request ID: {pair.id}
                      </div>
                      
                      {/* Individual Request */}
                      <div style={{ marginBottom: "12px" }}>
                        <div style={{
                          fontSize: "12px",
                          fontWeight: "bold",
                          color: "#333",
                          marginBottom: "6px"
                        }}>
                          Request: {pair.request.method} {pair.request.url}
                        </div>
                        <div style={{ position: "relative" }}>
                          <SyntaxHighlighter
                            language="json"
                            style={atomOneDark}
                            wrapLongLines={true}
                            customStyle={{
                              borderRadius: "6px",
                              padding: "8px",
                              paddingRight: "40px",
                              fontSize: "12px"
                            }}
                          >
                            {formatJsonContent(JSON.stringify(pair.request, null, 2))}
                          </SyntaxHighlighter>
                          <IconButton
                            iconProps={{ iconName: "Copy" }}
                            title="Copy request to clipboard"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              copyToClipboard(JSON.stringify(pair.request, null, 2));
                            }}
                            onMouseEnter={() => setHoveredButton(`batch-req-${index}`)}
                            onMouseLeave={() => setHoveredButton(null)}
                            styles={{
                              root: {
                                position: "absolute",
                                top: "6px",
                                right: "6px",
                                backgroundColor: hoveredButton === `batch-req-${index}`
                                  ? "rgba(255, 255, 255, 0.25)"
                                  : "rgba(255, 255, 255, 0.1)",
                                color: "#fff",
                                border: "1px solid transparent",
                                borderRadius: "3px",
                                padding: "2px",
                                cursor: "pointer",
                                minWidth: "24px",
                                width: "24px",
                                height: "24px",
                                fontSize: "10px"
                              }
                            }}
                          />
                        </div>
                      </div>

                      {/* Individual Response */}
                      {pair.responseBody && (
                        <div>
                          <div style={{
                            fontSize: "12px",
                            fontWeight: "bold",
                            color: "#333",
                            marginBottom: "6px"
                          }}>
                            Response (Status: {pair.response.status})
                          </div>
                          <div style={{ position: "relative" }}>
                            <SyntaxHighlighter
                              language="json"
                              style={atomOneDark}
                              wrapLongLines={true}
                              customStyle={{
                                borderRadius: "6px",
                                padding: "8px",
                                paddingRight: "40px",
                                fontSize: "12px"
                              }}
                            >
                              {pair.responseBody}
                            </SyntaxHighlighter>
                            <IconButton
                              iconProps={{ iconName: "Copy" }}
                              title="Copy response to clipboard"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                copyToClipboard(pair.responseBody);
                              }}
                              onMouseEnter={() => setHoveredButton(`batch-resp-${index}`)}
                              onMouseLeave={() => setHoveredButton(null)}
                              styles={{
                                root: {
                                  position: "absolute",
                                  top: "6px",
                                  right: "6px",
                                  backgroundColor: hoveredButton === `batch-resp-${index}`
                                    ? "rgba(255, 255, 255, 0.25)"
                                    : "rgba(255, 255, 255, 0.1)",
                                  color: "#fff",
                                  border: "1px solid transparent",
                                  borderRadius: "3px",
                                  padding: "2px",
                                  cursor: "pointer",
                                  minWidth: "24px",
                                  width: "24px",
                                  height: "24px",
                                  fontSize: "10px"
                                }
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                // Normal request/response handling
                <div>
                  {request.requestBody && request.requestBody.length > 0 && (
                    <div style={{ marginBottom: request.responseContent && request.responseContent.length > 0 ? "15px" : "0" }}>
                      <div style={{
                        fontSize: "14px",
                        fontWeight: "bold",
                        color: "#333",
                        marginBottom: "8px"
                      }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: "8px",
                          }}
                        >
                          <span>Request</span>
                          <IconButton
                            iconProps={{ iconName: "Download" }}
                            title="Save request"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              saveRequestToFile(request.requestBody);
                            }}
                            styles={{
                              root: {
                                minWidth: "28px",
                                width: "28px",
                                height: "28px",
                                color: "#334155",
                              },
                            }}
                          />
                        </div>
                      </div>
                      <div style={{ position: "relative" }}>
                        <SyntaxHighlighter
                          language="json"
                          style={atomOneDark}
                          wrapLongLines={true}
                          customStyle={{
                            borderRadius: "8px",
                            padding: "12px",
                            paddingRight: "50px"
                          }}
                        >
                          {formatJsonContent(request.requestBody)}
                        </SyntaxHighlighter>
                        <IconButton
                          iconProps={{ iconName: "Copy" }}
                          title="Copy request body to clipboard"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            copyToClipboard(request.requestBody);
                          }}
                          onMouseEnter={() => setHoveredButton('body-copy')}
                          onMouseLeave={() => setHoveredButton(null)}
                          styles={{
                            root: {
                              position: "absolute",
                              top: "8px",
                              right: "8px",
                              backgroundColor: hoveredButton === 'body-copy'
                                ? "rgba(255, 255, 255, 0.25)"
                                : "rgba(255, 255, 255, 0.1)",
                              color: "#fff",
                              border: hoveredButton === 'body-copy'
                                ? "1px solid rgba(255, 255, 255, 0.4)"
                                : "1px solid transparent",
                              borderRadius: "4px",
                              padding: "4px",
                              cursor: "pointer",
                              minWidth: "32px",
                              width: "32px",
                              height: "32px",
                              transition: "all 0.2s ease",
                              boxShadow: hoveredButton === 'body-copy'
                                ? "0 2px 6px rgba(0, 0, 0, 0.2)"
                                : "none"
                            }
                          }}
                        />
                      </div>
                    </div>
                  )}
                  {request.responseContent && request.responseContent.length > 0 && (
                    <div>
                      <div style={{
                        fontSize: "14px",
                        fontWeight: "bold",
                        color: "#333",
                        marginBottom: "8px"
                      }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: "8px",
                          }}
                        >
                          <span>Response</span>
                          <IconButton
                            iconProps={{ iconName: "Download" }}
                            title="Save response"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              saveResponseToFile(
                                request.responseContent,
                                "response"
                              );
                            }}
                            styles={{
                              root: {
                                minWidth: "28px",
                                width: "28px",
                                height: "28px",
                                color: "#334155",
                              },
                            }}
                          />
                        </div>
                      </div>
                      <div style={{ position: "relative" }}>
                        <SyntaxHighlighter
                          language="json"
                          style={atomOneDark}
                          wrapLongLines={true}
                          customStyle={{
                            borderRadius: "8px",
                            padding: "12px",
                            paddingRight: "50px"
                          }}
                        >
                          {formatJsonContent(request.responseContent)}
                        </SyntaxHighlighter>
                        <IconButton
                          iconProps={{ iconName: "Copy" }}
                          title="Copy response to clipboard"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            copyToClipboard(request.responseContent);
                          }}
                          onMouseEnter={() => setHoveredButton('response-copy')}
                          onMouseLeave={() => setHoveredButton(null)}
                          styles={{
                            root: {
                              position: "absolute",
                              top: "8px",
                              right: "8px",
                              backgroundColor: hoveredButton === 'response-copy'
                                ? "rgba(255, 255, 255, 0.25)"
                                : "rgba(255, 255, 255, 0.1)",
                              color: "#fff",
                              border: hoveredButton === 'response-copy'
                                ? "1px solid rgba(255, 255, 255, 0.4)"
                                : "1px solid transparent",
                              borderRadius: "4px",
                              padding: "4px",
                              cursor: "pointer",
                              minWidth: "32px",
                              width: "32px",
                              height: "32px",
                              transition: "all 0.2s ease",
                              boxShadow: hoveredButton === 'response-copy'
                                ? "0 2px 6px rgba(0, 0, 0, 0.2)"
                                : "none"
                            }
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {!request.code &&
        request.codeError &&
        request.codeError.length > 0 && (
          <div
            style={{
              marginTop: "12px",
              marginBottom: "12px",
              padding: "12px 14px",
              borderRadius: "8px",
              border: "1px solid #f3c58d",
              backgroundColor: "#fff4e5",
              color: "#7a3e00",
              fontSize: "13px",
              lineHeight: "1.4",
            }}
          >
            {isLocalOnlySnippetError
              ? "Snippet generation is blocked by Local only mode for this language. Enable external snippet generation if you want Graph X-Ray to call the DevX snippet service."
              : "Snippet generation failed for this request. Diagnostic mode can be used to export the full DevX error details."}
          </div>
        )}

      {request.code &&
        request.code.length > 0 &&
        renderCollapseHeader(
          isSnippetExpanded,
          toggleSnippet,
          "Snippet",
          snippetSourceMeta
            ? snippetSourceMeta.subtitle
            : "Expand to inspect the generated code.",
          <>
            {snippetSourceMeta &&
              renderStatusBadge(
                snippetSourceMeta.label,
                snippetSourceMeta.styles
              )}
            <IconButton
              iconProps={{ iconName: "Download" }}
              title="Save snippet"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                saveSnippetToFile(request.code);
              }}
              styles={{
                root: {
                  minWidth: "28px",
                  width: "28px",
                  height: "28px",
                  color: "#334155",
                },
              }}
            />
          </>
        )}

      {request.code && request.code.length > 0 && isSnippetExpanded && (
        <div style={{ position: "relative" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginBottom: "8px",
            }}
          >
            <IconButton
              iconProps={{ iconName: "Download" }}
              title="Save snippet"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                saveSnippetToFile(request.code);
              }}
              styles={{
                root: {
                  minWidth: "28px",
                  width: "28px",
                  height: "28px",
                  color: "#334155",
                  backgroundColor: "rgba(255, 255, 255, 0.9)",
                },
              }}
            />
          </div>
          <SyntaxHighlighter
            language={syntaxLanguage}
            style={atomOneDark}
            wrapLongLines={true}
            customStyle={{
              borderRadius: "8px",
              padding: "12px",
              paddingRight: "50px"
            }}
          >
            {request.code}
          </SyntaxHighlighter>
          <IconButton
            iconProps={{ iconName: "Copy" }}
            title="Copy code to clipboard"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              copyToClipboard(request.code);
            }}
            onMouseEnter={() => setHoveredButton('code-copy')}
            onMouseLeave={() => setHoveredButton(null)}
            styles={{
              root: {
                position: "absolute",
                top: "8px",
                right: "8px",
                backgroundColor: hoveredButton === 'code-copy'
                  ? "rgba(255, 255, 255, 0.25)"
                  : "rgba(255, 255, 255, 0.1)",
                color: "#fff",
                border: hoveredButton === 'code-copy'
                  ? "1px solid rgba(255, 255, 255, 0.4)"
                  : "1px solid transparent",
                borderRadius: "4px",
                padding: "4px",
                cursor: "pointer",
                minWidth: "32px",
                width: "32px",
                height: "32px",
                transition: "all 0.2s ease",
                boxShadow: hoveredButton === 'code-copy'
                  ? "0 2px 6px rgba(0, 0, 0, 0.2)"
                  : "none"
              }
            }}
          />
        </div>
      )}

      {/* Batch code snippets - show individual code blocks for each request in the batch */}
      {request.batchCodeSnippets &&
        request.batchCodeSnippets.length > 0 &&
        renderCollapseHeader(
          isBatchSnippetsExpanded,
          toggleBatchSnippets,
          "Individual request snippets",
          `${request.batchCodeSnippets.length} generated snippets inside this batch request.`
        )}

      {request.batchCodeSnippets &&
        request.batchCodeSnippets.length > 0 &&
        isBatchSnippetsExpanded && (
        <div style={{ marginTop: "15px" }}>
          {request.batchCodeSnippets.map((snippet, index) => (
            <div key={snippet.id} style={{
              marginBottom: index < request.batchCodeSnippets.length - 1 ? "20px" : "0"
            }}>
              <div style={{
                fontSize: "14px",
                fontWeight: "bold",
                color: "#666",
                marginBottom: "8px"
              }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "8px",
                  }}
                >
                          <span>
                            Request ID: {snippet.id} - {snippet.method} {snippet.url}
                          </span>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    {snippet.codeSource &&
                      renderStatusBadge(
                        getSnippetSourceMeta(snippet.codeSource)?.label ||
                          "Snippet",
                        getSnippetSourceMeta(snippet.codeSource)?.styles || {}
                      )}
                    <IconButton
                      iconProps={{ iconName: "Download" }}
                      title="Save individual snippet"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        saveSnippetToFile(
                          snippet.code,
                          "snippet",
                          snippet.url,
                          snippet.method,
                          [snippet.id]
                        );
                      }}
                      styles={{
                        root: {
                          minWidth: "28px",
                          width: "28px",
                          height: "28px",
                          color: "#334155",
                        },
                      }}
                    />
                  </div>
                </div>
              </div>
              <div style={{ position: "relative" }}>
                <SyntaxHighlighter
                  language={syntaxLanguage}
                  style={atomOneDark}
                  wrapLongLines={true}
                  customStyle={{
                    borderRadius: "8px",
                    padding: "12px",
                    paddingRight: "50px"
                  }}
                >
                  {snippet.code}
                </SyntaxHighlighter>
                <IconButton
                  iconProps={{ iconName: "Copy" }}
                  title="Copy individual code to clipboard"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    copyToClipboard(snippet.code);
                  }}
                  onMouseEnter={() => setHoveredButton(`batch-code-${index}`)}
                  onMouseLeave={() => setHoveredButton(null)}
                  styles={{
                    root: {
                      position: "absolute",
                      top: "8px",
                      right: "8px",
                      backgroundColor: hoveredButton === `batch-code-${index}`
                        ? "rgba(255, 255, 255, 0.25)"
                        : "rgba(255, 255, 255, 0.1)",
                      color: "#fff",
                      border: hoveredButton === `batch-code-${index}`
                        ? "1px solid rgba(255, 255, 255, 0.4)"
                        : "1px solid transparent",
                      borderRadius: "4px",
                      padding: "4px",
                      cursor: "pointer",
                      minWidth: "32px",
                      width: "32px",
                      height: "32px",
                      transition: "all 0.2s ease",
                      boxShadow: hoveredButton === `batch-code-${index}`
                        ? "0 2px 6px rgba(0, 0, 0, 0.2)"
                        : "none"
                    }
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
