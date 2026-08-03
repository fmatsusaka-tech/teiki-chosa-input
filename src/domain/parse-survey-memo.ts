import type { ParsedSurveyBatch, SurveyRecord } from "./survey-record";
import {
  defaultSurveyMasterCatalog,
  type SurveyMasterCatalog,
  type SurveyMasterItem,
} from "./survey-masters";
const fullDatePattern = /^\d{4}[/-]\d{1,2}[/-]\d{1,2}$/;
const shortDatePattern = /^\d{1,2}[/-]\d{1,2}$/;
const numberPattern = /^-?\d+(?:\.\d+)?$/;
const numberWithUnitPattern = /^(-?\d+(?:\.\d+)?)\s*(?:ミリ|mm|㎜)$/i;
const numberWithOrdinalPrefixPattern = /^\d+[.、]\s*(-?\d+(?:\.\d+)?)\s*(?:ミリ|mm|㎜)?$/i;
const diameterEntryPattern = /^\d+番\s*(-?\d+(?:\.\d+)?)\s*(?:ミリ|mm|㎜)?$/i;
const labeledFieldPattern = /^(?:[*・\-]\s*)?(横径|糖度|酸度)\s*[:：]\s*(.+)$/;
const orchardWithVarietyPattern = /^(.+?)[（(]\s*品種\s*[:：]\s*(.+?)\s*[）)]$/;

/** Matches "1. 46.1" style single-value lines in addition to plain and unit-suffixed numbers. */
function extractNumericToken(line: string): string | null {
  if (numberPattern.test(line)) return line;
  const unitMatch = line.match(numberWithUnitPattern);
  if (unitMatch) return unitMatch[1];
  const ordinalMatch = line.match(numberWithOrdinalPrefixPattern);
  return ordinalMatch ? ordinalMatch[1] : null;
}

/** Splits a "1番 49.8、2番 45.6。" style line into its diameter values. */
function extractDiameterList(line: string): string[] | null {
  const trimmed = line.replace(/[。.]+$/u, "").trim();
  if (!/\d+番/.test(trimmed)) return null;

  const segments = trimmed.split(/[、,]/).map((segment) => segment.trim()).filter(Boolean);
  const values: string[] = [];
  for (const segment of segments) {
    const match = segment.match(diameterEntryPattern);
    if (!match) return null;
    values.push(match[1]);
  }
  return values.length > 0 ? values : null;
}

/** Parses a "* 横径：40.1、39.4" style labeled line into its field name and values. */
function extractLabeledField(line: string): { field: string; tokens: string[] } | null {
  const match = line.match(labeledFieldPattern);
  if (!match) return null;
  const [, field, rawValue] = match;
  const trimmedValue = rawValue.replace(/[。.]+$/u, "").trim();
  const tokens = trimmedValue
    .split(/[、,]/)
    .map((segment) => segment.trim())
    .map((segment) => extractNumericToken(segment))
    .filter((token): token is string => token !== null);
  return { field, tokens };
}

function isNumericLikeLine(line: string): boolean {
  return (
    extractNumericToken(line) !== null ||
    extractDiameterList(line) !== null ||
    extractLabeledField(line) !== null
  );
}

function levenshteinDistance(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  );
  for (let i = 0; i <= a.length; i += 1) dp[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) dp[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[a.length][b.length];
}

/** Finds the closest master orchard name for a likely mis-transcribed heading (e.g. 鳴る1 → なる1). */
function findFuzzyOrchardMatch(
  normalized: string,
  orchards: readonly SurveyMasterItem[],
): string | null {
  let best: { canonicalName: string; distance: number } | null = null;
  for (const item of orchards) {
    for (const candidate of [item.canonicalName, ...item.aliases]) {
      const normalizedCandidate = normalizeOrchard(candidate);
      const distance = levenshteinDistance(normalized, normalizedCandidate);
      const threshold = Math.max(1, Math.floor(normalizedCandidate.length / 3));
      if (distance > 0 && distance <= threshold && (!best || distance < best.distance)) {
        best = { canonicalName: item.canonicalName, distance };
      }
    }
  }
  return best?.canonicalName ?? null;
}

type OrchardResolution = {
  canonicalName: string;
  fuzzyWarning: string | null;
};

/** Resolves a raw orchard heading against the master, falling back to a fuzzy "did you mean" suggestion. */
function resolveOrchardHeading(
  rawLine: string,
  orchardHeadingMap: Map<string, string>,
  orchards: readonly SurveyMasterItem[],
): OrchardResolution | null {
  const normalized = normalizeOrchard(rawLine);
  const exact = orchardHeadingMap.get(normalized);
  if (exact) return { canonicalName: exact, fuzzyWarning: null };

  const fuzzy = findFuzzyOrchardMatch(normalized, orchards);
  if (!fuzzy) return null;
  return {
    canonicalName: fuzzy,
    fuzzyWarning: `園地名「${rawLine}」は「${fuzzy}」の入力間違いの可能性があるため、そちらとして扱いました。表記をご確認ください`,
  };
}

