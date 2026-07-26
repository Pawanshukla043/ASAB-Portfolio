/**
 * ============================================================
 *  ALLOWED DOMAINS & KEY VALIDATION
 * ============================================================
 *
 *  Reads from the "allowed_domains" sheet which has 2 columns:
 *    secret_key  |  domain
 *
 *  On each request, the backend checks:
 *    1. The provided _key exists in the sheet
 *    2. The provided _origin matches a domain associated with that key
 *  Only if both match, the request is allowed.
 *
 *  To add/rotate keys or domains — just edit the sheet. No code changes needed.
 * ============================================================
 */

const ALLOWED_DOMAINS_CACHE_KEY = "allowed_domains_v1";
const ALLOWED_DOMAINS_CACHE_TTL = 120; // 2 minutes

/**
 * Loads the allowed_domains sheet into a Map:
 *   secret_key -> [domain1, domain2, ...]
 * Uses CacheService to avoid reading the sheet on every request.
 */
function loadAllowedDomains() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get(ALLOWED_DOMAINS_CACHE_KEY);

  if (cached) {
    const parsed = JSON.parse(cached);
    const map = new Map();
    for (const [key, domains] of Object.entries(parsed)) {
      map.set(key, domains);
    }
    return map;
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("allowed_domains");

  if (!sheet) {
    console.warn('Sheet "allowed_domains" not found. Denying all requests as fallback.');
    return new Map();
  }

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) {
    console.warn('Sheet "allowed_domains" has no data rows. Denying all requests.');
    return new Map();
  }

  // Build the map: secret_key -> Set of domains
  const domainMap = new Map();

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (!row[0] && !row[1]) continue; // skip empty rows

    const secretKey = String(row[0] || "").trim();
    const domain = String(row[1] || "").trim();

    if (!secretKey || !domain) continue;

    if (!domainMap.has(secretKey)) {
      domainMap.set(secretKey, []);
    }
    domainMap.get(secretKey).push(domain);
  }

  // Cache the map as a plain object (Map isn't serializable)
  const cacheObj = {};
  for (const [key, domains] of domainMap) {
    cacheObj[key] = domains;
  }
  cache.put(ALLOWED_DOMAINS_CACHE_KEY, JSON.stringify(cacheObj), ALLOWED_DOMAINS_CACHE_TTL);

  return domainMap;
}

/**
 * Validates the request by checking:
 *   - _key is present and exists in allowed_domains
 *   - _origin matches a domain associated with that key
 */
function validateRequest(e) {
  const providedKey = (e && e.parameter && e.parameter._key)
    ? e.parameter._key
    : "";

  const providedOrigin = (e && e.parameter && e.parameter._origin)
    ? e.parameter._origin
    : "";

  if (!providedKey) {
    return { valid: false, reason: "Missing API key" };
  }

  if (!providedOrigin) {
    return { valid: false, reason: "Missing origin" };
  }

  const domainMap = loadAllowedDomains();
  const allowedDomains = domainMap.get(providedKey);

  if (!allowedDomains) {
    return { valid: false, reason: "Invalid API key" };
  }

  // Check if the provided origin matches any allowed domain
  const isDomainAllowed = allowedDomains.some(allowedDomain =>
    providedOrigin === allowedDomain ||
    providedOrigin.startsWith(allowedDomain + "/") ||
    providedOrigin.startsWith(allowedDomain + ":")
  );

  if (!isDomainAllowed) {
    return { valid: false, reason: "Domain not allowed for this API key" };
  }

  return { valid: true };
}

function buildErrorResponse(message) {
  return ContentService
    .createTextOutput(JSON.stringify({
      success: false,
      error: message
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * ============================================================
 *  GET WEBSITE DATA
 * ============================================================
 */

function doGet(e) {
  try {
    // Validate API key + domain
    const validation = validateRequest(e);
    if (!validation.valid) {
      console.warn("GET request rejected:", validation.reason);
      return buildErrorResponse(validation.reason);
    }

    const cache = CacheService.getScriptCache();
    const CACHE_KEY = "website_data_v1";
    // Return cached response if available
    const cached = cache.get(CACHE_KEY);
    if (cached) {
      return ContentService
        .createTextOutput(cached)
        .setMimeType(ContentService.MimeType.JSON);
    }
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const response = {
      settings: getSheetData(ss, "settings"),
      journey: getSheetObjects(ss, "journey"),
      stats: getSheetObjects(ss, "stats"),
      music_iframes: getSheetObjects(ss, "music_iframes"),
      videos: getSheetData(ss, "videos"),
      shorts: getSheetObjects(ss, "shorts"),
      goals: getSheetObjects(ss, "goals")
    };
    const json = JSON.stringify(response);
    // Cache for 5 minutes (300 seconds)
    cache.put(CACHE_KEY, json, 300);
    return ContentService
      .createTextOutput(json)
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    console.error(error);
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: error.message
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}


/**
 * ============================================================
 *  SETTINGS SHEETS (Key -> Value)
 * ============================================================
 */

function getSheetData(ss, sheetName) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error(`Sheet "${sheetName}" not found.`);
  }
  const values = sheet.getDataRange().getValues();
  const obj = {};
  for (let i = 1; i < values.length; i++) {
    // Skip empty rows
    if (values[i].every(cell => cell === "")) continue;
    const key = values[i][0];
    if (!key) continue;
    obj[key] = values[i][1];
  }
  return obj;
}


/**
 * ============================================================
 *  TABLE SHEETS
 * ============================================================
 */

function getSheetObjects(ss, sheetName) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error(`Sheet "${sheetName}" not found.`);
  }
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) {
    return [];
  }
  const headers = values[0];
  const rows = [];
  for (let i = 1; i < values.length; i++) {
    // Skip completely empty rows
    if (values[i].every(cell => cell === "")) continue;
    const row = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[i][j];
    }
    rows.push(row);
  }
  return rows;
}
