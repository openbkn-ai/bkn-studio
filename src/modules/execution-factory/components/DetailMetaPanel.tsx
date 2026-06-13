import { InfoCircleOutlined } from "@ant-design/icons";
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

function resolveValueClassName(variant: DetailMetaItem["variant"]) {
  switch (variant) {
    case "accent":
    case "strong":
      return `${styles.value} ${styles.valueStrong}`;
    case "mono":
      return `${styles.value} ${styles.valueMono}`;
    case "muted":
      return `${styles.value} ${styles.valueMuted}`;
    default:
      return styles.value;
  }
}

export function DetailMetaPanel({
  title,
  titleExtra,
  items,
  columns = 3,
  compact = false,
}: DetailMetaPanelProps) {
  const columnClass =
    columns === 4 ? styles.cols4 : columns === 2 ? styles.cols2 : styles.cols3;

  return (
    <section
      className={`${styles.panel} ${compact ? styles.panelCompact : ""}`}
      data-testid="detail-meta-panel"
    >
      {title ? (
        <div className={styles.header}>
          <span className={styles.title}>
            <span className={styles.titleIcon}>
              <InfoCircleOutlined />
            </span>
            {title}
          </span>
          {titleExtra}
        </div>
      ) : null}

      <div className={`${styles.grid} ${columnClass}`}>
        {items.map((item) => {
          const cardClassName = [
            styles.card,
            item.span === "full" ? styles.cardFull : "",
            item.variant === "accent" || item.variant === "strong" ? styles.cardAccent : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <div className={cardClassName} key={item.key}>
              {item.icon ? (
                <span className={styles.labelRow}>
                  <span className={styles.itemIcon}>{item.icon}</span>
                  <span className={styles.label}>{item.label}</span>
                </span>
              ) : (
                <span className={styles.label}>{item.label}</span>
              )}
              <div className={resolveValueClassName(item.variant)}>{item.value}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
