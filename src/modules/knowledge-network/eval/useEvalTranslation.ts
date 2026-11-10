/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useTranslation } from "react-i18next";
import type { ReactOptions } from "i18next";
import "./locales";

const options = {
  bindI18n: "languageChanged",
  bindI18nStore: "added removed",
} satisfies ReactOptions;

export function useEvalTranslation() {
  return useTranslation(undefined, options);
}
