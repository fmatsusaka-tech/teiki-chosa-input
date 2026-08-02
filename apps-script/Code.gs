const SPREADSHEET_ID = "1Ix7qFigeUvmxkEl3C51rmzuBzYDq7OR_ZGHq6GUKa0g";
const RAW_SHEET_NAME = "調査原票";
const SURVEY_SHEET_NAME = "調査データ";
const API_TOKEN_PROPERTY = "API_TOKEN";
const MAX_DIAMETERS = 10;
const ACTIVE_STATUS_HEADER = "有効状態";
const ACTIVE_STATUS_VALUES = ["有効", "無効"];
const CANONICAL_RAW_HEADERS = [
  "登録ID", "編集キーハッシュ", "登録日時", "更新日時", "改訂番号", "データ状態",
  "計測日", "園地名", "品種", "処理区", "備考",
  "横径1", "横径2", "横径3", "横径4", "横径5", "横径6", "横径7", "横径8", "横径9", "横径10",
  "糖度", "酸度", "入力方法", "入力者", "送信元", "原文メモ",
];
const DIAMETER_OUTPUT_HEADERS = Array.from(
  { length: MAX_DIAMETERS },
  (_, index) => `玉${index + 1}横径`,
);
const DIAMETER_SUMMARY_HEADERS = ["横径個数", "横径平均", "横径最小", "横径最大"];

function doGet() {
  return jsonResponse_({ ok: true, service: "teiki-chosa-registration" });
}

