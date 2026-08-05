import type { SurveyRecord } from "../../domain/survey-record";

export type SaveSurveyRecordsResult = {
  savedCount: number;
  recordIds: string[];
  /** Returned once so a future UI can construct an edit URL. Never persist these plaintext keys. */
  editCredentials?: Array<{ recordId: string; editKey: string }>;
  /** Records rejected as exact duplicates of an existing 有効 row (see Issue #54). */
  skippedCount?: number;
  skippedIds?: string[];
};

/**
 * Boundary for saving confirmed survey records.
 *
 * Implementations may use Google Sheets or another store, but callers only
 * depend on this domain-facing contract.
 */
export interface SurveyRecordPersistence {
  save(records: readonly SurveyRecord[]): Promise<SaveSurveyRecordsResult>;
}
