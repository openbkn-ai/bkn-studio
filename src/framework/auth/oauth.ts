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
  normalizeSupportedLocale,
  resolveSupportedLocale,
} from "@/framework/i18n/locale";
import { getRuntimeConfig } from "@/framework/runtime/config";
import {
  clearStoredTokens,
  getStoredAccessToken,
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
const CSRF_RETRY_KEY = "bkn_oauth_csrf_retried";
const CSRF_ORIGINAL_ERROR_KEY = "bkn_oauth_original_error";
const FLOW_LOCK_KEY = "bkn_oauth_flow_lock";
// Proof that *this tab* started the in-flight flow, so a later page load in
// the same tab (the callback page, or a back-navigation to Studio) can claim
// the lock the previous load wrote.
//
// Known trade-off: sessionStorage is copied into a cloned tab, so a tab
// duplicated between writeFlowLock and dropFlowLock — the whole flow,
// including the minutes a forced password change takes — inherits ownership
// and can start its own /oauth2/auth. That is narrower than a persistent tab
// id (which would hand ownership to every clone forever) but wider than "an
// instant". Accepted: cloning a tab mid-login is rare, and the callback's
// one-shot retry recovers from it. See the paired tests in oauth.test.ts.
const FLOW_OWNER_KEY = "bkn_oauth_flow_owner";

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
  // Secure context (HTTPS or localhost): use the Web Crypto API.
  if (window.crypto?.subtle) {
    const digest = await window.crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(verifier),
    );
    return base64UrlEncode(new Uint8Array(digest));
  }

  // Insecure context (HTTP): use the crypto-js fallback.
  const hash = CryptoJS.SHA256(verifier);
  return hash.toString(CryptoJS.enc.Base64)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function redirectUri() {
  return `${window.location.origin}${getAppCallbackPath()}`;
}

/**
 * Identifies this page load, held in memory only. sessionStorage is *cloned*
 * into a tab opened via window.open / target="_blank" / "duplicate tab", so a
 * sessionStorage-backed id would let a cloned tab mistake another tab's lock
 * for its own — and cloned tabs are exactly the ones most likely to race on
 * /oauth2/auth.
 */
let pageLoadId: string | null = null;

function loadId() {
  pageLoadId ??= randomUrlSafeString();
  return pageLoadId;
}

type FlowLock = { loadId: string; startedAt: number };

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

  const { loadId: owner, startedAt } = parsed as Partial<FlowLock>;
  if (typeof startedAt !== "number" || typeof owner !== "string") {
    return null;
  }

  return { loadId: owner, startedAt };
}

function writeFlowLock() {
  const lock: FlowLock = { loadId: loadId(), startedAt: Date.now() };
  window.sessionStorage.setItem(FLOW_OWNER_KEY, lock.loadId);
  window.localStorage.setItem(FLOW_LOCK_KEY, JSON.stringify(lock));
}

function ownsFlowLock(lock: FlowLock) {
  return lock.loadId === loadId() || lock.loadId === window.sessionStorage.getItem(FLOW_OWNER_KEY);
}

function dropFlowLock() {
  window.sessionStorage.removeItem(FLOW_OWNER_KEY);
  window.localStorage.removeItem(FLOW_LOCK_KEY);
}

/**
 * Hand the lock back when a flow reaches a terminal state — success or failure
 * — so other tabs stop waiting on a flow that is already dead instead of
 * sitting out the full TTL. Only the owning tab may release: otherwise a stale
 * callback page reloaded in some other tab would delete a live flow's lock and
 * let the waiting tabs overwrite its CSRF cookie.
 */
export function releaseFlowLock() {
  const lock = readFlowLock();
  if (!lock || ownsFlowLock(lock)) {
    dropFlowLock();
  }
}

/**
 * Whether this page may redirect to hydra on its own. A page that started a
 * flow inside the lock window owns the browser's login CSRF cookie —
 * redirecting now would overwrite it and break that flow's callback. A later
 * page load in the tab that started the flow still counts as the owner, so
 * navigating back to Studio from the login page can restart it.
 */
export function canAutoStartLogin() {
  const lock = readFlowLock();
  if (!lock || ownsFlowLock(lock)) {
    return true;
  }
  return Date.now() - lock.startedAt > FLOW_LOCK_TTL_MS;
}

/**
 * Re-evaluate auth state from scratch after another tab's flow ended. Tokens
 * live in cookies shared by same-origin tabs, so by the time the lock is
 * released a waiting tab is usually already signed in and a reload drops it
 * straight into the app. Racing to start our own flow instead would put every
 * waiting tab on the wire at once — the very pile-up this lock exists to stop.
 */
export function reloadForSharedAuthState() {
  window.location.reload();
}

/**
 * Notifies when another tab releases the lock. `storage` fires only in *other*
 * tabs, which is exactly the audience that needs waking: a tab that has been
 * visible the whole time (side-by-side windows) never gets a visibilitychange
 * to re-check on, and would otherwise sit on the wait screen after the owning
 * tab has already finished.
 */
