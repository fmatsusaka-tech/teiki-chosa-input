export const CUSTOM_TREATMENT_OPTION = "__custom_treatment__";

/**
 * `null`/`undefined` means "never touched" (未選択). An empty string means the
 * user explicitly switched to free input but hasn't typed a name yet, so it
 * must resolve to the custom option rather than falling back to 未選択.
 */
export function resolveTreatmentOption(
  treatment: string | null | undefined,
  suggestions: readonly string[],
): string {
  if (treatment === null || treatment === undefined) return "";
  if (treatment === "") return CUSTOM_TREATMENT_OPTION;
  return suggestions.includes(treatment) ? treatment : CUSTOM_TREATMENT_OPTION;
}
