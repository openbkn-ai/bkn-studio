/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import axios from "axios";

import i18n from "@/app/locales/i18n";
import {
  extractRequestErrorDetails,
  extractRequestErrorMessage,
  readErrorCode,
  registerErrorCodeMessage,
} from "@/framework/request/error-message";
import { isBuildStartRejected } from "@/modules/data-catalog/utils/build-task-guards";

const INCREMENTAL_BASELINE_UNAVAILABLE = "VegaBackend.BuildTask.IncrementalBaselineUnavailable";

registerErrorCodeMessage(INCREMENTAL_BASELINE_UNAVAILABLE, () =>
  i18n.t("dataCatalog.build.incrementalBaselineUnavailable"),
);

export function extractBuildTaskErrorDetails(error: unknown) {
  const details = extractRequestErrorDetails(error);
  // The localized message replaces the backend description. Retain it as a
  // diagnostic fallback when the response has no separate error details.
  if (
    details.code === INCREMENTAL_BASELINE_UNAVAILABLE &&
    !details.details &&
    axios.isAxiosError<{ description?: unknown }>(error)
  ) {
    const description = error.response?.data?.description;
    if (typeof description === "string" && description.trim()) {
      return { ...details, details: description };
    }
  }
  return details;
}

export function buildTaskStartErrorMessage(error: unknown) {
  if (readErrorCode(error) !== INCREMENTAL_BASELINE_UNAVAILABLE && isBuildStartRejected(error)) {
    return i18n.t("dataCatalog.task.startRejected");
  }
  return extractRequestErrorMessage(error);
}

export type BuildTaskErrorSummary = {
  message: string;
  raw: string;
  suggestion?: string;
  title: string;
};

const incrementalRecoveryErrors = new Map([
  ["cannot recover incremental checkpoint: unsupported cursor field", "unsupportedField"],
  ["cannot recover incremental checkpoint: published index query failed", "queryFailed"],
  ["cannot recover incremental checkpoint: invalid indexed cursor", "invalidCursor"],
  ["cannot recover a compatible incremental checkpoint from the published index", "unknown"],
]);

export function summarizeBuildTaskError(
  rawError: string | null | undefined,
  language?: string,
): BuildTaskErrorSummary | null {
  const raw = rawError?.trim();
  if (!raw) {
    return null;
  }

  const recoveryError = incrementalRecoveryErrors.get(raw);
  if (recoveryError) {
    return {
      title: taskErrorText("incrementalRecovery.title", language),
      message: taskErrorText(`incrementalRecovery.${recoveryError}Message`, language),
      raw,
      suggestion: taskErrorText("incrementalRecovery.fullBuildSuggestion", language),
    };
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
