/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import i18n from "@/app/locales/i18n";
import { objectMetricAiProposalFields as enAiProposalFields } from "@/modules/knowledge-network/locales/en-US/object-metric-v1";
import { objectMetricAiProposalFields as zhAiProposalFields } from "@/modules/knowledge-network/locales/zh-CN/object-metric-v1";
import type { objectMetricV1Part } from "@/modules/knowledge-network/locales/zh-CN/object-metric-v1";

export function objectMetricText(
  key: keyof typeof objectMetricV1Part,
  values?: Record<string, string | number | undefined>,
): string {
  return i18n.t(`knowledgeNetwork.objectMetricV1.${key}`, values);
}

export function objectMetricLocale(): string {
  return i18n.resolvedLanguage?.startsWith("en") ? "en-US" : "zh-CN";
}

export function objectMetricAiProposalFieldLabel(path: string): string {
  const labels = objectMetricLocale() === "en-US" ? enAiProposalFields : zhAiProposalFields;
  return labels[path] ?? path;
}
