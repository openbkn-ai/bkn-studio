/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { TFunction } from "i18next";

const MODEL_SERIES_DEFINITIONS = [
  { value: "openai", label: "OpenAI" },
  { value: "qwen", labelKey: "modelResources.models.series.qwen" },
  { value: "claude", label: "Claude" },
  { value: "deepseek", label: "DeepSeek" },
  { value: "internlm", label: "InternLM" },
  { value: "chatglm", label: "ChatGLM" },
  { value: "llama", label: "Llama" },
  { value: "baidu", label: "Baidu" },
  { value: "others", labelKey: "modelResources.models.series.others" },
];

export const MODEL_SERIES_OPTIONS = MODEL_SERIES_DEFINITIONS.map((item) => ({
  value: item.value,
  label: item.label ?? item.value,
}));

export function getModelSeriesOptions(t: TFunction) {
  return MODEL_SERIES_DEFINITIONS.map((item) => ({
    value: item.value,
    label: item.labelKey ? t(item.labelKey) : item.label,
  }));
}

export function getModelSeriesLabel(series?: string, t?: TFunction) {
  const item = MODEL_SERIES_DEFINITIONS.find((entry) => entry.value === series);
  if (!item) return series ?? "--";
  return item.labelKey && t ? t(item.labelKey) : item.label ?? series ?? "--";
}

export function formatNumberWithCommas(value?: number | string) {
  if (value === undefined || value === null || value === "") {
    return "--";
  }

  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
