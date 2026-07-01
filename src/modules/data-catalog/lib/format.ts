/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export function formatCount(value: number) {
  return value.toLocaleString("en-US");
}

export function timeAgo(timestamp: number | null, locale: string) {
  if (!timestamp) {
    return "—";
  }

  const zh = locale.startsWith("zh");
  const diffMinutes = Math.round((Date.now() - timestamp) / 60_000);

  if (diffMinutes < 1) {
    return zh ? "刚刚" : "just now";
  }
  if (diffMinutes < 60) {
    return zh ? `${diffMinutes} 分钟前` : `${diffMinutes}m ago`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return zh ? `${diffHours} 小时前` : `${diffHours}h ago`;
  }

  const diffDays = Math.round(diffHours / 24);
  return zh ? `${diffDays} 天前` : `${diffDays}d ago`;
}
