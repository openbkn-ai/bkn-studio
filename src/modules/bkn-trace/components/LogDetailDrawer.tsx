/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Descriptions, Drawer, Spin, Tag, Typography } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { buildAppPath } from "@/app/router/app-paths";
import styles from "@/modules/bkn-trace/scenes/ObservabilityWorkspace.module.css";
import { getLogDetail, type LogDetailResult } from "@/modules/bkn-trace/services/observability.service";

type Props = {
  logId?: string;
  onClose: () => void;
};

export function LogDetailDrawer({ logId, onClose }: Props) {
  const { t } = useTranslation();
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
  return (
    <Drawer destroyOnClose onClose={onClose} open={Boolean(logId)} title={t("bknTrace.logs.detail.title")} width={560}>
      {error ? <Alert message={error} showIcon type="error" /> : null}
      {!detail && !error ? <Spin /> : null}
      {record ? (
        <div className={styles.detailBody}>
          <div className={styles.detailSummary}>
            <Typography.Title level={4}>{record.summary || record.eventName}</Typography.Title>
            <Typography.Text className={styles.technicalId}>{record.eventName}</Typography.Text>
          </div>
          <Descriptions column={1} size="small">
            <Descriptions.Item label={t("bknTrace.logs.detail.time")}>{formatTime(record.eventTimestamp)}</Descriptions.Item>
            <Descriptions.Item label={t("bknTrace.logs.detail.category")}><Tag>{record.category}</Tag></Descriptions.Item>
            <Descriptions.Item label={t("bknTrace.logs.detail.service")}>{record.serviceName || "-"}</Descriptions.Item>
            <Descriptions.Item label={t("bknTrace.logs.detail.outcome")}>{record.outcome || "-"}</Descriptions.Item>
            <Descriptions.Item label={t("bknTrace.logs.detail.source")}>{record.sourceId}</Descriptions.Item>
            <Descriptions.Item label={t("bknTrace.logs.detail.logId")}><span className={styles.technicalId}>{record.logId}</span></Descriptions.Item>
            <Descriptions.Item label={t("bknTrace.logs.detail.requestId")}>
              {record.requestId ? <a aria-label={t("bknTrace.logs.detail.openBusinessProvenance")} href={buildAppPath(`/observability/business-provenance?view=requests&request_id=${encodeURIComponent(record.requestId)}`)}>{record.requestId}</a> : "-"}
            </Descriptions.Item>
            <Descriptions.Item label={t("bknTrace.logs.detail.traceId")}>
              {record.traceId ? <a aria-label={t("bknTrace.logs.detail.openTrace")} href={buildAppPath(`/observability/traces?trace_id=${encodeURIComponent(record.traceId)}`)}>{record.traceId}</a> : "-"}
            </Descriptions.Item>
            <Descriptions.Item label={t("bknTrace.logs.detail.projection")}>{detail.policyRevision}</Descriptions.Item>
          </Descriptions>
          {detail.redactedFields.length ? <Alert message={t("bknTrace.logs.detail.projectedFields", { count: detail.redactedFields.length })} showIcon type="info" /> : null}
          {Object.keys(record.attributes).length ? <pre className={styles.attributeBlock}>{JSON.stringify(record.attributes, null, 2)}</pre> : null}
        </div>
      ) : null}
    </Drawer>
  );
}

function formatTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}
