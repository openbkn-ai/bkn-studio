/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/**
 * Auth tokens live in cookies so same-origin tabs share login state.
 * OAuth PKCE handshake keys stay in sessionStorage (see oauth.ts).
 *
 * Cookie jar is not HttpOnly (SPA still needs to attach Bearer headers).
 * Cross-tab logout uses BroadcastChannel — cookie changes do not fire
 * the `storage` event.
 */

const ACCESS_TOKEN_KEY = "bkn_access_token";
const REFRESH_TOKEN_KEY = "bkn_refresh_token";
const ID_TOKEN_KEY = "bkn_id_token";

/** Days until cookie expiry (align with typical refresh lifetime). */
const TOKEN_COOKIE_MAX_AGE_DAYS = 7;

const AUTH_CHANNEL_NAME = "bkn-auth";

export type AuthBroadcastMessage = { type: "logout" };

/**
 * Host-only cookies (no Domain attribute) so localhost / IPs work and tabs
 * on the same host still share login. Parent-domain sharing can be added later
 * if Studio is served across sibling subdomains.
 */
function cookieOptions(): string {
  const parts = [
    "path=/",
    "SameSite=Lax",
    `max-age=${TOKEN_COOKIE_MAX_AGE_DAYS * 24 * 60 * 60}`,
  ];
  if (window.location.protocol === "https:") {
    parts.push("Secure");
  }
  return parts.join("; ");
}

function readCookie(name: string): string {
  const prefix = `${encodeURIComponent(name)}=`;
  const parts = document.cookie ? document.cookie.split("; ") : [];
  for (const part of parts) {
    if (part.startsWith(prefix)) {
      return decodeURIComponent(part.slice(prefix.length)).trim();
    }
  }
  return "";
}

function writeCookie(name: string, value: string): boolean {
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; ${cookieOptions()}`;
  // Browsers silently drop oversized cookies (~4KB). Detect so callers can react.
  return readCookie(name) === value.trim();
}

function removeCookie(name: string): void {
  const base = ["path=/", "SameSite=Lax", "max-age=0"];
  if (window.location.protocol === "https:") {
    base.push("Secure");
  }
  document.cookie = `${encodeURIComponent(name)}=; ${base.join("; ")}`;
}

/**
 * One-shot migration for sessions that logged in before the cookie store.
 * Safe to call repeatedly: no-ops once cookies are present or legacy is empty.
 */
function migrateFromSessionStorageOnce(): void {
  if (typeof window === "undefined") {
    return;
  }
  if (readCookie(ACCESS_TOKEN_KEY)) {
    return;
  }
  const legacyAccess = window.sessionStorage.getItem(ACCESS_TOKEN_KEY)?.trim();
  if (!legacyAccess) {
    return;
  }

  writeCookie(ACCESS_TOKEN_KEY, legacyAccess);

  const legacyRefresh = window.sessionStorage.getItem(REFRESH_TOKEN_KEY)?.trim();
  if (legacyRefresh) {
    writeCookie(REFRESH_TOKEN_KEY, legacyRefresh);
  }

  const legacyId = window.sessionStorage.getItem(ID_TOKEN_KEY)?.trim();
  if (legacyId) {
    writeCookie(ID_TOKEN_KEY, legacyId);
  }

  window.sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  window.sessionStorage.removeItem(REFRESH_TOKEN_KEY);
  window.sessionStorage.removeItem(ID_TOKEN_KEY);
}

function getAuthChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === "undefined") {
    return null;
  }
  try {
    return new BroadcastChannel(AUTH_CHANNEL_NAME);
  } catch {
    return null;
  }
}

function broadcastLogout(): void {
  const channel = getAuthChannel();
  if (!channel) {
    return;
  }
  const message: AuthBroadcastMessage = { type: "logout" };
  channel.postMessage(message);
  channel.close();
}

/**
 * Subscribe to cross-tab auth events (e.g. logout). Returns an unsubscribe fn.
 */
export function subscribeAuthBroadcast(
  onMessage: (message: AuthBroadcastMessage) => void,
): () => void {
  const channel = getAuthChannel();
  if (!channel) {
    return () => undefined;
  }

  const handler = (event: MessageEvent<AuthBroadcastMessage>) => {
    if (event.data?.type === "logout") {
      onMessage(event.data);
    }
  };
  channel.addEventListener("message", handler);
  return () => {
    channel.removeEventListener("message", handler);
    channel.close();
  };
}

export function getStoredAccessToken() {
  migrateFromSessionStorageOnce();
  return readCookie(ACCESS_TOKEN_KEY);
}

export function getStoredRefreshToken() {
  migrateFromSessionStorageOnce();
  return readCookie(REFRESH_TOKEN_KEY);
}

export function getStoredIdToken() {
  migrateFromSessionStorageOnce();
  return readCookie(ID_TOKEN_KEY);
}

export function storeTokens(tokens: {
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
}) {
  const accessOk = writeCookie(ACCESS_TOKEN_KEY, tokens.accessToken.trim());
  if (!accessOk) {
    console.error(
      "[auth] failed to persist access token cookie (possibly exceeds browser size limit)",
    );
  }

  if (tokens.refreshToken?.trim()) {
    const refreshOk = writeCookie(REFRESH_TOKEN_KEY, tokens.refreshToken.trim());
    if (!refreshOk) {
      console.error(
        "[auth] failed to persist refresh token cookie (possibly exceeds browser size limit)",
      );
    }
  } else {
    // Match prior sessionStorage behavior: omit/empty clears refresh.
    removeCookie(REFRESH_TOKEN_KEY);
  }

  // Only overwrite id token when the token response includes one. Refresh
  // grants often omit id_token; wiping the cookie would break hydra logout
  // (id_token_hint).
  if (tokens.idToken?.trim()) {
    const idOk = writeCookie(ID_TOKEN_KEY, tokens.idToken.trim());
    if (!idOk) {
      console.error(
        "[auth] failed to persist id token cookie (possibly exceeds browser size limit)",
      );
    }
  }

  // Drop any leftover sessionStorage tokens from older builds.
  window.sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  window.sessionStorage.removeItem(REFRESH_TOKEN_KEY);
  window.sessionStorage.removeItem(ID_TOKEN_KEY);
}

export function clearStoredTokens() {
  removeCookie(ACCESS_TOKEN_KEY);
  removeCookie(REFRESH_TOKEN_KEY);
  removeCookie(ID_TOKEN_KEY);
  window.sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  window.sessionStorage.removeItem(REFRESH_TOKEN_KEY);
  window.sessionStorage.removeItem(ID_TOKEN_KEY);
  broadcastLogout();
}
