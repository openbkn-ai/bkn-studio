/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */
import i18n from "i18next";
import { authZhCN } from "@/app/locales/resources/auth/zh-CN";
import { authEnUS } from "@/app/locales/resources/auth/en-US";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { authorizeInOAuthPopup, relayOAuthPopupCallback } from "./oauth-popup";

beforeEach(async () => {
  window.sessionStorage.clear();
  await i18n.init({
    lng: "zh-CN",
    showSupportNotice: false,
    resources: { "zh-CN": { translation: authZhCN }, "en-US": { translation: authEnUS } },
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  window.sessionStorage.clear();
  window.history.replaceState({}, "", "/studio/callback");
});

it("requires the popup origin, source and one-time state before accepting a code", async () => {
  const storage = { setItem: vi.fn() };
  const popup = {
    sessionStorage: storage,
    closed: false,
    close: vi.fn(),
    location: { replace: vi.fn() },
  };
  vi.spyOn(window, "open").mockReturnValue(popup as unknown as Window);
  const pending = authorizeInOAuthPopup(() =>
    Promise.resolve({
      state: "independent-state",
      url: "https://auth.example/oauth2/auth",
    }),
  );
  await Promise.resolve();
  expect(storage.setItem).toHaveBeenCalledWith("bkn_oauth_popup_state", "independent-state");
  const emit = (origin: string, source: unknown, state: string) =>
    window.dispatchEvent(
      new MessageEvent("message", {
        origin,
        source: source as Window,
        data: { type: "bkn-oauth-popup-callback", state, code: "single-use-code" },
      }),
    );
  emit("https://evil.test", popup, "independent-state");
  emit(window.location.origin, window, "independent-state");
  emit(window.location.origin, popup, "wrong-state");
  expect(popup.close).not.toHaveBeenCalled();
  emit(window.location.origin, popup, "independent-state");
  await expect(pending).resolves.toEqual({ state: "independent-state", code: "single-use-code" });
  expect(window.sessionStorage.getItem("bkn_oauth_state")).toBeNull();
});

it.each([
  ["zh-CN", "请允许授权弹窗后重试。"],
  ["en-US", "Allow the authorization popup and try again."],
])(
  "does not start blocked authorization and reports the error in %s",
  async (language, message) => {
    await i18n.changeLanguage(language);
    vi.spyOn(window, "open").mockReturnValue(null);
    const begin = vi.fn();
    await expect(authorizeInOAuthPopup(begin)).rejects.toThrow(message);
    expect(begin).not.toHaveBeenCalled();
  },
);

it("relays independent authorization without changing the interactive login state", () => {
  const postMessage = vi.fn();
  vi.stubGlobal("opener", { postMessage });
  vi.spyOn(window, "close").mockImplementation(() => undefined);
  window.sessionStorage.setItem("bkn_oauth_popup_state", "popup-state");
  window.sessionStorage.setItem("bkn_oauth_state", "login-state");
  window.history.replaceState({}, "", "/studio/callback?state=popup-state&code=code");
  expect(relayOAuthPopupCallback()).toBe(true);
  expect(postMessage).toHaveBeenCalledWith(
    { type: "bkn-oauth-popup-callback", state: "popup-state", code: "code", error: null },
    window.location.origin,
  );
  expect(window.sessionStorage.getItem("bkn_oauth_state")).toBe("login-state");
  vi.unstubAllGlobals();
});

it("never forwards a code from a mismatched callback state", () => {
  const postMessage = vi.fn();
  vi.stubGlobal("opener", { postMessage });
  vi.spyOn(window, "close").mockImplementation(() => undefined);
  window.sessionStorage.setItem("bkn_oauth_popup_state", "expected");
  window.history.replaceState({}, "", "/studio/callback?state=wrong&code=do-not-forward");
  expect(relayOAuthPopupCallback()).toBe(true);
  expect(postMessage).toHaveBeenCalledWith(
    expect.objectContaining({ code: null, error: "OAuth state mismatch" }),
    window.location.origin,
  );
  vi.unstubAllGlobals();
});
