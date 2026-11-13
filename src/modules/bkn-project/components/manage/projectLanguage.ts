/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { ProjectNamingLanguage } from "@/modules/bkn-project/types/project";

/**
 * The content language a new project starts with: the browser's, Chinese or English. It is never
 * guessed from the network, which has no language of its own; the person picks.
 */
export function defaultNamingLanguage(
  language: string | undefined = typeof navigator === "undefined" ? undefined : navigator.language,
): ProjectNamingLanguage {
  return language?.toLowerCase().startsWith("zh") ? "zh-CN" : "en-US";
}

/** The copy key naming a content language. */
export function namingLanguageLabelKey(language: ProjectNamingLanguage) {
  return language === "en-US"
    ? "bknProject.contentLanguage.options.en"
    : "bknProject.contentLanguage.options.zh";
}