function normalizeDate(value: string, registeredAt: string): string {
  const parts = value.split(/[/-]/).map(Number);
  const [year, month, day] =
    parts.length === 3
      ? parts
      : [new Date(registeredAt).getUTCFullYear(), parts[0], parts[1]];
  return new Date(Date.UTC(year, month - 1, day)).toISOString();
}

function normalizeOrchard(value: string): string {
  return value.replace(/[０-９]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) - 0xfee0),
  );
}

function parseDiameter(raw: string): { value: number; warning?: string } {
  const numeric = Number(raw);

  if (raw.startsWith("-") && Math.abs(numeric) >= 100) {
    return {
      value: Math.abs(numeric) / 10,
      warning: `${raw} は負の横径として不自然なため ${Math.abs(numeric) / 10}mm と推定しました`,
    };
  }

  if (Number.isInteger(numeric) && Math.abs(numeric) >= 100) {
    return { value: numeric / 10 };
  }

  return { value: numeric };
}

function hasSugarAcidPair(tokens: string[]): boolean {
  if (tokens.length < 3) return false;
  const brixToken = tokens.at(-2) ?? "";
  const acidityToken = tokens.at(-1) ?? "";
  const brix = Number(brixToken);
  const acidity = Number(acidityToken);

  return (
    (brixToken.includes(".") || acidityToken.includes(".")) &&
    brix >= 4 &&
    brix <= 30 &&
    acidity >= 0 &&
    acidity <= 10
  );
}

