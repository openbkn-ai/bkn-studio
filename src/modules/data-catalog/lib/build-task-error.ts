/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import i18n from "@/app/locales/i18n";

export type BuildTaskErrorSummary = {
  message: string;
  raw: string;
  suggestion?: string;
  title: string;
};

export function summarizeBuildTaskError(
  rawError: string | null | undefined,
  language?: string,
): BuildTaskErrorSummary | null {
  const raw = rawError?.trim();
  if (!raw) {
    return null;
  }

  const dataTooLong = raw.match(/Data too long for column '([^']+)'/i);
  if (dataTooLong) {
    const column = dataTooLong[1];
    const isSyncedMark = column === "f_synced_mark";
    return {
      title: taskErrorText("dataTooLong.title", language),
      message: isSyncedMark
        ? taskErrorText("dataTooLong.syncedMarkMessage", language)
        : taskErrorText("dataTooLong.columnMessage", language, { column }),
      raw,
      suggestion: isSyncedMark
        ? taskErrorText("dataTooLong.syncedMarkSuggestion", language)
        : taskErrorText("dataTooLong.columnSuggestion", language),
    };
  }

  const duplicateEntry = raw.match(/Duplicate entry '([^']+)'/i);
  if (duplicateEntry) {
    return {
      title: taskErrorText("duplicateEntry.title", language),
      message: taskErrorText("duplicateEntry.message", language),
      raw,
      suggestion: taskErrorText("duplicateEntry.suggestion", language),
    };
  }

  if (/id is missing/i.test(raw)) {
    return {
      title: taskErrorText("missingDocumentId.title", language),
      message: taskErrorText("missingDocumentId.message", language),
      raw,
      suggestion: taskErrorText("missingDocumentId.suggestion", language),
    };
  }

  return {
    title: taskErrorText("unknown.title", language),
    message: taskErrorText("unknown.message", language),
    raw,
  };
}

function taskErrorText(
  key: string,
  language: string | undefined,
  values: Record<string, unknown> = {},
) {
  return i18n.t(`dataCatalog.taskErrors.${key}`, {
    lng: language,
    ...values,
  });
}
