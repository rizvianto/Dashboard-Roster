// ============================================================
//  Intrepid Weekly Shoot Schedule — Google Apps Script Web App
//  Serves schedule.html: reads the "This Week" and "Log" tabs,
//  adds shoots and changes statuses. Every request must carry a
//  Google sign-in from an @intrepid.asia account, which this
//  script verifies with Google before touching the sheet.
// ============================================================
//
//  SETUP (do this once):
//
//  1. Open the schedule sheet:
//     https://docs.google.com/spreadsheets/d/1lsUyXJX0nlDrtv_T5AJuOjU-05bntdkAWJdp823bBWA/edit
//
//  2. Extensions → Apps Script
//     Paste this entire file into the editor, save (Ctrl+S).
//
//  3. Deploy → New deployment
//     - Type: Web app
//     - Execute as: Me (your Google account)
//     - Who has access: Anyone
//     Click Deploy, authorise when prompted (it asks for the
//     spreadsheet and for "connect to an external service",
//     which is the sign-in check with Google).
//
//  4. Copy the Web App URL (ends in /exec) and paste it into
//     schedule.html → CONFIG.scriptUrl, then commit and push to main.
//
//  No new OAuth Client ID is needed: this reuses the one already
//  set up for submit.html.
//
//  After editing this file later: Deploy → Manage deployments →
//  Edit → Version: New version. Otherwise the old code keeps running.
//
// ============================================================

var SHEET_ID = "1lsUyXJX0nlDrtv_T5AJuOjU-05bntdkAWJdp823bBWA";
var WEEK_SHEET = "This Week";
var LOG_SHEET = "Log";
var FIRST_ROW = 5; // first schedule row under the header on "This Week"

var CLIENT_ID = "373030385336-uflrubpps2530prn3qe0ulg4020cgmu4.apps.googleusercontent.com";
var ALLOWED_DOMAIN = "intrepid.asia";

var STATUSES = ["Scheduled", "In Progress", "Completed", "Postponed", "Cancelled"];
var DAYS = ["Mon", "Tues", "Wed", "Thurs", "Fri", "Sat", "Sun"];

function doPost(e) {
  var out;
  try {
    var body = JSON.parse(e.postData.contents);
    verifySignIn_(body.idToken);
    if (body.action === "read") {
      out = snapshot_();
    } else {
      var lock = LockService.getScriptLock();
      lock.waitLock(20000);
      try {
        if (body.action === "add") addShoot_(body);
        else if (body.action === "status") setStatus_(body);
        else throw new Error("Unknown action.");
        SpreadsheetApp.flush();
        out = snapshot_();
      } finally {
        lock.releaseLock();
      }
    }
    out.ok = true;
  } catch (err) {
    out = { ok: false, error: String((err && err.message) || err), signIn: !!(err && err.signIn) };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

// Health-check: open the Web App URL in a browser to confirm it's running
function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, msg: "Intrepid schedule endpoint is active" }))
    .setMimeType(ContentService.MimeType.JSON);
}

