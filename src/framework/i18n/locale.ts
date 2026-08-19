/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { RuntimeConfig, SupportedLocale } from "@/framework/runtime/types";

export const SUPPORTED_LOCALES = ["zh-CN", "en-US"] as const satisfies readonly SupportedLocale[];

export const FALLBACK_LOCALE: SupportedLocale = "en-US";

export const DEPLOYMENT_DEFAULT_LOCALE: SupportedLocale = "zh-CN";

export const LOCALE_STORAGE_KEY = "bkn-studio:locale";

export const LOCALE_COOKIE_NAME = "openbkn_locale";

const LOCALE_COOKIE_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;

const supportedLocaleSet = new Set<string>(SUPPORTED_LOCALES);

let activeDocumentLanguageSyncs = 0;
let restoreDocumentLanguage: (() => void) | undefined;
let synchronizedDocumentLanguage: string | undefined;

export type LocaleResolutionInput = {
  browserLanguages?: readonly string[];
  cookieLocale?: string | null;
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
  cookieLocale = readLocaleCookie(),
  deploymentDefaultLocale = DEPLOYMENT_DEFAULT_LOCALE,
  persistedLocale = readPersistedLocale(),
  runtimeLocale,
}: LocaleResolutionInput = {}): SupportedLocale {
  return (
    normalizeSupportedLocale(runtimeLocale) ??
    normalizeSupportedLocale(cookieLocale) ??
    normalizeSupportedLocale(persistedLocale) ??
    firstSupportedLocale(browserLanguages) ??
    deploymentDefaultLocale ??
    FALLBACK_LOCALE
  );
}

export function resolveAuthenticatedStandaloneLocale(
  currentLocale: SupportedLocale,
  mode: RuntimeConfig["mode"],
): SupportedLocale {
  if (mode !== "standalone") {
    return currentLocale;
  }

  return resolveSupportedLocale({
    deploymentDefaultLocale: currentLocale,
  });
}

export function readPersistedLocale(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(LOCALE_STORAGE_KEY);
}

export function readLocaleCookie(): string | null {
  if (typeof document === "undefined") {
    return null;
  }

  return readLocaleCookieValue(document.cookie);
}

export function readLocaleCookieValue(cookieHeader: string): string | null {
  let matchedValue: string | null = null;

  for (const item of cookieHeader.split(";")) {
    const [rawName, ...rawValue] = item.trim().split("=");
    if (rawName !== LOCALE_COOKIE_NAME) {
      continue;
    }
    const value = rawValue.join("=");
    try {
      matchedValue = decodeURIComponent(value);
    } catch {
      matchedValue = value;
    }
  }

  return matchedValue;
}

export function clearLegacyLocaleCookies(basename = "/studio") {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return;
  }

  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  const legacyPaths = new Set<string>();
  addLegacyLocaleCookiePath(legacyPaths, basename);
  addLegacyLocaleCookiePath(legacyPaths, defaultCookiePath(window.location.pathname));

  for (const path of legacyPaths) {
    document.cookie = `${LOCALE_COOKIE_NAME}=; Path=${path}; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax${secure}`;
  }
}

export function persistLocale(locale: SupportedLocale) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${LOCALE_COOKIE_NAME}=${encodeURIComponent(locale)}; Path=/; Max-Age=${LOCALE_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
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

function addLegacyLocaleCookiePath(paths: Set<string>, path: string | null | undefined) {
  const normalizedPath = normalizeCookiePath(path);
  if (normalizedPath && normalizedPath !== "/") {
    paths.add(normalizedPath);
  }
}

function normalizeCookiePath(path: string | null | undefined) {
  const trimmed = path?.trim();
  if (!trimmed) {
    return null;
  }
  const withLeadingSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  const withoutTrailingSlash = withLeadingSlash.replace(/\/+$/, "");
  return withoutTrailingSlash || "/";
}

function defaultCookiePath(pathname: string) {
  if (!pathname.startsWith("/") || pathname === "/") {
    return "/";
  }

  const rightmostSlash = pathname.lastIndexOf("/");
  if (rightmostSlash <= 0) {
    return "/";
  }
  return pathname.slice(0, rightmostSlash);
}
