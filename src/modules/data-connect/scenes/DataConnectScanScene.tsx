/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Input, Select, Space, Switch, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import type { DataConnectScanSceneProps } from "@/modules/data-connect/contracts/scenes";
import { useAppServices } from "@/framework/context/use-app-services";
import { PermissionGate } from "@/framework/permission/PermissionGate";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { AppTable } from "@/framework/ui/common/AppTable";
import { EmptyStatePanel } from "@/framework/ui/common/EmptyStatePanel";
import { TablePaginationBar } from "@/framework/ui/common/TablePaginationBar";
import { TableSurface } from "@/framework/ui/common/TableSurface";
import {
  listDataConnectRecords,
} from "@/modules/data-connect/services/data-connect.service";
import {
  createDataConnectScanSchedule,
  deleteDataConnectScanTask,
  deleteDataConnectScanSchedule,
  getDataConnectScanSchedule,
  listDataConnectScanSchedules,
  listDataConnectScanTasks,
  setDataConnectScanScheduleEnabled,
  triggerDataConnectDiscover,
  updateDataConnectScanSchedule,
} from "@/modules/data-connect/services/scan.service";
import type { DataConnectRecord } from "@/modules/data-connect/types/data-connect";
import type {
  DataConnectScanSchedule,
  DataConnectScanSchedulePayload,
  DataConnectScanTask,
  DataConnectScanTaskStatus,
} from "@/modules/data-connect/types/scan";
import {
  ScanScheduleFormModal,
  type ScanScheduleFormModalSubmitPayload,
} from "@/modules/data-connect/components/ScanScheduleFormModal";
import { DataConnectScanTaskDrawer } from "@/modules/data-connect/components/DataConnectScanTaskDrawer";

import styles from "./DataConnectScanScene.module.css";

type ScheduleModalState =
  | { mode: "create"; scheduleId?: undefined }
  | { mode: "edit"; scheduleId: string }
  | null;

type EnabledFilterValue = "all" | "disabled" | "enabled";
type TaskStatusFilterValue = "all" | DataConnectScanTaskStatus;
type TaskTriggerTypeFilterValue = "all" | DataConnectScanTask["triggerType"];

const taskStatusColorMap: Record<DataConnectScanTaskStatus, string> = {
  pending: "default",
  running: "processing",
  completed: "success",
  failed: "error",
};

