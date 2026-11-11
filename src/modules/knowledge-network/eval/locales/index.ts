/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { evalPart as enUS } from "./en-US";
import { evalPart as zhCN } from "./zh-CN";
import i18n, { type i18n as I18n } from "i18next";

export const evalLocales = {
  "en-US": { knowledgeNetwork: enUS },
  "zh-CN": { knowledgeNetwork: zhCN },
};

/** Refresh only Eval-owned copy, never re-register the frozen extension or replace core copy. */
export function syncEvalLocales(instance: I18n = i18n) {
  for (const [locale, resources] of Object.entries(evalLocales)) {
    instance.addResourceBundle(locale, "translation", resources, true, true);
  }
}

const onInitialized = () => syncEvalLocales();
if (i18n.isInitialized) syncEvalLocales();
i18n.on("initialized", onInitialized);

// Locale edits must reach the resource store even when React Refresh preserves the page.
// Eval consumers subscribe to resource additions through useEvalTranslation; drafts stay mounted.
if (import.meta.hot) {
  import.meta.hot.accept();
  import.meta.hot.dispose(() => i18n.off("initialized", onInitialized));
}
