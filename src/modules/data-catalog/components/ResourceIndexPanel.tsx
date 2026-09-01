/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  DeleteOutlined,
  EllipsisOutlined,
  ExclamationCircleOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { Alert, Dropdown, Space, type MenuProps } from "antd";
import type { ColumnsType, TableProps } from "antd/es/table";
import type { TFunction } from "i18next";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import { hasPermissions } from "@/framework/permission/has-permissions";
import { PermissionGate } from "@/framework/permission/PermissionGate";
import { formatDateTimeYmdHms } from "@/framework/i18n/format";
import { AppButton } from "@/framework/ui/common/AppButton";
import { AppTable } from "@/framework/ui/common/AppTable";
import { TablePaginationBar } from "@/framework/ui/common/TablePaginationBar";
import { TableSurface } from "@/framework/ui/common/TableSurface";
import { BuildProgress } from "@/modules/data-catalog/components/BuildProgress";
import { BuildStatusTag } from "@/modules/data-catalog/components/BuildStatusTag";
import { BuildTaskDetailDrawer } from "@/modules/data-catalog/components/BuildTaskDetailDrawer";
import { BuildTaskLaunchPanel } from "@/modules/data-catalog/components/BuildTaskLaunchPanel";
import { IndexConfigFormPanel } from "@/modules/data-catalog/components/IndexConfigFormPanel";
import { useBuildTaskActions } from "@/modules/data-catalog/hooks/use-build-task-actions";
import { deleteBuildTask } from "@/modules/data-catalog/services/build-task.service";
import { summarizeBuildTaskError } from "@/modules/data-catalog/lib/build-task-error";
import type { ResourceIndexView } from "@/modules/data-catalog/lib/index-build-filters";
import { formatCount, timeAgo } from "@/modules/data-catalog/lib/format";
import { indexStateOf, resourceGateOf, sortTasks } from "@/modules/data-catalog/lib/index-state";
import { resourceQueryBlockReason } from "@/modules/data-catalog/lib/resource-query-availability";
import {
  canManageResourceBuildTasks,
  canViewResourceIndexTasks,
  isResourceIndexReadOnly,
} from "@/modules/data-catalog/lib/resource-index-access";
import type {
  BuildMode,
  BuildTask,
  BuildTaskExecuteType,
  BuildTaskSort,
  BuildTaskStatus,
  CatalogResource,
} from "@/modules/data-catalog/types/data-catalog";
import { isActiveBuildTask } from "@/modules/data-catalog/utils/build-task-guards";
import type { CatalogRecord } from "@/shared/catalog";

import panelStyles from "./ResourceIndexPanel.module.css";

export type { ResourceIndexView };

type ResourceIndexPanelProps = {
  active: boolean;
  catalog: CatalogRecord | null;
  /** When false, panel opens the configuration view once after resource loads. */
  indexViewExplicit?: boolean;
  indexView: ResourceIndexView;
  onIndexViewChange: (view: ResourceIndexView) => void;
  onRefresh: () => Promise<void> | void;
  resource: CatalogResource;
  tasks: BuildTask[];
};

const CONTROLLABLE_TASK_STATUSES = new Set<BuildTask["status"]>([
  "pending",
  "running",
  "stopped",
]);

const STATUS_OPTIONS: BuildTaskStatus[] = [
  "pending",
  "running",
  "stopping",
  "stopped",
  "completed",
  "failed",
  "cancelled",
];

function formatEffectiveState(task: BuildTask, t: TFunction) {
  if (task.mode === "streaming" && task.status === "running") {
    return t("dataCatalog.indexState.listening");
  }
  if (task.status === "stopped") {
    return t("dataCatalog.indexState.paused");
  }
  return t("dataCatalog.resource.effectiveActive");
}

