import { CopyOutlined, WarningFilled } from "@ant-design/icons";
import { Alert, Modal } from "antd";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import type { IssuedApiKey } from "@/modules/api-keys/types/api-key";

import styles from "./ApiKeySecretModal.module.css";

export function ApiKeySecretModal({
  secret,
  onClose,
}: {
  secret: IssuedApiKey | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { message } = useAppServices();

  const copy = () => {
    if (!secret) {
      return;
    }
    void navigator.clipboard
      ?.writeText(secret.key)
      .then(() => message.success(t("apiKeys.secretModal.copied")))
      .catch(() => message.error(t("apiKeys.secretModal.copyFailed")));
  };

  return (
    <Modal
      open={Boolean(secret)}
      onCancel={onClose}
      onOk={onClose}
      okText={t("apiKeys.secretModal.done")}
      cancelButtonProps={{ style: { display: "none" } }}
      closable={false}
      maskClosable={false}
      title={
        <span className={styles.titleRow}>
          <WarningFilled className={styles.titleIcon} /> {t("apiKeys.secretModal.title")}
        </span>
      }
    >
      <Alert type="warning" showIcon message={t("apiKeys.secretModal.warning")} style={{ marginBottom: 14 }} />
      <div className={styles.keyRow}>
        <code className={styles.key}>{secret?.key}</code>
        <button type="button" className={styles.copyBtn} onClick={copy}>
          <CopyOutlined /> {t("apiKeys.secretModal.copy")}
        </button>
      </div>
    </Modal>
  );
}