// Google checks the token's signature and expiry; we check who it was issued to and for.
function verifySignIn_(idToken) {
  function fail(msg) { var e = new Error(msg); e.signIn = true; return e; }
  if (!idToken) throw fail("Sign in first.");
  var res = UrlFetchApp.fetch("https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(idToken), { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw fail("Your sign-in has expired. Sign in again.");
  var info = JSON.parse(res.getContentText());
  if (info.aud !== CLIENT_ID) throw fail("This sign-in was not issued for the schedule dashboard.");
  if (info.hd !== ALLOWED_DOMAIN || String(info.email_verified) !== "true") {
    throw fail("Only @" + ALLOWED_DOMAIN + " accounts can use the schedule.");
  }
}

function weekSheet_() {
  var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(WEEK_SHEET);
  if (!sheet) throw new Error("Sheet '" + WEEK_SHEET + "' not found.");
  return sheet;
}

// Schedule rows run from FIRST_ROW to the row above "Weekly Summary" (or the last row if there is none).
function bounds_(sheet) {
  var lastRow = Math.max(sheet.getLastRow(), FIRST_ROW);
  var colA = sheet.getRange(FIRST_ROW, 1, lastRow - FIRST_ROW + 1, 1).getDisplayValues();
  for (var i = 0; i < colA.length; i++) {
    if (colA[i][0].trim().toLowerCase() === "weekly summary") {
      return { end: Math.max(FIRST_ROW + i - 1, FIRST_ROW), hasSummary: true };
    }
  }
  return { end: lastRow, hasSummary: false };
}

function snapshot_() {
  var sheet = weekSheet_();
  var b = bounds_(sheet);
  var values = sheet.getRange(FIRST_ROW, 1, b.end - FIRST_ROW + 1, 6).getDisplayValues();
  var rows = [];
  values.forEach(function (v, i) {
    if (!v[1].trim() && !v[2].trim()) return;
    rows.push({ row: FIRST_ROW + i, no: v[0], brand: v[1].trim(), talent: v[2].trim(), videos: v[3], days: v[4].trim(), status: v[5].trim() });
  });
  var log = [];
  var logSheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(LOG_SHEET);
  if (logSheet) {
    logSheet.getDataRange().getDisplayValues().slice(1).forEach(function (v) {
      if (!v[1] || !v[1].trim()) return;
      log.push({ week: v[0], brand: v[1].trim(), talent: (v[2] || "").trim(), videos: v[3], days: (v[4] || "").trim(), status: (v[5] || "").trim() });
    });
  }
  return { week: sheet.getRange("A1").getDisplayValue(), rows: rows, log: log };
}

function text_(value, label) {
  var s = String(value == null ? "" : value).trim();
  if (!s) throw new Error(label + " is required.");
  if (s.length > 80) throw new Error(label + " is too long (80 characters max).");
  // A leading =, +, - or @ would be read by Sheets as a formula
  if (/^[=+\-@]/.test(s)) throw new Error(label + " cannot start with =, +, - or @.");
  return s;
}

function addShoot_(body) {
  var brand = text_(body.brand, "Brand");
  var talent = text_(body.talent, "Talent");
  var videos = Number(body.videos);
  if (Math.floor(videos) !== videos || videos < 0 || videos > 999) throw new Error("# Videos must be a whole number from 0 to 999.");
  var days = (body.days || []).filter(function (d) { return DAYS.indexOf(d) !== -1; });
  if (!days.length) throw new Error("Pick at least one shoot day.");
  var status = STATUSES.indexOf(body.status) !== -1 ? body.status : "Scheduled";

  var sheet = weekSheet_();
  var b = bounds_(sheet);
  var values = sheet.getRange(FIRST_ROW, 1, b.end - FIRST_ROW + 1, 3).getDisplayValues();
  var target = 0;
  var maxNo = 0;
  values.forEach(function (v, i) {
    var n = Number(v[0]);
    if (n > maxNo) maxNo = n;
    if (!target && !v[1].trim() && !v[2].trim()) target = FIRST_ROW + i;
  });
  if (!target) {
    if (b.hasSummary) {
      // Insert inside the block so summary formulas grow with it, then keep the new shoot last.
      sheet.insertRowBefore(b.end);
      sheet.getRange(b.end + 1, 1, 1, 6).copyTo(sheet.getRange(b.end, 1, 1, 6));
    }
    target = b.end + 1;
  }
  sheet.getRange(target, 1, 1, 6).setValues([[maxNo + 1, brand, talent, videos, days.join(", "), status]]);
}

function setStatus_(body) {
  if (STATUSES.indexOf(body.status) === -1) throw new Error("Unknown status.");
  var sheet = weekSheet_();
  var b = bounds_(sheet);
  var row = Number(body.row);
  if (Math.floor(row) !== row || row < FIRST_ROW || row > b.end) throw new Error("That row is no longer in the schedule. Refresh and try again.");
  var current = sheet.getRange(row, 2, 1, 2).getDisplayValues()[0];
  if (current[0].trim() !== String(body.brand || "").trim() || current[1].trim() !== String(body.talent || "").trim()) {
    throw new Error("That row changed in the sheet. Refresh and try again.");
  }
  sheet.getRange(row, 6).setValue(body.status);
}
