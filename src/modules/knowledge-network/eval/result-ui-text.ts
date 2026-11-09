/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import i18n from "i18next";
import { resultUi } from "./locales/result-ui";

export function resultUiText(
  key: keyof (typeof resultUi)["zh-CN"],
  values?: Record<string, string | number | boolean>,
): string {
  const locale = (i18n.resolvedLanguage ?? i18n.language ?? "zh-CN").startsWith("en")
    ? "en-US"
    : "zh-CN";
  const template = resultUi[locale][key];
  // Isolated previews can render before application i18n initializes.
  return i18n.isInitialized
    ? i18n.t(`evalResultUi.${key}`, {
        ...values,
        defaultValue: template,
        interpolation: { escapeValue: false },
      })
    : template.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(values?.[name] ?? ""));
}
