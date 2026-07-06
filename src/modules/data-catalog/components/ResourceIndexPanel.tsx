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
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { PermissionGate } from "@/framework/permission/PermissionGate";
import { AppButton } from "@/framework/ui/common/AppButton";
import { AppTable } from "@/framework/ui/common/AppTable";
import { TablePaginationBar } from "@/framework/ui/common/TablePaginationBar";
import { TableSurface } from "@/framework/ui/common/TableSurface";
import { BuildProgress } from "@/modules/data-catalog/components/BuildProgress";
import { BuildTaskDetailDrawer } from "@/modules/data-catalog/components/BuildTaskDetailDrawer";
import { BuildTaskFormPanel } from "@/modules/data-catalog/components/BuildTaskFormPanel";
import { useBuildTaskActions } from "@/modules/data-catalog/hooks/use-build-task-actions";
import type { ResourceIndexView } from "@/modules/data-catalog/lib/index-build-filters";
import { formatCount, timeAgo } from "@/modules/data-catalog/lib/format";
import { indexStateOf, resourceGateOf, sortTasks } from "@/modules/data-catalog/lib/index-state";
import {
  buildTaskStatusLabelKey,
  embeddingStateOf,
} from "@/modules/data-catalog/services/build-task.service";
import type { BuildTask, CatalogResource } from "@/modules/data-catalog/types/data-catalog";
import type { CatalogRecord } from "@/shared/catalog";

import panelStyles from "./ResourceIndexPanel.module.css";

export type { ResourceIndexView };

type ResourceIndexPanelProps = {
  active: boolean;
  catalog: CatalogRecord | null;
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

  if (effective.embeddingModel) {
    parts.push(`${effective.embeddingModel} · ${effective.modelDimensions}d`);
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
    if (
      effective &&
      effective.id === latest.id &&
      latest.status === "succeeded"
    ) {
      return null;
    }
    return latest;
  }
  return null;
}

