import type { ParsedSurveyBatch, SurveyRecord } from "./survey-record";
import {
  defaultSurveyMasterCatalog,
  type SurveyMasterCatalog,
} from "./survey-masters";
const fullDatePattern = /^\d{4}[/-]\d{1,2}[/-]\d{1,2}$/;
const shortDatePattern = /^\d{1,2}[/-]\d{1,2}$/;
const numberPattern = /^-?\d+(?:\.\d+)?$/;

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

  const flush = () => {
    if (!currentOrchard || numericLines.length === 0) return;

    const warnings: string[] = [];
    const sugarAcidPresent = hasSugarAcidPair(numericLines);
    const brix = sugarAcidPresent ? Number(numericLines.at(-2)) : null;
    const acidity = sugarAcidPresent ? Number(numericLines.at(-1)) : null;
    const diameterTokens = sugarAcidPresent ? numericLines.slice(0, -2) : numericLines;
    const diametersMm = diameterTokens.slice(0, 10).map((token) => {
      const parsed = parseDiameter(token);
      if (parsed.warning) warnings.push(parsed.warning);
      return parsed.value;
    });

    const variety =
      currentVariety ?? catalog.orchardVarietyDefaults[currentOrchard] ?? "未設定";
    if (currentOrchardIsUnregistered) {
      warnings.push("園地マスタ未登録です。園地名と品種を確認してください");
    }
    if (variety === "未設定") warnings.push("品種を特定できませんでした");
    if (diametersMm.length === 0) warnings.push("横径が未入力です");
    if (diameterTokens.length > 10) warnings.push("横径は先頭10個を候補にしました");
    if (brix === null) warnings.push("糖度が未入力です");

    const notes = [currentTreatment, ...currentNotes].filter(Boolean).join("・");

    records.push({
      measuredAt,
      registeredAt,
      orchard: currentOrchard,
      variety,
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
      continue;
    }

    if (numberPattern.test(line)) {
      numericLines.push(line);
      continue;
    }

    const normalized = normalizeOrchard(line);
    const orchard = orchardHeadingMap.get(normalized);
    if (orchard) {
      flush();
      currentOrchard = orchard;
      currentVariety = null;
      currentOrchardIsUnregistered = false;
      currentTreatment = "";
      currentNotes = [];
      continue;
    }

    const variety = varietyHeadingMap.get(normalized);
    if (variety) {
      currentVariety = variety;
      continue;
    }

    const followingNumericCount = lines
      .slice(lineIndex + 1)
      .findIndex((candidate) => !numberPattern.test(candidate));
    const numericRunLength =
      followingNumericCount < 0 ? lines.length - lineIndex - 1 : followingNumericCount;
    const looksLikeUnknownOrchard =
      numericRunLength > 0 && (numericLines.length === 0 || numericRunLength >= 3);
    if (looksLikeUnknownOrchard) {
      flush();
      currentOrchard = normalized;
      currentVariety = null;
      currentOrchardIsUnregistered = true;
      currentTreatment = "";
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