function buildStatusSummary(
  effective: BuildTask | null,
  t: TFunction,
  language: string,
) {
  if (!effective) {
    return null;
  }

  const parts = [
    formatEffectiveState(effective, t),
    t(`dataCatalog.modes.${effective.mode}`),
    t("dataCatalog.indexWorkspace.indexedRowsShort", {
      count: formatCount(
        effective.mode === "streaming" ? effective.syncedCount : effective.totalCount,
      ) as never,
    }),
  ];

  if (effective.mode === "streaming") {
    parts.push(
      t("dataCatalog.indexWorkspace.lastEventShort", {
        time: timeAgo(effective.lastProgressTime ?? effective.createTime, language),
      }),
    );
  } else if (effective.finishTime) {
    parts.push(
      t("dataCatalog.indexWorkspace.finishedAtShort", {
        time: formatDateTimeYmdHms(effective.finishTime),
      }),
    );
  }

  return parts.join(" · ");
}

function progressTask(effective: BuildTask | null, latest: BuildTask | null) {
  if (latest && CONTROLLABLE_TASK_STATUSES.has(latest.status)) {
    if (
      effective &&
      effective.id === latest.id &&
      latest.status === "running" &&
      latest.mode === "streaming"
    ) {
      return null;
    }
    if (effective && effective.id === latest.id && latest.status === "completed") {
      return null;
    }
    return latest;
  }

  return null;
}

function renderBuildFailureAlert(
  task: BuildTask,
  language: string,
  rawErrorLabel: string,
) {
  const summary = summarizeBuildTaskError(task.error, language);
  if (!summary) {
    return null;
  }

  return (
    <div className={panelStyles.failureAlertContent}>
      <strong>{summary.title}</strong>
      <span>{summary.message}</span>
      {summary.suggestion ? (
        <span className={panelStyles.failureSuggestion}>{summary.suggestion}</span>
      ) : null}
      <details className={panelStyles.failureRaw}>
        <summary>{rawErrorLabel}</summary>
        <code>{summary.raw}</code>
      </details>
    </div>
  );
}

