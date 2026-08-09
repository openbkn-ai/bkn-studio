/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */
import CryptoJS from "crypto-js";
import { getAppCallbackPath, getAppHomePath } from "@/app/router/app-paths";
import { getDevRefreshToken } from "@/framework/auth/dev-auth";
import {
  clearStoredTokens,
  getStoredIdToken,
  storeTokens,
} from "@/framework/auth/token-store";

// Pre-registered public SPA client — see bkn-safe chart client-seed-job.yaml.
const OAUTH_CLIENT_ID = "openbkn-studio";
const OAUTH_SCOPE = "openid offline";
const OAUTH_AUDIENCE = "bkn-safe";

// hydra public endpoints exposed same-origin at the gateway (ingress
// hydraPublicPaths). The token exchange is a cookie-less XHR and goes through
// the vite proxy in dev; the authorize/logout full-page navigations must hit
// the gateway origin directly — hydra's CSRF cookie is bound to the host that
// served /oauth2/auth, and proxying that first hop through localhost leaves
// the cookie on the wrong domain ("No CSRF value available in the session
// cookie" after the login form submits).
const AUTHORIZE_PATH = "/oauth2/auth";
const TOKEN_PATH = "/oauth2/token";
const LOGOUT_PATH = "/oauth2/sessions/logout";

export function gatewayOrigin() {
  if (!import.meta.env.DEV) {
    return "";
  }

  const value: unknown = import.meta.env.VITE_DEV_AUTH_ORIGIN;
  return typeof value === "string" ? value.trim().replace(/\/+$/, "") : "";
}

export const OAUTH_CALLBACK_PATH = getAppCallbackPath();

const STATE_KEY = "bkn_oauth_state";
const VERIFIER_KEY = "bkn_oauth_verifier";
const RETURN_TO_KEY = "bkn_oauth_return_to";
const TAB_ID_KEY = "bkn_oauth_tab_id";
const CSRF_RETRY_KEY = "bkn_oauth_csrf_retried";
const FLOW_LOCK_KEY = "bkn_oauth_flow_lock";

// hydra keeps a single login CSRF cookie per browser, so a second
// /oauth2/auth overwrites the first flow's value and the older flow fails to
// accept with "The CSRF value from the token does not match the CSRF value
// from the data store". A forced first-login password change parks the user on
// the login pages for a minute or more — long enough for another Studio tab
// (session restore, a bfcache wake-up) to silently start its own flow. The
// lock makes *automatic* redirects yield to a flow another tab already owns;
// an explicit sign-in click always takes over.
const FLOW_LOCK_TTL_MS = 3 * 60 * 1000;

type TokenResponse = {
  access_token: string;
  expires_in?: number;
  id_token?: string;
  refresh_token?: string;
  token_type?: string;
};

export function shouldUseOAuthGate(mode: "hosted" | "standalone") {
  if (mode !== "standalone") {
    return false;
  }

  // Mock-mode dev runs without a backend, so there is nothing to log in to.
  return !import.meta.env.DEV || import.meta.env.VITE_USE_MOCK === "false";
}

export function isOAuthCallbackPath(pathname = window.location.pathname) {
  return pathname === getAppCallbackPath();
}

