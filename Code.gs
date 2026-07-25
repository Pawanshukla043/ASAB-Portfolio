/**
 * ============================================================
 *  GET WEBSITE DATA
 * ============================================================
 */

function doGet() {
  try {
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