/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

const ACCESS_TOKEN_KEY = "bkn_access_token";
const REFRESH_TOKEN_KEY = "bkn_refresh_token";
const ID_TOKEN_KEY = "bkn_id_token";

export function getStoredAccessToken() {
  return window.sessionStorage.getItem(ACCESS_TOKEN_KEY)?.trim() ?? "";
}

export function getStoredRefreshToken() {
  return window.sessionStorage.getItem(REFRESH_TOKEN_KEY)?.trim() ?? "";
}

export function getStoredIdToken() {
  return window.sessionStorage.getItem(ID_TOKEN_KEY)?.trim() ?? "";
}

export function storeTokens(tokens: {
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
}) {
  window.sessionStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken.trim());

  if (tokens.refreshToken?.trim()) {
    window.sessionStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken.trim());
  } else {
    window.sessionStorage.removeItem(REFRESH_TOKEN_KEY);
  }

  if (tokens.idToken?.trim()) {
    window.sessionStorage.setItem(ID_TOKEN_KEY, tokens.idToken.trim());
  }
}

export function clearStoredTokens() {
  window.sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  window.sessionStorage.removeItem(REFRESH_TOKEN_KEY);
  window.sessionStorage.removeItem(ID_TOKEN_KEY);
}
