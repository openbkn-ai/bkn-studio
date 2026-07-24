/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Descriptions } from "antd";
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
  title?: string;
  titleExtra?: ReactNode;
  items: DetailMetaItem[];
  columns?: 2 | 3 | 4;
  compact?: boolean;
};

export function DetailMetaPanel({
  title,
  titleExtra,
  items,
  columns = 3,
  compact = false,
}: DetailMetaPanelProps) {
  return (
    <section className={styles.sectionCard} data-testid="detail-meta-panel">
      {title ? (
        <div className={styles.header}>
          <h3 className={styles.sectionTitle}>{title}</h3>
          {titleExtra}
        </div>
      ) : null}

      <Descriptions
        bordered
        className={styles.descriptionBlock}
        column={columns}
        items={items.map((item) => ({
          key: item.key,
          label: item.label,
          children: item.value,
          span: item.span === "full" ? columns : 1,
        }))}
        size={compact ? "small" : "middle"}
      />
    </section>
  );
}
