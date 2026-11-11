/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { ReactNode } from "react";

import styles from "./KnVersions.module.css";

export type KnStatusTone = "error" | "info" | "neutral" | "success" | "warning";

/** A state as a colored dot and plain text, lighter than a filled tag. */
export function KnStatusText({ children, tone }: { children: ReactNode; tone: KnStatusTone }) {
  return (
    <span className={styles.statusText}>
      <span aria-hidden className={`${styles.statusDot} ${styles[`tone_${tone}`]}`} />
      {children}
    </span>
  );
}
