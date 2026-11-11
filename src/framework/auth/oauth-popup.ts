/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import i18n from "i18next";

const popupStateKey = "bkn_oauth_popup_state";
const messageType = "bkn-oauth-popup-callback";

/** Relay only the one-time code to the opener. Independent authorizations must
 * never replace the current tab's login/refresh token or its OAuth state. */
export function relayOAuthPopupCallback(): boolean {
  const expected = window.sessionStorage.getItem(popupStateKey);
  if (!expected) return false;
  const params = new URLSearchParams(window.location.search);
  window.sessionStorage.removeItem(popupStateKey);
  const opener: Window | null = window.opener as Window | null;
  if (!opener) throw new Error(i18n.t("auth.popup.disconnected"));
  const matches = params.get("state") === expected;
  opener.postMessage(
    {
      type: messageType,
      state: expected,
      code: matches ? params.get("code") : null,
      error: matches ? params.get("error") : "OAuth state mismatch",
    },
    window.location.origin,
  );
  window.close();
  return true;
}

export function reserveOAuthPopup(): Window {
  const popup = window.open("about:blank", "_blank", "popup,width=600,height=720");
  if (!popup) throw new Error(i18n.t("auth.popup.blocked"));
  return popup;
}

/** Call from a user click so browser popup protection permits the window. */
export async function authorizeInOAuthPopup(
  begin: () => Promise<{ state: string; url: string }>,
  reserved?: Window,
): Promise<{ state: string; code: string }> {
  const popup = reserved ?? reserveOAuthPopup();
  try {
    const authorization = await begin();
    popup.sessionStorage.setItem(popupStateKey, authorization.state);
    return await new Promise((resolve, reject) => {
      const cleanup = () => {
        window.removeEventListener("message", receive);
        window.clearInterval(closed);
        window.clearTimeout(timeout);
        popup.close();
      };
      const receive = (event: MessageEvent<unknown>) => {
        const data = event.data;
        if (
          event.origin !== window.location.origin ||
          event.source !== popup ||
          !data ||
          typeof data !== "object" ||
          !("type" in data) ||
          data.type !== messageType ||
          !("state" in data) ||
          data.state !== authorization.state
        )
          return;
        cleanup();
        if (
          ("error" in data && data.error) ||
          !("code" in data) ||
          typeof data.code !== "string" ||
          !data.code
        ) {
          reject(new Error(i18n.t("auth.popup.incomplete")));
        } else resolve({ state: authorization.state, code: data.code });
      };
      const closed = window.setInterval(() => {
        if (popup.closed) {
          cleanup();
          reject(new Error(i18n.t("auth.popup.cancelled")));
        }
      }, 500);
      const timeout = window.setTimeout(
        () => {
          cleanup();
          reject(new Error(i18n.t("auth.popup.timeout")));
        },
        10 * 60 * 1000,
      );
      window.addEventListener("message", receive);
      popup.location.replace(authorization.url);
    });
  } catch (error) {
    popup.close();
    throw error;
  }
}
