export const CUSTOM_VARIETY_OPTION = "__custom_variety__";

export function resolveVarietyOption(
  variety: string,
  suggestions: readonly string[],
): string {
  return suggestions.includes(variety) ? variety : CUSTOM_VARIETY_OPTION;
}
