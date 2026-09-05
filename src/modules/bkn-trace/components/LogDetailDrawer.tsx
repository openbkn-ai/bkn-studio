/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Button, Collapse, Descriptions, Drawer, Spin, Tag, Typography } from "antd";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { buildAppPath } from "@/app/router/app-paths";
import { writeTextToClipboard } from "@/framework/compat/clipboard";
import { useAppServices } from "@/framework/context/use-app-services";
import { presentAuthMethod, presentLogAction, presentLogActor, presentLogTarget, presentTargetType } from "@/modules/bkn-trace/components/log-presentation";
import styles from "@/modules/bkn-trace/scenes/ObservabilityWorkspace.module.css";
import { getLogDetail, type LogDetailResult } from "@/modules/bkn-trace/services/observability.service";
import { useAuditUserDirectory } from "@/modules/execution-factory/utils/use-audit-user-directory";

type Props = {
  logId?: string;
  onClose: () => void;
};

export function LogDetailDrawer({ logId, onClose }: Props) {
  const { t } = useTranslation();
  const { message } = useAppServices();
  const userDirectory = useAuditUserDirectory();
  const [detail, setDetail] = useState<LogDetailResult>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    setDetail(undefined);
    setError(undefined);
    if (!logId) return () => { active = false; };
    getLogDetail(logId)
      .then((value) => { if (active) setDetail(value); })
      .catch((caught: unknown) => {
        if (active) setError(caught instanceof Error ? caught.message : t("bknTrace.errors.queryFailed"));
      });
    return () => { active = false; };
  }, [logId, t]);

  const record = detail?.data;
  const target = record ? presentLogTarget(record, t) : undefined;
  const actor = record ? presentLogActor(record, t, userDirectory) : undefined;
  const copyRawFacts = () => {
    if (!record) return;
    void writeTextToClipboard(JSON.stringify(record, null, 2))
      .then(() => message.success(t("bknTrace.logs.detail.rawFactsCopied")))
      .catch(() => message.error(t("bknTrace.logs.detail.copyFailed")));
  };
  return (
    <Drawer
      className={styles.compactDrawer}
      destroyOnClose
      onClose={onClose}
      open={Boolean(logId)}
      rootClassName={styles.compactDrawerRoot}
      title={t("bknTrace.logs.detail.title")}
      width={420}
    >
      {error ? <Alert message={error} showIcon type="error" /> : null}
      {!detail && !error ? <Spin /> : null}
      {record ? <div className={styles.detailBody}>
        <div className={styles.detailSummary}>
          <Typography.Text type="secondary">{t(`bknTrace.logs.modules.${record.businessModule}`)}</Typography.Text>
          <Typography.Title level={4}>{presentLogAction(record, t)}</Typography.Title>
          <Tag color={outcomeColor(record.outcome)}>{t(`bknTrace.logs.outcomes.${record.outcome}`)}</Tag>
        </div>

        <DetailSection title={t("bknTrace.logs.detail.businessObject")}>
          <Descriptions column={1} size="small">
            <Descriptions.Item label={t("bknTrace.logs.detail.target")}>{target?.primary}</Descriptions.Item>
            <Descriptions.Item label={t("bknTrace.logs.detail.targetType")}>{presentTargetType(record, t)}</Descriptions.Item>
            <Descriptions.Item label={t("bknTrace.logs.detail.time")}>{formatTime(record.eventTime)}</Descriptions.Item>
          </Descriptions>
        </DetailSection>

        <DetailSection title={t("bknTrace.logs.detail.facts")}>
          <Descriptions column={1} size="small">
            {record.facts.method ? <Descriptions.Item label={t("bknTrace.logs.detail.method")}>{record.facts.method}</Descriptions.Item> : null}
            {record.facts.statusCode !== undefined ? <Descriptions.Item label={t("bknTrace.logs.detail.statusCode")}>{record.facts.statusCode}</Descriptions.Item> : null}
            {record.facts.clientIp ? <Descriptions.Item label={t("bknTrace.logs.detail.clientIp")}>{record.facts.clientIp}</Descriptions.Item> : null}
            {record.facts.operationType ? <Descriptions.Item label={t("bknTrace.logs.detail.operationType")}>{record.facts.operationType}</Descriptions.Item> : null}
            {record.facts.operationStatus ? <Descriptions.Item label={t("bknTrace.logs.detail.operationStatus")}>{record.facts.operationStatus}</Descriptions.Item> : null}
            {record.facts.businessContext ? <Descriptions.Item label={t("bknTrace.logs.detail.businessContext")}>{record.facts.businessContext}</Descriptions.Item> : null}
          </Descriptions>
          {record.facts.detail ? <pre className={styles.attributeBlock}>{JSON.stringify(record.facts.detail, null, 2)}</pre> : null}
        </DetailSection>

        <DetailSection title={t("bknTrace.logs.detail.actorAndSource")}>
          <Descriptions column={1} size="small">
            <Descriptions.Item label={t("bknTrace.logs.detail.actor")}>{actor?.primary}</Descriptions.Item>
            <Descriptions.Item label={t("bknTrace.logs.detail.authMethod")}>{presentAuthMethod(record.authMethod, t)}</Descriptions.Item>
            {record.credential ? <Descriptions.Item label={t("bknTrace.logs.detail.credential")}>{record.credential.name || record.credential.id}</Descriptions.Item> : null}
            <Descriptions.Item label={t("bknTrace.logs.detail.source")}>{record.sourceId} · {record.sourceChannel}</Descriptions.Item>
          </Descriptions>
        </DetailSection>

        {record.failure ? <DetailSection title={t("bknTrace.logs.detail.failure")}>
          <Alert description={record.failure.message} message={record.failure.code} showIcon type="error" />
        </DetailSection> : null}

        {record.conversationId || record.requestId || record.taskId || record.traceId ? <DetailSection title={t("bknTrace.logs.detail.associations")}>
          <Descriptions column={1} size="small">
            {record.conversationId ? <Descriptions.Item label={t("bknTrace.logs.detail.conversationId")}><a aria-label={t("bknTrace.logs.detail.openBusinessProvenance")} href={buildAppPath(`/observability/business-provenance?conversation_id=${encodeURIComponent(record.conversationId)}`)}>{record.conversationId}</a></Descriptions.Item> : null}
            {record.requestId ? <Descriptions.Item label={t("bknTrace.logs.detail.requestId")}><span className={styles.technicalId}>{record.requestId}</span></Descriptions.Item> : null}
            {record.taskId ? <Descriptions.Item label={t("bknTrace.logs.detail.taskId")}><span className={styles.technicalId}>{record.taskId}</span></Descriptions.Item> : null}
            {record.traceId ? <Descriptions.Item label={t("bknTrace.logs.detail.traceId")}><a aria-label={t("bknTrace.logs.detail.openTrace")} href={buildAppPath(`/observability/traces?trace_id=${encodeURIComponent(record.traceId)}`)}>{record.traceId}</a></Descriptions.Item> : null}
          </Descriptions>
        </DetailSection> : null}

        <Collapse
          ghost
          items={[
            {
              key: "technical",
              label: t("bknTrace.logs.detail.technicalIds"),
              children: <Descriptions column={1} size="small">
                <Descriptions.Item label={t("bknTrace.logs.detail.event")}>{record.eventName}</Descriptions.Item>
                <Descriptions.Item label={t("bknTrace.logs.detail.rawAction")}>{record.action}</Descriptions.Item>
                <Descriptions.Item label={t("bknTrace.logs.detail.targetId")}><span className={styles.technicalId}>{record.target.id}</span></Descriptions.Item>
                <Descriptions.Item label={t("bknTrace.logs.detail.actorId")}><span className={styles.technicalId}>{record.actor.id}</span></Descriptions.Item>
                <Descriptions.Item label={t("bknTrace.logs.detail.eventId")}><span className={styles.technicalId}>{record.eventId}</span></Descriptions.Item>
                <Descriptions.Item label={t("bknTrace.logs.detail.recordedAt")}>{formatTime(record.recordedAt)}</Descriptions.Item>
              </Descriptions>,
            },
            {
              key: "raw",
              label: t("bknTrace.logs.detail.rawFacts"),
              children: <>
              <Button onClick={copyRawFacts} size="small">
                {t("bknTrace.logs.detail.copyRawFacts")}
              </Button>
              <pre className={styles.attributeBlock}>{JSON.stringify({ facts: record.facts, attributes: record.attributes }, null, 2)}</pre>
              </>,
            },
          ]}
        />
      </div> : null}
    </Drawer>
  );
}

function DetailSection({ children, title }: { children: ReactNode; title: string }) {
  return <section className={styles.detailSection}><Typography.Title level={5}>{title}</Typography.Title>{children}</section>;
}

function formatTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function outcomeColor(outcome: string) {
  if (outcome === "success") return "green";
  if (outcome === "failure" || outcome === "denied") return "red";
  return "blue";
}
