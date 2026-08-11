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
  /** One per list row; a narrower fixed width aligns badges into one column. */
  compact?: boolean;
};

/**
 * HTTP-method badge with shared colors for tool lists and tool details. A component prevents the
 * same POST from receiving different colors in separate implementations. Unknown methods use neutral color.
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