function doPost(e) {
  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(10000);
    const payload = parsePayload_(e);
    verifyToken_(payload.token);

    if (!Array.isArray(payload.records) || payload.records.length === 0) {
      throw new Error("登録対象のデータがありません。");
    }

    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(RAW_SHEET_NAME);
    if (!sheet) throw new Error(`シート「${RAW_SHEET_NAME}」が見つかりません。`);

    const rawHeaders = getHeaders_(sheet);
    validateCanonicalHeaders_(rawHeaders);
    const existingIds = getExistingIds_(sheet, rawHeaders);
    const now = new Date();
    const rows = [];
    const acceptedIds = [];
    const editCredentials = [];
    const skippedIds = [];

    payload.records.forEach((record, index) => {
      validateRecord_(record, index);
      const registrationId = String(record.registrationId || Utilities.getUuid());

      if (existingIds.has(registrationId)) {
        skippedIds.push(registrationId);
        return;
      }

      const diameters = Array.isArray(record.diametersMm)
        ? record.diametersMm.slice(0, MAX_DIAMETERS)
        : [];
      while (diameters.length < MAX_DIAMETERS) diameters.push("");
      const editKey = createEditKey_();
      const editKeyHash = hashEditKey_(editKey);

      const cells = {
        登録ID: registrationId,
        編集キーハッシュ: editKeyHash,
        登録日時: now,
        更新日時: now,
        改訂番号: 1,
        データ状態: "有効",
        計測日: new Date(record.measuredAt),
        園地名: cleanText_(record.orchard),
        品種: cleanText_(record.variety),
        処理区: cleanText_(record.treatment || ""),
        備考: cleanText_(record.notes || ""),
        糖度: optionalNumber_(record.brix),
        酸度: optionalNumber_(record.acidity),
        入力方法: cleanText_(record.source || "text"),
        入力者: cleanText_(payload.operator || record.operator || ""),
        送信元: cleanText_(payload.client || "定期調査入力アプリ"),
        原文メモ: cleanText_(payload.sourceText || ""),
      };
      diameters.forEach((diameter, diameterIndex) => {
        cells[`横径${diameterIndex + 1}`] = diameter;
      });
      rows.push(rowForHeaders_(cells, rawHeaders));
      acceptedIds.push(registrationId);
      editCredentials.push({ registrationId, editKey });
      existingIds.add(registrationId);
    });

    if (rows.length > 0) {
      const startRow = sheet.getLastRow() + 1;
      sheet.getRange(startRow, 1, rows.length, rows[0].length).setValues(rows);
      ["登録日時", "更新日時", "計測日"].forEach((header) => {
        const columnIndex = rawHeaders.indexOf(header);
        if (columnIndex >= 0) {
          sheet.getRange(startRow, columnIndex + 1, rows.length, 1).setNumberFormat("yyyy/mm/dd hh:mm:ss");
        }
      });
    }

    return jsonResponse_({
      ok: true,
      registeredCount: rows.length,
      skippedCount: skippedIds.length,
      registrationIds: acceptedIds,
      editCredentials,
      skippedIds,
    });
  } catch (error) {
    console.error(error);
    return jsonResponse_({
      ok: false,
      error: error && error.message ? error.message : String(error),
    });
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

/**
 * Add missing canonical columns without moving, renaming, or deleting existing columns.
 * Existing records cannot receive a usable edit key retroactively, so their hash remains blank.
 */
function setupCanonicalRawSheet() {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(RAW_SHEET_NAME);
  if (!sheet) throw new Error(`シート「${RAW_SHEET_NAME}」が見つかりません。`);

  const originalHeaders = getHeaders_(sheet);
  const duplicates = originalHeaders.filter((header, index) => originalHeaders.indexOf(header) !== index);
  if (duplicates.length > 0) {
    throw new Error(`調査原票の見出しが重複しています: ${[...new Set(duplicates)].join(", ")}`);
  }
  const missingHeaders = CANONICAL_RAW_HEADERS.filter((header) => !originalHeaders.includes(header));
  if (missingHeaders.length > 0) {
    const startColumn = Math.max(sheet.getLastColumn(), 0) + 1;
    sheet.getRange(1, startColumn, 1, missingHeaders.length).setValues([missingHeaders]);
  }

  const headers = getHeaders_(sheet);
  const rowCount = Math.max(sheet.getLastRow() - 1, 0);
  if (rowCount === 0) return { addedHeaders: missingHeaders, updatedRows: 0 };

  const registeredAtColumn = headers.indexOf("登録日時") + 1;
  const updatedAtColumn = headers.indexOf("更新日時") + 1;
  const revisionColumn = headers.indexOf("改訂番号") + 1;
  const statusColumn = headers.indexOf("データ状態") + 1;
  const registeredValues = sheet.getRange(2, registeredAtColumn, rowCount, 1).getValues();
  const updatedValues = sheet.getRange(2, updatedAtColumn, rowCount, 1).getValues();
  const revisionValues = sheet.getRange(2, revisionColumn, rowCount, 1).getValues();
  const statusValues = sheet.getRange(2, statusColumn, rowCount, 1).getValues();

  for (let index = 0; index < rowCount; index += 1) {
    if (updatedValues[index][0] === "") updatedValues[index][0] = registeredValues[index][0];
    if (revisionValues[index][0] === "") revisionValues[index][0] = 1;
    if (statusValues[index][0] === "") statusValues[index][0] = "有効";
  }
  sheet.getRange(2, updatedAtColumn, rowCount, 1).setValues(updatedValues).setNumberFormat("yyyy/mm/dd hh:mm:ss");
  sheet.getRange(2, revisionColumn, rowCount, 1).setValues(revisionValues);
  sheet.getRange(2, statusColumn, rowCount, 1).setValues(statusValues);
  return { addedHeaders: missingHeaders, updatedRows: rowCount };
}

/**
 * 「調査原票」から「調査データ」を全件再生成する。
 * 既存データの再生成時にも、列位置ではなく見出し名だけを使用する。
 */
function regenerateSurveyData() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const rawSheet = spreadsheet.getSheetByName(RAW_SHEET_NAME);
  const surveySheet = spreadsheet.getSheetByName(SURVEY_SHEET_NAME);
  if (!rawSheet || !surveySheet) throw new Error("調査原票または調査データが見つかりません。");

  const rawHeaders = getHeaders_(rawSheet);
  const existingSurveyHeaders = getHeaders_(surveySheet);
  const activeStatusById = activeStatusByRegistrationId_(
    existingSurveyHeaders,
    surveySheet.getLastRow() < 2
      ? []
      : surveySheet.getRange(
        2, 1, surveySheet.getLastRow() - 1, existingSurveyHeaders.length,
      ).getValues(),
  );
  const surveyHeaders = ensureSurveyActiveStatusHeader_(
    ensureDiameterOutputHeaders_(existingSurveyHeaders),
  );
  surveySheet.getRange(1, 1, 1, surveyHeaders.length).setValues([surveyHeaders]);

  const rawRows = rawSheet.getLastRow() < 2
    ? []
    : rawSheet.getRange(2, 1, rawSheet.getLastRow() - 1, rawHeaders.length).getValues();
  const outputRows = rawRows.map((row) => {
    const outputRow = buildSurveyDataRow_(rawHeaders, row, surveyHeaders);
    const registrationId = cleanText_(outputRow[surveyHeaders.indexOf("登録ID")]);
    outputRow[surveyHeaders.indexOf(ACTIVE_STATUS_HEADER)] = activeStatusById.get(registrationId) ?? "";
    return outputRow;
  });

  const oldDataRows = Math.max(surveySheet.getLastRow() - 1, 0);
  if (oldDataRows > 0) surveySheet.getRange(2, 1, oldDataRows, surveySheet.getLastColumn()).clearContent();
  if (outputRows.length > 0) {
    surveySheet.getRange(2, 1, outputRows.length, surveyHeaders.length).setValues(outputRows);
  }
  applySurveyActiveStatusValidation_(surveySheet, surveyHeaders);
  return outputRows.length;
}

