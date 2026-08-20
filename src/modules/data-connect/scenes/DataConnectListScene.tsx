/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { ApiOutlined, EllipsisOutlined, ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import { Alert, Dropdown, Input, Select, Space, type MenuProps } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import type { DataConnectListSceneProps } from "@/modules/data-connect/contracts/scenes";
import { useAppServices } from "@/framework/context/use-app-services";
import { usePageState } from "@/framework/hooks/use-page-state";
import { useDebouncedValue } from "@/framework/hooks/use-debounced-value";
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
import { formatCatalogTime } from "@/modules/data-connect/utils/format-catalog-time";
import {
  DeleteImpactAlert,
  useDangerDelete,
} from "@/framework/safety/DangerDeleteModal";
import {
  previewCatalogDeletion,
  type CatalogDeletionImpact,
} from "@/shared/catalog";

import styles from "./DataConnectListScene.module.css";

function hasCascadeImpact(impact: CatalogDeletionImpact) {
  return (
    impact.resources > 0 ||
    impact.catalogHealthCheckSchedules > 0 ||
    impact.discoverSchedules > 0 ||
    impact.buildTasks.willCancel > 0 ||
    impact.discoverTasks.willCancel > 0 ||
    impact.semanticUnderstandingTasks.willCancel > 0
  );
}

function CatalogDeletionImpactDetails({
  impact,
  name,
}: {
  impact: CatalogDeletionImpact;
  name: string;
}) {
  const { t } = useTranslation();

  return (
    <div>
      <div>{t("dataConnect.dangerDelete.catalogImpact", { name })}</div>
      <ul style={{ marginBottom: 0, marginTop: 8, paddingInlineStart: 20 }}>
        <li>
          {t("dataConnect.dangerDelete.resources", {
            count: impact.resources,
            protected: impact.protectedResources,
          })}
        </li>
        <li>
          {t("dataConnect.dangerDelete.schedules", {
            discover: impact.discoverSchedules,
            health: impact.catalogHealthCheckSchedules,
          })}
        </li>
        <li>
          {t("dataConnect.dangerDelete.buildTasks", impact.buildTasks)}
        </li>
        <li>
          {t("dataConnect.dangerDelete.discoverTasks", impact.discoverTasks)}
        </li>
        <li>
          {t(
            "dataConnect.dangerDelete.semanticUnderstandingTasks",
            impact.semanticUnderstandingTasks,
          )}
        </li>
      </ul>
    </div>
  );
}

export function DataConnectListScene({
  defaultConnectorType,
  defaultKeyword,
  onCreate,
  onEdit,
  onOpenDetail,
  onOpenDiscovers,
}: DataConnectListSceneProps) {
  const { i18n, t } = useTranslation();
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
  const [refreshVersion, setRefreshVersion] = useState(0);

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
  }, [loadData, refreshVersion]);

  const openDetail = useCallback((record: DataConnectRecord) => {
    onOpenDetail?.(record.id);
    setDetailRecordId(record.id);
  }, [onOpenDetail]);

  const openDiscovers = useCallback((record: DataConnectRecord) => {
    if (onOpenDiscovers) {
      onOpenDiscovers(record.id);
      return;
    }
    void navigate(`/data-connect/discover?catalogId=${record.id}`);
  }, [navigate, onOpenDiscovers]);

  const openEdit = useCallback((record: DataConnectRecord) => {
    if (onEdit) {
      onEdit(record.id);
      return;
    }
    void navigate(`/data-connect/${record.id}/edit`);
  }, [navigate, onEdit]);

  const testConnection = useCallback((record: DataConnectRecord) => {
    void (async () => {
      try {
        await testDataConnectRecord(record.id);
        message.success(t("dataConnect.testConnectionSuccess"));
      } catch (error) {
        void message.error(extractRequestErrorMessage(error));
      } finally {
        setRefreshVersion((version) => version + 1);
      }
    })();
  }, [message, t]);

  const toggleEnabled = useCallback((record: DataConnectRecord) => {
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
  }, [loadData, message, modal, t]);

  const deleteRecord = useCallback((record: DataConnectRecord) => {
    void (async () => {
      let impact: CatalogDeletionImpact;
      try {
        impact = await previewCatalogDeletion(record.id);
      } catch (error) {
        void message.error(extractRequestErrorMessage(error));
        return;
      }

      const details = <CatalogDeletionImpactDetails impact={impact} name={record.name} />;
      if (!impact.canDelete) {
        void modal.warning({
          content: (
            <DeleteImpactAlert
              detail={details}
              warning={t("dataConnect.dangerDelete.blockedWarning")}
            />
          ),
          okText: t("common.confirm"),
          title: t("dataConnect.dangerDelete.blockedTitle"),
        });
        return;
      }

      const highRisk = hasCascadeImpact(impact);
      danger.open({
        title: t("dataConnect.deleteConfirmTitle"),
        targetName: record.name,
        requireTypeName: highRisk,
        impact: (
          <DeleteImpactAlert
            detail={
              highRisk ? details : t("dataConnect.dangerDelete.catalogEmpty", { name: record.name })
            }
            warning={highRisk ? t("dataConnect.dangerDelete.impactWarning") : undefined}
          />
        ),
        onOk: async () => {
          try {
            await deleteDataConnectRecord(record.id);
          } catch (error) {
            void message.error(extractRequestErrorMessage(error));
            throw error;
          }
          void message.success(t("common.success"));
          await loadData();
        },
      });
    })();
  }, [danger, loadData, message, modal, t]);

  const buildActionMoreMenu = useCallback((record: DataConnectRecord): MenuProps => {
    const items: NonNullable<MenuProps["items"]> = [
      {
        key: "detail",
        label: t("common.detail"),
      },
      {
        key: "discover",
        label: t("dataConnect.discoverManage"),
      },
    ];

    items.push({
      key: "edit",
      label: t("common.edit"),
    });
    items.push({
      key: "test",
      label: t("common.testConnection"),
    });
    items.push({
      key: "toggle",
      label: record.enabled ? t("common.disabled") : t("common.enabled"),
    });
    items.push({
      danger: true,
      key: "delete",
      label: t("common.delete"),
    });

    return {
      items,
      onClick: ({ key, domEvent }) => {
        domEvent.stopPropagation();
        if (key === "detail") {
          openDetail(record);
          return;
        }
        if (key === "discover") {
          openDiscovers(record);
          return;
        }
        if (key === "edit") {
          openEdit(record);
          return;
        }
        if (key === "test") {
          testConnection(record);
          return;
        }
        if (key === "toggle") {
          toggleEnabled(record);
          return;
        }
        if (key === "delete") {
          deleteRecord(record);
        }
      },
    };
  }, [
    deleteRecord,
    openDetail,
    openDiscovers,
    openEdit,
    t,
    testConnection,
    toggleEnabled,
  ]);

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
      render: (value: DataConnectRecord["updateTime"]) =>
        formatCatalogTime(value, i18n.resolvedLanguage ?? i18n.language),
    },
    {
      key: "actions",
      title: t("common.actions"),
      align: "center",
      width: 84,
      render: (_, record) => {
        const moreMenu = buildActionMoreMenu(record);

        return (
          <Space className={styles.actionGroup}>
            <Dropdown menu={moreMenu} trigger={["click"]}>
              <AppButton
                aria-label={t("dataConnect.moreActions")}
                className={[styles.actionLink, styles.actionMore].join(" ")}
                icon={<EllipsisOutlined />}
                onClick={(event) => event.stopPropagation()}
                type="link"
              />
            </Dropdown>
          </Space>
        );
      },
    },
  ];

  return (
    <>
      {danger.node}
      <section className={styles.contentSurface}>
        <div className={styles.operationBar}>
          <div className={styles.operationPrimary}>
            <div className={styles.toolbarActions}>
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
                  setPagination(1, pageState.pageSize);
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
