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
  /** 调用本身失败（HTTP 非 2xx / MCP isError），面板转告警色但仍展示结果。 */
  error?: boolean;
  /** 标题右侧的补充信息：状态码、耗时。没有就不画。 */
  meta?: ReactNode;
  testId?: string;
  value: unknown;
};

/**
 * 调试结果面板。三处调试入口（HTTP 弹窗、HTTP 工作台、MCP 弹窗）共用一份，
 * 各自画时会漂：MCP 那侧本来还是 antd 的 Alert，整块橄榄绿，跟另外两处
 * 「小圆点 + 标题 + 安静底色」完全不像。
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