/** Add the manual active-status column without changing existing header order. */
function setupSurveyActiveStatusColumn() {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SURVEY_SHEET_NAME);
  if (!sheet) throw new Error(`シート「${SURVEY_SHEET_NAME}」が見つかりません。`);
  const originalHeaders = getHeaders_(sheet);
  const duplicates = originalHeaders.filter(
    (header, index) => header === ACTIVE_STATUS_HEADER && originalHeaders.indexOf(header) !== index,
  );
  if (duplicates.length > 0) throw new Error(`調査データの「${ACTIVE_STATUS_HEADER}」見出しが重複しています。`);
  const headers = ensureSurveyActiveStatusHeader_(originalHeaders);
  if (!originalHeaders.includes(ACTIVE_STATUS_HEADER)) {
    sheet.getRange(1, headers.indexOf(ACTIVE_STATUS_HEADER) + 1).setValue(ACTIVE_STATUS_HEADER);
  }
  applySurveyActiveStatusValidation_(sheet, headers);
  return summarizeSurveyActiveStatuses_(headers, sheet.getLastRow() < 2
    ? []
    : sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues());
}

function ensureSurveyActiveStatusHeader_(headers) {
  return headers.includes(ACTIVE_STATUS_HEADER) ? [...headers] : [...headers, ACTIVE_STATUS_HEADER];
}