export function ResourceIndexPanel({
  active,
  catalog,
  indexView,
  indexViewExplicit = false,
  onIndexViewChange,
  onRefresh,
  resource,
  tasks,
}: ResourceIndexPanelProps) {
  const { i18n, t } = useTranslation();
  const { message, modal, runtimeConfig } = useAppServices();
  const navigate = useNavigate();
  const [taskPage, setTaskPage] = useState(1);
  const [taskPageSize, setTaskPageSize] = useState(10);
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [modeFilter, setModeFilter] = useState<BuildMode>();
  const [executeTypeFilter, setExecuteTypeFilter] = useState<BuildTaskExecuteType>();
  const [statusFilter, setStatusFilter] = useState<BuildTaskStatus[]>([]);
  const [sort, setSort] = useState<BuildTaskSort>("create_time");
  const [direction, setDirection] = useState<"asc" | "desc">("desc");
  const { pauseOrResume, remove, retry } = useBuildTaskActions(onRefresh);
  const autoPickedRef = useRef(false);

  useEffect(() => {
    autoPickedRef.current = false;
  }, [resource.id]);

  const sortedTasks = useMemo(() => sortTasks(tasks), [tasks]);
  const state = useMemo(
    () => indexStateOf(sortedTasks, resource.localIndexStatus),
    [resource.localIndexStatus, sortedTasks],
  );
  const gate = resourceGateOf(catalog);
  const resourceBlockReason = resourceQueryBlockReason(resource);
  const buildActionsDisabled = !gate.ok || resourceBlockReason !== null;
  const readOnly = isResourceIndexReadOnly(catalog);
  const canManageBuildTasks = canManageResourceBuildTasks(resource, catalog);
  const canManageTaskActions =
    canManageBuildTasks &&
    hasPermissions({
      currentPermissions: runtimeConfig.currentUser.permissions,
      requiredPermissions: "catalog:task_manage",
    });
  const canViewTasks = canViewResourceIndexTasks(resource);
  const effective = state.effective;
  const latest = state.latest;
  const activeTask = latest && CONTROLLABLE_TASK_STATUSES.has(latest.status) ? latest : null;
  const progressSource = progressTask(effective, latest);
  const filteredTasks = useMemo(() => {
    const timestampOf = (task: BuildTask) => {
      if (sort === "last_progress_time") return task.lastProgressTime ?? 0;
      if (sort === "finish_time") return task.finishTime ?? 0;
      return task.createTime;
    };
    return sortedTasks
      .filter((task) =>
        (!modeFilter || task.mode === modeFilter) &&
        (!executeTypeFilter || task.executeType === executeTypeFilter) &&
        (statusFilter.length === 0 || statusFilter.includes(task.status)),
      )
      .sort((left, right) => (timestampOf(left) - timestampOf(right)) * (direction === "asc" ? 1 : -1));
  }, [direction, executeTypeFilter, modeFilter, sort, sortedTasks, statusFilter]);
  const batchDeleteTargets = filteredTasks.filter(
    (task) => selectedKeys.includes(task.id) && !isActiveBuildTask(task),
  );

  const handleBatchDelete = () => {
    if (!batchDeleteTargets.length) return;
    void modal.confirm({
      title: t("dataCatalog.task.batchDeleteConfirmTitle", { count: batchDeleteTargets.length }),
      content: t("dataCatalog.task.batchDeleteConfirmContent"),
      okText: t("common.delete"),
      cancelText: t("common.cancel"),
      okButtonProps: { danger: true },
      onOk: async () => {
        const results = await Promise.allSettled(
          batchDeleteTargets.map((task) => deleteBuildTask(task.id)),
        );
        const failed = results.filter((result) => result.status === "rejected").length;
        if (failed) {
          void message.error(
            t("dataCatalog.task.batchDeletePartial", {
              failed,
              total: batchDeleteTargets.length,
            }),
          );
        } else {
          message.success(t("common.success"));
        }
        setSelectedKeys([]);
        await onRefresh();
      },
    });
  };

  useEffect(() => {
    if (!active || indexViewExplicit || autoPickedRef.current) {
      return;
    }
    autoPickedRef.current = true;
    if (indexView !== "config") {
      onIndexViewChange("config");
    }
  }, [
    active,
    indexView,
    indexViewExplicit,
    onIndexViewChange,
  ]);

  useEffect(() => {
    if (!canViewTasks && indexView === "tasks") {
      onIndexViewChange("config");
    }
  }, [canViewTasks, indexView, onIndexViewChange]);

  useEffect(() => {
    setTaskPage(1);
    setSelectedKeys([]);
    setModeFilter(undefined);
    setExecuteTypeFilter(undefined);
    setStatusFilter([]);
    setSort("create_time");
    setDirection("desc");
    setDetailTaskId(null);
  }, [resource.id]);

  const pagedTasks = useMemo(() => {
    const start = (taskPage - 1) * taskPageSize;
    return filteredTasks.slice(start, start + taskPageSize);
  }, [filteredTasks, taskPage, taskPageSize]);

  const updateTaskFilters = (patch: {
    executeType?: BuildTaskExecuteType;
    mode?: BuildMode;
    statuses?: BuildTaskStatus[];
  }) => {
    if ("mode" in patch) setModeFilter(patch.mode);
    if ("executeType" in patch) setExecuteTypeFilter(patch.executeType);
    if ("statuses" in patch) setStatusFilter(patch.statuses ?? []);
    setTaskPage(1);
  };
  const sortOrderOf = (key: BuildTaskSort): "ascend" | "descend" | null =>
    sort === key ? (direction === "asc" ? "ascend" : "descend") : null;
  const handleTaskTableChange: TableProps<BuildTask>["onChange"] = (
    _pagination,
    _filters,
    sorter,
    extra,
  ) => {
    if (extra.action !== "sort") return;
    const single = Array.isArray(sorter) ? sorter[0] : sorter;
    if (!single?.order || !single.columnKey) {
      setSort("create_time");
      setDirection("desc");
    } else {
      setSort(single.columnKey as BuildTaskSort);
      setDirection(single.order === "ascend" ? "asc" : "desc");
    }
    setTaskPage(1);
  };

  const pauseResumeLabel =
    activeTask?.status === "stopped"
      ? t(
        activeTask.mode === "streaming"
          ? "dataCatalog.task.resumeListening"
          : "dataCatalog.task.resumeBuild",
      )
      : t(
        activeTask?.mode === "streaming" && activeTask.status === "running"
          ? "dataCatalog.task.pauseListening"
          : "dataCatalog.task.stopBuild",
      );

  const pauseResumeLabelOf = (task: BuildTask) =>
    task.status === "stopped"
      ? t(
        task.mode === "streaming"
          ? "dataCatalog.task.resumeListening"
          : "dataCatalog.task.resumeBuild",
      )
      : t(
        task.mode === "streaming"
          ? "dataCatalog.task.pauseListening"
          : "dataCatalog.task.stopBuild",
      );

  const taskColumns: ColumnsType<BuildTask> = [
    {
      dataIndex: "id",
      title: t("dataCatalog.taskManagement.columns.task"),
      width: 160,
      render: (value: string) => <button className={panelStyles.textLink} onClick={() => setDetailTaskId(value)} type="button">{value}</button>,
    },
    {
      dataIndex: "mode",
      title: t("dataCatalog.build.mode"),
      width: 100,
      filters: ["batch", "streaming"].map((value) => ({ text: t(`dataCatalog.modes.${value}`), value })),
      filterMultiple: false,
      filteredValue: modeFilter ? [modeFilter] : null,
      render: (value: BuildTask["mode"]) => t(`dataCatalog.modes.${value}`),
    },
    {
      dataIndex: "executeType",
      title: t("dataCatalog.build.executeType"),
      width: 100,
      filters: ["full", "incremental"].map((value) => ({ text: t(value === "incremental" ? "dataCatalog.build.executeIncremental" : "dataCatalog.build.executeFull"), value })),
      filterMultiple: false,
      filteredValue: executeTypeFilter ? [executeTypeFilter] : null,
      render: (_value, record) =>
        record.mode === "batch"
          ? record.executeType === "incremental"
            ? t("dataCatalog.build.executeIncremental")
            : record.executeType === "full"
              ? t("dataCatalog.build.executeFull")
              : "-"
          : "-",
    },
    {
      dataIndex: "status",
      title: t("dataCatalog.task.detailSections.status"),
      width: 120,
      filters: STATUS_OPTIONS.map((value) => ({ text: t(`dataCatalog.task.statuses.${value}`), value })),
      filteredValue: statusFilter.length ? statusFilter : null,
      render: (_value, record) => <BuildStatusTag task={record} />,
    },
    {
      key: "progress",
      title: t("dataCatalog.task.progress"),
      width: 200,
      render: (_value, record) => <BuildProgress compact task={record} />,
    },
    {
      dataIndex: "lastProgressTime",
      key: "last_progress_time",
      title: t("dataCatalog.task.fields.lastProgressTime"),
      width: 180,
      sorter: true,
      sortOrder: sortOrderOf("last_progress_time"),
      render: (value: number | null) => formatDateTimeYmdHms(value || undefined),
    },
    {
      dataIndex: "finishTime",
      key: "finish_time",
      title: t("dataCatalog.task.finishedAt"),
      width: 180,
      sorter: true,
      sortOrder: sortOrderOf("finish_time"),
      render: (value: number | null) => formatDateTimeYmdHms(value || undefined),
    },
    {
      dataIndex: "createTime",
      key: "create_time",
      title: t("dataConnect.createTime"),
      width: 180,
      sorter: true,
      sortOrder: sortOrderOf("create_time"),
      render: (value: number) => formatDateTimeYmdHms(value || undefined),
    },
    {
      key: "actions",
      title: t("common.actions"),
      align: "center",
      width: 84,
      fixed: "right",
      render: (_value, record) => {
        const menuItems: NonNullable<MenuProps["items"]> = [
          { key: "detail", label: t("common.detail") },
        ];
        if (canManageTaskActions && CONTROLLABLE_TASK_STATUSES.has(record.status)) {
          menuItems.push({ key: "pauseResume", label: pauseResumeLabelOf(record) });
        }
        if (canManageTaskActions && record.status === "failed") {
          menuItems.push({ key: "retry", label: t("dataCatalog.task.rerun") });
        }
        if (canManageTaskActions && !isActiveBuildTask(record)) {
          menuItems.push({ danger: true, key: "delete", label: t("common.delete") });
        }
        return (
          <Dropdown
            menu={{
              items: menuItems,
              onClick: ({ key, domEvent }) => {
                domEvent.stopPropagation();
                if (key === "detail") setDetailTaskId(record.id);
                if (key === "pauseResume") void pauseOrResume(record);
                if (key === "retry") void retry(record);
                if (key === "delete") void remove(record);
              },
            }}
            trigger={["click"]}
          >
            <AppButton aria-label={t("dataConnect.moreActions")} icon={<EllipsisOutlined />} type="link" />
          </Dropdown>
        );
      },
    },
  ];

  const statusSummary = buildStatusSummary(effective, t, i18n.language);

  const gateBanner =
    !gate.ok && catalog ? (
      <div className={panelStyles.calloutWarn}>
        <ExclamationCircleOutlined />
        <span>
          {t("dataCatalog.gate.catalogDisabled", { name: catalog.name })}{" "}
          <button
            className={panelStyles.textLink}
            onClick={() => {
              void navigate("/data-connect");
            }}
            type="button"
          >
            {t("dataCatalog.gate.goEnable")}
          </button>
        </span>
      </div>
    ) : null;

  const renderConfigTab = () => (
    <>
      {gateBanner}
      <div className={panelStyles.configureCard}>
        <IndexConfigFormPanel
          active={active && indexView === "config"}
          hideBuildControls={readOnly}
          onSaved={() => {
            void onRefresh();
          }}
          readOnly={readOnly}
          resource={resource}
        />
      </div>
    </>
  );

  const renderTasksTab = () => (
    <>
      {gateBanner}

      <div className={panelStyles.opsCard}>
        <div className={panelStyles.statusStrip}>
          <div className={panelStyles.statusStripMain}>
            <span className={panelStyles.statusStripLabel}>
              {t("dataCatalog.indexWorkspace.statusCardTitle")}
            </span>
            <span className={panelStyles.statusStripValue}>
              {statusSummary ??
                (resource.localIndexStatus === "available"
                  ? t("dataCatalog.resource.effectiveActive")
                  : t("dataCatalog.resource.noEffectiveIndex"))}
            </span>
          </div>
          <div className={panelStyles.sectionActions}>
            {canManageBuildTasks && activeTask &&
              (activeTask.status === "running" ||
                activeTask.status === "pending") ? (
              <PermissionGate permissions="catalog:task_manage">
                <AppButton onClick={() => void pauseOrResume(activeTask)} size="small">
                  {pauseResumeLabel}
                </AppButton>
              </PermissionGate>
            ) : null}
            {canManageBuildTasks && activeTask?.status === "stopped" ? (
              <PermissionGate permissions="catalog:task_manage">
                <AppButton
                  disabled={buildActionsDisabled}
                  onClick={() => void pauseOrResume(activeTask)}
                  size="small"
                >
                  {pauseResumeLabel}
                </AppButton>
              </PermissionGate>
            ) : null}
            {canManageBuildTasks && latest?.status === "failed" ? (
              <PermissionGate permissions="catalog:task_manage">
                <AppButton
                  disabled={buildActionsDisabled}
                  onClick={() => {
                    if (latest) {
                      void retry(latest);
                    }
                  }}
                  size="small"
                >
                  {t("dataCatalog.task.rerun")}
                </AppButton>
              </PermissionGate>
            ) : null}
          </div>
        </div>

        {progressSource ? (
          <div className={panelStyles.progressBlock}>
            <BuildProgress task={progressSource} />
          </div>
        ) : null}

        {latest?.status === "failed" && effective ? (
          <Alert
            className={panelStyles.statusAlert}
            message={t("dataCatalog.resource.rebuildFailedTitle", {
              version: effective.id,
            })}
            description={renderBuildFailureAlert(
              latest,
              i18n.language,
              t("dataCatalog.task.rawError"),
            )}
            showIcon
            type="warning"
          />
        ) : latest?.status === "failed" && latest.error ? (
          <Alert
            className={panelStyles.statusAlert}
            message={renderBuildFailureAlert(
              latest,
              i18n.language,
              t("dataCatalog.task.rawError"),
            )}
            showIcon
            type="error"
          />
        ) : null}

        {canManageBuildTasks ? (
          <div className={panelStyles.launchSection}>
            <div className={panelStyles.launchSectionHead}>
              <h3 className={panelStyles.sectionTitle}>
                {t("dataCatalog.indexWorkspace.launchTitle")}
              </h3>
            </div>
            <PermissionGate permissions="catalog:task_manage">
              <BuildTaskLaunchPanel
                active={active && indexView === "tasks"}
                disabled={buildActionsDisabled}
                onGoConfigure={() => onIndexViewChange("config")}
                onStarted={() => {
                  void onRefresh();
                }}
                resource={resource}
              />
            </PermissionGate>
          </div>
        ) : null}
      </div>

      <div className={panelStyles.sectionCard}>
        <div className={panelStyles.historyHead}>
          <h3 className={panelStyles.historyTitle}>
            {t("dataCatalog.resource.historyTasks")}
            {sortedTasks.length > 0 ? (
              <span className={panelStyles.historyCount}> ({sortedTasks.length})</span>
            ) : null}
          </h3>
          <div className={panelStyles.historyControls}>
            <Space>
              <AppButton icon={<ReloadOutlined />} onClick={() => void onRefresh()}>
                {t("common.refresh")}
              </AppButton>
              <PermissionGate permissions="catalog:task_manage">
                <AppButton
                  danger
                  disabled={batchDeleteTargets.length === 0}
                  icon={<DeleteOutlined />}
                  onClick={handleBatchDelete}
                >
                  {batchDeleteTargets.length > 0
                    ? `${t("dataCatalog.task.batchDelete")} (${batchDeleteTargets.length})`
                    : t("dataCatalog.task.batchDelete")}
                </AppButton>
              </PermissionGate>
            </Space>
          </div>
        </div>
        <TableSurface className={panelStyles.tableSurface}>
          <AppTable<BuildTask>
            columns={taskColumns}
            dataSource={pagedTasks}
            locale={{ emptyText: t("dataCatalog.resource.historyEmpty") }}
            onChange={(pagination, filters, sorter, extra) => {
              if (extra.action === "filter") {
                updateTaskFilters({
                  executeType: (filters.executeType?.[0] as BuildTaskExecuteType | undefined),
                  mode: filters.mode?.[0] as BuildMode | undefined,
                  statuses: (filters.status ?? []).map(String) as BuildTaskStatus[],
                });
                return;
              }
              handleTaskTableChange(pagination, filters, sorter, extra);
            }}
            pagination={false}
            rowKey="id"
            rowSelection={canManageTaskActions ? {
              selectedRowKeys: selectedKeys,
              onChange: (keys) => setSelectedKeys(keys.map(String)),
              getCheckboxProps: (task) => ({ disabled: isActiveBuildTask(task) }),
            } : undefined}
          />
        </TableSurface>
        {filteredTasks.length > 0 ? (
          <TablePaginationBar
            current={taskPage}
            onChange={(nextPage, nextPageSize) => {
              setTaskPage(nextPage);
              setTaskPageSize(nextPageSize);
            }}
            pageSize={taskPageSize}
            showSizeChanger
            showTotal={(count) => t("common.total", { total: count })}
            total={filteredTasks.length}
          />
        ) : null}
      </div>
    </>
  );

  return (
    <>
      <div className={panelStyles.panelRoot}>
        <div className={panelStyles.viewBar}>
          <div className={panelStyles.viewTabs} role="tablist">
            <button
              className={
                indexView === "config" ? panelStyles.viewTabActive : panelStyles.viewTab
              }
              onClick={() => onIndexViewChange("config")}
              role="tab"
              type="button"
            >
              {t("dataCatalog.indexWorkspace.viewConfig")}
            </button>
            {canViewTasks ? (
              <button
                className={
                  indexView === "tasks" ? panelStyles.viewTabActive : panelStyles.viewTab
                }
                onClick={() => onIndexViewChange("tasks")}
                role="tab"
                type="button"
              >
                {t("dataCatalog.indexWorkspace.viewTasks")}
              </button>
            ) : null}
          </div>
        </div>

        {!canViewTasks || indexView === "config" ? renderConfigTab() : renderTasksTab()}
      </div>

      {detailTaskId ? (
        <BuildTaskDetailDrawer
          onClose={() => setDetailTaskId(null)}
          open
          resource={resource}
          taskId={detailTaskId}
        />
      ) : null}
    </>
  );
}
