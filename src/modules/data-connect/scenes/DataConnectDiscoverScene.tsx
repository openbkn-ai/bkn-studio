/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import { Alert, Input, Select, Space, Switch, Tabs } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import type { DataConnectDiscoverSceneProps } from "@/modules/data-connect/contracts/scenes";
import { useAppServices } from "@/framework/context/use-app-services";
import { useDebouncedValue } from "@/framework/hooks/use-debounced-value";
import { PermissionGate } from "@/framework/permission/PermissionGate";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { AppTable } from "@/framework/ui/common/AppTable";
import { EmptyStatePanel } from "@/framework/ui/common/EmptyStatePanel";
import { TablePaginationBar } from "@/framework/ui/common/TablePaginationBar";
import { TableSurface } from "@/framework/ui/common/TableSurface";
import { listCatalogs } from "@/shared/catalog";
import {
  createDataConnectDiscoverSchedule,
  deleteDataConnectDiscoverTask,
  deleteDataConnectDiscoverSchedule,
  getDataConnectDiscoverSchedule,
  listDataConnectDiscoverSchedules,
  listDataConnectDiscoverTasks,
  setDataConnectDiscoverScheduleEnabled,
  triggerDataConnectDiscover,
  updateDataConnectDiscoverSchedule,
} from "@/modules/data-connect/services/discover.service";
import type { DataConnectRecord } from "@/modules/data-connect/types/data-connect";
import type {
  DataConnectDiscoverSchedule,
  DataConnectDiscoverSchedulePayload,
  DataConnectDiscoverTask,
  DataConnectDiscoverTaskStatus,
} from "@/modules/data-connect/types/discover";
import {
  DiscoverScheduleFormModal,
  type DiscoverScheduleFormModalSubmitPayload,
} from "@/modules/data-connect/components/DiscoverScheduleFormModal";
import { DiscoverRunNowModal } from "@/modules/data-connect/components/DiscoverRunNowModal";
import { DataConnectDiscoverTaskDrawer } from "@/modules/data-connect/components/DataConnectDiscoverTaskDrawer";
import { DataConnectPageHeader } from "@/modules/data-connect/components/DataConnectPageHeader";

import styles from "./DataConnectDiscoverScene.module.css";

type ScheduleModalState =
  | { mode: "create"; scheduleId?: undefined }
  | { mode: "edit"; scheduleId: string }
  | null;

type EnabledFilterValue = "all" | "disabled" | "enabled";
type DiscoverPageTab = "schedules" | "tasks";
type TaskStatusFilterValue = "all" | DataConnectDiscoverTaskStatus;
type TaskTriggerTypeFilterValue = "all" | DataConnectDiscoverTask["triggerType"];

function renderTableTime(value?: string) {
  return <span className={styles.timeText}>{value || "-"}</span>;
}