function applySurveyActiveStatusValidation_(sheet, headers) {
  const column = headers.indexOf(ACTIVE_STATUS_HEADER) + 1;
  if (column <= 0) throw new Error(`調査データに「${ACTIVE_STATUS_HEADER}」見出しがありません。`);
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(ACTIVE_STATUS_VALUES, true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange(2, column, Math.max(sheet.getMaxRows() - 1, 1), 1).setDataValidation(rule);
}

function parseActiveStatus_(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return ACTIVE_STATUS_VALUES.includes(normalized) ? normalized : null;
}

function isSurveyRowAdopted_(headers, row, acceptedDataStatuses) {
  const activeIndex = headers.indexOf(ACTIVE_STATUS_HEADER);
  const dataStatusIndex = headers.indexOf("データ状態");
  if (activeIndex < 0 || dataStatusIndex < 0) return false;
  if (parseActiveStatus_(row[activeIndex]) !== "有効") return false;
  const dataStatus = cleanText_(row[dataStatusIndex]);
  return Array.isArray(acceptedDataStatuses) && acceptedDataStatuses.includes(dataStatus);
}

function activeStatusByRegistrationId_(headers, rows) {
  const idIndex = headers.indexOf("登録ID");
  const statusIndex = headers.indexOf(ACTIVE_STATUS_HEADER);
  const result = new Map();
  if (idIndex < 0 || statusIndex < 0) return result;
  rows.forEach((row) => {
    const id = cleanText_(row[idIndex]);
    if (id) result.set(id, row[statusIndex]);
  });
  return result;
}

function summarizeSurveyActiveStatuses_(headers, rows) {
  const statusIndex = headers.indexOf(ACTIVE_STATUS_HEADER);
  const summary = { totalRows: rows.length, active: 0, inactive: 0, blank: 0, unknown: 0 };
  rows.forEach((row) => {
    const value = statusIndex < 0 ? "" : row[statusIndex];
    if (value === "" || value === null || value === undefined) summary.blank += 1;
    else if (parseActiveStatus_(value) === "有効") summary.active += 1;
    else if (parseActiveStatus_(value) === "無効") summary.inactive += 1;
    else summary.unknown += 1;
  });
  return summary;
}

function ensureDiameterOutputHeaders_(headers) {
  const diameterHeaders = [...DIAMETER_OUTPUT_HEADERS, ...DIAMETER_SUMMARY_HEADERS];
  const retained = headers.filter((header) => !diameterHeaders.includes(header));
  const notesIndex = retained.indexOf("備考");
  const insertionIndex = notesIndex >= 0 ? notesIndex + 1 : retained.length;
  retained.splice(insertionIndex, 0, ...diameterHeaders);
  return retained;
}

function buildSurveyDataRow_(rawHeaders, rawRow, surveyHeaders) {
  const raw = Object.fromEntries(rawHeaders.map((header, index) => [header, rawRow[index]]));
  const diameters = Array.from({ length: MAX_DIAMETERS }, (_, index) => raw[`横径${index + 1}`])
    .filter((value) => value !== "" && value !== null && value !== undefined);
  const numericDiameters = diameters.map(Number).filter(Number.isFinite);
  const cells = { ...raw };
  const measuredAt = raw["調査日"] ?? raw["計測日"] ?? "";
  const dateParts = surveyDateParts_(measuredAt);
  cells["調査日"] = measuredAt;
  cells["園地"] = raw["園地"] ?? raw["園地名"] ?? "";
  cells["年度"] = dateParts ? fiscalYear_(dateParts.year, dateParts.month) : "";
  cells["年"] = dateParts ? dateParts.year : "";
  cells["月"] = dateParts ? dateParts.month : "";
  cells["調査基準月"] = dateParts ? surveyBaseMonth_(dateParts.month, dateParts.day) : "";
  cells["調査区分"] = dateParts ? surveyPeriod_(dateParts.day) : "";
  DIAMETER_OUTPUT_HEADERS.forEach((header, index) => {
    const value = raw[`横径${index + 1}`];
    cells[header] = value === null || value === undefined ? "" : value;
  });
  cells["横径個数"] = numericDiameters.length || "";
  cells["横径平均"] = numericDiameters.length
    ? numericDiameters.reduce((sum, value) => sum + value, 0) / numericDiameters.length
    : "";
  cells["横径最小"] = numericDiameters.length ? Math.min(...numericDiameters) : "";
  cells["横径最大"] = numericDiameters.length ? Math.max(...numericDiameters) : "";
  cells["糖酸比"] = sugarAcidRatio_(raw["糖度"], raw["酸度"]);
  cells["データ状態"] = cleanText_(raw["データ状態"])
    || surveyDataStatus_(measuredAt, cells["園地"], raw["品種"]);
  return rowForHeaders_(cells, surveyHeaders);
}

function surveyDateParts_(value) {
  if (value === "" || value === null || value === undefined) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() };
}

function fiscalYear_(year, month) {
  return month < 4 ? year - 1 : year;
}

function surveyBaseMonth_(month, day) {
  return day >= 25 ? month % 12 + 1 : month;
}

function surveyPeriod_(day) {
  if (day >= 25 || day <= 10) return "前半";
  if (day <= 20) return "中頃";
  return "";
}

function sugarAcidRatio_(brix, acidity) {
  if (brix === "" || brix === null || brix === undefined
    || acidity === "" || acidity === null || acidity === undefined) return "";
  const numericBrix = Number(brix);
  const numericAcidity = Number(acidity);
  if (!Number.isFinite(numericBrix) || !Number.isFinite(numericAcidity) || numericAcidity === 0) return "";
  return numericBrix / numericAcidity;
}

