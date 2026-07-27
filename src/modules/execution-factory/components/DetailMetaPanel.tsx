/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { ReactNode } from "react";

import styles from "./DetailMetaPanel.module.css";

export type DetailMetaItem = {
  key: string;
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  span?: "default" | "full";
  variant?: "default" | "accent" | "strong" | "mono" | "muted";
};

type DetailMetaPanelProps = {
  /** 宿主用来接管外框：plain 模式下由它给分区补内边距和分隔线。 */
  className?: string;
  /** 允许传节点：工具详情把「方法徽标 + 工具名」直接当标题，与函数工作台的头对齐。 */
  title?: ReactNode;
  /** 标题行最右侧的入口，通常是「编辑」。 */
  titleExtra?: ReactNode;
  /** 标题行里 titleExtra 左边的常驻区，放状态开关、就绪度这类跟着卡片走的操作与指标。 */
  headerAside?: ReactNode;
  /** 标题与字段列表之间的通栏区，放标签行。 */
  subheader?: ReactNode;
  /** 字段列表下方的通栏区，放结论或告警。 */
  footer?: ReactNode;
  items: DetailMetaItem[];
  /** 字段最多排几列；容器变窄时无论传几都会塌成一列。 */
  columns?: 1 | 2;
  compact?: boolean;
  /** 字段图标默认渲染，密集场景可整体关掉。 */
  showIcons?: boolean;
  /** plain 去掉卡片外框，交给宿主容器（抽屉、弹窗）自己定边界。 */
  variant?: "card" | "plain";
  /** 字段之间加分隔线；单列长列表比纯间距更好读。 */
  dividers?: boolean;
};

export function DetailMetaPanel({
  className,
  title,
  titleExtra,
  headerAside,
  subheader,
  footer,
  items,
  columns = 2,
  compact = false,
  showIcons = true,
  variant = "card",
  dividers = false,
}: DetailMetaPanelProps) {
  const hasHeader = Boolean(title || titleExtra || headerAside);
  const sectionClassName = [
    variant === "plain" ? styles.plain : styles.sectionCard,
    compact ? styles.compact : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section className={sectionClassName} data-testid="detail-meta-panel">
      {hasHeader ? (
        <div className={styles.header}>
          {title ? <h3 className={styles.sectionTitle}>{title}</h3> : null}
          {headerAside || titleExtra ? (
            <div className={styles.headerActions}>
              {headerAside}
              {titleExtra}
            </div>
          ) : null}
        </div>
      ) : null}

      {subheader ? <div className={styles.subheader}>{subheader}</div> : null}

      {items.length > 0 ? (
        <dl className={styles.grid} data-columns={columns} data-dividers={dividers}>
          {items.map((item) => (
            <div className={styles.row} data-span={item.span ?? "default"} key={item.key}>
              <dt className={styles.label}>
                {showIcons && item.icon ? (
                  <span className={styles.labelIcon}>{item.icon}</span>
                ) : null}
                {item.label}
              </dt>
              <dd className={styles.value} data-variant={item.variant ?? "default"}>
                {item.value}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      {footer ? <div className={styles.footer}>{footer}</div> : null}
    </section>
  );
}