export function DataConnectScanScene({
  catalogId,
  onBackToConnections,
  onCatalogIdChange,
}: DataConnectScanSceneProps) {
  const { t } = useTranslation();
  const { message, modal } = useAppServices();
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState("");
  const [selectedCatalogId, setSelectedCatalogId] = useState<string | undefined>(catalogId);
  const [enabledFilter, setEnabledFilter] =
    useState<EnabledFilterValue>("all");
  const [taskStatusFilter, setTaskStatusFilter] =
    useState<TaskStatusFilterValue>("all");
  const [taskTriggerTypeFilter, setTaskTriggerTypeFilter] =
    useState<TaskTriggerTypeFilterValue>("all");
  const [catalogs, setCatalogs] = useState<DataConnectRecord[]>([]);
  const [schedules, setSchedules] = useState<DataConnectScanSchedule[]>([]);
  const [tasks, setTasks] = useState<DataConnectScanTask[]>([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string>();
  const [schedulePage, setSchedulePage] = useState(1);
  const [schedulePageSize, setSchedulePageSize] = useState(10);
  const [scheduleTotal, setScheduleTotal] = useState(0);
  const [taskPage, setTaskPage] = useState(1);
  const [taskPageSize, setTaskPageSize] = useState(10);
  const [taskTotal, setTaskTotal] = useState(0);
  const [loadingSchedules, setLoadingSchedules] = useState(false);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [loadingCatalogs, setLoadingCatalogs] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [taskError, setTaskError] = useState<string | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [scheduleModalState, setScheduleModalState] =
    useState<ScheduleModalState>(null);
  const [scheduleModalSubmitting, setScheduleModalSubmitting] = useState(false);
  const [editingSchedule, setEditingSchedule] =
    useState<DataConnectScanSchedule | null>(null);
  const [triggeringScheduleId, setTriggeringScheduleId] = useState<string | null>(null);
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);

  const catalogNameMap = useMemo(
    () => new Map(catalogs.map((item) => [item.id, item.name])),
    [catalogs],
  );

  const selectedSchedule = useMemo(
    () => schedules.find((item) => item.id === selectedScheduleId) ?? null,
    [schedules, selectedScheduleId],
  );
  const hasActiveTasks = useMemo(
    () => tasks.some((item) => item.status === "pending" || item.status === "running"),
    [tasks],
  );

  const loadCatalogs = useCallback(async () => {
    setLoadingCatalogs(true);
    setCatalogError(null);

    try {
      const result = await listDataConnectRecords({
        keyword: "",
        page: 1,
        pageSize: 200,
      });
      setCatalogs(result.items);
    } catch (error) {
      setCatalogError(extractRequestErrorMessage(error));
    } finally {
      setLoadingCatalogs(false);
    }
  }, []);

  const loadSchedules = useCallback(async () => {
    setLoadingSchedules(true);
    setScheduleError(null);

    try {
      const result = await listDataConnectScanSchedules({
        catalogId: selectedCatalogId,
        enabled:
          enabledFilter === "all" ? undefined : enabledFilter === "enabled",
        keyword,
        page: schedulePage,
        pageSize: schedulePageSize,
      });
      setSchedules(result.items);
      setScheduleTotal(result.total);
    } catch (error) {
      setSchedules([]);
      setScheduleTotal(0);
      setScheduleError(extractRequestErrorMessage(error));
    } finally {
      setLoadingSchedules(false);
    }
  }, [enabledFilter, keyword, schedulePage, schedulePageSize, selectedCatalogId]);

  const loadTasks = useCallback(async () => {
    setLoadingTasks(true);
    setTaskError(null);

    try {
      const result = await listDataConnectScanTasks({
        catalogId: selectedCatalogId,
        page: taskPage,
        pageSize: taskPageSize,
        scheduleId: selectedScheduleId,
        status: taskStatusFilter === "all" ? undefined : taskStatusFilter,
        triggerType:
          taskTriggerTypeFilter === "all" ? undefined : taskTriggerTypeFilter,
      });
      setTasks(result.items);
      setTaskTotal(result.total);
    } catch (error) {
      setTasks([]);
      setTaskTotal(0);
      setTaskError(extractRequestErrorMessage(error));
    } finally {
      setLoadingTasks(false);
    }
  }, [
    selectedCatalogId,
    selectedScheduleId,
    taskPage,
    taskPageSize,
    taskTriggerTypeFilter,
    taskStatusFilter,
  ]);

  useEffect(() => {
    void loadCatalogs();
  }, [loadCatalogs]);

  useEffect(() => {
    void loadSchedules();
  }, [loadSchedules]);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  useEffect(() => {
    setSelectedCatalogId(catalogId);
  }, [catalogId]);

  useEffect(() => {
    if (!selectedScheduleId) {
      return;
    }

    const existsInCurrentList = schedules.some((item) => item.id === selectedScheduleId);
    if (!existsInCurrentList) {
      setSelectedScheduleId(undefined);
      setTaskPage(1);
    }
  }, [schedules, selectedScheduleId]);

  useEffect(() => {
    onCatalogIdChange?.(selectedCatalogId);
  }, [onCatalogIdChange, selectedCatalogId]);

  useEffect(() => {
    if (!hasActiveTasks) {
      return;
    }

    const timer = window.setInterval(() => {
      void Promise.all([loadSchedules(), loadTasks()]);
    }, 8000);

    return () => {
      window.clearInterval(timer);
    };
  }, [hasActiveTasks, loadSchedules, loadTasks]);

  const scheduleColumns: ColumnsType<DataConnectScanSchedule> = [
    {
      dataIndex: "name",
      title: t("dataConnect.scanScheduleName"),
    },
    {
      dataIndex: "catalogId",
      title: t("dataConnect.scanCatalog"),
      render: (value: string) => catalogNameMap.get(value) ?? value,
    },
    {
      dataIndex: "strategy",
      title: t("dataConnect.scanStrategy"),
      render: (value: DataConnectScanSchedule["strategy"]) => (
        <Tag className={styles.strategyTag}>
          {t(`dataConnect.scanStrategies.${value}`)}
        </Tag>
      ),
    },
    {
      dataIndex: "cronExpr",
      title: t("dataConnect.scanCronExpr"),
    },
    {
      dataIndex: "enabled",
      title: t("common.status"),
      render: (value: boolean, record) => (
        <PermissionGate permissions="catalog:task_manage">
          <Switch
            checked={value}
            onChange={(checked) => {
              void (async () => {
                try {
                  await setDataConnectScanScheduleEnabled(record.id, checked);
                  message.success(t("common.success"));
                  await Promise.all([loadSchedules(), loadTasks()]);
                } catch (error) {
                  void message.error(extractRequestErrorMessage(error));
                }
              })();
            }}
          />
        </PermissionGate>
      ),
    },
    {
      dataIndex: "lastRun",
      title: t("dataConnect.scanLastRun"),
    },
    {
      dataIndex: "nextRun",
      title: t("dataConnect.scanNextRun"),
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
          <PermissionGate permissions="catalog:task_manage">
            <AppButton
              onClick={() => {
                setScheduleModalState({ mode: "edit", scheduleId: record.id });
              }}
              type="link"
            >
              {t("common.edit")}
            </AppButton>
          </PermissionGate>
          <PermissionGate permissions="catalog:task_manage">
            <AppButton
              loading={triggeringScheduleId === record.id}
              onClick={() => {
                void (async () => {
                  try {
                    setTriggeringScheduleId(record.id);
                    const result = await triggerDataConnectDiscover(
                      record.catalogId,
                      record.strategy,
                    );
                    void message.success(t("dataConnect.scanTriggerSuccess"));
                    setDetailTaskId(result.id);
                    await Promise.all([loadSchedules(), loadTasks()]);
                  } catch (error) {
                    void message.error(extractRequestErrorMessage(error));
                  } finally {
                    setTriggeringScheduleId(null);
                  }
                })();
              }}
              type="link"
            >
              {t("dataConnect.scanRunNow")}
            </AppButton>
          </PermissionGate>
          <PermissionGate permissions="catalog:task_manage">
            <AppButton
              danger
              onClick={() => {
                void modal.confirm({
                  title: t("dataConnect.scanDeleteConfirmTitle"),
                  content: t("dataConnect.scanDeleteConfirmDescription", {
                    name: record.name,
                  }),
                  okText: t("common.delete"),
                  cancelText: t("common.cancel"),
                  okButtonProps: { danger: true },
                  onOk: async () => {
                    await deleteDataConnectScanSchedule(record.id);
                    void message.success(t("common.success"));
                    if (selectedScheduleId === record.id) {
                      setSelectedScheduleId(undefined);
                    }
                    await Promise.all([loadSchedules(), loadTasks()]);
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

  const taskColumns: ColumnsType<DataConnectScanTask> = [
    {
      dataIndex: "status",
      title: t("dataConnect.scanTaskStatus"),
      render: (value: DataConnectScanTaskStatus) => (
        <Tag className={styles.statusTag} color={taskStatusColorMap[value]}>
          {t(`dataConnect.scanTaskStatuses.${value}`)}
        </Tag>
      ),
    },
    {
      dataIndex: "triggerType",
      title: t("dataConnect.scanTriggerType"),
      render: (value: DataConnectScanTask["triggerType"]) => (
        <Tag className={styles.triggerTag}>
          {t(`dataConnect.scanTriggerTypes.${value}`)}
        </Tag>
      ),
    },
    {
      dataIndex: "strategy",
      title: t("dataConnect.scanStrategy"),
      render: (value: DataConnectScanTask["strategy"]) =>
        t(`dataConnect.scanStrategies.${value}`),
    },
    {
      dataIndex: "progress",
      title: t("dataConnect.scanProgress"),
      render: (value: number) => `${value}%`,
    },
    {
      dataIndex: "message",
      title: t("dataConnect.scanMessage"),
      render: (value: string) => (
        <span className={styles.messageText}>{value || "-"}</span>
      ),
    },
    {
      dataIndex: "startTime",
      title: t("dataConnect.scanStartTime"),
    },
    {
      dataIndex: "finishTime",
      title: t("dataConnect.scanFinishTime"),
    },
    {
      dataIndex: "createTime",
      title: t("dataConnect.createTime"),
    },
    {
      dataIndex: "creatorName",
      title: t("dataConnect.creator"),
    },
    {
      key: "actions",
      title: t("common.actions"),
      render: (_, record) => (
        <Space className={styles.actionGroup}>
          <AppButton
            onClick={() => {
              setDetailTaskId(record.id);
            }}
            type="link"
          >
            {t("common.detail")}
          </AppButton>
          <PermissionGate permissions="catalog:task_manage">
            <AppButton
              danger
              onClick={() => {
                void modal.confirm({
                  title: t("dataConnect.scanTaskDeleteConfirmTitle"),
                  content: t("dataConnect.scanTaskDeleteConfirmDescription", {
                    id: record.id,
                  }),
                  okText: t("common.delete"),
                  cancelText: t("common.cancel"),
                  okButtonProps: { danger: true },
                  onOk: async () => {
                    await deleteDataConnectScanTask(record.id);
                    void message.success(t("common.success"));
                    if (detailTaskId === record.id) {
                      setDetailTaskId(null);
                    }
                    await loadTasks();
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

  useEffect(() => {
    if (scheduleModalState?.mode !== "edit" || !scheduleModalState.scheduleId) {
      setEditingSchedule(null);
      return;
    }

    void (async () => {
      try {
        const schedule = await getDataConnectScanSchedule(scheduleModalState.scheduleId);
        setEditingSchedule(schedule);
      } catch (error) {
        setEditingSchedule(null);
        void message.error(extractRequestErrorMessage(error));
      }
    })();
  }, [message, scheduleModalState]);

  const handleScheduleSubmit = async (
    payload: ScanScheduleFormModalSubmitPayload,
  ) => {
    setScheduleModalSubmitting(true);

    try {
      const requestPayload: DataConnectScanSchedulePayload = {
        ...payload,
        catalogId:
          scheduleModalState?.mode === "edit" && editingSchedule
            ? editingSchedule.catalogId
            : payload.catalogId,
        endTime:
          payload.endTime ??
          (scheduleModalState?.mode === "edit"
            ? editingSchedule?.endTimeValue
            : undefined),
        startTime:
          payload.startTime ??
          (scheduleModalState?.mode === "edit"
            ? editingSchedule?.startTimeValue
            : undefined),
      };

      if (scheduleModalState?.mode === "edit" && scheduleModalState.scheduleId) {
        await updateDataConnectScanSchedule(
          scheduleModalState.scheduleId,
          requestPayload,
        );
      } else {
        await createDataConnectScanSchedule(requestPayload);
      }

      setScheduleModalState(null);
      setEditingSchedule(null);
      void message.success(t("common.success"));
      await Promise.all([loadSchedules(), loadTasks()]);
    } catch (error) {
      void message.error(extractRequestErrorMessage(error));
    } finally {
      setScheduleModalSubmitting(false);
    }
  };

  return (
    <>
      <section className={styles.contentSurface}>
        {catalogError ? <Alert message={catalogError} showIcon type="warning" /> : null}
        <div className={styles.operationBar}>
          <div className={styles.operationPrimary}>
            <div className={styles.toolbarActions}>
              <PermissionGate permissions="catalog:task_manage">
                <AppButton
                  onClick={() => {
                    setEditingSchedule(null);
                    setScheduleModalState({ mode: "create" });
                  }}
                  type="primary"
                >
                  {t("dataConnect.scanCreate")}
                </AppButton>
              </PermissionGate>
              <PermissionGate permissions="catalog:task_manage">
                <AppButton
                  disabled={!selectedCatalogId}
                  onClick={() => {
                    void (async () => {
                      if (!selectedCatalogId) {
                        return;
                      }

                      try {
                        const result = await triggerDataConnectDiscover(selectedCatalogId);
                        void message.success(t("dataConnect.scanTriggerSuccess"));
                        setDetailTaskId(result.id);
                        await loadTasks();
                      } catch (error) {
                        void message.error(extractRequestErrorMessage(error));
                      }
                    })();
                  }}
                >
                  {t("dataConnect.scanRunNow")}
                </AppButton>
              </PermissionGate>
              <AppButton
                onClick={() => {
                  if (onBackToConnections) {
                    onBackToConnections();
                    return;
                  }
                  void navigate("/data-connect");
                }}
              >
                {t("dataConnect.backToConnections")}
              </AppButton>
              <AppButton
                onClick={() => {
                  void Promise.all([loadCatalogs(), loadSchedules(), loadTasks()]);
                }}
              >
                {t("common.refresh")}
              </AppButton>
            </div>
            <span className={styles.toolbarMeta}>
              {selectedSchedule
                ? t("dataConnect.scanSelectedSchedule", {
                    name: selectedSchedule.name,
                  })
                : hasActiveTasks
                  ? t("dataConnect.scanAutoRefreshHint")
                  : t("dataConnect.scanToolbarHint")}
            </span>
          </div>
          <div className={styles.toolbarFilters}>
            <Input.Search
              allowClear
              className={styles.searchInput}
              onChange={(event) => {
                setKeyword(event.target.value);
                setSchedulePage(1);
              }}
              onSearch={(value) => {
                setKeyword(value);
                setSchedulePage(1);
              }}
              placeholder={t("dataConnect.scanSearchPlaceholder")}
              value={keyword}
            />
            <Select
              allowClear
              className={styles.filterSelect}
              loading={loadingCatalogs}
              onChange={(value) => {
                setSelectedCatalogId(value);
                setSelectedScheduleId(undefined);
                setSchedulePage(1);
                setTaskPage(1);
              }}
              options={catalogs.map((item) => ({
                label: item.name,
                value: item.id,
              }))}
              optionFilterProp="label"
              placeholder={t("dataConnect.scanCatalogFilterPlaceholder")}
              showSearch
              value={selectedCatalogId}
            />
            <Select
              className={styles.filterSelect}
              onChange={(value: EnabledFilterValue) => {
                setEnabledFilter(value);
                setSchedulePage(1);
              }}
              options={[
                { label: t("common.all"), value: "all" },
                { label: t("common.enabled"), value: "enabled" },
                { label: t("common.disabled"), value: "disabled" },
              ]}
              value={enabledFilter}
            />
            <Select
              className={styles.filterSelect}
              onChange={(value: TaskStatusFilterValue) => {
                setTaskStatusFilter(value);
                setTaskPage(1);
              }}
              options={[
                { label: t("common.all"), value: "all" },
                { label: t("dataConnect.scanTaskStatuses.pending"), value: "pending" },
                { label: t("dataConnect.scanTaskStatuses.running"), value: "running" },
                { label: t("dataConnect.scanTaskStatuses.completed"), value: "completed" },
                { label: t("dataConnect.scanTaskStatuses.failed"), value: "failed" },
              ]}
              value={taskStatusFilter}
            />
            <Select
              className={styles.filterSelect}
              onChange={(value: TaskTriggerTypeFilterValue) => {
                setTaskTriggerTypeFilter(value);
                setTaskPage(1);
              }}
              options={[
                { label: t("common.all"), value: "all" },
                { label: t("dataConnect.scanTriggerTypes.manual"), value: "manual" },
                { label: t("dataConnect.scanTriggerTypes.scheduled"), value: "scheduled" },
              ]}
              value={taskTriggerTypeFilter}
            />
          </div>
        </div>
        <TableSurface className={styles.panelSection}>
          <div className={styles.sectionHeader}>
            <div>
              <h3 className={styles.sectionTitle}>{t("dataConnect.scanScheduleTableTitle")}</h3>
              <p className={styles.sectionDescription}>{t("dataConnect.scanDescription")}</p>
            </div>
          </div>
          {scheduleError ? (
            <Alert
              action={
                <AppButton
                  onClick={() => {
                    void loadSchedules();
                  }}
                  type="link"
                >
                  {t("common.retry")}
                </AppButton>
              }
              message={scheduleError}
              showIcon
              type="error"
            />
          ) : !loadingSchedules && schedules.length === 0 ? (
            <EmptyStatePanel
              action={
                <PermissionGate permissions="catalog:task_manage">
                  <AppButton
                    onClick={() => {
                      setScheduleModalState({ mode: "create" });
                    }}
                    type="primary"
                  >
                    {t("dataConnect.scanCreate")}
                  </AppButton>
                </PermissionGate>
              }
              description={t("dataConnect.scanScheduleEmptyDescription")}
              title={t("dataConnect.scanScheduleEmpty")}
            />
          ) : (
            <AppTable<DataConnectScanSchedule>
              columns={scheduleColumns}
              dataSource={schedules}
              loading={loadingSchedules}
              onRow={(record) => ({
                className: record.id === selectedScheduleId ? styles.selectedRow : "",
                onClick: () => {
                  setSelectedScheduleId((current) =>
                    current === record.id ? undefined : record.id,
                  );
                  setTaskPage(1);
                },
              })}
              pagination={false}
              rowKey="id"
            />
          )}
        </TableSurface>
        {scheduleTotal > 0 ? (
          <TablePaginationBar
            current={schedulePage}
            onChange={(page, pageSize) => {
              setSchedulePage(page);
              setSchedulePageSize(pageSize);
            }}
            pageSize={schedulePageSize}
            showSizeChanger
            showTotal={(count) => t("common.total", { total: count })}
            total={scheduleTotal}
          />
        ) : null}
        <TableSurface className={styles.panelSection}>
          <div className={styles.sectionHeader}>
            <div>
              <h3 className={styles.sectionTitle}>{t("dataConnect.scanTaskTableTitle")}</h3>
              <p className={styles.sectionDescription}>
                {selectedSchedule
                  ? t("dataConnect.scanSelectedSchedule", {
                      name: selectedSchedule.name,
                    })
                  : hasActiveTasks
                    ? t("dataConnect.scanTaskAutoRefreshing")
                    : t("dataConnect.scanTaskEmptyDescription")}
              </p>
            </div>
            {selectedSchedule ? (
              <AppButton
                onClick={() => {
                  setSelectedScheduleId(undefined);
                  setTaskPage(1);
                }}
                type="link"
              >
                {t("dataConnect.scanClearSelection")}
              </AppButton>
            ) : null}
          </div>
          {taskError ? (
            <Alert
              action={
                <AppButton
                  onClick={() => {
                    void loadTasks();
                  }}
                  type="link"
                >
                  {t("common.retry")}
                </AppButton>
              }
              message={taskError}
              showIcon
              type="error"
            />
          ) : !loadingTasks && tasks.length === 0 ? (
            <EmptyStatePanel
              description={t("dataConnect.scanTaskEmptyDescription")}
              title={t("dataConnect.scanTaskEmpty")}
            />
          ) : (
            <AppTable<DataConnectScanTask>
              columns={taskColumns}
              dataSource={tasks}
              loading={loadingTasks}
              pagination={false}
              rowKey="id"
            />
          )}
        </TableSurface>
        {taskTotal > 0 ? (
          <TablePaginationBar
            current={taskPage}
            onChange={(page, pageSize) => {
              setTaskPage(page);
              setTaskPageSize(pageSize);
            }}
            pageSize={taskPageSize}
            showSizeChanger
            showTotal={(count) => t("common.total", { total: count })}
            total={taskTotal}
          />
        ) : null}
      </section>
      {scheduleModalState ? (
        <ScanScheduleFormModal
          catalogs={catalogs}
          initialValue={scheduleModalState.mode === "edit" ? editingSchedule : null}
          mode={scheduleModalState.mode}
          onCancel={() => {
            setScheduleModalState(null);
            setEditingSchedule(null);
          }}
          onSubmit={handleScheduleSubmit}
          open
          submitting={scheduleModalSubmitting}
        />
      ) : null}
      {detailTaskId ? (
        <DataConnectScanTaskDrawer
          catalogs={catalogs}
          onClose={() => {
            setDetailTaskId(null);
          }}
          open
          schedules={schedules}
          taskId={detailTaskId}
        />
      ) : null}
    </>
  );
}
