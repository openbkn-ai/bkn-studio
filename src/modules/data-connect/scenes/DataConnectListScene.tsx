/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { ApiOutlined, ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import { Alert, Input, Select, Space } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import type { DataConnectListSceneProps } from "@/modules/data-connect/contracts/scenes";
import { useAppServices } from "@/framework/context/use-app-services";
import { usePageState } from "@/framework/hooks/use-page-state";
import { useDebouncedValue } from "@/framework/hooks/use-debounced-value";
import { PermissionGate } from "@/framework/permission/PermissionGate";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { AppTable } from "@/framework/ui/common/AppTable";
import { EmptyStatePanel } from "@/framework/ui/common/EmptyStatePanel";
import { TablePaginationBar } from "@/framework/ui/common/TablePaginationBar";
import { TableSurface } from "@/framework/ui/common/TableSurface";
import {
  deleteDataConnectRecord,
  listDataConnectConnectorTypes,
  listDataConnectRecords,
  setDataConnectRecordEnabled,
  testDataConnectRecord,
} from "@/modules/data-connect/services/data-connect.service";
import type { DataConnectConnectorType, DataConnectRecord } from "@/modules/data-connect/types/data-connect";
import { DataConnectDetailDrawer } from "@/modules/data-connect/components/DataConnectDetailDrawer";
import {
  DeleteImpactAlert,
  useDangerDelete,
} from "@/framework/safety/DangerDeleteModal";
import { runningIdsFromError } from "@/framework/safety/delete-guard";
import { catalogBlastRadius } from "@/shared/catalog";

import styles from "./DataConnectListScene.module.css";

export function DataConnectListScene({
  defaultConnectorType,
  defaultKeyword,
  onCreate,
  onEdit,
  onOpenDetail,
  onOpenScans,
}: DataConnectListSceneProps) {
  const { t } = useTranslation();
  const { message, modal } = useAppServices();
  const danger = useDangerDelete();
  const navigate = useNavigate();
  const { pageState, query, reset, setKeyword, setPagination } = usePageState();
  const debouncedKeyword = useDebouncedValue(pageState.keyword.trim());
  const [connectorTypes, setConnectorTypes] = useState<DataConnectConnectorType[]>([]);
  const [selectedConnectorType, setSelectedConnectorType] = useState<string>();
  const [items, setItems] = useState<DataConnectRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [detailRecordId, setDetailRecordId] = useState<string | null>(null);

  useEffect(() => {
    if (defaultKeyword) {
      setKeyword(defaultKeyword);
    }
  }, [defaultKeyword, setKeyword]);

  useEffect(() => {
    if (defaultConnectorType) {
      setSelectedConnectorType(defaultConnectorType);
    }
  }, [defaultConnectorType]);

  const listQuery = useMemo(
    () => ({
      page: query.page,
      pageSize: query.pageSize,
      keyword: debouncedKeyword,
      connectorType: selectedConnectorType,
    }),
    [debouncedKeyword, query.page, query.pageSize, selectedConnectorType],
  );

  const connectorTypeMap = useMemo(
    () => new Map(connectorTypes.map((item) => [item.type, item.name])),
    [connectorTypes],
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
      render: (_, record) => <span className={styles.nameTitle}>{record.name}</span>,
    },
    {
      dataIndex: "connectorType",
      title: t("dataConnect.connectorType"),
      render: (value: string) => <span>{connectorTypeMap.get(value) ?? value}</span>,
    },
    {
      dataIndex: "mode",
      title: t("common.mode"),
      render: (value: string) => <span className={styles.modeText}>{t(`dataConnect.modes.${value}`)}</span>,
    },
    {
      dataIndex: "status",
      title: t("common.status"),
      render: (_, record) => <span>{record.enabled ? t("common.enabled") : t("common.disabled")}</span>,
    },
    {
      dataIndex: "healthStatus",
      title: t("common.healthStatus"),
      render: (value: DataConnectRecord["healthStatus"]) => <span>{t(`dataConnect.healthStatuses.${value}`)}</span>,
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
          <AppButton
            className={styles.actionLink}
            onClick={() => {
              onOpenDetail?.(record.id);
              setDetailRecordId(record.id);
            }}
            type="link"
          >
            {t("common.detail")}
          </AppButton>
          <AppButton
            className={styles.actionLink}
            onClick={() => {
              if (onOpenScans) {
                onOpenScans(record.id);
                return;
              }
              void navigate(`/data-connect/scans?catalogId=${record.id}`);
            }}
            type="link"
          >
            {t("dataConnect.scanManage")}
          </AppButton>
          <PermissionGate permissions="catalog:modify">
            <AppButton
              className={styles.actionLink}
              onClick={() => {
                if (onEdit) {
                  onEdit(record.id);
                  return;
                }
                void navigate(`/data-connect/${record.id}/edit`);
              }}
              type="link"
            >
              {t("common.edit")}
            </AppButton>
          </PermissionGate>
          <PermissionGate permissions="catalog:modify">
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
          <PermissionGate permissions="catalog:modify">
            <AppButton
              className={styles.actionLink}
              onClick={() => {
                const nextEnabled = !record.enabled;
                void modal.confirm({
                  title: nextEnabled
                    ? t("dataConnect.enableConfirmTitle")
                    : t("dataConnect.disableConfirmTitle"),
                  content: nextEnabled
                    ? t("dataConnect.enableConfirmDescription", { name: record.name })
                    : t("dataConnect.disableConfirmDescription", { name: record.name }),
                  okText: nextEnabled ? t("common.enabled") : t("common.disabled"),
                  cancelText: t("common.cancel"),
                  okButtonProps: nextEnabled ? undefined : { danger: true },
                  onOk: async () => {
                    try {
                      await setDataConnectRecordEnabled(record.id, nextEnabled);
                      message.success(t("common.success"));
                      await loadData();
                    } catch (error) {
                      void message.error(extractRequestErrorMessage(error));
                      throw error;
                    }
                  },
                });
              }}
              type="link"
            >
              {record.enabled ? t("common.disabled") : t("common.enabled")}
            </AppButton>
          </PermissionGate>
          <PermissionGate permissions="catalog:delete">
            <AppButton
              className={[styles.actionLink, styles.actionDanger].join(" ")}
              danger
              onClick={() => {
                void (async () => {
                  let indexCount = 0;
                  try {
                    indexCount = (await catalogBlastRadius(record.id)).indexCount;
                  } catch {
                    indexCount = 0;
                  }
                  const highRisk = indexCount > 0;
                  danger.open({
                    title: t("dataConnect.deleteConfirmTitle"),
                    targetName: record.name,
                    requireTypeName: highRisk,
                    impact: (
                      <DeleteImpactAlert
                        detail={
                          highRisk
                            ? t("dataConnect.dangerDelete.catalogImpact", {
                                name: record.name,
                                count: indexCount,
                              })
                            : t("dataConnect.dangerDelete.catalogEmpty", {
                                name: record.name,
                              })
                        }
                        warning={
                          highRisk
                            ? t("dataConnect.dangerDelete.impactWarning")
                            : undefined
                        }
                      />
                    ),
                    onOk: async () => {
                      try {
                        await deleteDataConnectRecord(record.id);
                      } catch (error) {
                        const running = runningIdsFromError(error);
                        void message.error(
                          running
                            ? t("dataConnect.dangerDelete.hasRunning")
                            : extractRequestErrorMessage(error),
                        );
                        throw error;
                      }
                      void message.success(t("common.success"));
                      await loadData();
                    },
                  });
                })();
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
      {danger.node}
      <section className={styles.contentSurface}>
        <div className={styles.operationBar}>
          <div className={styles.operationPrimary}>
            <div className={styles.toolbarActions}>
                <PermissionGate permissions="catalog:create">
                  <AppButton
                    onClick={() => {
                      if (onCreate) {
                        onCreate();
                        return;
                      }
                      void navigate("/data-connect/new");
                    }}
                    type="primary"
                >
                  {t("common.create")}
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
          </div>
          <div className={styles.toolbarFilters}>
            <Input
              allowClear
              className={styles.searchInput}
              onChange={(event) => setKeyword(event.target.value)}
              onPressEnter={(event) => setKeyword(event.currentTarget.value)}
              placeholder={t("dataConnect.searchPlaceholder")}
              prefix={<SearchOutlined className={styles.searchIcon} />}
              value={pageState.keyword}
            />
            <div className={styles.filterField}>
              <span className={styles.filterLabel}>{t("dataConnect.connectorType")}</span>
              <Select
                className={styles.filterSelect}
                onChange={(value) => {
                  setSelectedConnectorType(value || undefined);
                }}
                options={[
                  { label: t("dataConnect.categoryAll"), value: "" },
                  ...connectorTypes.map((item) => ({
                    label: item.name,
                    value: item.type,
                  })),
                ]}
                value={selectedConnectorType ?? ""}
              />
            </div>
          </div>
        </div>
        <TableSurface className={styles.tableSurface}>
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
              pagination={false}
              rowKey="id"
            />
          )}
        </TableSurface>
        {total > 0 ? (
          <TablePaginationBar
            current={pageState.page}
            onChange={setPagination}
            pageSize={pageState.pageSize}
            showSizeChanger
            showTotal={(count) => t("common.total", { total: count })}
            total={total}
          />
        ) : null}
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
