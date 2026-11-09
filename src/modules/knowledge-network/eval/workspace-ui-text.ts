/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import i18n from "i18next";
import { workspaceUiResources, workspaceUiSharedFallbacks } from "./locales/workspace-ui";

const namespace = "evalWorkspaceUi";
type WorkspaceUiKey =
  keyof (typeof workspaceUiResources)["zh-CN"] | keyof typeof workspaceUiSharedFallbacks;

/** Resolve at render/action time so mounted workspaces follow language changes. */
export function workspaceUi(key: WorkspaceUiKey, values: Record<string, unknown> = {}): string {
  const english = (i18n.resolvedLanguage || i18n.language || "zh-CN").startsWith("en");
  const locale = english ? "en-US" : "zh-CN";
  const shared = workspaceUiSharedFallbacks[key as keyof typeof workspaceUiSharedFallbacks];
  const resources: Readonly<Record<string, string>> = workspaceUiResources[locale];
  const fallbackOne = resources[`${key}_one`];
  const fallbackOther = resources[`${key}_other`];
  const hasPluralFallback = Boolean(fallbackOne && fallbackOther);
  const count = typeof values.count === "number" ? values.count : undefined;
  const plural = count === undefined ? undefined : new Intl.PluralRules(locale).select(count);
  const fallback =
    hasPluralFallback && count !== undefined
      ? plural === "one"
        ? fallbackOne
        : fallbackOther
      : shared
        ? shared[english ? "en" : "zh"]
        : resources[key];
  if (!i18n.isInitialized) {
    return fallback.replace(/{{(\w+)}}/g, (token, name: string) => {
      const value = values[name];
      if (value === undefined) return token;
      if (typeof value === "string") return value;
      if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint")
        return String(value);
      return JSON.stringify(value) ?? "";
    });
  }
  // Defaults also work after host/test resource resets, without mutating the
  // i18n store during a React render and notifying other mounted components.
  return i18n.t(key, {
    ...values,
    interpolation: { escapeValue: false },
    ns: shared && !hasPluralFallback ? "translation" : namespace,
    defaultValue: fallback,
    ...(hasPluralFallback
      ? { defaultValue_one: fallbackOne, defaultValue_other: fallbackOther }
      : {}),
  });
}
