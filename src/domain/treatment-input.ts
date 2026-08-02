export const CUSTOM_TREATMENT_OPTION = "__custom_treatment__";

export type TreatmentSuggestionsByOrchard = Readonly<Record<string, readonly string[]>>;

export function treatmentSuggestionsForOrchard(
  orchard: string,
  suggestionsByOrchard: TreatmentSuggestionsByOrchard,
  fallbackSuggestions: readonly string[] = [],
): string[] {
  const normalizedOrchard = orchard.trim();
  const pastSuggestions = normalizedOrchard
    ? suggestionsByOrchard[normalizedOrchard] ?? []
    : [];
  return [...new Set([...pastSuggestions, ...fallbackSuggestions].map((value) => value.trim()).filter(Boolean))];
}

export function resolveTreatmentOption(
  treatment: string | null | undefined,
  suggestions: readonly string[],
): string {
  const normalized = treatment?.trim() ?? "";
  return normalized && suggestions.includes(normalized)
    ? normalized
    : CUSTOM_TREATMENT_OPTION;
}
