/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { afterEach, describe, expect, it } from "vitest";

import {
  LOCALE_STORAGE_KEY,
  normalizeSupportedLocale,
  persistLocale,
  preserveDocumentLanguage,
  readPersistedLocale,
  resolveSupportedLocale,
  syncDocumentLanguage,
} from "@/framework/i18n/locale";

const initialDocumentLanguage = document.documentElement.getAttribute("lang");

describe("locale resolution", () => {
  afterEach(() => {
    window.localStorage.removeItem(LOCALE_STORAGE_KEY);
    if (initialDocumentLanguage === null) {
      document.documentElement.removeAttribute("lang");
      return;
    }
    document.documentElement.lang = initialDocumentLanguage;
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

  it("persists the selected locale for future app starts", () => {
    persistLocale("en-US");

    expect(readPersistedLocale()).toBe("en-US");
    expect(
      resolveSupportedLocale({
        browserLanguages: ["zh-CN"],
      }),
    ).toBe("en-US");
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
