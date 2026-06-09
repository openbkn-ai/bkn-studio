import { LeftOutlined } from "@ant-design/icons";
import type { PropsWithChildren, ReactNode } from "react";

import styles from "./KnowledgeNetworkResourceConfigShell.module.css";

type KnowledgeNetworkResourceConfigShellProps = PropsWithChildren<{
  actions?: ReactNode;
  onBack: () => void;
  subtitle?: string;
  title: string;
}>;

export function KnowledgeNetworkResourceConfigShell({
  actions,
  children,
  onBack,
  subtitle,
  title,
}: KnowledgeNetworkResourceConfigShellProps) {
  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <button
          aria-label="back"
          className={styles.backButton}
          onClick={onBack}
          type="button"
        >
          <LeftOutlined />
        </button>
        <div className={styles.headerText}>
          <h1 className={styles.title}>{title}</h1>
          {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
        </div>
        {actions ? <div className={styles.headerActions}>{actions}</div> : null}
      </header>
      <div className={styles.content}>{children}</div>
    </section>
  );
}
