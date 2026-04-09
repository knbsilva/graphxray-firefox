// Centralized domain configuration for Graph X-Ray
export const GRAPH_DOMAINS = {
  // Standard Microsoft Graph API endpoints
  STANDARD: [
    "https://graph.microsoft.com",
    "https://graph.microsoft.us",
    "https://dod-graph.microsoft.us",
    "https://microsoftgraph.chinacloudapi.cn"
  ],
  
  // Ultra X-Ray mode endpoints (undocumented/internal APIs)
  ULTRA_XRAY: [
    "https://main.iam.ad.ext.azure.com",
    "https://elm.iga.azure.com",
    "https://pds.iga.azure.com",
    "https://api.accessreviews.identitygovernance.azure.com",
    "https://management.azure.com",
    "https://admin.microsoft.com",
    "https://portal.office.com",
    "https://security.microsoft.com",
    "https://graph.windows.net",
    "https://api.azrbac.mspim.azure.com",
    "https://admin.powerplatform.microsoft.com",
    "https://admin.cloud.microsoft"
    // Additional ultra endpoints can be added here in the future
  ]
};

const getUrlOrigin = (url) => {
  try {
    return new URL(url).origin;
  } catch (error) {
    return null;
  }
};

// Helper function to get all domains based on ultra mode setting
export const getAllowedDomains = (ultraXRayMode = false) => {
  if (ultraXRayMode) {
    return [...GRAPH_DOMAINS.STANDARD, ...GRAPH_DOMAINS.ULTRA_XRAY];
  }
  return GRAPH_DOMAINS.STANDARD;
};

// Helper function to check if a URL matches any allowed domain
export const isAllowedDomain = (url, ultraXRayMode = false) => {
  const allowedDomains = getAllowedDomains(ultraXRayMode);
  const origin = getUrlOrigin(url);
  if (!origin) {
    return false;
  }
  return allowedDomains.includes(origin);
};

// Helper function to check if a URL is from an Ultra X-Ray domain
export const isUltraXRayDomain = (url) => {
  const origin = getUrlOrigin(url);
  if (!origin) {
    return false;
  }
  return GRAPH_DOMAINS.ULTRA_XRAY.includes(origin);
};

// Helper function to get all domain URLs for webRequest (includes wildcards)
export const getAllDomainUrls = () => {
  const allDomains = [...GRAPH_DOMAINS.STANDARD, ...GRAPH_DOMAINS.ULTRA_XRAY];
  return allDomains.map(domain => `${domain}/*`);
};

export const getAllowedDomainUrls = (ultraXRayMode = false) =>
  getAllowedDomains(ultraXRayMode).map((domain) => `${domain}/*`);

// Helper function to parse domain from URL for host determination
export const parseGraphUrl = (url) => {
  try {
    const parsedUrl = new URL(url);
    return {
      path: `${parsedUrl.pathname}${parsedUrl.search}`,
      host: parsedUrl.host,
    };
  } catch (error) {
    return {
      path: url,
      host: "graph.microsoft.com",
    };
  }
};