export function parseSurveyMemo(
  sourceText: string,
  registeredAt = new Date().toISOString(),
  catalog: SurveyMasterCatalog = defaultSurveyMasterCatalog,
): ParsedSurveyBatch {
  const lines = sourceText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  let measuredAt = registeredAt;
  let currentOrchard = "";
  let currentVariety: string | null = null;
  let currentTreatment = "";
  let currentNotes: string[] = [];
  let numericLines: string[] = [];
  const records: SurveyRecord[] = [];
  const batchWarnings: string[] = [];
  const orchardHeadingMap = new Map(
    catalog.orchards.flatMap((item) =>
      [item.canonicalName, ...item.aliases].map((name) => [
        normalizeOrchard(name),
        item.canonicalName,
      ]),
    ),
  );
  const treatmentHeadingMap = new Map(
    catalog.treatments.flatMap((item) =>
      [item.canonicalName, ...item.aliases].map((name) => [
        normalizeOrchard(name),
        item.canonicalName,
      ]),
    ),
  );
  const varietyHeadingMap = new Map(
    catalog.varieties.flatMap((item) =>
      [item.canonicalName, ...item.aliases].map((name) => [
        normalizeOrchard(name),
        item.canonicalName,
      ]),
    ),
  );
  let currentOrchardIsUnregistered = false;
  let currentOrchardFuzzyWarning: string | null = null;
  let currentTreatmentIsUnregistered = false;
  let explicitDiameterTokens: string[] | null = null;
  let explicitBrixToken: string | null = null;
  let explicitAcidityToken: string | null = null;

  const flush = () => {
    const hasExplicitFields =
      explicitDiameterTokens !== null || explicitBrixToken !== null || explicitAcidityToken !== null;
    if (!currentOrchard || (numericLines.length === 0 && !hasExplicitFields)) return;

    const warnings: string[] = [];
    let diameterTokens: string[];
    let brix: number | null;
    let acidity: number | null;
    if (hasExplicitFields) {
      diameterTokens = explicitDiameterTokens ?? [];
      brix = explicitBrixToken !== null ? Number(explicitBrixToken) : null;
      acidity = explicitAcidityToken !== null ? Number(explicitAcidityToken) : null;
    } else {
      const sugarAcidPresent = hasSugarAcidPair(numericLines);
      brix = sugarAcidPresent ? Number(numericLines.at(-2)) : null;
      acidity = sugarAcidPresent ? Number(numericLines.at(-1)) : null;
      diameterTokens = sugarAcidPresent ? numericLines.slice(0, -2) : numericLines;
    }
    const diametersMm = diameterTokens.slice(0, 10).map((token) => {
      const parsed = parseDiameter(token);
      if (parsed.warning) warnings.push(parsed.warning);
      return parsed.value;
    });

    const variety =
      currentVariety ?? catalog.orchardVarietyDefaults[currentOrchard] ?? "未設定";
    if (currentOrchardFuzzyWarning) warnings.push(currentOrchardFuzzyWarning);
    if (currentOrchardIsUnregistered) {
      warnings.push("園地マスタ未登録です。園地名と品種を確認してください");
    }
    if (currentTreatmentIsUnregistered) {
      warnings.push("処理区マスタ未登録です。処理区名を確認してください");
    }
    if (variety === "未設定") warnings.push("品種を特定できませんでした");
    if (diametersMm.length === 0) warnings.push("横径が未入力です");
    if (diameterTokens.length > 10) warnings.push("横径は先頭10個を候補にしました");
    if (brix === null) warnings.push("糖度が未入力です");

    const notes = currentNotes.filter(Boolean).join("・");

    records.push({
      measuredAt,
      registeredAt,
      orchard: currentOrchard,
      variety,
      treatment: currentTreatment || null,
      diametersMm,
      brix,
      acidity,
      notes,
      source: "text",
      confidence: warnings.length === 0 ? 1 : 0.8,
      warnings,
    });

    numericLines = [];
    currentNotes = [];
    explicitDiameterTokens = null;
    explicitBrixToken = null;
    explicitAcidityToken = null;
  };

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    if (fullDatePattern.test(line) || shortDatePattern.test(line)) {
      measuredAt = normalizeDate(line, registeredAt);
      continue;
    }

    const treatment = treatmentHeadingMap.get(normalizeOrchard(line));
    if (treatment) {
      if (numericLines.length > 0) flush();
      currentTreatment = treatment;
      currentTreatmentIsUnregistered = false;
      continue;
    }

    const labeledField = extractLabeledField(line);
    if (labeledField) {
      if (labeledField.field === "横径") {
        explicitDiameterTokens = [...(explicitDiameterTokens ?? []), ...labeledField.tokens];
      } else if (labeledField.field === "糖度") {
        explicitBrixToken = labeledField.tokens[0] ?? explicitBrixToken;
      } else if (labeledField.field === "酸度") {
        explicitAcidityToken = labeledField.tokens[0] ?? explicitAcidityToken;
      }
      continue;
    }

    const orchardWithVarietyMatch = line.match(orchardWithVarietyPattern);
    if (orchardWithVarietyMatch) {
      const [, orchardText, varietyText] = orchardWithVarietyMatch;
      const resolution = resolveOrchardHeading(orchardText, orchardHeadingMap, catalog.orchards);
      flush();
      currentOrchard = resolution?.canonicalName ?? normalizeOrchard(orchardText);
      currentOrchardIsUnregistered = resolution === null;
      currentOrchardFuzzyWarning = resolution?.fuzzyWarning ?? null;
      currentVariety = varietyHeadingMap.get(normalizeOrchard(varietyText)) ?? null;
      currentTreatment = "";
      currentTreatmentIsUnregistered = false;
      currentNotes = [];
      continue;
    }

    const diameterList = extractDiameterList(line);
    if (diameterList) {
      numericLines.push(...diameterList);
      continue;
    }

    const numericToken = extractNumericToken(line);
    if (numericToken !== null) {
      numericLines.push(numericToken);
      continue;
    }

    const normalized = normalizeOrchard(line);
    const exactOrchard = orchardHeadingMap.get(normalized);
    if (exactOrchard) {
      flush();
      currentOrchard = exactOrchard;
      currentVariety = null;
      currentOrchardIsUnregistered = false;
      currentOrchardFuzzyWarning = null;
      currentTreatment = "";
      currentTreatmentIsUnregistered = false;
      currentNotes = [];
      continue;
    }

    const variety = varietyHeadingMap.get(normalized);
    if (variety) {
      currentVariety = variety;
      continue;
    }

    // Only fall back to a fuzzy orchard match once an exact variety match has been
    // ruled out, so short variety aliases (e.g. 宮川) can't be misread as a nearby
    // orchard name (e.g. 吉川).
    const fuzzyOrchard = findFuzzyOrchardMatch(normalized, catalog.orchards);
    if (fuzzyOrchard) {
      flush();
      currentOrchard = fuzzyOrchard;
      currentVariety = null;
      currentOrchardIsUnregistered = false;
      currentOrchardFuzzyWarning = `園地名「${line}」は「${fuzzyOrchard}」の入力間違いの可能性があるため、そちらとして扱いました。表記をご確認ください`;
      currentTreatment = "";
      currentTreatmentIsUnregistered = false;
      currentNotes = [];
      continue;
    }

    // A heading between the orchard line and its measurements that matches neither
    // the variety nor treatment master is most often an unregistered treatment name
    // (e.g. a new spray/rootstock plot), not a brand-new orchard.
    const hasCollectedMeasurements =
      numericLines.length > 0 ||
      explicitDiameterTokens !== null ||
      explicitBrixToken !== null ||
      explicitAcidityToken !== null;
    if (currentOrchard && !hasCollectedMeasurements && currentVariety === null) {
      currentTreatment = line;
      currentTreatmentIsUnregistered = true;
      continue;
    }

    const followingNumericCount = lines
      .slice(lineIndex + 1)
      .findIndex((candidate) => !isNumericLikeLine(candidate));
    const numericRunLength =
      followingNumericCount < 0 ? lines.length - lineIndex - 1 : followingNumericCount;
    const looksLikeUnknownOrchard =
      numericRunLength > 0 && (numericLines.length === 0 || numericRunLength >= 3);
    if (looksLikeUnknownOrchard) {
      flush();
      currentOrchard = normalized;
      currentVariety = null;
      currentOrchardIsUnregistered = true;
      currentOrchardFuzzyWarning = null;
      currentTreatment = "";
      currentTreatmentIsUnregistered = false;
      currentNotes = [];
      continue;
    }

    if (currentOrchard) {
      currentNotes.push(line);
    } else {
      batchWarnings.push(`「${line}」を園地名として認識できませんでした`);
    }
  }

  flush();

  return { records, sourceText, batchWarnings };
}
