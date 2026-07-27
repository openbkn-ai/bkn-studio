/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import styles from "./HttpMethodTag.module.css";

const KNOWN_METHODS = new Set([
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
]);

type HttpMethodTagProps = {
  method?: string;
  /** 列表里一行一个，收窄定宽让各行徽标对齐成一列。 */
  compact?: boolean;
};

/**
 * HTTP 动词徽标，工具列表与工具详情共用一套配色。抽成组件是因为两处各画一份时
 * 同一个 POST 会出现两种颜色。未知动词一律走中性色，不再单独配。
 */
export function HttpMethodTag({ compact = false, method }: HttpMethodTagProps) {
  const normalized = method?.trim().toUpperCase();

  if (!normalized) {
    return null;
  }

  return (
    <span
      className={compact ? `${styles.tag} ${styles.compact}` : styles.tag}
      data-method={KNOWN_METHODS.has(normalized) ? normalized : "OTHER"}
    >
      {normalized}
    </span>
  );
}
