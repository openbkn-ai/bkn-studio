import { PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import { Alert, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { AppTable } from "@/framework/ui/common/AppTable";
import { EmptyStatePanel } from "@/framework/ui/common/EmptyStatePanel";
import { ApiKeySecretModal } from "@/modules/api-keys/components/ApiKeySecretModal";
import { IssueApiKeyModal } from "@/modules/api-keys/components/IssueApiKeyModal";
import {
  listApiKeys,
  regenerateApiKey,
  revokeApiKey,
} from "@/modules/api-keys/services/api-key.service";
import type { ApiKey, IssuedApiKey } from "@/modules/api-keys/types/api-key";

import styles from "./ApiKeyListScene.module.css";

const formatTime = (value?: string | null) =>
  value ? dayjs(value).format("YYYY/MM/DD HH:mm") : null;

export function ApiKeyListScene() {
  const { t } = useTranslation();
  const { message, modal } = useAppServices();
  const [items, setItems] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [issueOpen, setIssueOpen] = useState(false);
  const [secret, setSecret] = useState<IssuedApiKey | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setItems(await listApiKeys());
    } catch (error) {
      setItems([]);
      setLoadError(extractRequestErrorMessage(error) || t("apiKeys.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleRevoke = (record: ApiKey) => {
    void modal.confirm({
      title: t("apiKeys.revokeConfirm.title"),
      content: t("apiKeys.revokeConfirm.content", { name: record.name }),
      okText: t("apiKeys.revokeConfirm.ok"),
      okButtonProps: { danger: true },
      cancelText: t("common.cancel"),
      onOk: async () => {
        try {
          await revokeApiKey(record.id);
          message.success(t("apiKeys.revokeSuccess"));
          await loadData();
        } catch (error) {
          message.error(extractRequestErrorMessage(error) || t("apiKeys.revokeFailed"));
          throw error;
        }
      },
    });
  };

  const handleRegenerate = (record: ApiKey) => {
    void modal.confirm({
      title: t("apiKeys.regenerateConfirm.title"),
      content: t("apiKeys.regenerateConfirm.content", { name: record.name }),
      okText: t("apiKeys.regenerateConfirm.ok"),
      okButtonProps: { danger: true },
      cancelText: t("common.cancel"),
      onOk: async () => {
        try {
          const issued = await regenerateApiKey(record.id);
          message.success(t("apiKeys.regenerateSuccess"));
          setSecret(issued);
          await loadData();
        } catch (error) {
          message.error(extractRequestErrorMessage(error) || t("apiKeys.regenerateFailed"));
          throw error;
        }
      },
    });
  };

  const columns: ColumnsType<ApiKey> = [
    {
      title: t("apiKeys.columns.name"),
      dataIndex: "name",
      width: 200,
      render: (value: string) => <span className={styles.nameCell}>{value}</span>,
    },
    {
      title: t("apiKeys.columns.status"),
      dataIndex: "enabled",
      width: 100,
      render: (enabled: boolean) =>
        enabled ? (
          <Tag color="green">{t("apiKeys.statusEnabled")}</Tag>
        ) : (
          <Tag>{t("apiKeys.statusDisabled")}</Tag>
        ),
    },
    {
      title: t("apiKeys.columns.expires"),
      dataIndex: "expiresAt",
      width: 170,
      render: (value: string | null) =>
        value ? formatTime(value) : <span className={styles.muted}>{t("apiKeys.neverExpire")}</span>,
    },
    {
      title: t("apiKeys.columns.lastUsed"),
      dataIndex: "lastUsedAt",
      width: 170,
      render: (value: string | null) =>
        value ? formatTime(value) : <span className={styles.muted}>{t("apiKeys.never")}</span>,
    },
    {
      title: t("apiKeys.columns.created"),
      dataIndex: "createdAt",
      width: 170,
      render: (value: string) => formatTime(value),
    },
    {
      title: t("apiKeys.columns.actions"),
      key: "actions",
      width: 170,
      render: (_value, record) => (
        <div className={styles.actions}>
          <AppButton type="link" onClick={() => handleRegenerate(record)}>
            {t("apiKeys.actionRegenerate")}
          </AppButton>
          <AppButton danger type="link" onClick={() => handleRevoke(record)}>
            {t("apiKeys.actionRevoke")}
          </AppButton>
        </div>
      ),
    },
  ];

  return (
    <section className={styles.page}>
      <div className={styles.head}>
        <h2 className={styles.title}>{t("apiKeys.title")}</h2>
        <p className={styles.intro}>{t("apiKeys.description")}</p>
      </div>

      <div className={styles.toolbar}>
        <AppButton icon={<PlusOutlined />} type="primary" onClick={() => setIssueOpen(true)}>
          {t("apiKeys.issue")}
        </AppButton>
        <AppButton icon={<ReloadOutlined />} onClick={() => void loadData()} loading={loading}>
          {t("apiKeys.refresh")}
        </AppButton>
      </div>

      {loadError ? (
        <Alert
          action={
            <AppButton onClick={() => void loadData()} size="small">
              {t("common.retry")}
            </AppButton>
          }
          message={loadError}
          showIcon
          style={{ marginBottom: 16 }}
          type="error"
        />
      ) : null}

      <AppTable<ApiKey>
        columns={columns}
        dataSource={items}
        loading={loading}
        locale={{
          emptyText: (
            <EmptyStatePanel
              description={t("apiKeys.emptyDescription")}
              title={t("apiKeys.emptyTitle")}
            />
          ),
        }}
        pagination={false}
        rowKey="id"
        scroll={{ x: 900 }}
      />

      <IssueApiKeyModal
        open={issueOpen}
        onCancel={() => setIssueOpen(false)}
        onIssued={(issued) => {
          setIssueOpen(false);
          message.success(t("apiKeys.issueSuccess"));
          setSecret(issued);
          void loadData();
        }}
      />
      <ApiKeySecretModal secret={secret} onClose={() => setSecret(null)} />
    </section>
  );
}
