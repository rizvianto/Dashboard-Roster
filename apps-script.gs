// ============================================================
//  Intrepid Shoot Session — Google Apps Script Web App
//  Receives POST from submit.html and appends a row to the
//  "Production Roster" sheet.
// ============================================================
//
//  SETUP (do this once):
//
//  1. Open the Google Sheet:
//     https://docs.google.com/spreadsheets/d/1R83tcGSZs8BgMHXt5hwByimyVUCKqyhKTUVZhNjTCbA/edit
//
//  2. Extensions → Apps Script
//     Paste this entire file into the editor, save (Ctrl+S).
//
//  3. Deploy → New deployment
//     - Type: Web app
//     - Execute as: Me (your Google account)
//     - Who has access: Anyone
//     Click Deploy, authorise when prompted.
//
//  4. Copy the Web App URL (looks like:
//     https://script.google.com/macros/s/AKfycb.../exec)
//     Paste it into submit.html → CONFIG.appsScriptUrl
//
//  5. Create a Google OAuth Client ID:
//     a. Go to https://console.cloud.google.com/
//     b. Select (or create) a project
//     c. APIs & Services → Credentials → Create Credentials → OAuth client ID
//     d. Application type: Web application
//     e. Authorised JavaScript origins — add BOTH:
//          https://rizvianto.github.io
//          http://localhost   (for local testing)
//     f. Copy the Client ID (ends in .apps.googleusercontent.com)
//     g. Paste it into submit.html → CONFIG.googleClientId
//
//  After both values are in submit.html, commit and push to main.
//  The form at https://rizvianto.github.io/Dashboard-Roster/submit.html
//  will then be fully functional.
//
// ============================================================

var SHEET_ID   = "1R83tcGSZs8BgMHXt5hwByimyVUCKqyhKTUVZhNjTCbA";
var SHEET_NAME = "Production Roster";

function doPost(e) {
  try {
    var data  = JSON.parse(e.postData.contents);
    var ss    = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName(SHEET_NAME);

    if (!sheet) throw new Error("Sheet '" + SHEET_NAME + "' not found");

    // Auto-increment the No. column
    var lastRow = sheet.getLastRow();
    var nextNo  = 1;
    if (lastRow > 1) {
      var lastNoVal = sheet.getRange(lastRow, 1).getValue();
      nextNo = (typeof lastNoVal === "number" && lastNoVal > 0) ? lastNoVal + 1 : lastRow;
    }

    // Convert ISO date (YYYY-MM-DD) → DD/MM/YYYY to match existing sheet format
    var parts = String(data.date || "").split("-");
    var dateOut = (parts.length === 3)
      ? parts[2] + "/" + parts[1] + "/" + parts[0]
      : (data.date || "");

    sheet.appendRow([
      nextNo,
      data.brand   || "",
      data.talent  || "",
      dateOut,
      data.pic     || "",
      Number(data.videos) || 0,
      Number(data.hours)  || 0
    ]);

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, no: nextNo }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Health-check: open the Web App URL in a browser to confirm it's running
function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, msg: "Intrepid Apps Script endpoint is active" }))
    .setMimeType(ContentService.MimeType.JSON);
}
