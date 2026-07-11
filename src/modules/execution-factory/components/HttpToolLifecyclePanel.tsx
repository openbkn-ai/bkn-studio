/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { ReactNode } from "react";
import { Tag } from "antd";
import { useTranslation } from "react-i18next";

import styles from "./HttpToolLifecyclePanel.module.css";

type HttpToolLifecyclePanelProps = {
  advancedConfig?: ReactNode;
  businessFields: ReactNode;
  debugWorkbench?: ReactNode;
  ioPreview: ReactNode;
  metadataTypeLabel: string;
};

export function HttpToolLifecyclePanel({
  advancedConfig,
  businessFields,
  debugWorkbench,
  ioPreview,
  metadataTypeLabel,
}: HttpToolLifecyclePanelProps) {
  const { t } = useTranslation();

  return (
    <div className={styles.panel}>
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <h3 className={styles.sectionTitle}>
              {t("executionFactory.httpToolLifecycleSummaryTitle")}
            </h3>
            <p className={styles.sectionDesc}>
              {t("executionFactory.httpToolLifecycleSummaryDesc")}
            </p>
          </div>
          <Tag className={styles.metadataTag}>{metadataTypeLabel}</Tag>
        </div>
        {businessFields}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <h3 className={styles.sectionTitle}>
              {t("executionFactory.httpToolLifecyclePreviewTitle")}
            </h3>
            <p className={styles.sectionDesc}>
              {t("executionFactory.httpToolLifecyclePreviewDesc")}
            </p>
          </div>
        </div>
        {ioPreview}
      </section>

      {debugWorkbench ? debugWorkbench : null}

      {advancedConfig ? (
        <section className={`${styles.section} ${styles.advanced}`}>
          <div className={styles.sectionHeader}>
            <div>
              <h3 className={styles.sectionTitle}>
                {t("executionFactory.httpToolLifecycleAdvancedTitle")}
              </h3>
              <p className={styles.sectionDesc}>
                {t("executionFactory.httpToolLifecycleAdvancedDesc")}
              </p>
            </div>
          </div>
          {advancedConfig}
        </section>
      ) : null}
    </div>
  );
}
