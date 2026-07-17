function doGet() {
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
  
  return ContentService
    .createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSheetData(ss, sheetName) {
  const sheet = ss.getSheetByName(sheetName);
  const data = sheet.getDataRange().getValues();
  const obj = {};
  
  for (let i = 1; i < data.length; i++) {
    obj[data[i][0]] = data[i][1];
  }
  
  return obj;
}

function getSheetObjects(ss, sheetName) {
  const sheet = ss.getSheetByName(sheetName);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const arr = [];
  
  for (let i = 1; i < data.length; i++) {
    let rowObj = {};
    for (let j = 0; j < headers.length; j++) {
      rowObj[headers[j]] = data[i][j];
    }
    arr.push(rowObj);
  }
  
  return arr;
}