/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Tag } from "antd";
import { useTranslation } from "react-i18next";

import styles from "./KnowledgeBaseListPanel.module.css";

const SAMPLES = ["contracts", "incidents", "manuals"] as const;

/**
 * What the section looks like once licensed, under the edition mask. Static: the real list would
 * call knowledge-base routes that answer 404 without the license.
 */
export function KnowledgeBasePreview() {
  const { t } = useTranslation();
  return (
    <div aria-hidden className={styles.preview}>
      {SAMPLES.map((sample) => (
        <div className={styles.pickerItem} key={sample}>
          <span>{t(`knowledgeNetwork.knowledgeBasesPreview.${sample}`)}</span>
          <Tag color="success">{t("knowledgeNetwork.knowledgeBasesStatusReady")}</Tag>
        </div>
      ))}
    </div>
  );
}
