const ACCESS_TOKEN_KEY = "bkn_access_token";
const FAILED_ENV_ACCESS_TOKEN_KEY = "bkn_failed_env_access_token";
const REFRESH_TOKEN_KEY = "bkn_refresh_token";

function readEnvAccessToken() {
  const value: unknown = import.meta.env.VITE_DEV_ACCESS_TOKEN;
  return typeof value === "string" ? value.trim() : "";
}

function readEnvRefreshToken() {
  const value: unknown = import.meta.env.VITE_DEV_REFRESH_TOKEN;
  return typeof value === "string" ? value.trim() : "";
}

export function shouldUseDevAuth() {
  return import.meta.env.DEV && import.meta.env.VITE_USE_MOCK === "false";
}

export function hasDevAccessToken() {
  return Boolean(getDevAccessToken());
}

export function getDevAccessToken() {
  const stored = window.sessionStorage.getItem(ACCESS_TOKEN_KEY)?.trim();
  if (stored) {
    return stored;
  }

  const envAccessToken = readEnvAccessToken();
  const failedEnvAccessToken = window.sessionStorage
    .getItem(FAILED_ENV_ACCESS_TOKEN_KEY)
    ?.trim();

  if (envAccessToken && envAccessToken === failedEnvAccessToken) {
    return "";
  }

  return envAccessToken;
}

export function getDevRefreshToken() {
  const stored = window.sessionStorage.getItem(REFRESH_TOKEN_KEY)?.trim();
  if (stored) {
    return stored;
  }

  return readEnvRefreshToken();
}

export function setDevTokens(accessToken: string, refreshToken?: string) {
  window.sessionStorage.setItem(ACCESS_TOKEN_KEY, accessToken.trim());
  window.sessionStorage.removeItem(FAILED_ENV_ACCESS_TOKEN_KEY);

  if (refreshToken?.trim()) {
    window.sessionStorage.setItem(REFRESH_TOKEN_KEY, refreshToken.trim());
  } else {
    window.sessionStorage.removeItem(REFRESH_TOKEN_KEY);
  }
}

export function clearDevAuthSession() {
  window.sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  window.sessionStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function seedDevTokensFromEnv() {
  if (!shouldUseDevAuth()) {
    return;
  }

  if (window.sessionStorage.getItem(ACCESS_TOKEN_KEY)) {
    return;
  }

  const accessToken = readEnvAccessToken();
  if (!accessToken) {
    return;
  }

  const failedEnvAccessToken = window.sessionStorage
    .getItem(FAILED_ENV_ACCESS_TOKEN_KEY)
    ?.trim();
  if (accessToken === failedEnvAccessToken) {
    return;
  }

  setDevTokens(accessToken, readEnvRefreshToken() || undefined);
}

export function handleDevAuthFailure() {
  const envAccessToken = readEnvAccessToken();
  clearDevAuthSession();

  if (envAccessToken) {
    // Prevent the same invalid env token from triggering an endless reload loop.
    window.sessionStorage.setItem(FAILED_ENV_ACCESS_TOKEN_KEY, envAccessToken);
  }

  if (shouldUseDevAuth()) {
    window.location.reload();
  }
}
