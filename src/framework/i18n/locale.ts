/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { SupportedLocale } from "@/framework/runtime/types";

export const SUPPORTED_LOCALES = ["zh-CN", "en-US"] as const satisfies readonly SupportedLocale[];

export const FALLBACK_LOCALE: SupportedLocale = "en-US";

export const DEPLOYMENT_DEFAULT_LOCALE: SupportedLocale = "zh-CN";

export const LOCALE_STORAGE_KEY = "bkn-studio:locale";

const supportedLocaleSet = new Set<string>(SUPPORTED_LOCALES);

let activeDocumentLanguageSyncs = 0;
let restoreDocumentLanguage: (() => void) | undefined;
let synchronizedDocumentLanguage: string | undefined;

export type LocaleResolutionInput = {
  browserLanguages?: readonly string[];
  deploymentDefaultLocale?: SupportedLocale;
  persistedLocale?: string | null;
  runtimeLocale?: string | null;
};

export function normalizeSupportedLocale(locale: string | null | undefined): SupportedLocale | null {
  if (!locale) {
    return null;
  }

  const normalized = locale.trim().replace(/_/g, "-");
  if (supportedLocaleSet.has(normalized)) {
    return normalized as SupportedLocale;
  }

  const lower = normalized.toLowerCase();
  if (lower === "zh" || lower.startsWith("zh-")) {
    return "zh-CN";
  }
  if (lower === "en" || lower.startsWith("en-")) {
    return "en-US";
  }

  return null;
}

export function resolveSupportedLocale({
  browserLanguages = readBrowserLanguages(),
  deploymentDefaultLocale = DEPLOYMENT_DEFAULT_LOCALE,
  persistedLocale = readPersistedLocale(),
  runtimeLocale,
}: LocaleResolutionInput = {}): SupportedLocale {
  return (
    normalizeSupportedLocale(runtimeLocale) ??
    normalizeSupportedLocale(persistedLocale) ??
    firstSupportedLocale(browserLanguages) ??
    deploymentDefaultLocale ??
    FALLBACK_LOCALE
  );
}

export function readPersistedLocale(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(LOCALE_STORAGE_KEY);
}

export function persistLocale(locale: SupportedLocale) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
}

export function syncDocumentLanguage(locale: SupportedLocale) {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.lang = locale;
  synchronizedDocumentLanguage = locale;
}

export function preserveDocumentLanguage() {
  if (typeof document === "undefined") {
    return () => undefined;
  }

  if (activeDocumentLanguageSyncs === 0) {
    const originalLanguage = document.documentElement.getAttribute("lang");
    restoreDocumentLanguage = () => {
      if (originalLanguage === null) {
        document.documentElement.removeAttribute("lang");
        return;
      }
      document.documentElement.lang = originalLanguage;
    };
  }
  activeDocumentLanguageSyncs += 1;

  let released = false;
  return () => {
    if (released) {
      return;
    }
    released = true;
    activeDocumentLanguageSyncs -= 1;
    if (activeDocumentLanguageSyncs === 0) {
      if (document.documentElement.lang === synchronizedDocumentLanguage) {
        restoreDocumentLanguage?.();
      }
      restoreDocumentLanguage = undefined;
      synchronizedDocumentLanguage = undefined;
    }
  };
}

function firstSupportedLocale(locales: readonly string[]) {
  for (const locale of locales) {
    const normalized = normalizeSupportedLocale(locale);
    if (normalized) {
      return normalized;
    }
  }
  return null;
}

function readBrowserLanguages(): string[] {
  if (typeof navigator === "undefined") {
    return [];
  }
  return navigator.languages?.length ? [...navigator.languages] : [navigator.language];
}
