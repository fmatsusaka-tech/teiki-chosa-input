import { surveyRecordSchema, type SurveyRecord } from "../../domain/survey-record";
import { SurveyRecordPersistenceError } from "./persistence-error";
import type { SaveSurveyRecordsResult, SurveyRecordPersistence } from "./persistence-types";

export async function saveSurveyRecords(
  persistence: SurveyRecordPersistence,
  records: readonly SurveyRecord[],
): Promise<SaveSurveyRecordsResult> {
  if (records.length === 0) {
    throw new SurveyRecordPersistenceError("INVALID_RECORDS", "保存対象の調査データがありません。");
  }

  const validatedRecords = records.map((record, index) => {
    const result = surveyRecordSchema.safeParse(record);
    if (!result.success) {
      throw new SurveyRecordPersistenceError(
        "INVALID_RECORDS",
        `${index + 1}件目の調査データが不正です。`,
        { cause: result.error },
      );
    }
    if (
      result.data.diametersMm.length === 0 ||
      result.data.diametersMm.length > 10 ||
      result.data.brix === null
    ) {
      throw new SurveyRecordPersistenceError(
        "INVALID_RECORDS",
        `${index + 1}件目は横径を1〜10個、糖度を入力してください。`,
      );
    }
    return result.data;
  });

  try {
    return await persistence.save(validatedRecords);
  } catch (error) {
    if (error instanceof SurveyRecordPersistenceError) throw error;
    throw new SurveyRecordPersistenceError(
      "PROVIDER_ERROR",
      "調査データの保存に失敗しました。",
      { cause: error },
    );
  }
}
