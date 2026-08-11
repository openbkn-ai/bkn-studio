/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { JsonCodeBlock } from "./JsonCodeBlock";

import styles from "./DebugResultPanel.module.css";

type DebugResultPanelProps = {
  /** The invocation failed (non-2xx HTTP or MCP isError); use warning styling but still show the result. */
  error?: boolean;
  /** Supplemental information at the right of the title, such as status code and duration. Omit when absent. */
  meta?: ReactNode;
  testId?: string;
  value: unknown;
};

/**
 * Debug-result panel shared by three entry points: HTTP modal, HTTP workbench, and MCP modal.
 * Separate implementations drifted; the MCP side used AntD Alert with a solid olive-green block,
 * unlike the quiet background, title, and small-dot treatment used elsewhere.
 */
export function DebugResultPanel({ error, meta, testId, value }: DebugResultPanelProps) {
  const { t } = useTranslation();

  return (
    <section
      className={`${styles.panel} ${error ? styles.panelWarning : styles.panelSuccess}`}
      data-testid={testId}
    >
      <div className={styles.header}>
        <span className={error ? styles.dotWarning : styles.dotSuccess} />
        <span className={styles.title}>{t("executionFactory.debugResultTitle")}</span>
        {meta ? <span className={styles.meta}>{meta}</span> : null}
      </div>
      <JsonCodeBlock value={value} />
    </section>
  );
}
