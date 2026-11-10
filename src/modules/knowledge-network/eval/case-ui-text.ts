/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import i18n from "i18next";
import { caseUiResources } from "./locales/case-ui";

const namespace = "evalCaseUi";
type CaseUiKey = keyof (typeof caseUiResources)["zh-CN"];

const registerCaseUiResources = () => {
  for (const [locale, resources] of Object.entries(caseUiResources)) {
    i18n.addResourceBundle(locale, namespace, resources, true, true);
  }
};
if (i18n.isInitialized) registerCaseUiResources();
i18n.on("initialized", registerCaseUiResources);
if (import.meta.hot) {
  import.meta.hot.dispose(() => i18n.off("initialized", registerCaseUiResources));
}

/** Resolve copy at render time so open forms follow language changes. */
export function caseUiText(key: CaseUiKey, values: Record<string, unknown> = {}): string {
  const locale = (i18n.language ?? i18n.resolvedLanguage ?? "zh-CN").startsWith("en")
    ? "en-US"
    : "zh-CN";
  const resources: Record<string, string> = caseUiResources[locale];
  const count = values.count;
  const pluralKey =
    typeof count === "number" && Number.isFinite(count)
      ? `${key}_${new Intl.PluralRules(locale).select(count)}`
      : key;
  const fallback = resources[pluralKey] ?? resources[key];
  if (!i18n.isInitialized) {
    return fallback.replace(/{{(\w+)}}/g, (match, name: string) => {
      const value = values[name];
      if (value === undefined) return match;
      if (typeof value === "string") return value;
      if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint")
        return String(value);
      return JSON.stringify(value) ?? "";
    });
  }
  // Tests and embedded hosts can replace resource bundles after initialization.
  // Keep a default value even when this namespace has been removed by the host.
  return i18n.t(key, {
    ns: key.startsWith("knowledgeNetwork.") ? "translation" : namespace,
    defaultValue: fallback,
    ...values,
    interpolation: { escapeValue: false },
  });
}
