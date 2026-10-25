/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Button, Modal, Space, Table, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import axios from "axios";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { listTechnicalSpans } from "./trace-analysis.service";
import type { TechnicalSpanNode, TechnicalSpanPage } from "./trace-analysis.types";

export function SpanBrowser({ traceId, onClose }: { traceId: string; onClose: () => void }) {
  const { t } = useTranslation();
  const [page, setPage] = useState<TechnicalSpanPage>();
  const [cursors, setCursors] = useState<Array<string | undefined>>([undefined]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const controller = useRef<AbortController | undefined>(undefined);
  const load = useCallback(
    async (cursor: string | undefined, stack: Array<string | undefined>) => {
      controller.current?.abort();
      const request = new AbortController();
      controller.current = request;
      setLoading(true);
      setError(undefined);
      try {
        const result = await listTechnicalSpans(traceId, cursor, request.signal);
        if (request.signal.aborted) return;
        setPage(result);
        setCursors(stack);
      } catch (caught: unknown) {
        if (request.signal.aborted) return;
        let reason = "failed";
        if (axios.isAxiosError<{ error_code?: string; code?: string }>(caught)) {
          const status = caught.response?.status;
          const code = caught.response?.data?.error_code ?? caught.response?.data?.code;
          if (status === 403) reason = "denied";
          else if (
            status === 422 &&
            (code === "TRACE_SPAN_STORAGE_UNSUPPORTED" || code === "TRACE_SPAN_FORMAT_UNSUPPORTED")
          )
            reason = "unsupported";
          else if (status === 400) reason = "cursor";
          else if (status === 413) reason = "budget";
        }
        setError(reason);
      } finally {
        if (!request.signal.aborted) setLoading(false);
      }
    },
    [traceId],
  );
  useEffect(() => {
    void load(undefined, [undefined]);
    return () => {
      controller.current?.abort();
    };
  }, [load]);

  const columns: ColumnsType<TechnicalSpanNode> = [
    { dataIndex: "spanId", title: "Span ID", ellipsis: true },
    {
      dataIndex: "parentSpanId",
      title: t("bknTrace.traceWorkspace.spanBrowser.parent"),
      ellipsis: true,
    },
    { dataIndex: "name", title: t("bknTrace.traceWorkspace.spanBrowser.name"), ellipsis: true },
    {
      dataIndex: "serviceName",
      title: t("bknTrace.traceWorkspace.spanBrowser.service"),
      ellipsis: true,
    },
    {
      dataIndex: "startNano",
      title: t("bknTrace.traceWorkspace.startedAt"),
      render: (value: number) =>
        Number.isFinite(value) && value > 0 ? new Date(value / 1_000_000).toLocaleString() : "-",
    },
    {
      dataIndex: "durationNano",
      title: t("bknTrace.traceWorkspace.columns.duration"),
      render: (value: number) =>
        Number.isFinite(value) && value > 0 ? `${Math.round(value / 1_000_000)} ms` : "-",
    },
    { dataIndex: "status", title: t("bknTrace.traceWorkspace.spanBrowser.status") },
  ];
  return (
    <Modal
      open
      width={1100}
      title={t("bknTrace.traceWorkspace.spanBrowser.title")}
      onCancel={() => {
        controller.current?.abort();
        onClose();
      }}
      footer={null}
    >
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <Typography.Paragraph>
          {t("bknTrace.traceWorkspace.spanBrowser.scope")}
        </Typography.Paragraph>
        {error ? (
          <Alert
            showIcon
            type="warning"
            message={t(`bknTrace.traceWorkspace.spanBrowser.errors.${error}`)}
          />
        ) : null}
        <Table<TechnicalSpanNode>
          columns={columns}
          dataSource={page?.entries ?? []}
          loading={loading}
          pagination={false}
          rowKey="spanId"
          scroll={{ x: 950, y: 420 }}
          locale={{
            emptyText: t(
              page
                ? "bknTrace.traceWorkspace.spanBrowser.empty"
                : "bknTrace.traceWorkspace.spanBrowser.notLoaded",
            ),
          }}
        />
        <Space>
          <Button
            disabled={loading || cursors.length < 2}
            onClick={() => void load(cursors[cursors.length - 2], cursors.slice(0, -1))}
          >
            {t("bknTrace.traceWorkspace.spanBrowser.previous")}
          </Button>
          <Button
            disabled={loading || !page?.hasMore || !page.nextCursor}
            onClick={() => {
              if (page?.nextCursor) void load(page.nextCursor, [...cursors, page.nextCursor]);
            }}
          >
            {t("bknTrace.traceWorkspace.spanBrowser.next")}
          </Button>
          <Button disabled={loading} onClick={() => void load(undefined, [undefined])}>
            {t("bknTrace.actions.refresh")}
          </Button>
        </Space>
      </Space>
    </Modal>
  );
}
