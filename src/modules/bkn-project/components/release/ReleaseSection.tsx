/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { type ReactNode, useId } from "react";

import styles from "../ProjectReleasePage.module.css";

/** A section of the page, named by its heading for assistive technology. */
export function Section({
  actions,
  children,
  description,
  title,
}: {
  actions?: ReactNode;
  children: ReactNode;
  description: string;
  title: string;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={styles.card}>
      <div className={styles.cardHead}>
        <h3 className={styles.cardTitle} id={id}>
          {title}
        </h3>
        <span className={styles.spacer} />
        {actions}
      </div>
      <p className={styles.muted}>{description}</p>
      {children}
    </section>
  );
}