export function ResourceIndexPanel({
  active,
  catalog,
  indexView,
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

  const sortedTasks = useMemo(() => sortTasks(tasks), [tasks]);
  const state = useMemo(() => indexStateOf(sortedTasks), [sortedTasks]);
  const gate = resourceGateOf(catalog);
  const effective = state.effective;
  const latest = state.latest;
  const activeTask = latest && ACTIVE_TASK_STATUSES.has(latest.status) ? latest : null;
  const progressSource = progressTask(effective, latest);

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
      render: (value: string, record) => `${value} · ${record.modelDimensions}d`,
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

  const statusSummary = buildStatusSummary(effective, t, i18n.language);
  const embeddingFieldText = effective?.embeddingFields.join(", ") || "—";
  const fulltextFieldText = effective?.fulltextFields.join(", ") || "—";

  const renderOverview = () => (
    <>
      {!gate.ok && catalog ? (
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
      ) : null}

      {!effective && !latest ? (
        <div className={panelStyles.emptyPanel}>
          <p className={panelStyles.emptyText}>{t("dataCatalog.resource.noIndexHint")}</p>
          <PermissionGate permissions="resource:task_manage">
            <AppButton
              disabled={!gate.ok}
              onClick={() => onIndexViewChange("configure")}
              type="primary"
            >
              {t("dataCatalog.indexWorkspace.startConfigure")}
            </AppButton>
          </PermissionGate>
        </div>
      ) : (
        <div className={panelStyles.sectionCard}>
          <div className={panelStyles.sectionHead}>
            <div>
              <h3 className={panelStyles.sectionTitle}>
                {t("dataCatalog.indexWorkspace.statusCardTitle")}
              </h3>
              {statusSummary ? (
                <p className={panelStyles.sectionSummary}>{statusSummary}</p>
              ) : (
                <p className={panelStyles.sectionSummary}>
                  {t("dataCatalog.resource.noEffectiveIndex")}
                </p>
              )}
            </div>
            <div className={panelStyles.sectionActions}>
              {activeTask &&
              (activeTask.status === "listening" ||
                activeTask.status === "running" ||
                activeTask.status === "pending") ? (
                <PermissionGate permissions="resource:task_manage">
                  <AppButton onClick={() => void pauseOrResume(activeTask)}>
                    {pauseResumeLabel}
                  </AppButton>
                </PermissionGate>
              ) : null}
              {activeTask?.status === "paused" ? (
                <PermissionGate permissions="resource:task_manage">
                  <AppButton disabled={!gate.ok} onClick={() => void pauseOrResume(activeTask)}>
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
                  >
                    {t("dataCatalog.task.rebuild")}
                  </AppButton>
                </PermissionGate>
              ) : null}
            </div>
          </div>

          {effective ? (
            <div className={panelStyles.metaGrid}>
              <MetaItem
                label={t("dataCatalog.resource.effectiveVersion")}
                value={effective.id}
              />
              {latest && latest.id !== effective.id ? (
                <MetaItem
                  label={t("dataCatalog.resource.latestTask")}
                  value={formatTaskStatus(latest, t)}
                />
              ) : (
                <MetaItem label={t("common.mode")} value={t(`dataCatalog.modes.${effective.mode}`)} />
              )}
              <MetaItem
                full
                label={t("dataCatalog.indexWorkspace.embeddingFields")}
                value={embeddingFieldText}
              />
              {effective.fulltextFields.length > 0 ? (
                <MetaItem
                  full
                  label={t("dataCatalog.indexWorkspace.fulltextFields")}
                  value={fulltextFieldText}
                />
              ) : null}
            </div>
          ) : null}

          {progressSource ? (
            <div className={panelStyles.progressBlock}>
              <BuildProgress task={progressSource} />
            </div>
          ) : null}

          {latest?.status === "failed" && effective ? (
            <Alert
              className={panelStyles.statusAlert}
              message={t("dataCatalog.resource.rebuildFailedHint", {
                error: latest.error ?? "-",
                version: effective.id,
              })}
              showIcon
              type="warning"
            />
          ) : latest?.error && latest.status === "failed" ? (
            <Alert
              className={panelStyles.statusAlert}
              message={latest.error}
              showIcon
              type="error"
            />
          ) : null}
        </div>
      )}

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

  const renderConfigure = () => (
    <>
      {!gate.ok && catalog ? (
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
      ) : null}

      <div className={panelStyles.configureCard}>
        <BuildTaskFormPanel
          active={active && indexView === "configure"}
          onSubmitted={() => {
            onIndexViewChange("overview");
            void onRefresh();
          }}
          resource={resource}
          showResourceSummary={false}
        />
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
                indexView === "overview" ? panelStyles.viewTabActive : panelStyles.viewTab
              }
              onClick={() => onIndexViewChange("overview")}
              role="tab"
              type="button"
            >
              {t("dataCatalog.indexWorkspace.viewOverview")}
            </button>
            <button
              className={
                indexView === "configure" ? panelStyles.viewTabActive : panelStyles.viewTab
              }
              onClick={() => onIndexViewChange("configure")}
              role="tab"
              type="button"
            >
              {t("dataCatalog.indexWorkspace.viewConfigure")}
            </button>
          </div>
          {indexView === "configure" ? (
            <span className={panelStyles.viewBarHint}>
              {t("dataCatalog.indexWorkspace.configureHint")}
            </span>
          ) : null}
        </div>

        {indexView === "configure" ? renderConfigure() : renderOverview()}
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

function MetaItem({
  full = false,
  label,
  value,
}: {
  full?: boolean;
  label: string;
  value: string;
}) {
  return (
    <div
      className={
        full ? `${panelStyles.metaItem} ${panelStyles.metaItemFull}` : panelStyles.metaItem
      }
    >
      <span className={panelStyles.metaLabel}>{label}</span>
      <span className={panelStyles.metaValue}>{value}</span>
    </div>
  );
}
