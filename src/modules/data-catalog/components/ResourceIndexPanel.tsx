/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { ExclamationCircleOutlined } from "@ant-design/icons";
import { Alert, Space } from "antd";
import type { ColumnsType } from "antd/es/table";
import type { TFunction } from "i18next";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { PermissionGate } from "@/framework/permission/PermissionGate";
import { formatDateTime } from "@/framework/i18n/format";
import { AppButton } from "@/framework/ui/common/AppButton";
import { AppTable } from "@/framework/ui/common/AppTable";
import { TablePaginationBar } from "@/framework/ui/common/TablePaginationBar";
import { TableSurface } from "@/framework/ui/common/TableSurface";
import { BuildProgress } from "@/modules/data-catalog/components/BuildProgress";
import { BuildTaskDetailDrawer } from "@/modules/data-catalog/components/BuildTaskDetailDrawer";
import { BuildTaskLaunchPanel } from "@/modules/data-catalog/components/BuildTaskLaunchPanel";
import { IndexConfigFormPanel } from "@/modules/data-catalog/components/IndexConfigFormPanel";
import { useBuildTaskActions } from "@/modules/data-catalog/hooks/use-build-task-actions";
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
import {
  buildTaskStatusLabelKey,
} from "@/modules/data-catalog/services/build-task.service";
import { getCatalogResource } from "@/modules/data-catalog/services/resource.service";
import type { BuildTask, CatalogResource } from "@/modules/data-catalog/types/data-catalog";
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

const ACTIVE_TASK_STATUSES = new Set<BuildTask["status"]>([
  "pending",
  "running",
  "listening",
  "paused",
]);

function formatTaskStatus(task: BuildTask, t: TFunction) {
  return t(`dataCatalog.task.statuses.${buildTaskStatusLabelKey(task.status, task.mode)}`);
}

function formatEffectiveState(task: BuildTask, t: TFunction) {
  if (task.mode === "streaming" && task.status === "listening") {
    return t("dataCatalog.indexState.listening");
  }
  if (task.status === "paused") {
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
        time: formatDateTime(effective.finishTime),
      }),
    );
  }

  return parts.join(" · ");
}