export function DataConnectDiscoverScene({
  catalogId,
  onBackToConnections,
  onCatalogIdChange,
}: DataConnectDiscoverSceneProps) {
  const { t } = useTranslation();
  const { message, modal } = useAppServices();
  const navigate = useNavigate();
  const [catalogLocked] = useState(() => Boolean(catalogId));
  const [activeTab, setActiveTab] = useState<DiscoverPageTab>("schedules");
  const [keyword, setKeyword] = useState("");
  const debouncedKeyword = useDebouncedValue(keyword.trim());
  const [catalogKeyword, setCatalogKeyword] = useState("");
  const debouncedCatalogKeyword = useDebouncedValue(catalogKeyword.trim());
  const [selectedCatalogId, setSelectedCatalogId] = useState<string | undefined>(catalogId);
  const [enabledFilter, setEnabledFilter] =
    useState<EnabledFilterValue>("all");
  const [taskStatusFilter, setTaskStatusFilter] =
    useState<TaskStatusFilterValue>("all");
  const [taskTriggerTypeFilter, setTaskTriggerTypeFilter] =
    useState<TaskTriggerTypeFilterValue>("all");
  const [catalogs, setCatalogs] = useState<DataConnectRecord[]>([]);
  const [schedules, setSchedules] = useState<DataConnectDiscoverSchedule[]>([]);
  const [tasks, setTasks] = useState<DataConnectDiscoverTask[]>([]);
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
    useState<DataConnectDiscoverSchedule | null>(null);
  const [triggeringScheduleId, setTriggeringScheduleId] = useState<string | null>(null);
  const [runNowOpen, setRunNowOpen] = useState(false);
  const [runNowSubmitting, setRunNowSubmitting] = useState(false);
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);

  const catalogNameMap = useMemo(
    () => new Map(catalogs.map((item) => [item.id, item.name])),
    [catalogs],
  );

  const selectedCatalogName = selectedCatalogId
    ? catalogNameMap.get(selectedCatalogId)
    : undefined;

  const hasActiveTasks = useMemo(
    () => tasks.some((item) => item.status === "pending" || item.status === "running"),
    [tasks],
  );
  const activeTaskCount = useMemo(
    () =>
      tasks.filter((item) => item.status === "pending" || item.status === "running")
        .length,
    [tasks],
  );
  const scheduleNameMap = useMemo(
    () => new Map(schedules.map((item) => [item.id, item.name])),
    [schedules],
  );

  const loadCatalogs = useCallback(async () => {
    setLoadingCatalogs(true);
    setCatalogError(null);

    try {
      const result = await listCatalogs({
        keyword: debouncedCatalogKeyword,
        page: 1,
        pageSize: 50,
        type: "physical",
      });
      setCatalogs(result.items);
    } catch (error) {
      setCatalogError(extractRequestErrorMessage(error));
    } finally {
      setLoadingCatalogs(false);
    }
  }, [debouncedCatalogKeyword]);

  const loadSchedules = useCallback(async () => {
    setLoadingSchedules(true);
    setScheduleError(null);

    try {
      const result = await listDataConnectDiscoverSchedules({
        catalogId: selectedCatalogId,
        enabled:
          enabledFilter === "all" ? undefined : enabledFilter === "enabled",
        keyword: debouncedKeyword,
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
  }, [debouncedKeyword, enabledFilter, schedulePage, schedulePageSize, selectedCatalogId]);

  const loadTasks = useCallback(async () => {
    setLoadingTasks(true);
    setTaskError(null);

    try {
      const result = await listDataConnectDiscoverTasks({
        catalogId: selectedCatalogId,
        page: taskPage,
        pageSize: taskPageSize,
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
    taskPage,
    taskPageSize,
    taskTriggerTypeFilter,
    taskStatusFilter,
  ]);

  const openTasksForSchedule = useCallback(() => {
    // 立即扫描 / 按计划执行 走的都是 catalog discover，任务不带 schedule_id；
    // 因此「查看任务」进入任务 Tab 时展示当前连接下全部任务。
    setTaskStatusFilter("all");
    setTaskTriggerTypeFilter("all");
    setTaskPage(1);
    setActiveTab("tasks");
  }, []);

  const runDiscover = useCallback(
    async (targetCatalogId: string, strategy?: DataConnectDiscoverSchedule["strategy"]) => {
      const result = await triggerDataConnectDiscover(targetCatalogId, strategy);
      void message.success(t("dataConnect.discoverTriggerSuccess"));
      setDetailTaskId(result.id);
      setActiveTab("tasks");
      await Promise.all([loadSchedules(), loadTasks()]);
      return result;
    },
    [loadSchedules, loadTasks, message, t],
  );

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

  const scheduleColumns: ColumnsType<DataConnectDiscoverSchedule> = [
    {
      dataIndex: "name",
      title: t("dataConnect.discoverScheduleName"),
    },
    {
      dataIndex: "strategy",
      title: t("dataConnect.discoverStrategy"),
      render: (value: DataConnectDiscoverSchedule["strategy"]) =>
        t(`dataConnect.discoverStrategies.${value}`),
    },
    {
      dataIndex: "cronExpr",
      title: t("dataConnect.discoverCronExpr"),
    },
    {
      dataIndex: "enabled",
      title: t("common.status"),
      render: (value: boolean, record) => (
        <PermissionGate permissions="catalog:task_manage">
          <Switch
            checked={value}
            onChange={(checked) => {
              void modal.confirm({
                title: checked
                  ? t("dataConnect.discoverScheduleEnableConfirmTitle")
                  : t("dataConnect.discoverScheduleDisableConfirmTitle"),
                content: checked
                  ? t("dataConnect.discoverScheduleEnableConfirmDescription", {
                      name: record.name,
                    })
                  : t("dataConnect.discoverScheduleDisableConfirmDescription", {
                      name: record.name,
                    }),
                okText: checked ? t("common.enabled") : t("common.disabled"),
                cancelText: t("common.cancel"),
                okButtonProps: checked ? undefined : { danger: true },
                onOk: async () => {
                  try {
                    await setDataConnectDiscoverScheduleEnabled(record.id, checked);
                    message.success(t("common.success"));
                    await Promise.all([loadSchedules(), loadTasks()]);
                  } catch (error) {
                    void message.error(extractRequestErrorMessage(error));
                    throw error;
                  }
                },
              });
            }}
          />
        </PermissionGate>
      ),
    },
    {
      dataIndex: "lastRun",
      title: t("dataConnect.discoverLastRun"),
    },
    {
      dataIndex: "nextRun",
      title: t("dataConnect.discoverNextRun"),
    },
    {
      dataIndex: "updateTime",
      title: t("dataConnect.updateTime"),
    },
    {
      key: "actions",
      title: t("common.actions"),
      render: (_, record) => (
        <Space className={styles.actionGroup} onClick={(event) => event.stopPropagation()}>
          <AppButton
            onClick={() => {
              openTasksForSchedule();
            }}
            type="link"
          >
            {t("dataConnect.discoverViewTasks")}
          </AppButton>
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
                void modal.confirm({
                  title: t("dataConnect.discoverRunScheduleConfirmTitle"),
                  content: t("dataConnect.discoverRunScheduleConfirmDescription", {
                    name: record.name,
                  }),
                  okText: t("dataConnect.discoverRunSchedule"),
                  cancelText: t("common.cancel"),
                    onOk: async () => {
                    try {
                      setTriggeringScheduleId(record.id);
                      await runDiscover(record.catalogId, record.strategy);
                    } catch (error) {
                      void message.error(extractRequestErrorMessage(error));
                      throw error;
                    } finally {
                      setTriggeringScheduleId(null);
                    }
                  },
                });
              }}
              type="link"
            >
              {t("dataConnect.discoverRunSchedule")}
            </AppButton>
          </PermissionGate>
          <PermissionGate permissions="catalog:task_manage">
            <AppButton
              danger
              onClick={() => {
                void modal.confirm({
                  title: t("dataConnect.discoverDeleteConfirmTitle"),
                  content: t("dataConnect.discoverDeleteConfirmDescription", {
                    name: record.name,
                  }),
                  okText: t("common.delete"),
                  cancelText: t("common.cancel"),
                  okButtonProps: { danger: true },
                  onOk: async () => {
                    await deleteDataConnectDiscoverSchedule(record.id);
                    void message.success(t("common.success"));
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

  const taskColumns: ColumnsType<DataConnectDiscoverTask> = [
    {
      dataIndex: "status",
      title: t("dataConnect.discoverTaskStatus"),
      render: (value: DataConnectDiscoverTaskStatus) =>
        t(`dataConnect.discoverTaskStatuses.${value}`),
    },
    {
      dataIndex: "scheduleId",
      title: t("dataConnect.discoverScheduleName"),
      render: (value: string) =>
        value ? scheduleNameMap.get(value) ?? t("dataConnect.discoverManualTask") : "-",
    },
    {
      dataIndex: "triggerType",
      title: t("dataConnect.discoverTriggerType"),
      render: (value: DataConnectDiscoverTask["triggerType"]) =>
        t(`dataConnect.discoverTriggerTypes.${value}`),
    },
    {
      dataIndex: "strategy",
      title: t("dataConnect.discoverStrategy"),
      render: (value: DataConnectDiscoverTask["strategy"]) =>
        t(`dataConnect.discoverStrategies.${value}`),
    },
    {
      dataIndex: "progress",
      title: t("dataConnect.discoverProgress"),
      render: (value: number) => `${value}%`,
    },
    {
      dataIndex: "message",
      title: t("dataConnect.discoverMessage"),
      render: (value: string) => (
        <span className={styles.messageText} title={value || "-"}>
          {value || "-"}
        </span>
      ),
    },
    {
      dataIndex: "startTime",
      title: t("dataConnect.discoverStartTime"),
      render: renderTableTime,
    },
    {
      dataIndex: "finishTime",
      title: t("dataConnect.discoverFinishTime"),
      render: renderTableTime,
    },
    {
      dataIndex: "createTime",
      title: t("dataConnect.createTime"),
      render: renderTableTime,
    },
    {
      className: styles.creatorCell,
      dataIndex: "creatorName",
      title: t("dataConnect.creator"),
    },
    {
      key: "actions",
      className: styles.taskActionCell,
      title: t("common.actions"),
      width: 96,
      render: (_, record) => (
        <Space className={`${styles.actionGroup} ${styles.taskActionGroup}`}>
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
                  title: t("dataConnect.discoverTaskDeleteConfirmTitle"),
                  content: t("dataConnect.discoverTaskDeleteConfirmDescription", {
                    id: record.id,
                  }),
                  okText: t("common.delete"),
                  cancelText: t("common.cancel"),
                  okButtonProps: { danger: true },
                  onOk: async () => {
                    await deleteDataConnectDiscoverTask(record.id);
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
        const schedule = await getDataConnectDiscoverSchedule(scheduleModalState.scheduleId);
        setEditingSchedule(schedule);
      } catch (error) {
        setEditingSchedule(null);
        void message.error(extractRequestErrorMessage(error));
      }
    })();
  }, [message, scheduleModalState]);

  const handleScheduleSubmit = async (
    payload: DiscoverScheduleFormModalSubmitPayload,
  ) => {
    setScheduleModalSubmitting(true);

    try {
      const requestPayload: DataConnectDiscoverSchedulePayload = {
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
        await updateDataConnectDiscoverSchedule(
          scheduleModalState.scheduleId,
          requestPayload,
        );
      } else {
        await createDataConnectDiscoverSchedule(requestPayload);
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

  const handleBackToConnections = () => {
    if (onBackToConnections) {
      onBackToConnections();
      return;
    }

    void navigate("/data-connect");
  };

  const catalogFilter = (
    <div className={styles.filterField}>
      <span className={styles.filterLabel}>{t("dataConnect.discoverCatalog")}</span>
      <Select
        className={styles.filterSelectWide}
        disabled={catalogLocked}
        loading={loadingCatalogs}
        onChange={(value) => {
          setSelectedCatalogId(value || undefined);
          setSchedulePage(1);
          setTaskPage(1);
        }}
        filterOption={false}
        onSearch={setCatalogKeyword}
        options={[
          ...(catalogLocked ? [] : [{ label: t("dataConnect.categoryAll"), value: "" }]),
          ...catalogs.map((item) => ({
            label: item.name,
            value: item.id,
          })),
        ]}
        showSearch={!catalogLocked}
        value={selectedCatalogId ?? ""}
      />
    </div>
  );

  const schedulesPanel = (
    <div className={styles.tabPanel}>
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
                {t("dataConnect.discoverCreate")}
              </AppButton>
            </PermissionGate>
            <PermissionGate permissions="catalog:task_manage">
              <AppButton
                disabled={!selectedCatalogId}
                onClick={() => {
                  if (!selectedCatalogId) {
                    return;
                  }
                  setRunNowOpen(true);
                }}
              >
                {t("dataConnect.discoverRunNow")}
              </AppButton>
            </PermissionGate>
            <AppButton
              icon={<ReloadOutlined />}
              onClick={() => {
                void Promise.all([loadSchedules(), loadCatalogs()]);
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
            onChange={(event) => {
              setKeyword(event.target.value);
              setSchedulePage(1);
            }}
            onPressEnter={(event) => {
              setKeyword(event.currentTarget.value);
              setSchedulePage(1);
            }}
            placeholder={t("dataConnect.discoverSearchPlaceholder")}
            prefix={<SearchOutlined className={styles.searchIcon} />}
            value={keyword}
          />
          <div className={styles.filterField}>
            <span className={styles.filterLabel}>{t("dataConnect.discoverStatusFilter")}</span>
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
          </div>
        </div>
      </div>
      <TableSurface className={styles.panelSection}>
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
                  {t("dataConnect.discoverCreate")}
                </AppButton>
              </PermissionGate>
            }
            description={t("dataConnect.discoverScheduleEmptyDescription")}
            title={t("dataConnect.discoverScheduleEmpty")}
          />
        ) : (
          <AppTable<DataConnectDiscoverSchedule>
            columns={scheduleColumns}
            dataSource={schedules}
            loading={loadingSchedules}
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
    </div>
  );

  const tasksPanel = (
    <div className={styles.tabPanel}>
      <div className={styles.operationBar}>
        <div className={styles.operationPrimary}>
          <div className={styles.toolbarActions}>
            <AppButton
              icon={<ReloadOutlined />}
              onClick={() => {
                void loadTasks();
              }}
            >
              {t("common.refresh")}
            </AppButton>
          </div>
          {hasActiveTasks ? (
            <span className={styles.inlineHint}>{t("dataConnect.discoverAutoRefreshHint")}</span>
          ) : null}
        </div>
        <div className={styles.toolbarFilters}>
          <div className={styles.filterField}>
            <span className={styles.filterLabel}>{t("dataConnect.discoverTaskStatus")}</span>
            <Select
              className={styles.filterSelect}
              onChange={(value: TaskStatusFilterValue) => {
                setTaskStatusFilter(value);
                setTaskPage(1);
              }}
              options={[
                { label: t("common.all"), value: "all" },
                { label: t("dataConnect.discoverTaskStatuses.pending"), value: "pending" },
                { label: t("dataConnect.discoverTaskStatuses.running"), value: "running" },
                {
                  label: t("dataConnect.discoverTaskStatuses.completed"),
                  value: "completed",
                },
                { label: t("dataConnect.discoverTaskStatuses.failed"), value: "failed" },
              ]}
              value={taskStatusFilter}
            />
          </div>
          <div className={styles.filterField}>
            <span className={styles.filterLabel}>{t("dataConnect.discoverTriggerType")}</span>
            <Select
              className={styles.filterSelect}
              onChange={(value: TaskTriggerTypeFilterValue) => {
                setTaskTriggerTypeFilter(value);
                setTaskPage(1);
              }}
              options={[
                { label: t("common.all"), value: "all" },
                { label: t("dataConnect.discoverTriggerTypes.manual"), value: "manual" },
                {
                  label: t("dataConnect.discoverTriggerTypes.scheduled"),
                  value: "scheduled",
                },
              ]}
              value={taskTriggerTypeFilter}
            />
          </div>
        </div>
      </div>
      <TableSurface className={styles.panelSection}>
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
            description={t("dataConnect.discoverTaskEmptyDescription")}
            title={t("dataConnect.discoverTaskEmpty")}
          />
        ) : (
          <AppTable<DataConnectDiscoverTask>
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
    </div>
  );

  return (
    <>
      <section className={styles.contentSurface}>
        <DataConnectPageHeader
          description={t("dataConnect.discoverDescription")}
          extra={
            catalogLocked && selectedCatalogName ? (
              <div className={styles.contextBar}>
                <span className={styles.contextLabel}>
                  {t("dataConnect.discoverCurrentConnection")}
                </span>
                <strong className={styles.contextName}>{selectedCatalogName}</strong>
              </div>
            ) : catalogLocked ? null : (
              catalogFilter
            )
          }
          layout="inline"
          onBack={handleBackToConnections}
          title={t("dataConnect.discoverTitle")}
          variant="plain"
        />
        {catalogError ? <Alert message={catalogError} showIcon type="warning" /> : null}
        <Tabs
          activeKey={activeTab}
          className={styles.pageTabs}
          items={[
            {
              key: "schedules",
              label: t("dataConnect.discoverTabSchedules"),
              children: schedulesPanel,
            },
            {
              key: "tasks",
              label:
                activeTaskCount > 0
                  ? `${t("dataConnect.discoverTabTasks")} (${activeTaskCount})`
                  : t("dataConnect.discoverTabTasks"),
              children: tasksPanel,
            },
          ]}
          onChange={(key) => {
            setActiveTab(key as DiscoverPageTab);
          }}
        />
      </section>
      {scheduleModalState ? (
        <DiscoverScheduleFormModal
          catalogs={catalogs}
          defaultCatalogId={
            scheduleModalState.mode === "create" && catalogLocked
              ? selectedCatalogId
              : undefined
          }
          initialValue={scheduleModalState.mode === "edit" ? editingSchedule : null}
          mode={scheduleModalState.mode}
          onCancel={() => {
            setScheduleModalState(null);
            setEditingSchedule(null);
          }}
          onCatalogSearch={setCatalogKeyword}
          onSubmit={handleScheduleSubmit}
          open
          submitting={scheduleModalSubmitting}
        />
      ) : null}
      {selectedCatalogId ? (
        <DiscoverRunNowModal
          connectionName={
            catalogNameMap.get(selectedCatalogId) ?? selectedCatalogId
          }
          onCancel={() => {
            setRunNowOpen(false);
          }}
          onSubmit={async (strategy) => {
            try {
              setRunNowSubmitting(true);
              await runDiscover(selectedCatalogId, strategy);
              setRunNowOpen(false);
            } catch (error) {
              void message.error(extractRequestErrorMessage(error));
            } finally {
              setRunNowSubmitting(false);
            }
          }}
          open={runNowOpen}
          submitting={runNowSubmitting}
        />
      ) : null}
      {detailTaskId ? (
        <DataConnectDiscoverTaskDrawer
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
