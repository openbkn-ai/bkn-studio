/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { ExclamationCircleOutlined } from "@ant-design/icons";
import { Alert } from "antd";
import type { ColumnsType } from "antd/es/table";
import type { TFunction } from "i18next";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { PermissionGate } from "@/framework/permission/PermissionGate";
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
import {
  buildTaskStatusLabelKey,
  embeddingStateOf,
} from "@/modules/data-catalog/services/build-task.service";
import { getCatalogResource } from "@/modules/data-catalog/services/resource.service";
import type { BuildTask, CatalogResource } from "@/modules/data-catalog/types/data-catalog";
import { indexFormValuesFromResource } from "@/modules/data-catalog/utils/resource-index-config";
import { listSmallModels } from "@/modules/model-resources/services/small-model.service";
import type { SmallModel } from "@/modules/model-resources/types/small-model";
import type { CatalogRecord } from "@/shared/catalog";

import panelStyles from "./ResourceIndexPanel.module.css";

export type { ResourceIndexView };

type ResourceIndexPanelProps = {
  active: boolean;
  catalog: CatalogRecord | null;
  /** When false, panel may auto-pick config vs tasks once after resource loads. */
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
  const embeddingState = embeddingStateOf(task);
  if (embeddingState === "failed") {
    return t("dataCatalog.task.statuses.embeddingFailed");
  }
  if (embeddingState === "partial") {
    return t("dataCatalog.task.statuses.embeddingPartial");
  }
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

function formatEmbeddingModelDisplay(
  modelId: string | null | undefined,
  dimensions: number | null | undefined,
  models: SmallModel[],
) {
  const rawModel = modelId?.trim();
  if (!rawModel) {
    return "-";
  }

  const match = models.find(
    (item) => item.modelId === rawModel || item.modelName === rawModel,
  );
  const name = match?.modelName || rawModel;
  const resolvedDimensions = match?.embeddingDim ?? dimensions ?? 0;
  return resolvedDimensions > 0 ? `${name} - ${resolvedDimensions}d` : name;
}

function buildStatusSummary(
  effective: BuildTask | null,
  t: TFunction,
  language: string,
  models: SmallModel[],
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

  if (effective.embeddingModel) {
    parts.push(
      formatEmbeddingModelDisplay(
        effective.embeddingModel,
        effective.modelDimensions,
        models,
      ),
    );
  }

  if (effective.mode === "streaming") {
    parts.push(
      t("dataCatalog.indexWorkspace.lastEventShort", {
        time: timeAgo(effective.lastEventAt ?? effective.createdAt, language),
      }),
    );
  } else if (effective.finishTime) {
    parts.push(
      t("dataCatalog.indexWorkspace.finishedAtShort", {
        time: effective.finishTime,
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
  const summary = summarizeBuildTaskError(task.error || task.failureDetail, language);
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
  const [detailTask, setDetailTask] = useState<BuildTask | null>(null);
  const { pauseOrResume, retry } = useBuildTaskActions(onRefresh);
  const [detailResource, setDetailResource] = useState<CatalogResource>(resource);
  const [models, setModels] = useState<SmallModel[]>([]);
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

  useEffect(() => {
    if (!active) {
      return;
    }

    let alive = true;
    void listSmallModels({ modelType: "embedding", page: 1, size: 200 })
      .then((result) => {
        if (alive) {
          setModels(result.items);
        }
      })
      .catch(() => {
        if (alive) {
          setModels([]);
        }
      });
    return () => {
      alive = false;
    };
  }, [active]);

  const sortedTasks = useMemo(() => sortTasks(tasks), [tasks]);
  const state = useMemo(() => indexStateOf(sortedTasks), [sortedTasks]);
  const gate = resourceGateOf(catalog);
  const effective = state.effective;
  const latest = state.latest;
  const activeTask = latest && ACTIVE_TASK_STATUSES.has(latest.status) ? latest : null;
  const progressSource = progressTask(effective, latest);

  const resourceConfig = useMemo(
    () => indexFormValuesFromResource(detailResource),
    [detailResource],
  );
  const hasResourceConfig =
    resourceConfig.embeddingFields.length > 0 ||
    resourceConfig.fulltextFields.length > 0;

  useEffect(() => {
    if (!active || indexViewExplicit || autoPickedRef.current) {
      return;
    }
    const next: ResourceIndexView =
      hasResourceConfig || sortedTasks.length > 0 ? "tasks" : "config";
    autoPickedRef.current = true;
    if (next !== indexView) {
      onIndexViewChange(next);
    }
  }, [
    active,
    hasResourceConfig,
    indexView,
    indexViewExplicit,
    onIndexViewChange,
    sortedTasks.length,
  ]);

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

  const taskColumns: ColumnsType<BuildTask> = [
    {
      dataIndex: "status",
      title: t("common.status"),
      render: (_value, record) => formatTaskStatus(record, t),
    },
    {
      dataIndex: "mode",
      title: t("common.mode"),
      render: (value: BuildTask["mode"]) => t(`dataCatalog.modes.${value}`),
    },
    {
      dataIndex: "embeddingModel",
      title: t("dataCatalog.task.model"),
      render: (value: string, record) =>
        formatEmbeddingModelDisplay(value, record.modelDimensions, models),
    },
    {
      dataIndex: "createTime",
      title: t("dataConnect.createTime"),
    },
    {
      key: "actions",
      title: t("common.actions"),
      render: (_value, record) => (
        <AppButton onClick={() => setDetailTask(record)} type="link">
          {t("common.detail")}
        </AppButton>
      ),
    },
  ];

  const statusSummary = buildStatusSummary(effective, t, i18n.language, models);

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
          onSaved={() => {
            reloadResource();
            void onRefresh();
          }}
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
            {activeTask &&
            (activeTask.status === "listening" ||
              activeTask.status === "running" ||
              activeTask.status === "pending") ? (
              <PermissionGate permissions="resource:task_manage">
                <AppButton onClick={() => void pauseOrResume(activeTask)} size="small">
                  {pauseResumeLabel}
                </AppButton>
              </PermissionGate>
            ) : null}
            {activeTask?.status === "paused" ? (
              <PermissionGate permissions="resource:task_manage">
                <AppButton
                  disabled={!gate.ok}
                  onClick={() => void pauseOrResume(activeTask)}
                  size="small"
                >
                  {pauseResumeLabel}
                </AppButton>
              </PermissionGate>
            ) : null}
            {latest?.status === "failed" ? (
              <PermissionGate permissions="resource:task_manage">
                <AppButton
                  disabled={!gate.ok}
                  onClick={() => {
                    if (latest) {
                      void retry(latest);
                    }
                  }}
                  size="small"
                >
                  {t("dataCatalog.task.rebuild")}
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
        ) : latest?.status === "failed" && (latest.error || latest.failureDetail) ? (
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

        <div className={panelStyles.launchSection}>
          <div className={panelStyles.launchSectionHead}>
            <h3 className={panelStyles.sectionTitle}>
              {t("dataCatalog.indexWorkspace.launchTitle")}
            </h3>
          </div>
          <PermissionGate permissions="resource:task_manage">
            <BuildTaskLaunchPanel
              active={active && indexView === "tasks"}
              disabled={!gate.ok}
              onGoConfigure={() => onIndexViewChange("config")}
              onStarted={() => {
                void onRefresh();
              }}
              resource={detailResource}
            />
          </PermissionGate>
        </div>
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
          </div>
        </div>

        {indexView === "config" ? renderConfigTab() : renderTasksTab()}
      </div>

      {detailTask ? (
        <BuildTaskDetailDrawer
          onClose={() => setDetailTask(null)}
          open
          resource={resource}
          task={detailTask}
        />
      ) : null}
    </>
  );
}
