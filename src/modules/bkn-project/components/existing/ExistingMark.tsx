/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import styles from "./ExistingMark.module.css";

/** The blue dot that marks what the project's network already has. */
export function ExistingDot() {
  const { t } = useTranslation();
  return (
    <span
      aria-label={t("bknProject.networkExisting.mark")}
      className={styles.dot}
      data-testid="network-existing-dot"
      role="img"
    />
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