function base64UrlEncode(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function randomUrlSafeString() {
  const bytes = new Uint8Array(32);
  window.crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

export async function computeCodeChallenge(verifier: string) {
  // 安全上下文（HTTPS 或 localhost）：使用 Web Crypto API
  if (window.crypto?.subtle) {
    const digest = await window.crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(verifier),
    );
    return base64UrlEncode(new Uint8Array(digest));
  }

  // 非安全上下文（HTTP）：使用 crypto-js 替代方案
  const hash = CryptoJS.SHA256(verifier);
  return hash.toString(CryptoJS.enc.Base64)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function redirectUri() {
  return `${window.location.origin}${getAppCallbackPath()}`;
}

/** Stable per-tab id (sessionStorage survives navigations within the tab). */
function tabId() {
  const existing = window.sessionStorage.getItem(TAB_ID_KEY);
  if (existing) {
    return existing;
  }
  const created = randomUrlSafeString();
  window.sessionStorage.setItem(TAB_ID_KEY, created);
  return created;
}

type FlowLock = { startedAt: number; tabId: string };

function readFlowLock(): FlowLock | null {
  const raw = window.localStorage.getItem(FLOW_LOCK_KEY);
  if (!raw) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== "object") {
    return null;
  }

  const { startedAt, tabId: owner } = parsed as Partial<FlowLock>;
  if (typeof startedAt !== "number" || typeof owner !== "string") {
    return null;
  }

  return { startedAt, tabId: owner };
}

function writeFlowLock() {
  const lock: FlowLock = { startedAt: Date.now(), tabId: tabId() };
  window.localStorage.setItem(FLOW_LOCK_KEY, JSON.stringify(lock));
}

function clearFlowLock() {
  window.localStorage.removeItem(FLOW_LOCK_KEY);
}

/**
 * Whether this tab may redirect to hydra on its own. A tab that started a flow
 * inside the lock window owns the browser's login CSRF cookie — redirecting
 * now would overwrite it and break that tab's callback. Our own stale lock
 * (the user navigated back to Studio in this same tab) never blocks us.
 */
export function canAutoStartLogin() {
  const self = tabId();
  const lock = readFlowLock();
  if (!lock || lock.tabId === self) {
    return true;
  }
  return Date.now() - lock.startedAt > FLOW_LOCK_TTL_MS;
}

/**
 * True when hydra bounced the authorize request because the browser's login
 * CSRF cookie belongs to a different flow. Recoverable: a fresh /oauth2/auth
 * rewrites the cookie.
 */
export function isCsrfConflictCallback(search = window.location.search) {
  const params = new URLSearchParams(search);
  const error = params.get("error");
  if (!error) {
    return false;
  }
  return error === "request_forbidden" || (params.get("error_description") ?? "").includes("CSRF");
}

/** One automatic CSRF recovery per tab, so a persistent failure cannot loop. */
export function consumeCsrfRetry() {
  if (window.sessionStorage.getItem(CSRF_RETRY_KEY)) {
    return false;
  }
  window.sessionStorage.setItem(CSRF_RETRY_KEY, "1");
  return true;
}

export function getStoredReturnTo() {
  return window.sessionStorage.getItem(RETURN_TO_KEY) ?? undefined;
}

export async function beginLogin(returnTo?: string) {
  const verifier = randomUrlSafeString();
  const state = randomUrlSafeString();

  window.sessionStorage.setItem(VERIFIER_KEY, verifier);
  window.sessionStorage.setItem(STATE_KEY, state);
  if (returnTo && !isOAuthCallbackPath(returnTo)) {
    window.sessionStorage.setItem(RETURN_TO_KEY, returnTo);
  } else {
    window.sessionStorage.removeItem(RETURN_TO_KEY);
  }

  const params = new URLSearchParams({
    audience: OAUTH_AUDIENCE,
    client_id: OAUTH_CLIENT_ID,
    code_challenge: await computeCodeChallenge(verifier),
    code_challenge_method: "S256",
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: OAUTH_SCOPE,
    state,
  });

  // Claim the browser's login CSRF cookie before navigating; other tabs stop
  // auto-redirecting until this flow finishes or the lock ages out.
  writeFlowLock();
  window.location.assign(`${gatewayOrigin()}${AUTHORIZE_PATH}?${params.toString()}`);
}

async function requestToken(body: URLSearchParams): Promise<TokenResponse> {
  const response = await fetch(TOKEN_PATH, {
    body,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    method: "POST",
  });

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const error =
      payload && typeof payload === "object"
        ? (payload as { error?: string; error_description?: string })
        : null;
    throw new Error(
      error?.error_description ?? error?.error ?? `Token request failed (${response.status})`,
    );
  }

  if (
    !payload ||
    typeof payload !== "object" ||
    typeof (payload as TokenResponse).access_token !== "string"
  ) {
    throw new Error("Token response missing access_token.");
  }

  return payload as TokenResponse;
}

export async function completeLogin(search = window.location.search) {
  const params = new URLSearchParams(search);
  const error = params.get("error");

  if (error) {
    throw new Error(params.get("error_description") ?? error);
  }

  const code = params.get("code");
  const state = params.get("state");
  const expectedState = window.sessionStorage.getItem(STATE_KEY);
  const verifier = window.sessionStorage.getItem(VERIFIER_KEY);

  if (!code) {
    throw new Error("Missing authorization code in callback URL.");
  }

  if (!expectedState || !verifier || state !== expectedState) {
    throw new Error("OAuth state mismatch — please retry login.");
  }

  const tokens = await requestToken(
    new URLSearchParams({
      client_id: OAUTH_CLIENT_ID,
      code,
      code_verifier: verifier,
      grant_type: "authorization_code",
      redirect_uri: redirectUri(),
    }),
  );

  storeTokens({
    accessToken: tokens.access_token,
    idToken: tokens.id_token,
    refreshToken: tokens.refresh_token,
  });

  window.sessionStorage.removeItem(STATE_KEY);
  window.sessionStorage.removeItem(VERIFIER_KEY);
  window.sessionStorage.removeItem(CSRF_RETRY_KEY);
  clearFlowLock();

  const returnTo = window.sessionStorage.getItem(RETURN_TO_KEY) ?? getAppHomePath();
  window.sessionStorage.removeItem(RETURN_TO_KEY);
  return returnTo;
}

export async function refreshOAuthTokens(): Promise<string | null> {
  const refreshToken = getDevRefreshToken();
  if (!refreshToken) {
    return null;
  }

  try {
    const tokens = await requestToken(
      new URLSearchParams({
        client_id: OAUTH_CLIENT_ID,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    );

    storeTokens({
      accessToken: tokens.access_token,
      idToken: tokens.id_token,
      // hydra rotates refresh tokens; keep the old one only if none returned.
      refreshToken: tokens.refresh_token ?? refreshToken,
    });

    return tokens.access_token;
  } catch {
    return null;
  }
}

export function logout(mode: "hosted" | "standalone") {
  const idToken = getStoredIdToken();
  clearStoredTokens();
  window.sessionStorage.removeItem(CSRF_RETRY_KEY);
  clearFlowLock();

  if (!shouldUseOAuthGate(mode)) {
    // Mock / hosted mode has no hydra session to revoke.
    window.location.assign(getAppHomePath());
    return;
  }

  const params = new URLSearchParams({
    post_logout_redirect_uri: `${window.location.origin}${getAppHomePath()}`,
  });
  if (idToken) {
    params.set("id_token_hint", idToken);
  }

  window.location.assign(`${gatewayOrigin()}${LOGOUT_PATH}?${params.toString()}`);
}
