/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { ReloadOutlined } from "@ant-design/icons";
import { Alert } from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { AppTable } from "@/framework/ui/common/AppTable";
import { EmptyStatePanel } from "@/framework/ui/common/EmptyStatePanel";
import {
  disconnectClient,
  listConnectedClients,
} from "@/modules/api-keys/services/connected-client.service";
import type { ConnectedClient } from "@/modules/api-keys/types/connected-client";

import styles from "./ConnectedClientsSection.module.css";

const formatTime = (value?: string | null) =>
  value ? dayjs(value).format("YYYY/MM/DD HH:mm") : null;

/** Where a client receives its sign-in result, e.g. 127.0.0.1:61503 for a desktop agent. */
function callbackHost(uris: string[]): string {
  const first = uris[0];
  if (!first) {
    return "";
  }
  try {
    return new URL(first).host;
  } catch {
    return first;
  }
}

/**
 * External agents the user connected by signing in from them (MCP sign-in).
 * Disconnecting revokes that client's tokens; it has to sign in again.
 */
export function ConnectedClientsSection() {
  const { t } = useTranslation();
  const { message, modal } = useAppServices();
  const [items, setItems] = useState<ConnectedClient[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Not keyed on `t`: the list must load once, not again on every translator identity.
  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setItems(await listConnectedClients());
    } catch (error) {
      setItems([]);
      setLoadError(extractRequestErrorMessage(error) || "");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleDisconnect = (record: ConnectedClient) => {
    const name = record.clientName || record.clientId;
    void modal.confirm({
      title: t("apiKeys.connectedClients.disconnectConfirm.title"),
      content: t("apiKeys.connectedClients.disconnectConfirm.content", { name }),
      okText: t("apiKeys.connectedClients.disconnectConfirm.ok"),
      okButtonProps: { danger: true },
      cancelText: t("common.cancel"),
      onOk: async () => {
        try {
          await disconnectClient(record.clientId);
          message.success(t("apiKeys.connectedClients.disconnectSuccess"));
          await loadData();
        } catch (error) {
          message.error(
            extractRequestErrorMessage(error) || t("apiKeys.connectedClients.disconnectFailed"),
          );
          throw error;
        }
      },
    });
  };

  const columns: ColumnsType<ConnectedClient> = [
    {
      title: t("apiKeys.connectedClients.columns.client"),
      dataIndex: "clientName",
      width: 280,
      render: (value: string, record) => (
        <div className={styles.clientCell}>
          <span className={styles.clientName}>{value || record.clientId}</span>
          <code className={styles.clientId}>{record.clientId}</code>
        </div>
      ),
    },
    {
      title: t("apiKeys.connectedClients.columns.callback"),
      dataIndex: "redirectUris",
      width: 220,
      render: (uris: string[]) => <code className={styles.callback}>{callbackHost(uris)}</code>,
    },
    {
      title: t("apiKeys.connectedClients.columns.grantedAt"),
      dataIndex: "grantedAt",
      width: 170,
      render: (value: string | null) => formatTime(value),
    },
    {
      title: t("apiKeys.connectedClients.columns.actions"),
      key: "actions",
      width: 120,
      render: (_value, record) => (
        <AppButton danger type="link" onClick={() => handleDisconnect(record)}>
          {t("apiKeys.connectedClients.actionDisconnect")}
        </AppButton>
      ),
    },
  ];

  return (
    <section className={styles.section}>
      <div className={styles.head}>
        <p className={styles.intro}>{t("apiKeys.connectedClients.description")}</p>
        <AppButton icon={<ReloadOutlined />} onClick={() => void loadData()} loading={loading}>
          {t("apiKeys.refresh")}
        </AppButton>
      </div>

      {loadError !== null ? (
        <Alert
          action={
            <AppButton onClick={() => void loadData()} size="small">
              {t("common.retry")}
            </AppButton>
          }
          message={loadError || t("apiKeys.connectedClients.loadFailed")}
          showIcon
          style={{ marginBottom: 16 }}
          type="error"
        />
      ) : null}

      <AppTable<ConnectedClient>
        columns={columns}
        dataSource={items}
        loading={loading}
        locale={{
          emptyText: (
            <EmptyStatePanel
              description={t("apiKeys.connectedClients.emptyDescription")}
              title={t("apiKeys.connectedClients.emptyTitle")}
            />
          ),
        }}
        pagination={false}
        rowKey="clientId"
        scroll={{ x: 790 }}
      />
    </section>
  );
}
