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

function gatewayOrigin() {
  if (!import.meta.env.DEV) {
    return "";
  }

  const value: unknown = import.meta.env.VITE_DEV_AUTH_ORIGIN;
  return typeof value === "string" ? value.trim().replace(/\/+$/, "") : "";
}

export const OAUTH_CALLBACK_PATH = "/callback";

const STATE_KEY = "bkn_oauth_state";
const VERIFIER_KEY = "bkn_oauth_verifier";
const RETURN_TO_KEY = "bkn_oauth_return_to";

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
  return pathname === OAUTH_CALLBACK_PATH;
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
  const digest = await window.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  );
  return base64UrlEncode(new Uint8Array(digest));
}

function redirectUri() {
  return `${window.location.origin}${OAUTH_CALLBACK_PATH}`;
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

  const returnTo = window.sessionStorage.getItem(RETURN_TO_KEY) ?? "/";
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

  if (!shouldUseOAuthGate(mode)) {
    // Mock / hosted mode has no hydra session to revoke.
    window.location.assign("/");
    return;
  }

  const params = new URLSearchParams({
    post_logout_redirect_uri: `${window.location.origin}/`,
  });
  if (idToken) {
    params.set("id_token_hint", idToken);
  }

  window.location.assign(`${gatewayOrigin()}${LOGOUT_PATH}?${params.toString()}`);
}
