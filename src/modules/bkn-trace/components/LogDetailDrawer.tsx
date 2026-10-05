/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { CopyOutlined } from "@ant-design/icons";
import {
  Alert,
  Button,
  Collapse,
  Descriptions,
  Drawer,
  Spin,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { buildAppPath } from "@/app/router/app-paths";
import { writeTextToClipboard } from "@/framework/compat/clipboard";
import { useAppServices } from "@/framework/context/use-app-services";
import {
  presentAuthMethod,
  presentLogAction,
  presentLogFact,
  presentLogActor,
  presentLogTarget,
  presentTargetType,
} from "@/modules/bkn-trace/components/log-presentation";
import styles from "@/modules/bkn-trace/scenes/ObservabilityWorkspace.module.css";
import {
  getLogDetail,
  type LogDetailResult,
} from "@/modules/bkn-trace/services/observability.service";

const detailColumns = { xs: 1, sm: 2, md: 2, lg: 2, xl: 2, xxl: 2 } as const;

type Props = {
  logId?: string;
  onClose: () => void;
};

export function LogDetailDrawer({ logId, onClose }: Props) {
  const { t } = useTranslation();
  const { message, runtimeConfig } = useAppServices();
  const [detail, setDetail] = useState<LogDetailResult>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    setDetail(undefined);
    setError(undefined);
    if (!logId)
      return () => {
        active = false;
      };
    getLogDetail(logId)
      .then((value) => {
        if (active) setDetail(value);
      })
      .catch((caught: unknown) => {
        if (active)
          setError(caught instanceof Error ? caught.message : t("bknTrace.errors.queryFailed"));
      });
    return () => {
      active = false;
    };
  }, [logId, t]);

  const record = detail?.data;
  const target = record ? presentLogTarget(record, t) : undefined;
  const actor = record ? presentLogActor(record, t, runtimeConfig.currentUser) : undefined;
  const copyRawFacts = () => {
    if (!record) return;
    void writeTextToClipboard(JSON.stringify(record, null, 2))
      .then(() => message.success(t("bknTrace.logs.detail.rawFactsCopied")))
      .catch(() => message.error(t("bknTrace.logs.detail.copyFailed")));
  };
  const renderId = (value: string, label: string, link?: { href: string; label: string }) => (
    <span className={styles.detailId} title={value}>
      {link ? (
        <a href={link.href} aria-label={link.label}>
          {value}
        </a>
      ) : (
        <span className={styles.detailIdValue}>{value}</span>
      )}
      <Tooltip title={t("bknTrace.logs.detail.copyId", { label })}>
        <Button
          aria-label={t("bknTrace.logs.detail.copyId", { label })}
          type="text"
          size="small"
          icon={<CopyOutlined />}
          onClick={() => {
            void writeTextToClipboard(value)
              .then(() => message.success(t("bknTrace.logs.detail.idCopied")))
              .catch(() => message.error(t("bknTrace.logs.detail.copyFailed")));
          }}
        />
      </Tooltip>
    </span>
  );
  return (
    <Drawer
      className={styles.compactDrawer}
      destroyOnHidden
      onClose={onClose}
      open={Boolean(logId)}
      rootClassName={`${styles.compactDrawerRoot} ${styles.logDetailDrawerRoot}`}
      title={t("bknTrace.logs.detail.title")}
      width="min(600px, calc(100vw - 48px))"
    >
      {error ? <Alert message={error} showIcon type="error" /> : null}
      {!detail && !error ? <Spin /> : null}
      {record ? (
        <div className={styles.detailBody}>
          <div className={styles.detailSummary}>
            <Typography.Text type="secondary">
              {t(`bknTrace.logs.modules.${record.businessModule}`)}
            </Typography.Text>
            <Typography.Title level={4}>{presentLogAction(record, t)}</Typography.Title>
            <Tag color={outcomeColor(record.outcome)}>
              {t(`bknTrace.logs.outcomes.${record.outcome}`)}
            </Tag>
          </div>

          <DetailSection title={t("bknTrace.logs.detail.businessObject")}>
            <Descriptions column={detailColumns} layout="vertical" size="small">
              <Descriptions.Item span="filled" label={t("bknTrace.logs.detail.target")}>
                {target?.primary}
              </Descriptions.Item>
              <Descriptions.Item label={t("bknTrace.logs.detail.targetType")}>
                {presentTargetType(record, t)}
              </Descriptions.Item>
              <Descriptions.Item label={t("bknTrace.logs.detail.time")}>
                {formatTime(record.eventTime)}
              </Descriptions.Item>
            </Descriptions>
          </DetailSection>

          <DetailSection title={t("bknTrace.logs.detail.facts")}>
            <Descriptions column={detailColumns} layout="vertical" size="small">
              {record.facts.method ? (
                <Descriptions.Item label={t("bknTrace.logs.detail.method")}>
                  {record.facts.method}
                </Descriptions.Item>
              ) : null}
              {record.facts.statusCode !== undefined ? (
                <Descriptions.Item label={t("bknTrace.logs.detail.statusCode")}>
                  {record.facts.statusCode}
                </Descriptions.Item>
              ) : null}
              {record.facts.clientIp ? (
                <Descriptions.Item label={t("bknTrace.logs.detail.clientIp")}>
                  {record.facts.clientIp}
                </Descriptions.Item>
              ) : null}
              {record.facts.operationType ? (
                <Descriptions.Item label={t("bknTrace.logs.detail.operationType")}>
                  <span title={record.facts.operationType}>
                    {presentLogFact("operationType", record.facts.operationType, t)}
                  </span>
                </Descriptions.Item>
              ) : null}
              {record.facts.operationStatus ? (
                <Descriptions.Item label={t("bknTrace.logs.detail.operationStatus")}>
                  <span title={record.facts.operationStatus}>
                    {presentLogFact("operationStatus", record.facts.operationStatus, t)}
                  </span>
                </Descriptions.Item>
              ) : null}
              {record.facts.businessContext ? (
                <Descriptions.Item label={t("bknTrace.logs.detail.businessContext")}>
                  <span title={record.facts.businessContext}>
                    {presentLogFact("businessContext", record.facts.businessContext, t)}
                  </span>
                </Descriptions.Item>
              ) : null}
            </Descriptions>
            {record.facts.detail ? (
              <pre className={styles.attributeBlock}>
                {JSON.stringify(record.facts.detail, null, 2)}
              </pre>
            ) : null}
          </DetailSection>

          <DetailSection title={t("bknTrace.logs.detail.actorAndSource")}>
            <Descriptions column={detailColumns} layout="vertical" size="small">
              <Descriptions.Item label={t("bknTrace.logs.detail.actor")}>
                {actor?.primary}
              </Descriptions.Item>
              <Descriptions.Item label={t("bknTrace.logs.detail.authMethod")}>
                {presentAuthMethod(record.authMethod, t)}
              </Descriptions.Item>
              {record.credential ? (
                <Descriptions.Item label={t("bknTrace.logs.detail.credential")}>
                  {record.credential.name || record.credential.id}
                </Descriptions.Item>
              ) : null}
              <Descriptions.Item span="filled" label={t("bknTrace.logs.detail.source")}>
                {record.sourceId} · {record.sourceChannel}
              </Descriptions.Item>
            </Descriptions>
          </DetailSection>

          {record.failure ? (
            <DetailSection title={t("bknTrace.logs.detail.failure")}>
              <Alert
                description={record.failure.message}
                message={record.failure.code}
                showIcon
                type="error"
              />
            </DetailSection>
          ) : null}

          {record.conversationId || record.requestId || record.taskId || record.traceId ? (
            <DetailSection title={t("bknTrace.logs.detail.associations")}>
              <Descriptions column={1} size="small">
                {record.conversationId ? (
                  <Descriptions.Item label={t("bknTrace.logs.detail.conversationId")}>
                    {renderId(record.conversationId, t("bknTrace.logs.detail.conversationId"), {
                      href: buildAppPath(
                        `/observability/business-provenance?conversation_id=${encodeURIComponent(record.conversationId)}`,
                      ),
                      label: t("bknTrace.logs.detail.openBusinessProvenance"),
                    })}
                  </Descriptions.Item>
                ) : null}
                {record.requestId ? (
                  <Descriptions.Item label={t("bknTrace.logs.detail.requestId")}>
                    {renderId(record.requestId, t("bknTrace.logs.detail.requestId"))}
                  </Descriptions.Item>
                ) : null}
                {record.taskId ? (
                  <Descriptions.Item label={t("bknTrace.logs.detail.taskId")}>
                    {renderId(record.taskId, t("bknTrace.logs.detail.taskId"))}
                  </Descriptions.Item>
                ) : null}
                {record.traceId ? (
                  <Descriptions.Item label={t("bknTrace.logs.detail.traceId")}>
                    {renderId(record.traceId, t("bknTrace.logs.detail.traceId"), {
                      href: buildAppPath(
                        `/observability/traces?trace_id=${encodeURIComponent(record.traceId)}`,
                      ),
                      label: t("bknTrace.logs.detail.openTrace"),
                    })}
                  </Descriptions.Item>
                ) : null}
              </Descriptions>
            </DetailSection>
          ) : null}

          <Collapse
            ghost
            items={[
              {
                key: "technical",
                label: t("bknTrace.logs.detail.technicalIds"),
                children: (
                  <Descriptions column={1} size="small">
                    <Descriptions.Item label={t("bknTrace.logs.detail.event")}>
                      {record.eventName}
                    </Descriptions.Item>
                    <Descriptions.Item label={t("bknTrace.logs.detail.rawAction")}>
                      {record.action}
                    </Descriptions.Item>
                    <Descriptions.Item label={t("bknTrace.logs.detail.targetId")}>
                      {renderId(record.target.id, t("bknTrace.logs.detail.targetId"))}
                    </Descriptions.Item>
                    <Descriptions.Item label={t("bknTrace.logs.detail.actorId")}>
                      {renderId(record.actor.id, t("bknTrace.logs.detail.actorId"))}
                    </Descriptions.Item>
                    <Descriptions.Item label={t("bknTrace.logs.detail.eventId")}>
                      {renderId(record.eventId, t("bknTrace.logs.detail.eventId"))}
                    </Descriptions.Item>
                    <Descriptions.Item label={t("bknTrace.logs.detail.recordedAt")}>
                      {formatTime(record.recordedAt)}
                    </Descriptions.Item>
                  </Descriptions>
                ),
              },
              {
                key: "raw",
                label: t("bknTrace.logs.detail.rawFacts"),
                children: (
                  <>
                    <Button onClick={copyRawFacts} size="small">
                      {t("bknTrace.logs.detail.copyRawFacts")}
                    </Button>
                    <pre className={styles.attributeBlock}>
                      {JSON.stringify(
                        { facts: record.facts, attributes: record.attributes },
                        null,
                        2,
                      )}
                    </pre>
                  </>
                ),
              },
            ]}
          />
        </div>
      ) : null}
    </Drawer>
  );
}

function DetailSection({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className={styles.detailSection}>
      <Typography.Title level={5}>{title}</Typography.Title>
      {children}
    </section>
  );
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
