/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  clearLegacyLocaleCookies,
  LOCALE_COOKIE_NAME,
  LOCALE_STORAGE_KEY,
  normalizeSupportedLocale,
  persistLocale,
  preserveDocumentLanguage,
  readLocaleCookie,
  readLocaleCookieValue,
  readPersistedLocale,
  resolveSupportedLocale,
  syncDocumentLanguage,
} from "@/framework/i18n/locale";

const initialDocumentLanguage = document.documentElement.getAttribute("lang");
const initialLocation = `${window.location.pathname}${window.location.search}${window.location.hash}`;

describe("locale resolution", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.removeItem(LOCALE_STORAGE_KEY);
    document.cookie = `${LOCALE_COOKIE_NAME}=; Path=/; Max-Age=0`;
    document.cookie = `${LOCALE_COOKIE_NAME}=; Path=/studio; Max-Age=0`;
    window.history.replaceState(null, "", initialLocation);
    if (initialDocumentLanguage === null) {
      document.documentElement.removeAttribute("lang");
    } else {
      document.documentElement.lang = initialDocumentLanguage;
    }
  });

  it("normalizes supported locale aliases", () => {
    expect(normalizeSupportedLocale("en")).toBe("en-US");
    expect(normalizeSupportedLocale("en-GB")).toBe("en-US");
    expect(normalizeSupportedLocale("zh")).toBe("zh-CN");
    expect(normalizeSupportedLocale("zh_Hans_CN")).toBe("zh-CN");
    expect(normalizeSupportedLocale("fr-FR")).toBeNull();
  });

  it("prefers runtime locale over persisted and browser locales", () => {
    expect(
      resolveSupportedLocale({
        browserLanguages: ["en-GB"],
        persistedLocale: "zh-CN",
        runtimeLocale: "en-US",
      }),
    ).toBe("en-US");
  });

  it("uses persisted locale before browser locale", () => {
    expect(
      resolveSupportedLocale({
        browserLanguages: ["en-GB"],
        persistedLocale: "zh-CN",
      }),
    ).toBe("zh-CN");
  });

  it("uses the shared login locale cookie before Studio local storage", () => {
    document.cookie = `${LOCALE_COOKIE_NAME}=en-US; Path=/`;

    expect(
      resolveSupportedLocale({
        browserLanguages: ["zh-CN"],
        persistedLocale: "zh-CN",
      }),
    ).toBe("en-US");
  });

  it("uses the last repeated login locale cookie value", () => {
    expect(
      readLocaleCookieValue(`${LOCALE_COOKIE_NAME}=zh-CN; other=value; ${LOCALE_COOKIE_NAME}=en-US`),
    ).toBe("en-US");
  });

  it("persists the selected locale for future app starts", () => {
    persistLocale("en-US");

    expect(readPersistedLocale()).toBe("en-US");
    expect(readLocaleCookie()).toBe("en-US");
    expect(
      resolveSupportedLocale({
        browserLanguages: ["zh-CN"],
      }),
    ).toBe("en-US");
  });

  it("does not clear legacy path-scoped cookies when persisting an in-app locale change", () => {
    const cookieSetter = vi.spyOn(Document.prototype, "cookie", "set");

    persistLocale("en-US");

    expect(cookieSetter).toHaveBeenCalledTimes(1);
    expect(cookieSetter.mock.calls[0]?.[0]).toContain(`${LOCALE_COOKIE_NAME}=en-US; Path=/;`);
    expect(cookieSetter.mock.calls.some(([value]) => value.includes("Max-Age=0"))).toBe(false);
  });

  it("clears normalized legacy path-scoped cookies while keeping the root login locale cookie", () => {
    window.history.replaceState(null, "", "/studio/callback");
    document.cookie = `${LOCALE_COOKIE_NAME}=zh-CN; Path=/studio`;
    document.cookie = `${LOCALE_COOKIE_NAME}=en-US; Path=/`;

    clearLegacyLocaleCookies("studio/");

    expect(readLocaleCookie()).toBe("en-US");

    document.cookie = `${LOCALE_COOKIE_NAME}=; Path=/; Max-Age=0`;

    expect(readLocaleCookie()).toBeNull();
  });

  it("does not delete the root locale cookie when legacy paths normalize to root", () => {
    window.history.replaceState(null, "", "/studio");
    const cookieSetter = vi.spyOn(Document.prototype, "cookie", "set");

    clearLegacyLocaleCookies("/");

    expect(cookieSetter).not.toHaveBeenCalled();
  });

  it("ignores an unsupported shared login locale cookie", () => {
    document.cookie = `${LOCALE_COOKIE_NAME}=fr-FR; Path=/`;

    expect(
      resolveSupportedLocale({
        browserLanguages: ["zh-CN"],
        persistedLocale: null,
      }),
    ).toBe("zh-CN");
  });

  it("falls back to deployment default when no requested locale is supported", () => {
    expect(
      resolveSupportedLocale({
        browserLanguages: ["fr-FR"],
        deploymentDefaultLocale: "zh-CN",
        runtimeLocale: "fr-FR",
      }),
    ).toBe("zh-CN");
  });

  it("restores the host document language after the last mounted app unmounts", () => {
    document.documentElement.lang = "fr-FR";
    const releaseFirst = preserveDocumentLanguage();
    const releaseSecond = preserveDocumentLanguage();

    syncDocumentLanguage("en-US");
    releaseFirst();

    expect(document.documentElement.lang).toBe("en-US");

    releaseSecond();

    expect(document.documentElement.lang).toBe("fr-FR");
  });

  it("keeps a host language changed while Studio is mounted", () => {
    document.documentElement.lang = "fr-FR";
    const release = preserveDocumentLanguage();

    syncDocumentLanguage("en-US");
    document.documentElement.lang = "de-DE";
    release();

    expect(document.documentElement.lang).toBe("de-DE");
  });
});
