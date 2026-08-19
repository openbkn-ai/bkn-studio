/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  LOCALE_COOKIE_NAME,
  LOCALE_STORAGE_KEY,
} from "@/framework/i18n/locale";
import { startStandaloneApp } from "@/framework/runtime/bootstrap";

vi.mock("react-dom/client", () => ({
  createRoot: vi.fn(() => ({
    render: vi.fn(),
    unmount: vi.fn(),
  })),
}));

vi.mock("@/app/App", () => ({
  App: () => null,
}));

vi.mock("@/app/locales/i18n", () => ({
  default: {
    changeLanguage: vi.fn(),
    on: vi.fn(),
    use: vi.fn(() => ({
      init: vi.fn(),
    })),
  },
}));

vi.mock("@/framework/auth/token-store", () => ({
  subscribeAuthBroadcast: vi.fn(() => () => undefined),
}));

describe("standalone bootstrap locale persistence", () => {
  const initialLocation = `${window.location.pathname}${window.location.search}${window.location.hash}`;

  beforeEach(() => {
    document.body.innerHTML = '<div id="root"></div>';
    window.localStorage.clear();
    document.cookie = `${LOCALE_COOKIE_NAME}=; Path=/; Max-Age=0`;
    document.cookie = `${LOCALE_COOKIE_NAME}=; Path=/studio; Max-Age=0`;
    window.history.replaceState(null, "", initialLocation);
    delete window.__BKN_STUDIO_RUNTIME__;
  });

  afterEach(() => {
    document.body.innerHTML = "";
    window.localStorage.clear();
    document.cookie = `${LOCALE_COOKIE_NAME}=; Path=/; Max-Age=0`;
    document.cookie = `${LOCALE_COOKIE_NAME}=; Path=/studio; Max-Age=0`;
    window.history.replaceState(null, "", initialLocation);
    delete window.__BKN_STUDIO_RUNTIME__;
  });

  it("persists the login-page cookie locale over an older Studio preference", () => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, "en-US");
    document.cookie = `${LOCALE_COOKIE_NAME}=zh-CN; Path=/`;

    startStandaloneApp();

    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe("zh-CN");
  });

  it("persists an English login-page cookie over an older Chinese Studio preference", () => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, "zh-CN");
    document.cookie = `${LOCALE_COOKIE_NAME}=en-US; Path=/`;

    startStandaloneApp();

    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe("en-US");
  });

  it("clears stale scoped login locale cookies before resolving the standalone locale", () => {
    window.history.replaceState(null, "", "/studio/callback");
    window.localStorage.setItem(LOCALE_STORAGE_KEY, "zh-CN");
    document.cookie = `${LOCALE_COOKIE_NAME}=zh-CN; Path=/studio`;
    document.cookie = `${LOCALE_COOKIE_NAME}=en-US; Path=/`;
    window.__BKN_STUDIO_RUNTIME__ = { router: { basename: "/studio" } };

    startStandaloneApp();

    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe("en-US");

    document.cookie = `${LOCALE_COOKIE_NAME}=; Path=/; Max-Age=0`;

    expect(document.cookie).not.toContain(`${LOCALE_COOKIE_NAME}=`);
  });

  it("does not persist locale for hosted runtime mode", () => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, "en-US");
    document.cookie = `${LOCALE_COOKIE_NAME}=zh-CN; Path=/`;
    window.__BKN_STUDIO_RUNTIME__ = { mode: "hosted" };

    startStandaloneApp();

    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe("en-US");
  });
});
