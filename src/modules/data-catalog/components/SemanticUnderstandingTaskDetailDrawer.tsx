/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { ExclamationCircleOutlined } from "@ant-design/icons";
import { Alert, Descriptions, Drawer, Empty, Select, Space, Table } from "antd";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { formatDateTimeYmdHms } from "@/framework/i18n/format";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import {
  applySemanticUnderstandingTask,
  getSemanticUnderstandingTask,
  type SemanticUnderstandingTask,
} from "@/modules/data-catalog/services/semantic-understanding-task.service";

import { AppButton } from "@/framework/ui/common/AppButton";
import { getCatalog, hasCatalogOperation } from "@/shared/catalog";
import { getCatalogResource } from "@/modules/data-catalog/services/resource.service";
import { hasCatalogResourceOperation } from "@/modules/data-catalog/utils/resource-operations";

import styles from "./BuildTaskDetailDrawer.module.css";
import { getSemanticUnderstandingWarnings } from "./semantic-understanding-warnings";
import sharedStyles from "./shared.module.css";

const EMPTY_VALUE = "-";

type Props = {
  canApply?: boolean;
  onApplied?: () => void;
  onClose: () => void;
  open: boolean;
  taskId: string;
};

type ResourceQuality = {
  field_effective?: number;
  field_total?: number;
  resource_effective?: boolean;
};

type FieldApplyDetail = {
  name: string;
  reasons?: string[];
  status: "updated" | "partial" | "unchanged" | "skipped";
  updated?: string[];
};

function fieldStatusClass(status: FieldApplyDetail["status"]) {
  switch (status) {
    case "updated":
      return sharedStyles.taskSucceeded;
    case "partial":
      return sharedStyles.taskDegraded;
    case "skipped":
      return sharedStyles.taskFailed;
    default:
      return sharedStyles.taskPending;
  }
}

function formatTime(value?: number) {
  if (!value) return "-";
  const timestamp = value < 100_000_000_000 ? value * 1000 : value;
  return formatDateTimeYmdHms(timestamp);
}

function jsonDetail(value?: string) {
  if (!value?.trim()) return EMPTY_VALUE;
  let content = value;
  try {
    content = JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    // The server supports returning legacy data that is not JSON.
  }
  return (
    <details className={styles.rawDetail}>
      <summary>JSON</summary>
      <pre>{content}</pre>
    </details>
  );
}

