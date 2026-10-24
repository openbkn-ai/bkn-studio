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
import {
  listExternalClients,
  removeExternalClient,
} from "@/modules/system-admin/services/external-client.service";
import type { ExternalClient } from "@/modules/system-admin/types/external-client";

import styles from "./ExternalClientsSection.module.css";

const formatTime = (value?: string | null) =>
  value ? dayjs(value).format("YYYY/MM/DD HH:mm") : null;

/**
 * Every client that registered itself so a user could sign in from an agent.
 * Removing one ends access for every user who connected it; agents re-register
 * on reinstall, so this is also where duplicates get cleaned up.
 */
export function ExternalClientsSection() {
  const { t } = useTranslation();
  const { message, modal } = useAppServices();
  const [items, setItems] = useState<ExternalClient[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Not keyed on `t`: the list must load once, not again on every translator identity.
  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setItems(await listExternalClients());
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

  const handleRemove = (record: ExternalClient) => {
    const name = record.clientName || record.clientId;
    void modal.confirm({
      title: t("systemAdmin.externalClients.removeConfirm.title"),
      content: t("systemAdmin.externalClients.removeConfirm.content", { name }),
      okText: t("systemAdmin.externalClients.removeConfirm.ok"),
      okButtonProps: { danger: true },
      cancelText: t("common.cancel"),
      onOk: async () => {
        try {
          await removeExternalClient(record.clientId);
          message.success(t("systemAdmin.externalClients.removeSuccess"));
          await loadData();
        } catch (error) {
          message.error(
            extractRequestErrorMessage(error) || t("systemAdmin.externalClients.removeFailed"),
          );
          throw error;
        }
      },
    });
  };

  const columns: ColumnsType<ExternalClient> = [
    {
      title: t("systemAdmin.externalClients.columns.client"),
      dataIndex: "clientName",
      width: 280,
      render: (value: string, record) => (
        <div className={styles.clientCell}>
          <span className={styles.clientName}>{value || record.clientId}</span>
          <code className={styles.mono}>{record.clientId}</code>
        </div>
      ),
    },
    {
      title: t("systemAdmin.externalClients.columns.callback"),
      dataIndex: "redirectUris",
      width: 300,
      render: (uris: string[]) => (
        <div className={styles.uriList}>
          {uris.map((uri) => (
            <code className={styles.mono} key={uri}>
              {uri}
            </code>
          ))}
        </div>
      ),
    },
    {
      title: t("systemAdmin.externalClients.columns.registeredAt"),
      dataIndex: "registeredAt",
      width: 170,
      render: (value: string | null) => formatTime(value),
    },
    {
      title: t("systemAdmin.externalClients.columns.registeredFrom"),
      dataIndex: "registeredFrom",
      width: 150,
      render: (value: string) => <code className={styles.mono}>{value}</code>,
    },
    {
      title: t("systemAdmin.externalClients.columns.actions"),
      key: "actions",
      width: 110,
      render: (_value, record) => (
        <AppButton danger type="link" onClick={() => handleRemove(record)}>
          {t("systemAdmin.externalClients.actionRemove")}
        </AppButton>
      ),
    },
  ];

  return (
    <section className={styles.section}>
      <div className={styles.head}>
        <p className={styles.intro}>{t("systemAdmin.externalClients.description")}</p>
        <AppButton icon={<ReloadOutlined />} onClick={() => void loadData()} loading={loading}>
          {t("systemAdmin.externalClients.refresh")}
        </AppButton>
      </div>

      {loadError !== null ? (
        <Alert
          action={
            <AppButton onClick={() => void loadData()} size="small">
              {t("common.retry")}
            </AppButton>
          }
          message={loadError || t("systemAdmin.externalClients.loadFailed")}
          showIcon
          style={{ marginBottom: 12 }}
          type="error"
        />
      ) : null}

      <AppTable<ExternalClient>
        columns={columns}
        dataSource={items}
        loading={loading}
        locale={{ emptyText: t("systemAdmin.externalClients.empty") }}
        pagination={false}
        rowKey="clientId"
        scroll={{ x: 1010 }}
        size="middle"
      />
    </section>
  );
}
