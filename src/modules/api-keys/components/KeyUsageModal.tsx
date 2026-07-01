/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Modal } from "antd";
import { useTranslation } from "react-i18next";

import { UsageBlocks } from "@/modules/api-keys/components/UsageBlocks";
import type { ApiKey } from "@/modules/api-keys/types/api-key";

import styles from "./KeyUsageModal.module.css";

export function KeyUsageModal({ apiKey, onClose }: { apiKey: ApiKey | null; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <Modal
      open={Boolean(apiKey)}
      onCancel={onClose}
      onOk={onClose}
      okText={t("apiKeys.usageModal.close")}
      cancelButtonProps={{ style: { display: "none" } }}
      width={640}
      title={apiKey ? `${t("apiKeys.usageModal.title")} · ${apiKey.name}` : t("apiKeys.usageModal.title")}
    >
      <p className={styles.lead}>{t("apiKeys.usageModal.lead")}</p>
      {apiKey ? (
        <div className={styles.masked}>
          <span className={styles.maskedLabel}>{t("apiKeys.columns.key")}</span>
          <code className={styles.maskedCode}>{apiKey.masked}</code>
        </div>
      ) : null}
      <UsageBlocks keyValue="<YOUR_API_KEY>" />
    </Modal>
  );
}
