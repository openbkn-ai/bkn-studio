/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  DeleteOutlined,
  EllipsisOutlined,
  ReloadOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { Alert, Dropdown, Input, Select, Space, Switch, Tabs, Tag, type MenuProps } from "antd";
import type { ColumnsType, TableProps } from "antd/es/table";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import type {
  DataConnectDiscoverSceneProps,
  DataConnectDiscoverTab,
} from "@/modules/data-connect/contracts/scenes";
import { useAppServices } from "@/framework/context/use-app-services";
import { useDebouncedValue } from "@/framework/hooks/use-debounced-value";
import { PermissionGate } from "@/framework/permission/PermissionGate";
import { hasPermissions } from "@/framework/permission/has-permissions";
import {
  extractRequestErrorMessage,
  isRequestConflict,
  isRequestForbidden,
} from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { AppTable } from "@/framework/ui/common/AppTable";
import { EmptyStatePanel } from "@/framework/ui/common/EmptyStatePanel";
import { TablePaginationBar } from "@/framework/ui/common/TablePaginationBar";
import { TableSurface } from "@/framework/ui/common/TableSurface";
import { getCatalog, hasCatalogOperation } from "@/shared/catalog";
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
  DataConnectDiscoverStrategy,
  DataConnectDiscoverTask,
  DataConnectDiscoverTaskSort,
  DataConnectDiscoverTaskSummary,
  DataConnectDiscoverTaskStatus,
  DataConnectDiscoverTaskTriggerType,
} from "@/modules/data-connect/types/discover";
import { formatDiscoverTaskTime } from "@/modules/data-connect/utils/discover-task-time";
import {
  DiscoverScheduleFormModal,
  type DiscoverScheduleFormModalSubmitPayload,
} from "@/modules/data-connect/components/DiscoverScheduleFormModal";
import { DiscoverRunNowModal } from "@/modules/data-connect/components/DiscoverRunNowModal";
import { DataConnectDiscoverTaskDrawer } from "@/modules/data-connect/components/DataConnectDiscoverTaskDrawer";
import { DataConnectPageHeader } from "@/modules/data-connect/components/DataConnectPageHeader";
import taskStyles from "@/framework/ui/common/TaskDetailDrawer.module.css";

import styles from "./DataConnectDiscoverScene.module.css";

const useMock = import.meta.env.VITE_USE_MOCK !== "false";
type ScheduleModalState =
  | { mode: "create"; scheduleId?: undefined }
  | { mode: "edit"; scheduleId: string }
  | null;

type EnabledFilterValue = "all" | "disabled" | "enabled";
type TaskStatusFilterValue = DataConnectDiscoverTaskStatus[];
type TaskTriggerTypeFilterValue = "all" | DataConnectDiscoverTask["triggerType"];

function renderTableTime(value?: number) {
  return <span className={styles.timeText}>{formatDiscoverTaskTime(value)}</span>;
}

function DiscoverTaskProgress({ task }: { task: DataConnectDiscoverTaskSummary }) {
  const percent = Math.max(0, Math.min(100, task.progress));
  const fillClass = task.status === "completed" ? taskStyles.progressFillDone : task.status === "failed" ? taskStyles.progressFillFailed : task.status === "cancelled" || task.status === "pending" ? taskStyles.progressFillMuted : taskStyles.progressFillVector;
  return <div className={taskStyles.progressWrapCompact}><div className={taskStyles.progressTrack}><span className={[taskStyles.progressFill, fillClass].join(" ")} style={{ width: `${percent}%` }} /></div><div className={taskStyles.progressMetaCompact}><span>{`${percent}%`}</span></div></div>;
}

function DiscoverTaskPriority({ priority }: { priority: number }) {
  const { t } = useTranslation();
  const level = priority <= 10 ? "low" : priority >= 30 ? "high" : "normal";
  const color = level === "high" ? "error" : level === "low" ? "default" : "processing";
  return <Tag color={color}>{t(`dataConnect.discoverTaskPriorities.${level}`, { priority })}</Tag>;
}