function surveyDataStatus_(measuredAt, orchard, variety) {
  return surveyDateParts_(measuredAt) && cleanText_(orchard) && cleanText_(variety) ? "有効" : "要確認";
}

function getHeaders_(sheet) {
  const lastColumn = sheet.getLastColumn();
  if (lastColumn === 0) return [];
  return sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0].map(cleanText_);
}

function rowForHeaders_(cells, headers) {
  return headers.map((header) => Object.prototype.hasOwnProperty.call(cells, header) ? cells[header] : "");
}

function parsePayload_(e) {
  if (!e || !e.postData || !e.postData.contents) {
    throw new Error("送信データを読み取れませんでした。");
  }
  try {
    return JSON.parse(e.postData.contents);
  } catch (_) {
    throw new Error("JSON形式が正しくありません。");
  }
}

function verifyToken_(receivedToken) {
  const expectedToken = PropertiesService.getScriptProperties().getProperty(API_TOKEN_PROPERTY);
  if (!expectedToken) throw new Error("GAS側のAPIトークンが未設定です。");
  if (!receivedToken || receivedToken !== expectedToken) throw new Error("認証に失敗しました。");
}

function validateRecord_(record, index) {
  const label = `${index + 1}件目`;
  if (!record || typeof record !== "object") throw new Error(`${label}の形式が不正です。`);
  if (!record.measuredAt || Number.isNaN(new Date(record.measuredAt).getTime())) {
    throw new Error(`${label}の計測日が不正です。`);
  }
  if (!cleanText_(record.orchard)) throw new Error(`${label}の園地名が未入力です。`);
  if (!cleanText_(record.variety) || record.variety === "未設定") {
    throw new Error(`${label}の品種が未入力です。`);
  }
  if (record.diametersMm !== undefined && !Array.isArray(record.diametersMm)) {
    throw new Error(`${label}の横径の形式が不正です。`);
  }
  if (Array.isArray(record.diametersMm)
    && record.diametersMm.some((value) => value === "" || !Number.isFinite(Number(value)) || Number(value) <= 0)) {
    throw new Error(`${label}の横径に不正な値があります。`);
  }
  if (!isMissing_(record.brix) && (!Number.isFinite(Number(record.brix)) || Number(record.brix) < 0)) {
    throw new Error(`${label}の糖度が不正です。`);
  }
  if (!isMissing_(record.acidity) && (!Number.isFinite(Number(record.acidity)) || Number(record.acidity) < 0)) {
    throw new Error(`${label}の酸度が不正です。`);
  }
}

function validateCanonicalHeaders_(headers) {
  const duplicates = headers.filter((header, index) => headers.indexOf(header) !== index);
  const missing = CANONICAL_RAW_HEADERS.filter((header) => !headers.includes(header));
  if (duplicates.length > 0 || missing.length > 0) {
    const details = [
      missing.length > 0 ? `不足: ${missing.join(", ")}` : "",
      duplicates.length > 0 ? `重複: ${[...new Set(duplicates)].join(", ")}` : "",
    ].filter(Boolean).join(" / ");
    throw new Error(`調査原票の見出しが保存仕様と一致しません（${details}）。`);
  }
  return headers;
}

function isMissing_(value) {
  return value === null || value === undefined || value === "";
}

function optionalNumber_(value) {
  return isMissing_(value) ? "" : Number(value);
}

function createEditKey_() {
  return `${Utilities.getUuid().replace(/-/g, "")}${Utilities.getUuid().replace(/-/g, "")}`;
}

function hashEditKey_(editKey) {
  return Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    editKey,
    Utilities.Charset.UTF_8,
  ).map((byte) => ((byte + 256) % 256).toString(16).padStart(2, "0")).join("");
}

function getExistingIds_(sheet, headers) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return new Set();
  const idColumnIndex = headers.indexOf("登録ID");
  if (idColumnIndex < 0) throw new Error("調査原票に「登録ID」見出しがありません。");
  return new Set(
    sheet.getRange(2, idColumnIndex + 1, lastRow - 1, 1).getDisplayValues().flat().filter(String),
  );
}

function cleanText_(value) {
  return String(value == null ? "" : value).trim();
}

function jsonResponse_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
