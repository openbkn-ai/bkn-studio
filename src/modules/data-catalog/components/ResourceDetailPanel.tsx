/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  ExclamationCircleOutlined,
  EyeOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import { PermissionGate } from "@/framework/permission/PermissionGate";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { AppTable } from "@/framework/ui/common/AppTable";
import { BuildProgress } from "@/modules/data-catalog/components/BuildProgress";
import { BuildStatusTag } from "@/modules/data-catalog/components/BuildStatusTag";
import {
  DeleteImpactAlert,
  useDangerDelete,
} from "@/modules/data-catalog/components/DangerDeleteModal";
import { IndexStateTag } from "@/modules/data-catalog/components/IndexStateTag";
import { formatCount, timeAgo } from "@/modules/data-catalog/lib/format";
import {
  indexStateOf,
  resourceGateOf,
  sortTasks,
} from "@/modules/data-catalog/lib/index-state";
import {
  pauseBuildTask,
  resumeBuildTask,
  retryBuildTask,
} from "@/modules/data-catalog/services/build-task.service";
import { deleteCatalogResource } from "@/modules/data-catalog/services/resource.service";
import { runningIdsFromError } from "@/modules/data-catalog/utils/delete-guard";
import type {
  BuildTask,
  CatalogResource,
  ResourceSchemaField,
} from "@/modules/data-catalog/types/data-catalog";
import type { DataConnectRecord } from "@/modules/data-connect/types/data-connect";

import styles from "./shared.module.css";

type ResourceDetailPanelProps = {
  catalog: DataConnectRecord | null;
  onBuild: (resource: CatalogResource) => void;
  onOpenTask: (task: BuildTask) => void;
  onPreview: (resource: CatalogResource) => void;
  onRefresh: () => Promise<void> | void;
  resource: CatalogResource;
  tasks: BuildTask[];
};

