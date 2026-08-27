/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { RuntimeInput } from "@/framework/runtime/types";

export { DEFAULT_APP_BASENAME } from "./app-basename";
import { DEFAULT_APP_BASENAME } from "./app-basename";

// The application root forwards to the current default module route.
export const DEFAULT_APP_ENTRY_PATH = "/";

function normalizeBasename(value?: string) {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === "/") {
    return "/";
  }

  const withLeadingSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return withLeadingSlash.replace(/\/+$/, "");
}

function readRuntimeBasename(runtimeInput?: RuntimeInput) {
  return runtimeInput?.router?.basename;
}

export function resolveAppBasename(runtimeInput?: RuntimeInput) {
  return normalizeBasename(readRuntimeBasename(runtimeInput) ?? DEFAULT_APP_BASENAME);
}

export function getAppBasename() {
  if (typeof window === "undefined") {
    return resolveAppBasename();
  }

  return resolveAppBasename(window.__BKN_STUDIO_RUNTIME__);
}

export function buildAppPath(pathname = DEFAULT_APP_ENTRY_PATH) {
  const basename = getAppBasename();
  const normalizedPathname = pathname.startsWith("/") ? pathname : `/${pathname}`;

  if (basename === "/") {
    return normalizedPathname;
  }

  if (normalizedPathname === "/") {
    return basename;
  }

  return `${basename}${normalizedPathname}`;
}

export function getAppHomePath() {
  return buildAppPath(DEFAULT_APP_ENTRY_PATH);
}

export function getAppCallbackPath() {
  return buildAppPath("/callback");
}
