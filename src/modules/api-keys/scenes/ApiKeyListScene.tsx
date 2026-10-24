/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import { Alert, Tabs, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { AppTable } from "@/framework/ui/common/AppTable";
import { EmptyStatePanel } from "@/framework/ui/common/EmptyStatePanel";
import { ApiKeySecretModal } from "@/modules/api-keys/components/ApiKeySecretModal";
import { ConnectedClientsSection } from "@/modules/api-keys/components/ConnectedClientsSection";
import { IssueApiKeyModal } from "@/modules/api-keys/components/IssueApiKeyModal";
import {
  listApiKeys,
  regenerateApiKey,
  revokeApiKey,
} from "@/modules/api-keys/services/api-key.service";
import type { ApiKey, IssuedApiKey } from "@/modules/api-keys/types/api-key";
import { readApiKeyReturnTo, saveApiKeyHandoff } from "@/modules/api-keys/utils/api-key-handoff";

import styles from "./ApiKeyListScene.module.css";

/** `?tab=clients` opens the connected-clients tab, e.g. from the MCP connect guide. */
export const CONNECTED_CLIENTS_TAB = "clients";
type ApiKeyTab = "keys" | typeof CONNECTED_CLIENTS_TAB;

const readTab = (search: string): ApiKeyTab =>
  new URLSearchParams(search).get("tab") === CONNECTED_CLIENTS_TAB ? CONNECTED_CLIENTS_TAB : "keys";

const formatTime = (value?: string | null) =>
  value ? dayjs(value).format("YYYY/MM/DD HH:mm") : null;

export function ApiKeyListScene({ embedded = false }: { embedded?: boolean } = {}) {
  const { t } = useTranslation();
  const { message, modal } = useAppServices();
  const location = useLocation();
  const navigate = useNavigate();
  const returnTo = readApiKeyReturnTo(location.search);
  const activeTab = readTab(location.search);
  const changeTab = (key: string) => {
    const params = new URLSearchParams(location.search);
    if (key === CONNECTED_CLIENTS_TAB) params.set("tab", key);
    else params.delete("tab");
    const query = params.toString();
    void navigate(
      { pathname: location.pathname, search: query ? `?${query}` : "" },
      { replace: true },
    );
  };
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

  const handleSecretClose = () => {
    const issued = secret;
    setSecret(null);
    if (issued && returnTo) {
      const apiKeyHandoffId = saveApiKeyHandoff(returnTo, issued.key);
      void navigate(returnTo, { state: apiKeyHandoffId ? { apiKeyHandoffId } : undefined });
    }
  };

  const columns: ColumnsType<ApiKey> = [
    {
      title: `${t("apiKeys.columns.name")} / ${t("apiKeys.columns.key")}`,
      dataIndex: "name",
      width: 280,
      render: (value: string, record) => (
        <div className={styles.nameKeyCell}>
          <span className={styles.nameCell}>{value}</span>
          <code className={styles.keyMask}>{record.masked}</code>
        </div>
      ),
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
        value ? (
          formatTime(value)
        ) : (
          <span className={styles.muted}>{t("apiKeys.neverExpire")}</span>
        ),
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
    <section className={embedded ? styles.pageEmbedded : styles.page}>
      {embedded ? null : (
        <div className={styles.head}>
          <h2 className={styles.title}>{t("apiKeys.title")}</h2>
          <p className={styles.intro}>{t("apiKeys.description")}</p>
        </div>
      )}

      <Tabs
        activeKey={activeTab}
        onChange={changeTab}
        items={[
          {
            key: "keys",
            label: t("apiKeys.tabs.keys"),
            children: (
              <>
                <Alert
                  type="info"
                  showIcon
                  message={t("apiKeys.calloutInfo")}
                  style={{ marginBottom: 16 }}
                />

                <div className={styles.toolbar}>
                  <AppButton
                    icon={<PlusOutlined />}
                    type="primary"
                    onClick={() => setIssueOpen(true)}
                  >
                    {t("apiKeys.issue")}
                  </AppButton>
                  <AppButton
                    icon={<ReloadOutlined />}
                    onClick={() => void loadData()}
                    loading={loading}
                  >
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
              </>
            ),
          },
          {
            key: CONNECTED_CLIENTS_TAB,
            label: t("apiKeys.tabs.clients"),
            children: <ConnectedClientsSection />,
          },
        ]}
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
      <ApiKeySecretModal secret={secret} onClose={handleSecretClose} />
    </section>
  );
}
