/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import i18n from "@/app/locales/i18n";

export function formatCount(value: number, locale = i18n.language) {
  return value.toLocaleString(locale || "en-US");
}

function trimUnitValue(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "");
}

export function formatRowCount(value: number, locale = i18n.language) {
  if (!Number.isFinite(value) || value <= 0) {
    return "-";
  }
  const compactUnit = locale.startsWith("zh")
    ? compactChineseRowUnit(value)
    : null;
  if (compactUnit) {
    return i18n.t(`dataCatalog.format.${compactUnit.key}`, {
      count: compactUnit.value,
      defaultValue: "{{count}} rows",
      lng: locale,
    });
  }
  return i18n.t("dataCatalog.format.rows", {
    count: formatCount(value, locale),
    defaultValue: "{{count}} rows",
    lng: locale,
  });
}

function compactChineseRowUnit(value: number) {
  if (value >= 100_000_000) {
    return {
      key: "hundredMillionRows",
      value: trimUnitValue(value / 100_000_000),
    };
  }
  if (value >= 10_000) {
    return {
      key: "tenThousandRows",
      value: trimUnitValue(value / 10_000),
    };
  }
  return null;
}

export function timeAgo(timestamp: number | null, locale: string) {
  if (!timestamp) {
    return "—";
  }

  const diffMinutes = Math.round((Date.now() - timestamp) / 60_000);

  if (diffMinutes < 1) {
    return i18n.t("dataCatalog.format.justNow", {
      defaultValue: "just now",
      lng: locale,
    });
  }
  if (diffMinutes < 60) {
    return i18n.t("dataCatalog.format.minutesAgo", {
      count: diffMinutes,
      defaultValue: "{{count}}m ago",
      lng: locale,
    });
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return i18n.t("dataCatalog.format.hoursAgo", {
      count: diffHours,
      defaultValue: "{{count}}h ago",
      lng: locale,
    });
  }

  const diffDays = Math.round(diffHours / 24);
  return i18n.t("dataCatalog.format.daysAgo", {
    count: diffDays,
    defaultValue: "{{count}}d ago",
    lng: locale,
  });
}