function jsonObject(value?: string): Record<string, unknown> | undefined {
  if (!value?.trim()) return undefined;
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

function getQuality(...payloads: Array<string | undefined>): ResourceQuality | undefined {
  for (const payload of payloads) {
    const quality = jsonObject(payload)?.quality;
    if (quality && typeof quality === "object" && !Array.isArray(quality)) {
      return quality;
    }
  }
  return undefined;
}

function getFieldDetails(value?: string): FieldApplyDetail[] {
  const fieldDetails = jsonObject(value)?.field_details;
  return Array.isArray(fieldDetails)
    ? fieldDetails.filter(
        (detail): detail is FieldApplyDetail =>
          Boolean(detail) && typeof detail === "object" && "name" in detail && "status" in detail,
      )
    : [];
}

export function SemanticUnderstandingTaskDetailDrawer({
  canApply,
  onApplied,
  onClose,
  open,
  taskId,
}: Props) {
  const { t } = useTranslation();
  const [task, setTask] = useState<SemanticUnderstandingTask | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [allowedToApply, setAllowedToApply] = useState(false);
  const [applyMode, setApplyMode] = useState<"fill_empty" | "force">("fill_empty");
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [applyOutcome, setApplyOutcome] = useState<"applied" | "unchanged" | null>(null);
  const requestRef = useRef(0);
  const applyingRef = useRef(false);
  const onAppliedRef = useRef(onApplied);

  useEffect(() => {
    onAppliedRef.current = onApplied;
    return () => {
      onAppliedRef.current = undefined;
    };
  }, [onApplied]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    const loadRequestId = ++requestRef.current;
    applyingRef.current = false;
    setApplying(false);
    setAllowedToApply(false);
    setApplyMode("fill_empty");
    setApplyError(null);
    setApplyOutcome(null);
    void (async () => {
      setLoading(true);
      setLoadError(null);
      setTask(null);
      try {
        const nextTask = await getSemanticUnderstandingTask(taskId);
        if (active) setTask(nextTask);
        if (canApply !== undefined) {
          if (active) setAllowedToApply(canApply);
        } else if (
          nextTask?.scope === "resource" &&
          nextTask.applyMode === "dry_run" &&
          nextTask.resourceId
        ) {
          const [catalog, resource] = await Promise.all([
            getCatalog(nextTask.catalogId, { skipErrorToast: true }),
            getCatalogResource(nextTask.resourceId),
          ]);
          if (active)
            setAllowedToApply(
              hasCatalogOperation(catalog, "task_manage") &&
                hasCatalogResourceOperation(resource, "modify"),
            );
        }
      } catch (error) {
        if (active) setLoadError(extractRequestErrorMessage(error));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
      requestRef.current = loadRequestId + 1;
    };
  }, [canApply, open, taskId]);

  async function handleApply() {
    if (
      !task ||
      task.id !== taskId ||
      !allowedToApply ||
      applyingRef.current ||
      !open ||
      task.applied ||
      task.confidence < task.confidenceThreshold
    )
      return;
    const requestId = requestRef.current;
    applyingRef.current = true;
    setApplying(true);
    setApplyError(null);
    setApplyOutcome(null);
    try {
      const nextTask = await applySemanticUnderstandingTask(task.id, applyMode);
      // Refresh the current owner even when its drawer was closed or switched.
      onAppliedRef.current?.();
      if (requestId !== requestRef.current) return;
      setTask(nextTask);
      const detail = jsonObject(nextTask.applyDetailJson);
      const unchanged =
        detail?.reason === "no_resource_changes" ||
        (detail?.resource_updated === false &&
          (!Array.isArray(detail.updated_fields) || detail.updated_fields.length === 0));
      setApplyOutcome(unchanged ? "unchanged" : "applied");
    } catch (error) {
      if (requestId === requestRef.current) setApplyError(extractRequestErrorMessage(error));
    } finally {
      if (requestId === requestRef.current) {
        applyingRef.current = false;
        setApplying(false);
      }
    }
  }

  if (!task) {
    return (
      <Drawer
        className={styles.drawer}
        destroyOnHidden
        loading={loading}
        onClose={onClose}
        open={open}
        styles={{ body: { padding: 16 }, header: { padding: "12px 16px" } }}
        title={`${t("dataCatalog.task.semanticDetail")} · ${taskId}`}
        width={640}
      >
        {!loading && loadError ? <Alert message={loadError} showIcon type="error" /> : null}
        {!loading && !loadError ? <Empty description={t("common.notFound")} /> : null}
      </Drawer>
    );
  }

  const applyModeKey =
    task.applyMode === "dry_run" ? "dryRun" : task.applyMode === "force" ? "force" : "fillEmpty";
  const statusClass =
    task.status === "failed"
      ? sharedStyles.taskFailed
      : task.status === "completed"
        ? sharedStyles.taskSucceeded
        : task.status === "cancelled" || task.status === "pending"
          ? sharedStyles.taskPending
          : sharedStyles.taskRunning;
  const creator = task.creator.name || task.creator.id || EMPTY_VALUE;
  const quality = getQuality(task.confidenceDetailJson, task.resultJson);
  const warnings = getSemanticUnderstandingWarnings(t, task.confidenceDetailJson, task.resultJson);
  const fieldDetails = getFieldDetails(task.applyDetailJson);
  const canApplyResult =
    allowedToApply &&
    task.id === taskId &&
    task.scope === "resource" &&
    task.applyMode === "dry_run" &&
    task.status === "completed" &&
    !task.applied &&
    Boolean(task.resultJson?.trim());
  const belowThreshold = task.confidence < task.confidenceThreshold;
  const actualApplyMode = jsonObject(task.applyDetailJson)?.apply_mode;

  const fieldDetailColumns = [
    { dataIndex: "name", title: t("dataCatalog.taskManagement.semantic.fields.field") },
    {
      dataIndex: "status",
      title: t("common.status"),
      render: (status: FieldApplyDetail["status"]) => (
        <span className={[sharedStyles.tag, fieldStatusClass(status)].join(" ")}>
          {t(`dataCatalog.taskManagement.semantic.fieldStatus.${status}`)}
        </span>
      ),
    },
    {
      dataIndex: "updated",
      title: t("dataCatalog.taskManagement.semantic.fields.updated"),
      render: (updated?: string[]) => updated?.join(", ") || "-",
    },
    {
      dataIndex: "reasons",
      title: t("dataCatalog.taskManagement.semantic.fields.reason"),
      render: (reasons?: string[]) => reasons?.join("; ") || "-",
    },
  ];

  return (
    <Drawer
      className={styles.drawer}
      destroyOnHidden
      onClose={onClose}
      open={open}
      styles={{ body: { padding: 16 }, header: { padding: "12px 16px" } }}
      title={`${t("dataCatalog.task.semanticDetail")} · ${task.id}`}
      width={640}
    >
      <div className={styles.drawerContent}>
        {loadError ? <Alert message={loadError} showIcon type="error" /> : null}
        <section className={styles.sectionCard}>
          <h3 className={styles.sectionTitle}>{t("dataCatalog.task.detailSections.status")}</h3>
          <div className={styles.statusRow}>
            <span className={[sharedStyles.tag, sharedStyles.taskRunning].join(" ")}>
              {t(`dataCatalog.taskManagement.scope.${task.scope}`)}
            </span>
            <span className={[sharedStyles.tag, sharedStyles.taskRunning].join(" ")}>
              {t(`dataCatalog.taskManagement.applyMode.${applyModeKey}`)}
            </span>
            <span
              className={[
                sharedStyles.tag,
                task.applied ? sharedStyles.taskSucceeded : sharedStyles.taskPending,
              ].join(" ")}
            >
              {t(
                task.applied
                  ? "dataCatalog.taskManagement.applied.applied"
                  : "dataCatalog.taskManagement.applied.notApplied",
              )}
            </span>
            <span className={[sharedStyles.tag, statusClass].join(" ")}>
              {t(`dataCatalog.taskManagement.semanticStatus.${task.status}`)}
            </span>
          </div>
          {task.failureDetail ? (
            <div className={sharedStyles.calloutWarn}>
              <ExclamationCircleOutlined />
              <span className={styles.failureContent}>
                <b>{t("dataCatalog.taskManagement.details.failureReason")}</b>
                <span>{task.failureDetail}</span>
              </span>
            </div>
          ) : null}
        </section>

        {canApplyResult ? (
          <section className={styles.sectionCard}>
            <h3 className={styles.sectionTitle}>
              {t("dataCatalog.taskManagement.semantic.applyResult")}
            </h3>
            <Space direction="vertical" style={{ width: "100%" }}>
              <Space wrap>
                <Select<"fill_empty" | "force">
                  aria-label={t("dataCatalog.taskManagement.semantic.applicationMode")}
                  disabled={applying || belowThreshold}
                  onChange={setApplyMode}
                  options={[
                    {
                      value: "fill_empty",
                      label: t("dataCatalog.taskManagement.applyMode.fillEmpty"),
                    },
                    { value: "force", label: t("dataCatalog.taskManagement.applyMode.force") },
                  ]}
                  value={applyMode}
                  style={{ minWidth: 180 }}
                />
                <AppButton
                  disabled={belowThreshold}
                  loading={applying}
                  onClick={() => void handleApply()}
                  type="primary"
                >
                  {t("dataCatalog.taskManagement.semantic.applyResult")}
                </AppButton>
              </Space>
              <Alert
                showIcon
                type={belowThreshold ? "warning" : "info"}
                message={t(
                  belowThreshold
                    ? "dataCatalog.taskManagement.semantic.belowThreshold"
                    : applyMode === "force"
                      ? "dataCatalog.taskManagement.semantic.forceDescription"
                      : "dataCatalog.taskManagement.semantic.fillEmptyDescription",
                )}
              />
            </Space>
          </section>
        ) : null}
        {applyError ? <Alert showIcon type="error" message={applyError} /> : null}
        {applyOutcome ? (
          <Alert
            showIcon
            type={applyOutcome === "applied" ? "success" : "info"}
            message={t(
              applyOutcome === "applied"
                ? "dataCatalog.taskManagement.semantic.applySuccess"
                : "dataCatalog.taskManagement.semantic.applyUnchanged",
            )}
          />
        ) : null}

        <section className={styles.sectionCard}>
          <h3 className={styles.sectionTitle}>{t("dataCatalog.task.detailSections.task")}</h3>
          <Descriptions bordered className={styles.descriptionBlock} column={1} size="small">
            <Descriptions.Item label="ID">{task.id || EMPTY_VALUE}</Descriptions.Item>
            <Descriptions.Item label={t("dataCatalog.taskManagement.columns.catalog")}>
              {task.catalogName || task.catalogId || EMPTY_VALUE}
            </Descriptions.Item>
            <Descriptions.Item label={t("dataCatalog.taskManagement.semantic.fields.catalogId")}>
              {task.catalogId || EMPTY_VALUE}
            </Descriptions.Item>
            <Descriptions.Item label={t("dataCatalog.taskManagement.columns.resource")}>
              {task.resourceName || task.resourceId || EMPTY_VALUE}
            </Descriptions.Item>
            <Descriptions.Item label={t("dataCatalog.taskManagement.semantic.fields.resourceId")}>
              {task.resourceId || EMPTY_VALUE}
            </Descriptions.Item>
            <Descriptions.Item label={t("dataCatalog.taskManagement.details.taskScope")}>
              {t(`dataCatalog.taskManagement.scope.${task.scope}`)}
            </Descriptions.Item>
            <Descriptions.Item label={t("dataCatalog.taskManagement.columns.applyMode")}>
              {t(`dataCatalog.taskManagement.applyMode.${applyModeKey}`)}
            </Descriptions.Item>
          </Descriptions>
        </section>

        <section className={styles.sectionCard}>
          <h3 className={styles.sectionTitle}>{t("dataCatalog.task.detailSections.execution")}</h3>
          <Descriptions bordered className={styles.descriptionBlock} column={1} size="small">
            <Descriptions.Item label={t("dataCatalog.taskManagement.details.agentId")}>
              {task.agentId || EMPTY_VALUE}
            </Descriptions.Item>
            <Descriptions.Item label={t("dataCatalog.taskManagement.semantic.fields.agentTaskId")}>
              {task.agentTaskId || EMPTY_VALUE}
            </Descriptions.Item>
            <Descriptions.Item
              label={t("dataCatalog.taskManagement.semantic.fields.confidenceThreshold")}
            >{`${Math.round(task.confidenceThreshold * 100)}%`}</Descriptions.Item>
            <Descriptions.Item
              label={t("dataCatalog.taskManagement.columns.confidence")}
            >{`${Math.round(task.confidence * 100)}%`}</Descriptions.Item>
            <Descriptions.Item
              label={t("dataCatalog.taskManagement.semantic.fields.confidenceDetail")}
            >
              {jsonDetail(task.confidenceDetailJson)}
            </Descriptions.Item>
            <Descriptions.Item label={t("dataCatalog.taskManagement.columns.applied")}>
              <span
                className={[
                  sharedStyles.tag,
                  task.applied ? sharedStyles.taskSucceeded : sharedStyles.taskPending,
                ].join(" ")}
              >
                {t(
                  task.applied
                    ? "dataCatalog.taskManagement.applied.applied"
                    : "dataCatalog.taskManagement.applied.notApplied",
                )}
              </span>
            </Descriptions.Item>
            {actualApplyMode === "fill_empty" || actualApplyMode === "force" ? (
              <Descriptions.Item label={t("dataCatalog.taskManagement.semantic.applicationMode")}>
                {t(
                  `dataCatalog.taskManagement.applyMode.${actualApplyMode === "force" ? "force" : "fillEmpty"}`,
                )}
              </Descriptions.Item>
            ) : null}
            <Descriptions.Item label={t("dataCatalog.taskManagement.semantic.fields.applyDetail")}>
              {jsonDetail(task.applyDetailJson)}
            </Descriptions.Item>
            <Descriptions.Item label={t("dataCatalog.task.fields.startTime")}>
              {formatTime(task.startTime)}
            </Descriptions.Item>
            <Descriptions.Item label={t("dataCatalog.task.finishedAt")}>
              {formatTime(task.finishTime)}
            </Descriptions.Item>
          </Descriptions>

          <>
            <h4 className={styles.detailSubsectionTitle}>
              {t("dataCatalog.taskManagement.semantic.detailSections.quality")}
            </h4>
            <Descriptions bordered className={styles.descriptionBlock} column={1} size="small">
              <Descriptions.Item
                label={t("dataCatalog.taskManagement.semantic.fields.resourceEffective")}
              >
                {quality ? (
                  <span
                    className={[
                      sharedStyles.tag,
                      quality.resource_effective
                        ? sharedStyles.taskSucceeded
                        : sharedStyles.taskPending,
                    ].join(" ")}
                  >
                    {t(
                      quality.resource_effective
                        ? "dataCatalog.taskManagement.semantic.values.effective"
                        : "dataCatalog.taskManagement.semantic.values.notEffective",
                    )}
                  </span>
                ) : (
                  EMPTY_VALUE
                )}
              </Descriptions.Item>
              <Descriptions.Item
                label={t("dataCatalog.taskManagement.semantic.fields.fieldEffective")}
              >
                {quality
                  ? t("dataCatalog.taskManagement.semantic.values.fieldEffective", {
                      effective: quality.field_effective ?? 0,
                      total: quality.field_total ?? 0,
                    })
                  : EMPTY_VALUE}
              </Descriptions.Item>
            </Descriptions>
            {warnings.length > 0 ? (
              <Alert
                className={styles.semanticWarning}
                description={
                  <ul>
                    {warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                }
                message={t("dataCatalog.taskManagement.semantic.fields.warnings")}
                showIcon
                type="warning"
              />
            ) : null}
            {fieldDetails.length > 0 ? (
              <Table<FieldApplyDetail>
                className={styles.fieldDetailTable}
                columns={fieldDetailColumns}
                dataSource={fieldDetails}
                pagination={false}
                rowKey="name"
                size="small"
              />
            ) : null}
          </>

          <h4 className={styles.detailSubsectionTitle}>
            {t("dataCatalog.taskManagement.semantic.detailSections.payload")}
          </h4>
          <Descriptions bordered className={styles.descriptionBlock} column={1} size="small">
            <Descriptions.Item label={t("dataCatalog.taskManagement.semantic.fields.inputHash")}>
              {task.inputHash || "-"}
            </Descriptions.Item>
            <Descriptions.Item label={t("dataCatalog.taskManagement.semantic.fields.input")}>
              {jsonDetail(task.input)}
            </Descriptions.Item>
            <Descriptions.Item label={t("dataCatalog.taskManagement.semantic.fields.result")}>
              {jsonDetail(task.resultJson)}
            </Descriptions.Item>
          </Descriptions>
        </section>

        <section className={styles.sectionCard}>
          <h3 className={styles.sectionTitle}>{t("dataCatalog.task.detailSections.audit")}</h3>
          <Descriptions bordered className={styles.descriptionBlock} column={1} size="small">
            <Descriptions.Item label={t("dataCatalog.task.fields.creator")}>
              {creator}
            </Descriptions.Item>
            <Descriptions.Item label={t("dataCatalog.task.createTime")}>
              {formatTime(task.createTime)}
            </Descriptions.Item>
          </Descriptions>
        </section>
      </div>
    </Drawer>
  );
}