export function ResourceDetailPanel({
  catalog,
  onBuild,
  onOpenTask,
  onPreview,
  onRefresh,
  resource,
  tasks,
}: ResourceDetailPanelProps) {
  const { i18n, t } = useTranslation();
  const { message } = useAppServices();
  const danger = useDangerDelete();
  const navigate = useNavigate();

  const sortedTasks = useMemo(() => sortTasks(tasks), [tasks]);
  const state = useMemo(() => indexStateOf(sortedTasks), [sortedTasks]);
  const gate = resourceGateOf(catalog);
  const effective = state.effective;
  const latest = state.latest;

  const roleSource = effective ?? latest;

  const categoryClass =
    resource.category === "table"
      ? styles.catTable
      : resource.category === "logicview"
        ? styles.catLogicview
        : styles.catDataset;

  const removeResource = () => {
    // 该面板已加载本资源的全部构建任务,直接用 tasks.length 作影响面,无需再查。
    const indexCount = tasks.length;
    const highRisk = indexCount > 0;
    danger.open({
      title: t("dataCatalog.resource.deleteConfirmTitle", { name: resource.name }),
      targetName: resource.name,
      requireTypeName: highRisk,
      impact: (
        <DeleteImpactAlert
          detail={
            highRisk
              ? t("dataCatalog.dangerDelete.resourceImpact", {
                  name: resource.name,
                  count: indexCount,
                })
              : t("dataCatalog.dangerDelete.resourceEmpty", { name: resource.name })
          }
          warning={
            highRisk ? t("dataCatalog.dangerDelete.impactWarning") : undefined
          }
        />
      ),
      onOk: async () => {
        try {
          // 后端级联清理索引/任务,前端不再手动先删任务。
          await deleteCatalogResource(resource.id);
        } catch (error) {
          const running = runningIdsFromError(error);
          void message.error(
            running
              ? t("dataCatalog.dangerDelete.hasRunning")
              : extractRequestErrorMessage(error),
          );
          throw error;
        }
        message.success(t("common.success"));
        void navigate(
          catalog ? `/data-directory/catalog/${catalog.id}` : "/data-directory",
          { replace: true },
        );
        await onRefresh();
      },
    });
  };

  const handlePause = async () => {
    if (!latest) {
      return;
    }
    try {
      await pauseBuildTask(latest.id);
      message.success(t("dataCatalog.task.paused"));
      await onRefresh();
    } catch (error) {
      void message.error(extractRequestErrorMessage(error));
    }
  };

  const handleResume = async () => {
    if (!latest) {
      return;
    }
    try {
      await resumeBuildTask(latest.id);
      message.success(t("dataCatalog.task.resumed"));
      await onRefresh();
    } catch (error) {
      void message.error(extractRequestErrorMessage(error));
    }
  };

  const handleRetry = async () => {
    if (!latest) {
      return;
    }
    try {
      const task = await retryBuildTask(latest.id);
      if (task) {
        message.success(t("dataCatalog.task.retried", { id: task.id }));
      }
      await onRefresh();
    } catch (error) {
      void message.error(extractRequestErrorMessage(error));
    }
  };

  const schemaColumns: ColumnsType<ResourceSchemaField> = [
    {
      dataIndex: "name",
      title: t("dataCatalog.resource.field"),
      render: (value: string) => <span className={styles.fieldChip}>{value}</span>,
    },
    {
      dataIndex: "type",
      title: t("dataCatalog.resource.fieldType"),
      render: (value: string) => <span className={styles.monoText}>{value}</span>,
    },
    {
      key: "role",
      title: t("dataCatalog.resource.indexRole"),
      render: (_, record) => (
        <span className={styles.chipRow}>
          {roleSource?.embeddingFields.includes(record.name) ? (
            <span className={[styles.tag, styles.taskRunning].join(" ")}>embedding</span>
          ) : null}
          {roleSource?.fulltextFields.includes(record.name) ? (
            <span className={[styles.tag, styles.modeStreaming].join(" ")}>fulltext</span>
          ) : null}
          {roleSource?.buildKeyFields.includes(record.name) ? (
            <span className={[styles.tag, styles.modeBatch].join(" ")}>build key</span>
          ) : null}
        </span>
      ),
    },
  ];

  const showLatestBlock =
    latest &&
    !(
      effective &&
      effective.id === latest.id &&
      ["listening", "paused", "succeeded"].includes(latest.status)
    );

  return (
    <section>
      {danger.node}
      <div className={styles.detailHeader}>
        <div className={styles.detailHeadMain}>
          <div className={styles.detailTitleRow}>
            <h2 className={styles.detailTitle}>{resource.name}</h2>
            <span className={[styles.tag, categoryClass].join(" ")}>
              {t(`dataCatalog.categories.${resource.category}`)}
            </span>
            <IndexStateTag state={state} />
          </div>
          <div className={styles.detailSub}>
            <span className={styles.slugChip}>{resource.id}</span>
            {catalog ? (
              <button
                className={styles.backLink}
                onClick={() => {
                  void navigate(`/data-directory/catalog/${catalog.id}`);
                }}
                type="button"
              >
                Catalog · {catalog.name}
              </button>
            ) : null}
            {resource.description ? <span>{resource.description}</span> : null}
          </div>
        </div>
        <div className={styles.detailActions}>
          <AppButton
            disabled={!gate.ok}
            icon={<EyeOutlined />}
            onClick={() => onPreview(resource)}
            title={!gate.ok ? t("dataCatalog.gate.catalogDisabledShort") : undefined}
          >
            {t("dataCatalog.actions.preview")}
          </AppButton>
          <PermissionGate permissions="resource:task_manage">
            <AppButton
              disabled={!gate.ok}
              icon={<ThunderboltOutlined />}
              onClick={() => onBuild(resource)}
              title={!gate.ok ? t("dataCatalog.gate.catalogDisabledShort") : undefined}
              type="primary"
            >
              {t("dataCatalog.actions.buildIndex")}
            </AppButton>
          </PermissionGate>
          <PermissionGate permissions="resource:delete">
            <AppButton danger onClick={removeResource}>
              {t("common.delete")}
            </AppButton>
          </PermissionGate>
        </div>
      </div>

      {!gate.ok && catalog ? (
        <div className={styles.calloutWarn} style={{ marginTop: 16 }}>
          <ExclamationCircleOutlined />
          <span>
            {t("dataCatalog.gate.catalogDisabled", { name: catalog.name })}{" "}
            <button
              className={styles.backLink}
              onClick={() => {
                void navigate(`/data-directory/catalog/${catalog.id}`);
              }}
              style={{ color: "#1f4fd4" }}
              type="button"
            >
              {t("dataCatalog.gate.goEnable")}
            </button>
          </span>
        </div>
      ) : null}

      <div className={styles.statStrip}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>{t("dataCatalog.resource.rowCount")}</div>
          <div className={styles.statValue}>{formatCount(resource.rowCount)}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Schema</div>
          <div className={styles.statValue}>
            {resource.schema.length} <small>{t("dataCatalog.unit.column")}</small>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>{t("dataCatalog.resource.indexState")}</div>
          <div className={styles.statValue}>
            <IndexStateTag state={state} />
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>{t("dataCatalog.resource.buildTasks")}</div>
          <div className={styles.statValue}>
            {tasks.length} <small>{t("dataCatalog.unit.times")}</small>
          </div>
        </div>
      </div>

      <div className={styles.sectionGrid}>
        <div className={[styles.sectionCard, styles.sectionCardFlat].join(" ")}>
          <div className={styles.sectionTitleRow}>
            <h3 className={styles.sectionTitle}>
              Schema{" "}
              <span className={styles.sectionTitleHint}>
                source: {resource.sourceIdentifier}
              </span>
            </h3>
          </div>
          <AppTable<ResourceSchemaField>
            columns={schemaColumns}
            dataSource={resource.schema}
            pagination={false}
            rowKey="name"
            size="small"
          />
        </div>

        <div className={[styles.sectionCard, styles.sectionCardFlat].join(" ")}>
          <div className={styles.sectionTitleRow}>
            <h3 className={styles.sectionTitle}>
              {t("dataCatalog.resource.effectiveIndex")}{" "}
              <span className={styles.sectionTitleHint}>
                {t("dataCatalog.resource.effectiveIndexHint")}
              </span>
            </h3>
            <div className={styles.sectionTools}>
              {latest?.mode === "streaming" && latest.status === "listening" ? (
                <PermissionGate permissions="resource:task_manage">
                  <AppButton onClick={() => void handlePause()} size="small">
                    {t("dataCatalog.task.pauseListening")}
                  </AppButton>
                </PermissionGate>
              ) : null}
              {latest?.status === "paused" ? (
                <PermissionGate permissions="resource:task_manage">
                  <AppButton
                    disabled={!gate.ok}
                    onClick={() => void handleResume()}
                    size="small"
                  >
                    {t("dataCatalog.task.resumeListening")}
                  </AppButton>
                </PermissionGate>
              ) : null}
              {latest ? (
                <AppButton onClick={() => onOpenTask(latest)} size="small">
                  {t("dataCatalog.task.detail")}
                </AppButton>
              ) : null}
            </div>
          </div>

          {!effective && !latest ? (
            <div className={styles.scanItemMeta}>
              {t("dataCatalog.resource.noIndexHint")}
            </div>
          ) : (
            <>
              <div className={styles.descGrid}>
                {!effective ? (
                  <div className={[styles.descItem, styles.descItemWide].join(" ")}>
                    <span className={styles.descValue} style={{ color: "#8b98ac" }}>
                      {t("dataCatalog.resource.noEffectiveIndex")}
                    </span>
                  </div>
                ) : (
                  <>
                    <div className={[styles.descItem, styles.descItemWide].join(" ")}>
                      <span className={styles.descLabel}>
                        {t("dataCatalog.resource.effectiveVersion")}
                      </span>
                      <span className={styles.chipRow}>
                        <span className={styles.slugChip}>{effective.id}</span>
                        <span
                          className={[
                            styles.tag,
                            effective.mode === "batch" ? styles.modeBatch : styles.modeStreaming,
                          ].join(" ")}
                        >
                          {t(`dataCatalog.modes.${effective.mode}`)}
                        </span>
                        {effective.mode === "streaming" && effective.status === "listening" ? (
                          <span className={[styles.tag, styles.modeStreaming].join(" ")}>
                            {t("dataCatalog.indexState.listening")}
                          </span>
                        ) : effective.status === "paused" ? (
                          <span className={[styles.tag, styles.taskPending].join(" ")}>
                            {t("dataCatalog.indexState.paused")}
                          </span>
                        ) : (
                          <span className={[styles.tag, styles.taskSucceeded].join(" ")}>
                            {t("dataCatalog.resource.effectiveActive")}
                          </span>
                        )}
                      </span>
                    </div>
                    <div className={styles.descItem}>
                      <span className={styles.descLabel}>embedding_fields</span>
                      <span className={styles.chipRow}>
                        {effective.embeddingFields.map((field) => (
                          <span className={styles.fieldChip} key={field}>
                            {field}
                          </span>
                        ))}
                      </span>
                    </div>
                    {effective.fulltextFields.length > 0 ? (
                      <div className={styles.descItem}>
                        <span className={styles.descLabel}>fulltext_fields</span>
                        <span className={styles.chipRow}>
                          {effective.fulltextFields.map((field) => (
                            <span className={styles.fieldChip} key={field}>
                              {field}
                            </span>
                          ))}
                        </span>
                      </div>
                    ) : null}
                    <div className={styles.descItem}>
                      <span className={styles.descLabel}>
                        {t("dataCatalog.task.model")}
                      </span>
                      <span className={styles.descValue}>
                        {effective.embeddingModel} · {effective.modelDimensions}d
                      </span>
                    </div>
                    <div className={styles.descItem}>
                      <span className={styles.descLabel}>
                        {t("dataCatalog.resource.indexedRows")}
                      </span>
                      <span className={styles.descValue}>
                        {formatCount(
                          effective.mode === "streaming"
                            ? effective.syncedCount
                            : effective.totalCount,
                        )}
                      </span>
                    </div>
                    <div className={styles.descItem}>
                      <span className={styles.descLabel}>
                        {effective.mode === "streaming"
                          ? t("dataCatalog.task.lastEvent")
                          : t("dataCatalog.task.finishedAt")}
                      </span>
                      <span className={styles.descValue}>
                        {effective.mode === "streaming"
                          ? timeAgo(
                              effective.lastEventAt ?? effective.createdAt,
                              i18n.language,
                            )
                          : (effective.finishTime ?? "—")}
                      </span>
                    </div>
                  </>
                )}
              </div>

              {showLatestBlock && latest ? (
                <div
                  style={{
                    display: "grid",
                    gap: 12,
                    marginTop: 16,
                    paddingTop: 16,
                    borderTop: "1px dashed rgba(15, 30, 54, 0.1)",
                  }}
                >
                  <h3 className={styles.sectionTitle} style={{ fontSize: 14 }}>
                    {t("dataCatalog.resource.latestTask")}
                  </h3>
                  <div className={styles.chipRow}>
                    <span className={styles.slugChip}>{latest.id}</span>
                    <span
                      className={[
                        styles.tag,
                        latest.mode === "batch" ? styles.modeBatch : styles.modeStreaming,
                      ].join(" ")}
                    >
                      {t(`dataCatalog.modes.${latest.mode}`)}
                    </span>
                    <BuildStatusTag task={latest} />
                  </div>
                  {latest.status === "failed" && effective ? (
                    <div className={styles.calloutWarn} style={{ marginBottom: 0 }}>
                      <ExclamationCircleOutlined />
                      <span>
                        {t("dataCatalog.resource.rebuildFailedHint", {
                          error: latest.error ?? "-",
                          version: effective.id,
                        })}
                      </span>
                    </div>
                  ) : latest.error ? (
                    <div className={styles.calloutWarn} style={{ marginBottom: 0 }}>
                      <ExclamationCircleOutlined />
                      <span>{latest.error}</span>
                    </div>
                  ) : null}
                  <BuildProgress task={latest} />
                  {latest.status === "failed" ? (
                    <div>
                      <PermissionGate permissions="resource:task_manage">
                        <AppButton
                          disabled={!gate.ok}
                          onClick={() => void handleRetry()}
                          size="small"
                        >
                          {t("dataCatalog.task.rebuild")}
                        </AppButton>
                      </PermissionGate>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {sortedTasks.length > 1 ? (
                <div className={styles.scanList} style={{ marginTop: 14 }}>
                  {sortedTasks.slice(1).map((task) => (
                    <div
                      className={[styles.scanItem, styles.scanItemClickable].join(" ")}
                      key={task.id}
                      onClick={() => onOpenTask(task)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          onOpenTask(task);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      <span
                        className={[
                          styles.scanDot,
                          task.status === "failed"
                            ? styles.scanDotFailed
                            : task.status === "running" || task.status === "pending"
                              ? styles.scanDotRunning
                              : "",
                        ].join(" ")}
                      />
                      <div className={styles.scanItemBody}>
                        <span className={styles.scanItemTitle}>
                          <span className={styles.slugChip}>{task.id}</span>
                          <span
                            className={[
                              styles.tag,
                              task.mode === "batch" ? styles.modeBatch : styles.modeStreaming,
                            ].join(" ")}
                          >
                            {t(`dataCatalog.modes.${task.mode}`)}
                          </span>
                          <BuildStatusTag task={task} />
                        </span>
                        <span className={styles.scanItemMeta}>
                          {task.createTime} · {task.embeddingFields.join(", ")} ·{" "}
                          {task.embeddingModel}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
