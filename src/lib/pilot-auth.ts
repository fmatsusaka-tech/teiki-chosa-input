export const PILOT_SESSION_COOKIE = "teiki_chosa_pilot_session";

export function readPilotPassword(
  env: Record<string, string | undefined>,
): string | null {
  return env.PILOT_PASSWORD || null;
}

export async function createPilotSessionToken(password: string): Promise<string> {
  const bytes = new TextEncoder().encode(`teiki-chosa-pilot:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function safeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}
