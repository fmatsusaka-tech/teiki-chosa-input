export type PilotAuthConfig = {
  username: string;
  password: string;
};

export function readPilotAuthConfig(
  env: Record<string, string | undefined>,
): PilotAuthConfig | null {
  const username = env.PILOT_USERNAME?.trim();
  const password = env.PILOT_PASSWORD;
  return username && password ? { username, password } : null;
}

export function isAuthorizedBasicHeader(
  authorization: string | null,
  config: PilotAuthConfig,
): boolean {
  if (!authorization?.startsWith("Basic ")) return false;
  try {
    const decoded = atob(authorization.slice(6));
    const separator = decoded.indexOf(":");
    if (separator < 0) return false;
    return decoded.slice(0, separator) === config.username
      && decoded.slice(separator + 1) === config.password;
  } catch {
    return false;
  }
}
