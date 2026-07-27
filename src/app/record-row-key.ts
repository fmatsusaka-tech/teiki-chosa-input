/**
 * Parsed records never change order while the user is correcting them.
 * Keep the row key independent from editable values so React does not
 * remount the form controls after every keystroke.
 */
export function recordRowKey(index: number): string {
  return `survey-record-${index}`;
}