export function DataConnectDiscoverScene({
  activeTab: controlledActiveTab,
  catalogId,
  onBackToConnections,
  onTabChange,
}: DataConnectDiscoverSceneProps) {
  const { t } = useTranslation();
  const { message, modal, runtimeConfig } = useAppServices();
  const navigate = useNavigate();
  const [internalActiveTab, setInternalActiveTab] = useState<DataConnectDiscoverTab>("tasks");
  const activeTab = controlledActiveTab ?? internalActiveTab;
  const changeActiveTab = useCallback((nextTab: DataConnectDiscoverTab) => {
    setInternalActiveTab(nextTab);
    onTabChange?.(nextTab);
  }, [onTabChange]);
  const [keyword, setKeyword] = useState("");
  const debouncedKeyword = useDebouncedValue(keyword.trim());
  const selectedCatalogId = catalogId;
  const [enabledFilter, setEnabledFilter] =
    useState<EnabledFilterValue>("all");
  const [taskStatusFilter, setTaskStatusFilter] =
    useState<TaskStatusFilterValue>([]);
  const [taskTriggerTypeFilter, setTaskTriggerTypeFilter] =
    useState<TaskTriggerTypeFilterValue>("all");
  const [taskStrategyFilter, setTaskStrategyFilter] =
    useState<DataConnectDiscoverStrategy>();
  const [taskSort, setTaskSort] = useState<DataConnectDiscoverTaskSort>("create_time");
  const [taskDirection, setTaskDirection] = useState<"asc" | "desc">("desc");
  const [catalogs, setCatalogs] = useState<DataConnectRecord[]>([]);
  const [schedules, setSchedules] = useState<DataConnectDiscoverSchedule[]>([]);
  const [tasks, setTasks] = useState<DataConnectDiscoverTaskSummary[]>([]);
  const [schedulePage, setSchedulePage] = useState(1);
  const [schedulePageSize, setSchedulePageSize] = useState(10);
  const [scheduleTotal, setScheduleTotal] = useState(0);
  const [taskPage, setTaskPage] = useState(1);
  const [taskPageSize, setTaskPageSize] = useState(10);
  const [taskTotal, setTaskTotal] = useState(0);
  const [loadingSchedules, setLoadingSchedules] = useState(false);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [catalogsLoaded, setCatalogsLoaded] = useState(false);
  const [catalogAccessDenied, setCatalogAccessDenied] = useState(false);
  const [authorizedCatalogId, setAuthorizedCatalogId] = useState<string | null>(null);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [taskError, setTaskError] = useState<string | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const catalogRequestIdRef = useRef(0);
  const scheduleRequestIdRef = useRef(0);
  const taskRequestIdRef = useRef(0);
  const [scheduleModalState, setScheduleModalState] =
    useState<ScheduleModalState>(null);
  const [scheduleModalSubmitting, setScheduleModalSubmitting] = useState(false);
  const [editingSchedule, setEditingSchedule] =
    useState<DataConnectDiscoverSchedule | null>(null);
  const [triggeringScheduleId, setTriggeringScheduleId] = useState<string | null>(null);
  const [runNowOpen, setRunNowOpen] = useState(false);
  const [runNowSubmitting, setRunNowSubmitting] = useState(false);
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  const [selectedTaskKeys, setSelectedTaskKeys] = useState<string[]>([]);
  const catalogInteractionIdentityRef = useRef({ catalogId: selectedCatalogId });
  if (catalogInteractionIdentityRef.current.catalogId !== selectedCatalogId) {
    catalogInteractionIdentityRef.current = { catalogId: selectedCatalogId };
  }
  const canManageCatalogTasks = hasPermissions({
    currentPermissions: runtimeConfig.currentUser.permissions,
    requiredPermissions: "catalog:task_manage",
  });
  const batchDeleteTaskTargets = tasks.filter(
    (task) =>
      selectedTaskKeys.includes(task.id) &&
      task.status !== "pending" &&
      task.status !== "running",
  );

  const handleBatchDeleteTasks = () => {
    if (!batchDeleteTaskTargets.length) return;
    const catalogIdentity = catalogInteractionIdentityRef.current;
    void modal.confirm({
      title: t("dataCatalog.task.batchDeleteConfirmTitle", { count: batchDeleteTaskTargets.length }),
      content: t("dataCatalog.task.batchDeleteConfirmContent"),
      okText: t("common.delete"),
      cancelText: t("common.cancel"),
      okButtonProps: { danger: true },
      onOk: async () => {
        if (catalogInteractionIdentityRef.current !== catalogIdentity) return;
        const results = await Promise.allSettled(
          batchDeleteTaskTargets.map((task) => deleteDataConnectDiscoverTask(task.id)),
        );
        if (catalogInteractionIdentityRef.current !== catalogIdentity) return;
        const failed = results.filter((result) => result.status === "rejected").length;
        if (failed) {
          message.error(
            t("dataCatalog.task.batchDeletePartial", {
              failed,
              total: batchDeleteTaskTargets.length,
            }),
          );
        } else {
          message.success(t("common.success"));
        }
        setSelectedTaskKeys([]);
        await loadTasks();
      },
    });
  };
  const editingScheduleIdentityKey = scheduleModalState
    ? scheduleModalState.mode === "edit"
      ? `${selectedCatalogId}:edit:${scheduleModalState.scheduleId}`
      : `${selectedCatalogId}:create`
    : null;
  const editingScheduleIdentityRef = useRef({
    generation: 0,
    key: editingScheduleIdentityKey,
  });
  if (editingScheduleIdentityRef.current.key !== editingScheduleIdentityKey) {
    editingScheduleIdentityRef.current = {
      generation: editingScheduleIdentityRef.current.generation + 1,
      key: editingScheduleIdentityKey,
    };
  }

  const catalogNameMap = useMemo(
    () => new Map(catalogs.map((item) => [item.id, item.name])),
    [catalogs],
  );

  const selectedCatalogName = selectedCatalogId
    ? catalogNameMap.get(selectedCatalogId)
    : undefined;
  const catalogAccessConfirmed = Boolean(
    catalogsLoaded &&
    authorizedCatalogId === selectedCatalogId &&
    !catalogError &&
    !catalogAccessDenied,
  );

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
  const loadCatalogs = useCallback(async () => {
    const requestId = ++catalogRequestIdRef.current;
    setCatalogsLoaded(false);
    setCatalogAccessDenied(false);
    setAuthorizedCatalogId(null);
    setCatalogError(null);

    try {
      const catalog = await getCatalog(selectedCatalogId, { skipErrorToast: true });
      if (catalogRequestIdRef.current !== requestId) return;
      const allowed = Boolean(catalog && hasCatalogOperation(catalog, "task_manage"));
      setCatalogs(allowed && catalog ? [catalog] : []);
      setCatalogAccessDenied(!allowed);
      setAuthorizedCatalogId(allowed ? selectedCatalogId : null);
    } catch (error) {
      if (catalogRequestIdRef.current !== requestId) return;
      const accessDenied = isRequestForbidden(error);
      setCatalogs([]);
      setCatalogAccessDenied(accessDenied);
      setAuthorizedCatalogId(null);
      if (!accessDenied) {
        setCatalogError(extractRequestErrorMessage(error));
      }
    } finally {
      if (catalogRequestIdRef.current === requestId) {
        setCatalogsLoaded(true);
      }
    }
  }, [selectedCatalogId]);

  const loadSchedules = useCallback(async () => {
    const catalogIdentity = catalogInteractionIdentityRef.current;
    if (catalogIdentity.catalogId !== selectedCatalogId) return;
    const requestId = ++scheduleRequestIdRef.current;
    const isCurrentRequest = () =>
      scheduleRequestIdRef.current === requestId &&
      catalogInteractionIdentityRef.current === catalogIdentity;
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
      if (!isCurrentRequest()) return;
      setSchedules(result.items);
      setScheduleTotal(result.total);
    } catch (error) {
      if (!isCurrentRequest()) return;
      setSchedules([]);
      setScheduleTotal(0);
      setScheduleError(extractRequestErrorMessage(error));
    } finally {
      if (isCurrentRequest()) {
        setLoadingSchedules(false);
      }
    }
  }, [debouncedKeyword, enabledFilter, schedulePage, schedulePageSize, selectedCatalogId]);

  const loadTasks = useCallback(async () => {
    const catalogIdentity = catalogInteractionIdentityRef.current;
    if (catalogIdentity.catalogId !== selectedCatalogId) return;
    const requestId = ++taskRequestIdRef.current;
    const isCurrentRequest = () =>
      taskRequestIdRef.current === requestId &&
      catalogInteractionIdentityRef.current === catalogIdentity;
    setLoadingTasks(true);
    setTaskError(null);

    try {
      const result = await listDataConnectDiscoverTasks({
        catalogId: selectedCatalogId,
        page: taskPage,
        pageSize: taskPageSize,
        direction: taskDirection,
        sort: taskSort,
        statuses: taskStatusFilter.length === 0 ? undefined : taskStatusFilter,
        strategy: taskStrategyFilter,
        triggerType:
          taskTriggerTypeFilter === "all" ? undefined : taskTriggerTypeFilter,
      });
      if (!isCurrentRequest()) return;
      setTasks(result.items);
      setTaskTotal(result.total);
    } catch (error) {
      if (!isCurrentRequest()) return;
      setTasks([]);
      setTaskTotal(0);
      setTaskError(extractRequestErrorMessage(error));
    } finally {
      if (isCurrentRequest()) {
        setLoadingTasks(false);
      }
    }
  }, [
    selectedCatalogId,
    taskPage,
    taskPageSize,
    taskDirection,
    taskSort,
    taskStrategyFilter,
    taskTriggerTypeFilter,
    taskStatusFilter,
  ]);

  const taskSortOrderOf = (key: DataConnectDiscoverTaskSort) =>
    taskSort === key ? (taskDirection === "asc" ? "ascend" : "descend") : null;
  const handleTaskTableChange: TableProps<DataConnectDiscoverTaskSummary>["onChange"] = (
    _pagination,
    filters,
    sorter,
    extra,
  ) => {
    if (extra.action === "filter") {
      setTaskStrategyFilter(filters.strategy?.[0] as DataConnectDiscoverStrategy | undefined);
      setTaskTriggerTypeFilter((filters.triggerType?.[0] as DataConnectDiscoverTaskTriggerType | undefined) ?? "all");
      setTaskStatusFilter((filters.status ?? []).map(String) as TaskStatusFilterValue);
      setSelectedTaskKeys([]);
      setTaskPage(1);
      return;
    }
    if (extra.action !== "sort") return;
    const single = Array.isArray(sorter) ? sorter[0] : sorter;
    if (!single?.columnKey || !single.order) {
      setTaskSort("create_time");
      setTaskDirection("desc");
    } else {
      setTaskSort(single.columnKey as DataConnectDiscoverTaskSort);
      setTaskDirection(single.order === "ascend" ? "asc" : "desc");
    }
    setSelectedTaskKeys([]);
    setTaskPage(1);
  };

  const openTasksForSchedule = useCallback(() => {
    // Immediate and scheduled scans both use catalog discovery, whose tasks lack schedule_id;
    // therefore View tasks shows every task for the current connection in the task tab.
    setTaskStatusFilter([]);
    setTaskStrategyFilter(undefined);
    setTaskTriggerTypeFilter("all");
    setTaskPage(1);
    changeActiveTab("tasks");
  }, [changeActiveTab]);

  const runDiscover = useCallback(
    async (targetCatalogId: string, strategy?: DataConnectDiscoverSchedule["strategy"]) => {
      const catalogIdentity = catalogInteractionIdentityRef.current;
      if (catalogIdentity.catalogId !== targetCatalogId) return null;
      const result = await triggerDataConnectDiscover(targetCatalogId, strategy);
      if (
        catalogInteractionIdentityRef.current !== catalogIdentity ||
        catalogIdentity.catalogId !== targetCatalogId
      ) {
        return null;
      }
      void message.success(t("dataConnect.discoverTriggerSuccess"));
      setDetailTaskId(result.id);
      changeActiveTab("tasks");
      await Promise.all([loadSchedules(), loadTasks()]);
      return result;
    },
    [changeActiveTab, loadSchedules, loadTasks, message, t],
  );

  useEffect(() => {
    void loadCatalogs();
  }, [loadCatalogs]);

  useEffect(() => {
    scheduleRequestIdRef.current += 1;
    taskRequestIdRef.current += 1;
    setSchedules([]);
    setScheduleTotal(0);
    setScheduleError(null);
    setLoadingSchedules(false);
    setTasks([]);
    setTaskTotal(0);
    setTaskError(null);
    setLoadingTasks(false);
    setSelectedTaskKeys([]);
    setDetailTaskId(null);
    setTaskStatusFilter([]);
    setTaskStrategyFilter(undefined);
    setTaskTriggerTypeFilter("all");
    setTaskPage(1);
    setScheduleModalState(null);
    setScheduleModalSubmitting(false);
    setEditingSchedule(null);
    setTriggeringScheduleId(null);
    setRunNowOpen(false);
    setRunNowSubmitting(false);
  }, [selectedCatalogId]);

  useEffect(() => {
    if (catalogAccessConfirmed) {
      void loadSchedules();
    }
  }, [catalogAccessConfirmed, loadSchedules]);

  useEffect(() => {
    if (catalogAccessConfirmed) {
      void loadTasks();
    }
  }, [catalogAccessConfirmed, loadTasks]);

  useEffect(() => {
    if (useMock || !hasActiveTasks) {
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
              const catalogIdentity = catalogInteractionIdentityRef.current;
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
                  if (catalogInteractionIdentityRef.current !== catalogIdentity) return;
                  try {
                    await setDataConnectDiscoverScheduleEnabled(record.id, checked);
                    if (catalogInteractionIdentityRef.current !== catalogIdentity) return;
                    message.success(t("common.success"));
                    await Promise.all([loadSchedules(), loadTasks()]);
                  } catch (error) {
                    if (catalogInteractionIdentityRef.current !== catalogIdentity) return;
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
                const catalogIdentity = catalogInteractionIdentityRef.current;
                void modal.confirm({
                  title: t("dataConnect.discoverRunScheduleConfirmTitle"),
                  content: t("dataConnect.discoverRunScheduleConfirmDescription", {
                    name: record.name,
                  }),
                  okText: t("dataConnect.discoverRunSchedule"),
                  cancelText: t("common.cancel"),
                  onOk: async () => {
                    if (catalogInteractionIdentityRef.current !== catalogIdentity) return;
                    try {
                      setTriggeringScheduleId(record.id);
                      await runDiscover(record.catalogId, record.strategy);
                    } catch (error) {
                      if (catalogInteractionIdentityRef.current !== catalogIdentity) return;
                      void message.error(extractRequestErrorMessage(error));
                      throw error;
                    } finally {
                      if (catalogInteractionIdentityRef.current === catalogIdentity) {
                        setTriggeringScheduleId(null);
                      }
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
                const catalogIdentity = catalogInteractionIdentityRef.current;
                void modal.confirm({
                  title: t("dataConnect.discoverDeleteConfirmTitle"),
                  content: t("dataConnect.discoverDeleteConfirmDescription", {
                    name: record.name,
                  }),
                  okText: t("common.delete"),
                  cancelText: t("common.cancel"),
                  okButtonProps: { danger: true },
                  onOk: async () => {
                    if (catalogInteractionIdentityRef.current !== catalogIdentity) return;
                    try {
                      await deleteDataConnectDiscoverSchedule(record.id);
                      if (catalogInteractionIdentityRef.current !== catalogIdentity) return;
                      void message.success(t("common.success"));
                      await Promise.all([loadSchedules(), loadTasks()]);
                    } catch (error) {
                      if (catalogInteractionIdentityRef.current === catalogIdentity) throw error;
                    }
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

  const taskColumns: ColumnsType<DataConnectDiscoverTaskSummary> = [
    {
      dataIndex: "id",
      title: t("dataCatalog.taskManagement.columns.task"),
      width: 160,
      ellipsis: true,
      render: (value: string) => (
        <button className={styles.textLink} onClick={() => setDetailTaskId(value)} type="button">
          {value}
        </button>
      ),
    },
    {
      dataIndex: "resourceId",
      title: t("dataCatalog.taskManagement.columns.resource"),
      width: 160,
      ellipsis: true,
      render: (value: string | undefined, record: DataConnectDiscoverTaskSummary) =>
        value ? (
          <AppButton onClick={() => void navigate(`/data-catalog/resource/${value}`)} type="link">
            {record.resourceName ?? value}
          </AppButton>
        ) : (
          "-"
        ),
    },
    {
      dataIndex: "strategy",
      title: t("dataConnect.discoverStrategy"),
      width: 110,
      filters: ["full_sync", "create_only", "cleanup_only"].map((value) => ({ text: t(`dataConnect.discoverStrategies.${value}`), value })),
      filterMultiple: false,
      filteredValue: taskStrategyFilter ? [taskStrategyFilter] : null,
      render: (value: DataConnectDiscoverTaskSummary["strategy"]) => t(`dataConnect.discoverStrategies.${value}`),
    },
    {
      dataIndex: "triggerType",
      title: t("dataConnect.discoverTriggerType"),
      width: 100,
      filters: ["manual", "scheduled"].map((value) => ({ text: t(`dataConnect.discoverTriggerTypes.${value}`), value })),
      filterMultiple: false,
      filteredValue: taskTriggerTypeFilter === "all" ? null : [taskTriggerTypeFilter],
      render: (value: DataConnectDiscoverTaskSummary["triggerType"]) => t(`dataConnect.discoverTriggerTypes.${value}`),
    },
    {
      dataIndex: "queuePriority",
      title: t("dataConnect.discoverQueuePriority"),
      width: 100,
      render: (value: number) => <DiscoverTaskPriority priority={value} />,
    },
    {
      dataIndex: "status",
      title: t("dataConnect.discoverTaskStatus"),
      width: 120,
      filters: ["pending", "running", "completed", "failed", "cancelled"].map((value) => ({ text: t(`dataConnect.discoverTaskStatuses.${value}`), value })),
      filteredValue: taskStatusFilter.length ? taskStatusFilter : null,
      render: (value: DataConnectDiscoverTaskStatus) => <Tag color={value === "failed" ? "error" : value === "completed" ? "success" : value === "cancelled" || value === "pending" ? "default" : "processing"}>{t(`dataConnect.discoverTaskStatuses.${value}`)}</Tag>,
    },
    {
      dataIndex: "progress",
      title: t("dataConnect.discoverProgress"),
      width: 200,
      render: (_value, record) => <DiscoverTaskProgress task={record} />,
    },
    {
      dataIndex: "lastProgressTime",
      key: "last_progress_time",
      title: t("dataConnect.discoverLastProgressTime"),
      width: 180,
      sorter: true,
      sortOrder: taskSortOrderOf("last_progress_time"),
      render: renderTableTime,
    },
    {
      dataIndex: "finishTime",
      key: "finish_time",
      title: t("dataCatalog.task.finishedAt"),
      width: 180,
      sorter: true,
      sortOrder: taskSortOrderOf("finish_time"),
      render: renderTableTime,
    },
    {
      dataIndex: "createTime",
      key: "create_time",
      title: t("dataCatalog.task.createTime"),
      width: 180,
      sorter: true,
      sortOrder: taskSortOrderOf("create_time"),
      render: renderTableTime,
    },
    {
      key: "actions",
      className: styles.taskActionCell,
      title: t("common.actions"),
      align: "center",
      width: 84,
      fixed: "right",
      render: (_, record) => {
        const menuItems: NonNullable<MenuProps["items"]> = [{ key: "detail", label: t("common.detail") }];
        if (canManageCatalogTasks && record.status !== "pending" && record.status !== "running") {
          menuItems.push({ danger: true, key: "delete", label: t("common.delete") });
        }
        return <Dropdown menu={{
          items: menuItems, onClick: ({ key, domEvent }) => {
            domEvent.stopPropagation();
            if (key === "detail") setDetailTaskId(record.id);
            if (key === "delete") {
              const catalogIdentity = catalogInteractionIdentityRef.current;
              void modal.confirm({
                title: t("dataConnect.discoverTaskDeleteConfirmTitle"),
                content: t("dataConnect.discoverTaskDeleteConfirmDescription", { id: record.id }),
                okText: t("common.delete"),
                cancelText: t("common.cancel"),
                okButtonProps: { danger: true },
                onOk: async () => {
                  if (catalogInteractionIdentityRef.current !== catalogIdentity) return;
                  try {
                    await deleteDataConnectDiscoverTask(record.id);
                    if (catalogInteractionIdentityRef.current !== catalogIdentity) return;
                    void message.success(t("common.success"));
                    if (detailTaskId === record.id) setDetailTaskId(null);
                    await loadTasks();
                  } catch (error) {
                    if (catalogInteractionIdentityRef.current === catalogIdentity) throw error;
                  }
                },
              });
            }
          }
        }} trigger={["click"]}><AppButton aria-label={t("dataConnect.moreActions")} icon={<EllipsisOutlined />} type="link" /></Dropdown>;
      },
    },
  ];

  useEffect(() => {
    if (scheduleModalState?.mode !== "edit" || !scheduleModalState.scheduleId) {
      setEditingSchedule(null);
      return;
    }

    let active = true;
    const scheduleId = scheduleModalState.scheduleId;
    void (async () => {
      try {
        const schedule = await getDataConnectDiscoverSchedule(scheduleId);
        if (active) {
          setEditingSchedule(schedule);
        }
      } catch (error) {
        if (active) {
          setEditingSchedule(null);
          void message.error(extractRequestErrorMessage(error));
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [message, scheduleModalState]);

  const handleScheduleSubmit = async (
    payload: DiscoverScheduleFormModalSubmitPayload,
  ) => {
    const submittedScheduleIdentity = editingScheduleIdentityRef.current;
    setScheduleModalSubmitting(true);

    try {
      const requestPayload: DataConnectDiscoverSchedulePayload = {
        ...payload,
        catalogId:
          scheduleModalState?.mode === "edit" && editingSchedule
            ? editingSchedule.catalogId
            : payload.catalogId,
      };

      if (scheduleModalState?.mode === "edit" && scheduleModalState.scheduleId) {
        if (!editingSchedule) {
          throw new Error(t("common.requestFailed"));
        }
        await updateDataConnectDiscoverSchedule(
          scheduleModalState.scheduleId,
          {
            ...requestPayload,
            expectedUpdateTime: editingSchedule.expectedUpdateTime,
          },
        );
      } else {
        await createDataConnectDiscoverSchedule(requestPayload);
      }

      if (editingScheduleIdentityRef.current !== submittedScheduleIdentity) {
        return;
      }
      setScheduleModalSubmitting(false);
      setScheduleModalState(null);
      setEditingSchedule(null);
      void message.success(t("common.success"));
      await Promise.all([loadSchedules(), loadTasks()]);
    } catch (error) {
      if (editingScheduleIdentityRef.current !== submittedScheduleIdentity) {
        return;
      }
      void message.error(extractRequestErrorMessage(error));

      if (
        isRequestConflict(error) &&
        scheduleModalState?.mode === "edit"
      ) {
        const submittedScheduleId = scheduleModalState.scheduleId;
        try {
          const latestSchedule =
            await getDataConnectDiscoverSchedule(submittedScheduleId);
          if (editingScheduleIdentityRef.current === submittedScheduleIdentity) {
            setEditingSchedule(latestSchedule);
          }
        } catch (refreshError) {
          if (editingScheduleIdentityRef.current === submittedScheduleIdentity) {
            void message.error(extractRequestErrorMessage(refreshError));
          }
        }
      }
    } finally {
      if (editingScheduleIdentityRef.current === submittedScheduleIdentity) {
        setScheduleModalSubmitting(false);
      }
    }
  };

  const handleBackToConnections = () => {
    if (onBackToConnections) {
      onBackToConnections();
      return;
    }

    void navigate("/data-connect");
  };

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
          <div className={`${styles.toolbarActions} ${styles.taskActionsRight}`}>
            <PermissionGate permissions="catalog:task_manage">
              <AppButton
                onClick={() => {
                  setRunNowOpen(true);
                }}
                type="primary"
              >
                {t("dataConnect.discoverRunNow")}
              </AppButton>
            </PermissionGate>
            <AppButton
              icon={<ReloadOutlined />}
              onClick={() => {
                void loadTasks();
              }}
            >
              {t("common.refresh")}
            </AppButton>
            <PermissionGate permissions="catalog:task_manage">
              <AppButton
                danger
                disabled={batchDeleteTaskTargets.length === 0}
                icon={<DeleteOutlined />}
                onClick={handleBatchDeleteTasks}
              >
                {batchDeleteTaskTargets.length > 0
                  ? `${t("dataCatalog.task.batchDelete")} (${batchDeleteTaskTargets.length})`
                  : t("dataCatalog.task.batchDelete")}
              </AppButton>
            </PermissionGate>
          </div>
          {!useMock && hasActiveTasks ? (
            <span className={styles.inlineHint}>{t("dataConnect.discoverAutoRefreshHint")}</span>
          ) : null}
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
        ) : (
          <AppTable<DataConnectDiscoverTaskSummary>
            columns={taskColumns}
            dataSource={tasks}
            locale={{
              emptyText: (
                <EmptyStatePanel
                  description={t("dataConnect.discoverTaskEmptyDescription")}
                  title={t("dataConnect.discoverTaskEmpty")}
                />
              ),
            }}
            loading={loadingTasks}
            onChange={handleTaskTableChange}
            pagination={false}
            rowKey="id"
            rowSelection={canManageCatalogTasks ? {
              selectedRowKeys: selectedTaskKeys,
              onChange: (keys) => setSelectedTaskKeys(keys.map(String)),
              getCheckboxProps: (task) => ({
                disabled: task.status === "pending" || task.status === "running",
              }),
            } : undefined}
          />
        )}
      </TableSurface>
      {taskTotal > 0 ? (
        <TablePaginationBar
          current={taskPage}
          onChange={(page, pageSize) => {
            setSelectedTaskKeys([]);
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
            selectedCatalogName ? (
              <div className={styles.contextBar}>
                <span className={styles.contextLabel}>
                  {t("dataConnect.discoverCurrentConnection")}
                </span>
                <strong className={styles.contextName}>{selectedCatalogName}</strong>
              </div>
            ) : null
          }
          layout="inline"
          onBack={handleBackToConnections}
          title={t("dataConnect.discoverTitle")}
          variant="plain"
        />
        {catalogError ? (
          <Alert
            action={(
              <AppButton onClick={() => void loadCatalogs()} type="link">
                {t("common.retry")}
              </AppButton>
            )}
            message={catalogError}
            showIcon
            type="warning"
          />
        ) : null}
        {catalogAccessDenied ? (
          <Alert message={t("common.noPermission")} showIcon type="error" />
        ) : catalogError ? null : (
          <Tabs
            activeKey={activeTab}
            className={styles.pageTabs}
            items={[
              {
                key: "tasks",
                label:
                  activeTaskCount > 0
                    ? `${t("dataConnect.discoverTabTasks")} (${activeTaskCount})`
                    : t("dataConnect.discoverTabTasks"),
                children: tasksPanel,
              },
              {
                key: "schedules",
                label: t("dataConnect.discoverTabSchedules"),
                children: schedulesPanel,
              },
            ]}
            onChange={(key) => {
              changeActiveTab(key as DataConnectDiscoverTab);
            }}
          />
        )}
      </section>
      {scheduleModalState && catalogAccessConfirmed ? (
        <DiscoverScheduleFormModal
          catalogs={catalogs}
          defaultCatalogId={scheduleModalState.mode === "create" ? selectedCatalogId : undefined}
          initialValue={scheduleModalState.mode === "edit" ? editingSchedule : null}
          mode={scheduleModalState.mode}
          onCancel={() => {
            setScheduleModalSubmitting(false);
            setScheduleModalState(null);
            setEditingSchedule(null);
          }}
          onSubmit={handleScheduleSubmit}
          open
          submitting={scheduleModalSubmitting}
        />
      ) : null}
      {catalogAccessConfirmed ? (
        <DiscoverRunNowModal
          connectionName={
            catalogNameMap.get(selectedCatalogId) ?? selectedCatalogId
          }
          onCancel={() => {
            setRunNowOpen(false);
          }}
          onSubmit={async (strategy) => {
            const catalogIdentity = catalogInteractionIdentityRef.current;
            try {
              setRunNowSubmitting(true);
              const result = await runDiscover(selectedCatalogId, strategy);
              if (
                !result ||
                catalogInteractionIdentityRef.current !== catalogIdentity
              ) {
                return;
              }
              setRunNowOpen(false);
            } catch (error) {
              if (catalogInteractionIdentityRef.current === catalogIdentity) {
                void message.error(extractRequestErrorMessage(error));
              }
            } finally {
              if (catalogInteractionIdentityRef.current === catalogIdentity) {
                setRunNowSubmitting(false);
              }
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
