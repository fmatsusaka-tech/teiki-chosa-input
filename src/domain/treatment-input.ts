export const CUSTOM_TREATMENT_OPTION = "__custom_treatment__";

export function resolveTreatmentOption(
  treatment: string | null | undefined,
  suggestions: readonly string[],
): string {
  if (!treatment) return "";
  return suggestions.includes(treatment) ? treatment : CUSTOM_TREATMENT_OPTION;
}
