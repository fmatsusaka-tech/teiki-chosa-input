"use client";

import { useEffect, useMemo, useState } from "react";
import { surveyParseCandidateSchema, type SurveyParseCandidate } from "../../services/ocr-parser";
import { parseOptionalDiameters, parseOptionalNumber, validateReviewCandidate } from "./review-form";

type Props = {
  initialCandidates: SurveyParseCandidate[];
  orchardNames: string[];
  varietyNames: string[];
};

export function OcrReviewForm({ initialCandidates, orchardNames, varietyNames }: Props) {
  const [candidates, setCandidates] = useState(initialCandidates);
  const [warningsConfirmed, setWarningsConfirmed] = useState(false);
  const [status, setStatus] = useState<{ kind: "idle" | "saving" | "success" | "error"; message: string }>({ kind: "idle", message: "" });
  const errors = useMemo(() => candidates.map(validateReviewCandidate), [candidates]);
  const hasErrors = errors.some((fields) => Object.keys(fields).length > 0);
  const hasWarnings = candidates.some((candidate) => candidate.warnings.length > 0 || candidate.unparsedText.length > 0);

  useEffect(() => {
    const stored = sessionStorage.getItem("ocr-review-candidates");
    if (!stored) return;
    const parsed = surveyParseCandidateSchema.array().safeParse(JSON.parse(stored));
    if (parsed.success) setCandidates(parsed.data);
  }, []);

  const update = <K extends keyof SurveyParseCandidate>(index: number, field: K, value: SurveyParseCandidate[K]) => {
    setStatus({ kind: "idle", message: "" });
    setCandidates((current) => current.map((candidate, candidateIndex) =>
      candidateIndex === index ? { ...candidate, [field]: value } : candidate));
  };

  if (candidates.length === 0) {
    return <div className="review-empty" role="status">確認するOCR解析候補はありません。トップ画面で画像を選択してください。</div>;
  }

  const save = async () => {
    if (status.kind === "saving" || hasErrors || (hasWarnings && !warningsConfirmed)) return;
    setStatus({ kind: "saving", message: "調査原票へ保存中です…" });
    try {
      const response = await fetch("/api/survey-records", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ candidates, warningsConfirmed: true, sourceKind: sessionStorage.getItem("ocr-review-source-kind") || "photo" }),
      });
      const payload = await response.json() as { savedCount?: number; skippedCount?: number; error?: string };
      if (!response.ok) throw new Error(payload.error || "保存に失敗しました。");
      const savedCount = payload.savedCount ?? candidates.length;
      const skippedCount = payload.skippedCount ?? 0;
      if (savedCount === 0 && skippedCount > 0) {
        setStatus({
          kind: "error",
          message: `候補${skippedCount}件はすべて登録済みのデータと重複していたため、保存していません。`,
        });
        return;
      }
      sessionStorage.removeItem("ocr-review-candidates");
      sessionStorage.removeItem("ocr-review-source-kind");
      setStatus({
        kind: "success",
        message: `${savedCount}件を調査原票へ保存しました。${
          skippedCount > 0 ? `重複していた${skippedCount}件は保存していません。` : ""
        }`,
      });
    } catch (error) {
      setStatus({ kind: "error", message: error instanceof Error ? error.message : "保存に失敗しました。" });
    }
  };

  return (
    <form className="ocr-review-form" onSubmit={(event) => { event.preventDefault(); void save(); }}>
      <div className="review-introduction">
        <p>OCRの認識結果は候補です。内容を修正し、警告を確認してから確定してください。</p>
        <span>{candidates.length}件</span>
      </div>
      {candidates.map((candidate, index) => {
        const currentDiameters = candidate.diametersMm?.map(String) ?? [];
        const diameterValues = [
          ...currentDiameters,
          ...(currentDiameters.length < 10 ? [""] : []),
        ];
        return (
          <fieldset className="review-candidate" key={index}>
            <legend>候補 {index + 1}</legend>
            {candidate.warnings.length > 0 && (
              <ul className="review-warnings" aria-label={`候補${index + 1}の警告`}>
                {candidate.warnings.map((warning, warningIndex) => <li key={`${warning.code}-${warningIndex}`}>{warning.message}</li>)}
              </ul>
            )}
            <div className="review-fields">
              <label className={errors[index].measuredDate ? "field-error" : ""}>
                <span>調査日 <b>必須</b></span>
                <input type="date" value={candidate.measuredDate ?? ""} aria-invalid={Boolean(errors[index].measuredDate)} onChange={(event) => update(index, "measuredDate", event.target.value || null)} />
                {errors[index].measuredDate && <small>{errors[index].measuredDate}</small>}
              </label>
              <label className={errors[index].orchard ? "field-error" : ""}>
                <span>園地 <b>必須</b></span>
                <select value={candidate.orchard ?? ""} aria-invalid={Boolean(errors[index].orchard)} onChange={(event) => update(index, "orchard", event.target.value || null)}>
                  <option value="">選択してください</option>
                  {candidate.orchard && !orchardNames.includes(candidate.orchard) && <option value={candidate.orchard}>{candidate.orchard}（OCR候補）</option>}
                  {orchardNames.map((name) => <option key={name}>{name}</option>)}
                </select>
                {errors[index].orchard && <small>{errors[index].orchard}</small>}
              </label>
              <label className={errors[index].variety ? "field-error" : ""}>
                <span>品種 <b>必須</b></span>
                <select value={candidate.variety ?? ""} aria-invalid={Boolean(errors[index].variety)} onChange={(event) => update(index, "variety", event.target.value || null)}>
                  <option value="">選択してください</option>
                  {candidate.variety && !varietyNames.includes(candidate.variety) && <option value={candidate.variety}>{candidate.variety}（OCR候補）</option>}
                  {varietyNames.map((name) => <option key={name}>{name}</option>)}
                </select>
                {errors[index].variety && <small>{errors[index].variety}</small>}
              </label>
              <label><span>処理区</span><input value={candidate.treatment ?? ""} onChange={(event) => update(index, "treatment", event.target.value || null)} /></label>
              <label className={errors[index].brix ? "field-error" : ""}>
                <span>糖度 <b>必須</b></span>
                <input type="number" min="0" step="0.1" inputMode="decimal" value={candidate.brix ?? ""} aria-invalid={Boolean(errors[index].brix)} onChange={(event) => update(index, "brix", parseOptionalNumber(event.target.value))} />
                {errors[index].brix && <small>{errors[index].brix}</small>}
              </label>
              <label><span>酸度（任意）</span><input type="number" min="0" step="0.01" inputMode="decimal" value={candidate.acidity ?? ""} onChange={(event) => update(index, "acidity", parseOptionalNumber(event.target.value))} /></label>
              <label className="review-wide"><span>備考</span><textarea rows={2} value={candidate.notes ?? ""} onChange={(event) => update(index, "notes", event.target.value || null)} /></label>
            </div>
            <div className={`review-diameters ${errors[index].diametersMm ? "field-error" : ""}`}>
              <span>横径（mm） <b>1個以上必須</b></span>
              <div>{diameterValues.map((value, diameterIndex) => <input key={diameterIndex} aria-label={`候補${index + 1} 横径${diameterIndex + 1}`} type="number" min="0.1" step="0.1" inputMode="decimal" value={value} onChange={(event) => { const values = [...diameterValues]; values[diameterIndex] = event.target.value; update(index, "diametersMm", parseOptionalDiameters(values)); }} />)}</div>
              {errors[index].diametersMm && <small>{errors[index].diametersMm}</small>}
              <small>末尾の空欄へ入力すると、次の入力欄が追加されます。</small>
            </div>
            {candidate.unparsedText.length > 0 && <details><summary>判別できなかった文字を確認</summary><pre>{candidate.unparsedText.join("\n")}</pre></details>}
          </fieldset>
        );
      })}
      {hasWarnings && <label className="warning-confirm"><input type="checkbox" checked={warningsConfirmed} disabled={status.kind === "saving" || status.kind === "success"} onChange={(event) => setWarningsConfirmed(event.target.checked)} />警告と判別できなかった文字を確認しました</label>}
      {status.kind !== "idle" && <p className={status.kind === "error" ? "review-error" : "review-complete"} role="status">{status.message}{status.kind === "error" ? " 入力内容は保持されています。" : ""}</p>}
      <button className="review-submit" type="submit" disabled={hasErrors || (hasWarnings && !warningsConfirmed) || status.kind === "saving" || status.kind === "success"}>{status.kind === "saving" ? "保存中…" : "調査原票へ保存"}</button>
    </form>
  );
}