function progressTask(effective: BuildTask | null, latest: BuildTask | null) {
  if (latest && ACTIVE_TASK_STATUSES.has(latest.status)) {
    if (
      effective &&
      effective.id === latest.id &&
      latest.status === "listening" &&
      latest.mode === "streaming"
    ) {
      return null;
    }
    if (effective && effective.id === latest.id && latest.status === "succeeded") {
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
  const navigate = useNavigate();
  const [taskPage, setTaskPage] = useState(1);
  const [taskPageSize, setTaskPageSize] = useState(10);
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  const { pauseOrResume, remove, retry } = useBuildTaskActions(onRefresh);
  const [detailResource, setDetailResource] = useState<CatalogResource>(resource);
  const autoPickedRef = useRef(false);

  const reloadResource = () => {
    void getCatalogResource(resource.id).then((detail) => {
      if (detail) {
        setDetailResource(detail);
      }
    });
  };

  useEffect(() => {
    setDetailResource(resource);
    autoPickedRef.current = false;
    let cancelled = false;
    void getCatalogResource(resource.id).then((detail) => {
      if (!cancelled && detail) {
        setDetailResource(detail);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [resource]);

  const sortedTasks = useMemo(() => sortTasks(tasks), [tasks]);
  const state = useMemo(() => indexStateOf(sortedTasks), [sortedTasks]);
  const gate = resourceGateOf(catalog);
  const resourceBlockReason = resourceQueryBlockReason(detailResource);
  const buildActionsDisabled = !gate.ok || resourceBlockReason !== null;
  const readOnly = isResourceIndexReadOnly(catalog);
  const canManageBuildTasks = canManageResourceBuildTasks(resource, catalog);
  const canViewTasks = canViewResourceIndexTasks(resource);
  const effective = state.effective;
  const latest = state.latest;
  const activeTask = latest && ACTIVE_TASK_STATUSES.has(latest.status) ? latest : null;
  const progressSource = progressTask(effective, latest);

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
  }, [resource.id]);

  const pagedTasks = useMemo(() => {
    const start = (taskPage - 1) * taskPageSize;
    return sortedTasks.slice(start, start + taskPageSize);
  }, [sortedTasks, taskPage, taskPageSize]);

  const pauseResumeLabel =
    activeTask?.status === "paused"
      ? t(
          activeTask.mode === "streaming"
            ? "dataCatalog.task.resumeListening"
            : "dataCatalog.task.resumeBuild",
        )
      : t(
          activeTask?.mode === "streaming" && activeTask.status === "listening"
            ? "dataCatalog.task.pauseListening"
            : "dataCatalog.task.stopBuild",
        );

  const pauseResumeLabelOf = (task: BuildTask) =>
    task.status === "paused"
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
    },
    {
      dataIndex: "status",
      title: t("common.status"),
      width: 108,
      render: (_value, record) => formatTaskStatus(record, t),
    },
    {
      dataIndex: "mode",
      title: t("common.mode"),
      width: 100,
      render: (value: BuildTask["mode"]) => t(`dataCatalog.modes.${value}`),
    },
    {
      key: "progress",
      title: t("dataCatalog.task.progress"),
      width: 196,
      render: (_value, record) => <BuildProgress compact task={record} />,
    },
    {
      dataIndex: "createTime",
      title: t("dataConnect.createTime"),
      width: 180,
      render: (value: number) => formatDateTime(value || undefined),
    },
    {
      key: "actions",
      title: t("common.actions"),
      width: 160,
      fixed: "right",
      render: (_value, record) => (
        <Space className={panelStyles.historyActionGroup} size={4}>
          <AppButton onClick={() => setDetailTaskId(record.id)} type="link">
            {t("common.detail")}
          </AppButton>
          {canManageBuildTasks && ACTIVE_TASK_STATUSES.has(record.status) ? (
            <PermissionGate permissions="catalog:task_manage">
              <AppButton onClick={() => void pauseOrResume(record)} type="link">
                {pauseResumeLabelOf(record)}
              </AppButton>
            </PermissionGate>
          ) : null}
          {canManageBuildTasks && record.status === "failed" ? (
            <PermissionGate permissions="catalog:task_manage">
              <AppButton onClick={() => void retry(record)} type="link">
                {t("dataCatalog.task.rerun")}
              </AppButton>
            </PermissionGate>
          ) : null}
          {canManageBuildTasks ? (
            <PermissionGate permissions="catalog:task_manage">
              <AppButton danger onClick={() => remove(record)} type="link">
                {t("common.delete")}
              </AppButton>
            </PermissionGate>
          ) : null}
        </Space>
      ),
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
            reloadResource();
            void onRefresh();
          }}
          readOnly={readOnly}
          resource={detailResource}
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
              {statusSummary ?? t("dataCatalog.resource.noEffectiveIndex")}
            </span>
          </div>
          <div className={panelStyles.sectionActions}>
            {canManageBuildTasks && activeTask &&
            (activeTask.status === "listening" ||
              activeTask.status === "running" ||
              activeTask.status === "pending") ? (
              <PermissionGate permissions="catalog:task_manage">
                <AppButton onClick={() => void pauseOrResume(activeTask)} size="small">
                  {pauseResumeLabel}
                </AppButton>
              </PermissionGate>
            ) : null}
            {canManageBuildTasks && activeTask?.status === "paused" ? (
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
                resource={detailResource}
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
        </div>
        <TableSurface className={panelStyles.tableSurface}>
          <AppTable<BuildTask>
            columns={taskColumns}
            dataSource={pagedTasks}
            locale={{ emptyText: t("dataCatalog.resource.historyEmpty") }}
            pagination={false}
            rowKey="id"
          />
        </TableSurface>
        {sortedTasks.length > 0 ? (
          <TablePaginationBar
            current={taskPage}
            onChange={(nextPage, nextPageSize) => {
              setTaskPage(nextPage);
              setTaskPageSize(nextPageSize);
            }}
            pageSize={taskPageSize}
            showSizeChanger
            showTotal={(count) => t("common.total", { total: count })}
            total={sortedTasks.length}
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
