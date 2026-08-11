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
  /** Lets the host own the outer frame; in plain mode it supplies section padding and dividers. */
  className?: string;
  /** Accepts a node so tool details can use a method badge plus tool name as the title, aligned with the function workbench header. */
  title?: ReactNode;
  /** Entry point at the far right of the title row, usually Edit. */
  titleExtra?: ReactNode;
  /** Persistent area left of titleExtra for card-level actions and metrics, such as status toggles and readiness. */
  headerAside?: ReactNode;
  /** Full-width area between the title and field list for tag rows. */
  subheader?: ReactNode;
  /** Full-width area below the field list for conclusions or warnings. */
  footer?: ReactNode;
  items: DetailMetaItem[];
  /** Maximum number of field columns; a narrow container collapses to one regardless of this value. */
  columns?: 1 | 2;
  compact?: boolean;
  /** Field icons render by default and can be disabled globally for dense views. */
  showIcons?: boolean;
  /** plain removes the card frame so the host container, such as a drawer or modal, defines boundaries. */
  variant?: "card" | "plain";
  /** Adds dividers between fields; long single-column lists scan better than with spacing alone. */
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
