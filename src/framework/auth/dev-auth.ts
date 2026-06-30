import {
  clearStoredTokens,
  getStoredAccessToken,
  getStoredRefreshToken,
  storeTokens,
} from "@/framework/auth/token-store";

const FAILED_ENV_ACCESS_TOKEN_KEY = "bkn_failed_env_access_token";

function readEnvAccessToken() {
  const value: unknown = import.meta.env.VITE_DEV_ACCESS_TOKEN;
  return typeof value === "string" ? value.trim() : "";
}

function readEnvRefreshToken() {
  const value: unknown = import.meta.env.VITE_DEV_REFRESH_TOKEN;
  return typeof value === "string" ? value.trim() : "";
}

export function shouldUseDevAuth() {
  return import.meta.env.DEV && import.meta.env.VITE_USE_MOCK !== "true";
}

export function hasDevAccessToken() {
  return Boolean(getDevAccessToken());
}

export function getDevAccessToken() {
  const stored = getStoredAccessToken();
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
  const stored = getStoredRefreshToken();
  if (stored) {
    return stored;
  }

  return readEnvRefreshToken();
}

export function setDevTokens(accessToken: string, refreshToken?: string) {
  storeTokens({ accessToken, refreshToken });
  window.sessionStorage.removeItem(FAILED_ENV_ACCESS_TOKEN_KEY);
}

export function clearDevAuthSession() {
  clearStoredTokens();
}

export function seedDevTokensFromEnv() {
  if (!shouldUseDevAuth()) {
    return;
  }

  if (getStoredAccessToken()) {
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