export function subscribeFlowLockRelease(onRelease: () => void) {
  const handle = (event: StorageEvent) => {
    // key === null is storage.clear(), which also drops the lock.
    if ((event.key === FLOW_LOCK_KEY && event.newValue === null) || event.key === null) {
      onRelease();
    }
  };

  window.addEventListener("storage", handle);
  return () => {
    window.removeEventListener("storage", handle);
  };
}

/**
 * True when hydra bounced the authorize request in a way a fresh /oauth2/auth
 * can plausibly clear — the browser's login CSRF cookie belonging to a
 * different flow. `request_forbidden` is not CSRF-specific (hydra also uses it
 * for rejected login/consent), so a retry can be spent on an unrelated
 * rejection; stashCallbackError keeps the real reason for the error page.
 */
export function isCsrfConflictCallback(search = window.location.search) {
  const params = new URLSearchParams(search);
  const error = params.get("error");
  if (!error) {
    return false;
  }
  return error === "request_forbidden" || (params.get("error_description") ?? "").includes("CSRF");
}

/**
 * Preserve the first failure's reason. If the retry fails too, the second
 * callback's message describes the retry, not what actually went wrong — the
 * user needs the original.
 */
export function stashCallbackError(search = window.location.search) {
  const params = new URLSearchParams(search);
  const reason = params.get("error_description") ?? params.get("error");
  if (reason) {
    window.sessionStorage.setItem(CSRF_ORIGINAL_ERROR_KEY, reason);
  }
}

export function takeStashedCallbackError() {
  const stashed = window.sessionStorage.getItem(CSRF_ORIGINAL_ERROR_KEY);
  window.sessionStorage.removeItem(CSRF_ORIGINAL_ERROR_KEY);
  return stashed;
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

export function buildAuthorizationRequestURL(
  codeChallenge: string,
  state: string,
  requestedLocale?: string | null,
) {
  const locale = normalizeSupportedLocale(requestedLocale) ?? resolveSupportedLocale();
  const params = new URLSearchParams({
    audience: OAUTH_AUDIENCE,
    client_id: OAUTH_CLIENT_ID,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: OAUTH_SCOPE,
    state,
    ui_locales: locale,
  });

  return `${gatewayOrigin()}${AUTHORIZE_PATH}?${params.toString()}`;
}

export async function beginLogin(returnTo?: string, requestedLocale?: string | null) {
  const verifier = randomUrlSafeString();
  const state = randomUrlSafeString();

  window.sessionStorage.setItem(VERIFIER_KEY, verifier);
  window.sessionStorage.setItem(STATE_KEY, state);
  if (returnTo && !isOAuthCallbackPath(returnTo)) {
    window.sessionStorage.setItem(RETURN_TO_KEY, returnTo);
  } else {
    window.sessionStorage.removeItem(RETURN_TO_KEY);
  }

  const authorizationURL = buildAuthorizationRequestURL(
    await computeCodeChallenge(verifier),
    state,
    requestedLocale,
  );

  // Claim the browser's login CSRF cookie before navigating; other tabs stop
  // auto-redirecting until this flow finishes or the lock ages out.
  writeFlowLock();
  window.location.assign(authorizationURL);
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
  window.sessionStorage.removeItem(CSRF_ORIGINAL_ERROR_KEY);
  releaseFlowLock();

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
  const accessToken = getStoredAccessToken();

  // Record only an explicit user sign-out. This is deliberately separate from
  // Trace: it captures the platform access action and the server associates it
  // with the authenticated user before the browser session is cleared.
  if (shouldUseOAuthGate(mode) && accessToken) {
    // Access auditing is best effort: it must never hold the session tokens or
    // prevent the browser from completing the explicit logout.
    const apiBaseUrl = getRuntimeConfig().apiBaseUrl.replace(/\/$/, "");
    void fetch(`${apiBaseUrl}/safe/v1/me/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      keepalive: true,
    }).catch(() => {});
  }

  clearStoredTokens();
  window.sessionStorage.removeItem(CSRF_RETRY_KEY);
  window.sessionStorage.removeItem(CSRF_ORIGINAL_ERROR_KEY);
  // Signing out is a deliberate global reset, so drop the lock whoever holds it.
  dropFlowLock();

  if (!shouldUseOAuthGate(mode)) {
    // Mock / hosted mode has no hydra session to revoke.
    window.location.assign(getAppHomePath());
    return Promise.resolve();
  }

  const params = new URLSearchParams({
    post_logout_redirect_uri: `${window.location.origin}${getAppHomePath()}`,
  });
  if (idToken) {
    params.set("id_token_hint", idToken);
  }

  window.location.assign(`${gatewayOrigin()}${LOGOUT_PATH}?${params.toString()}`);
  return Promise.resolve();
}
