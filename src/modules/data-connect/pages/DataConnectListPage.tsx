import { ApiOutlined, ReloadOutlined } from "@ant-design/icons";
import { Alert, Input, Select, Space, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import { usePageState } from "@/framework/hooks/use-page-state";
import { PermissionGate } from "@/framework/permission/PermissionGate";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { AppTable } from "@/framework/ui/common/AppTable";
import { EmptyStatePanel } from "@/framework/ui/common/EmptyStatePanel";
import {
  deleteDataConnectRecord,
  listDataConnectConnectorTypes,
  listDataConnectRecords,
  setDataConnectRecordEnabled,
  testDataConnectRecord,
} from "@/modules/data-connect/services/data-connect.service";
import type {
  DataConnectConnectorType,
  DataConnectRecord,
} from "@/modules/data-connect/types/data-connect";
import { DataConnectDetailDrawer } from "@/modules/data-connect/pages/DataConnectDetailDrawer";

import styles from "./DataConnectListPage.module.css";

const healthColorMap: Record<DataConnectRecord["healthStatus"], string> = {
  healthy: styles.healthHealthy,
  degraded: styles.healthDegraded,
  unhealthy: styles.healthUnhealthy,
  offline: styles.healthOffline,
  unchecked: styles.healthUnchecked,
};

export function DataConnectListPage() {
  const { t } = useTranslation();
  const { message, modal } = useAppServices();
  const navigate = useNavigate();
  const { pageState, query, reset, setKeyword, setPagination } = usePageState();
  const [connectorTypes, setConnectorTypes] = useState<DataConnectConnectorType[]>([]);
  const [selectedConnectorType, setSelectedConnectorType] = useState<string>();
  const [items, setItems] = useState<DataConnectRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [detailRecordId, setDetailRecordId] = useState<string | null>(null);

  const listQuery = useMemo(
    () => ({
      ...query,
      connectorType: selectedConnectorType,
    }),
    [query, selectedConnectorType],
  );

  const connectorTypeMap = useMemo(
    () =>
      new Map(
        connectorTypes.map((item) => [
          item.type,
          `${item.name} (${t(`dataConnect.categories.${item.category}`)})`,
        ]),
      ),
    [connectorTypes, t],
  );

  const loadConnectorTypes = async () => {
    const nextTypes = await listDataConnectConnectorTypes();
    setConnectorTypes(nextTypes);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const [typeResult, listResult] = await Promise.all([
        connectorTypes.length === 0 ? listDataConnectConnectorTypes() : Promise.resolve(null),
        listDataConnectRecords(listQuery),
      ]);

      if (typeResult) {
        setConnectorTypes(typeResult);
      }

      setItems(listResult.items);
      setTotal(listResult.total);
    } catch (error) {
      setItems([]);
      setTotal(0);
      setLoadError(extractRequestErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [connectorTypes.length, listQuery]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const columns: ColumnsType<DataConnectRecord> = [
    {
      dataIndex: "name",
      title: t("dataConnect.name"),
      render: (_, record) => (
        <div className={styles.nameCell}>
          <div className={styles.nameTitle}>{record.name}</div>
          {record.description ? (
            <span className={styles.descriptionText}>{record.description}</span>
          ) : null}
        </div>
      ),
    },
    {
      dataIndex: "connectorType",
      title: t("dataConnect.connectorType"),
      render: (value: string) => (
        <span className={styles.connectorTypeCell}>
          <Tag className={styles.connectorTypeTag}>{value}</Tag>
          <span className={styles.connectorTypeName}>{connectorTypeMap.get(value) ?? value}</span>
        </span>
      ),
    },
    {
      dataIndex: "mode",
      title: t("common.mode"),
      render: (value: string) => <span className={styles.modeText}>{t(`dataConnect.modes.${value}`)}</span>,
    },
    {
      dataIndex: "status",
      title: t("common.status"),
      render: (_, record) => (
        <Tag
          className={[styles.statusTag, record.enabled ? styles.statusEnabled : styles.statusDisabled].join(" ")}
        >
          {record.enabled ? t("common.enabled") : t("common.disabled")}
        </Tag>
      ),
    },
    {
      dataIndex: "healthStatus",
      title: t("common.healthStatus"),
      render: (value: DataConnectRecord["healthStatus"]) => (
        <Tag className={[styles.statusTag, healthColorMap[value]].join(" ")}>
          {t(`dataConnect.healthStatuses.${value}`)}
        </Tag>
      ),
    },
    {
      dataIndex: "updaterName",
      title: t("dataConnect.updater"),
    },
    {
      dataIndex: "updateTime",
      title: t("dataConnect.updateTime"),
    },
    {
      key: "actions",
      title: t("common.actions"),
      render: (_, record) => (
        <Space className={styles.actionGroup}>
          <AppButton className={styles.actionLink} onClick={() => setDetailRecordId(record.id)} type="link">
            {t("common.detail")}
          </AppButton>
          <AppButton
            className={styles.actionLink}
            onClick={() => {
              void navigate(`/data-connect/scans?catalogId=${record.id}`);
            }}
            type="link"
          >
            {t("dataConnect.scanManage")}
          </AppButton>
          <PermissionGate permissions="data-connect:edit">
            <AppButton
              className={styles.actionLink}
              onClick={() => {
                void navigate(`/data-connect/${record.id}/edit`);
              }}
              type="link"
            >
              {t("common.edit")}
            </AppButton>
          </PermissionGate>
          <PermissionGate permissions="data-connect:test">
            <AppButton
              className={styles.actionLink}
              onClick={() => {
                void (async () => {
                  try {
                    await testDataConnectRecord(record.id);
                    message.success(t("dataConnect.testConnectionSuccess"));
                  } catch (error) {
                    void message.error(extractRequestErrorMessage(error));
                  }
                })();
              }}
              type="link"
            >
              {t("common.testConnection")}
            </AppButton>
          </PermissionGate>
          <PermissionGate permissions="data-connect:toggle">
            <AppButton
              className={styles.actionLink}
              onClick={() => {
                void (async () => {
                  try {
                    await setDataConnectRecordEnabled(record.id, !record.enabled);
                    message.success(t("common.success"));
                    await loadData();
                  } catch (error) {
                    void message.error(extractRequestErrorMessage(error));
                  }
                })();
              }}
              type="link"
            >
              {record.enabled ? t("common.disabled") : t("common.enabled")}
            </AppButton>
          </PermissionGate>
          <PermissionGate permissions="data-connect:delete">
            <AppButton
              className={[styles.actionLink, styles.actionDanger].join(" ")}
              danger
              onClick={() => {
                void modal.confirm({
                  title: t("dataConnect.deleteConfirmTitle"),
                  content: t("dataConnect.deleteConfirmDescription", {
                    name: record.name,
                  }),
                  okText: t("common.delete"),
                  cancelText: t("common.cancel"),
                  okButtonProps: { danger: true },
                  onOk: async () => {
                    await deleteDataConnectRecord(record.id);
                    void message.success(t("common.success"));
                    await loadData();
                  },
                });
              }}
              type="link"
            >
              {t("common.delete")}
            </AppButton>
          </PermissionGate>
        </Space>
      ),
    },
  ];

  return (
    <>
      <section className={styles.contentSurface}>
        <div className={styles.operationBar}>
          <div className={styles.operationPrimary}>
            <div className={styles.toolbarActions}>
              <PermissionGate permissions="data-connect:create">
                <AppButton
                  onClick={() => {
                    void navigate("/data-connect/new");
                  }}
                  type="primary"
                >
                  {t("common.create")}
                </AppButton>
              </PermissionGate>
              <PermissionGate permissions="data-connect-scan:create">
                <AppButton
                  onClick={() => {
                    void navigate("/data-connect/scans");
                  }}
                >
                  {t("dataConnect.scanManage")}
                </AppButton>
              </PermissionGate>
              <AppButton
                icon={<ReloadOutlined />}
                onClick={() => {
                  reset();
                  setSelectedConnectorType(undefined);
                  void loadConnectorTypes();
                }}
              >
                {t("common.refresh")}
              </AppButton>
            </div>
            <span className={styles.toolbarMeta}>{t("dataConnect.toolbarHint")}</span>
          </div>
          <div className={styles.toolbarFilters}>
            <Input.Search
              allowClear
              className={styles.searchInput}
              onChange={(event) => setKeyword(event.target.value)}
              onSearch={setKeyword}
              placeholder={t("dataConnect.searchPlaceholder")}
              value={pageState.keyword}
            />
            <Select
              allowClear
              className={styles.filterSelect}
              onChange={(value) => setSelectedConnectorType(value)}
              options={connectorTypes.map((item) => ({
                label: item.name,
                value: item.type,
              }))}
              placeholder={t("dataConnect.connectorTypeFilterPlaceholder")}
              value={selectedConnectorType}
            />
          </div>
        </div>
        <div className={styles.tableSurface}>
          {loadError ? (
            <Alert
              action={
                <AppButton
                  onClick={() => {
                    void loadData();
                  }}
                  type="link"
                >
                  {t("common.retry")}
                </AppButton>
              }
              message={loadError}
              showIcon
              type="error"
            />
          ) : !loading && items.length === 0 ? (
            <EmptyStatePanel
              action={
                <AppButton
                  onClick={() => {
                    void navigate("/data-connect/new");
                  }}
                  type="primary"
                >
                  {t("common.create")}
                </AppButton>
              }
              description={t("dataConnect.emptyDescription")}
              icon={<ApiOutlined />}
              title={t("dataConnect.empty")}
            />
          ) : (
            <AppTable<DataConnectRecord>
              columns={columns}
              dataSource={items}
              loading={loading}
              locale={{ emptyText: t("dataConnect.empty") }}
              pagination={{
                current: pageState.page,
                pageSize: pageState.pageSize,
                total,
                onChange: setPagination,
              }}
              rowKey="id"
            />
          )}
        </div>
      </section>
      {detailRecordId ? (
        <DataConnectDetailDrawer
          connectorTypes={connectorTypes}
          onClose={() => setDetailRecordId(null)}
          open={Boolean(detailRecordId)}
          recordId={detailRecordId}
        />
      ) : null}
    </>
  );
}
