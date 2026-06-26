import { Modal } from "antd";
import { useTranslation } from "react-i18next";

import { UsageBlocks } from "@/modules/api-keys/components/UsageBlocks";
import type { ApiKey } from "@/modules/api-keys/types/api-key";
import { maskApiKey } from "@/modules/api-keys/utils/api-key-usage";

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
          <code className={styles.maskedCode}>{maskApiKey(apiKey.keyId)}</code>
        </div>
      ) : null}
      <UsageBlocks keyValue="<YOUR_API_KEY>" />
    </Modal>
  );
}
