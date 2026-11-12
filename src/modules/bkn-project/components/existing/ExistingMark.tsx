/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { ReactNode } from "react";

import { ExistingMark } from "@/modules/bkn-project/components/draft/ExistingMark";

import styles from "./ExistingMark.module.css";

/** The modeling page's blue dot for what the network already has, as the other pages show it. */
export function ExistingDot() {
  return (
    <span className={styles.mark} data-testid="network-existing-dot">
      <ExistingMark />
    </span>
  );
}

/** A short line about what the network already has, after its blue dot. */
export function ExistingLine({ children }: { children: ReactNode }) {
  return (
    <span className={styles.line} data-testid="network-existing-line">
      <ExistingDot />
      <span>{children}</span>
    </span>
  );
}
