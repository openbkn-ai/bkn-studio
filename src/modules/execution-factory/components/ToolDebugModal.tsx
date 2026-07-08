/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Form, Input, Modal, Typography } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { debugTool } from "@/modules/execution-factory/services/tool.service";
import type { FunctionInputPayload } from "@/modules/execution-factory/types/function-input";
import type {
  ToolDebugResult,
  ToolRecord,
  ToolRunLogEntry,
  ToolIoSpec,
} from "@/modules/execution-factory/types/tool";
import { buildDefaultDebugBody } from "@/modules/execution-factory/utils/generate-sample-json";

import styles from "./ToolDebugModal.module.css";

type ToolDebugModalProps = {
  boxId: string;
  defaultRequestBody?: string;
  functionInput?: FunctionInputPayload;
  ioSpec?: ToolIoSpec;
  onClose: () => void;
  onRunComplete?: (entry: ToolRunLogEntry) => void;
  open: boolean;
  record: ToolRecord | null;
};

type DebugFormValues = {
  requestBody?: string;
};

export function ToolDebugModal({
  boxId,
  defaultRequestBody,
  functionInput,
  ioSpec,
  onClose,
  onRunComplete,
  open,
  record,
}: ToolDebugModalProps) {
  const { t } = useTranslation();
  const [form] = Form.useForm<DebugFormValues>();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ToolDebugResult | null>(null);

  const generatedBody = useMemo(
    () =>
      defaultRequestBody ??
      buildDefaultDebugBody({
        ioSpec,
        functionInput,
      }),
    [defaultRequestBody, functionInput, ioSpec],
  );

  useEffect(() => {
    if (!open) {
      form.resetFields();
      setError(null);
      setResult(null);
      return;
    }

    form.setFieldsValue({
      requestBody: generatedBody,
    });
  }, [form, generatedBody, open]);

  const handleDebug = async () => {
    if (!record) {
      return;
    }

    setSubmitting(true);
    setError(null);
    setResult(null);

    try {
      const values = await form.validateFields();
      let body: Record<string, unknown> | undefined;

      if (values.requestBody?.trim()) {
        body = JSON.parse(values.requestBody) as Record<string, unknown>;
      }

      const debugResult = await debugTool(boxId, record.toolId, { body });
      setResult(debugResult);
      onRunComplete?.({
        id: `${Date.now()}`,
        timestamp: Date.now(),
        statusCode: debugResult.statusCode,
        durationMs: debugResult.durationMs,
        error: debugResult.error,
        body: debugResult.body,
        requestBody: body,
      });
    } catch (caughtError) {
      setError(extractRequestErrorMessage(caughtError));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      confirmLoading={submitting}
      destroyOnClose
      okText={t("executionFactory.runDebug")}
      onCancel={onClose}
      onOk={() => {
        void handleDebug();
      }}
      open={open}
      title={t("executionFactory.toolDebugTitle")}
      width={720}
    >
      {record ? (
        <Typography.Paragraph type="secondary">
          {record.name} ({record.toolId})
        </Typography.Paragraph>
      ) : null}
      <Typography.Paragraph type="secondary">{t("executionFactory.debugSampleHint")}</Typography.Paragraph>
      <Form form={form} layout="vertical">
        <Form.Item label={t("executionFactory.debugRequestBody")} name="requestBody">
          <Input.TextArea placeholder="{}" rows={8} />
        </Form.Item>
      </Form>
      {error ? <Alert message={error} showIcon style={{ marginBottom: 16 }} type="error" /> : null}
      {result ? (
        <section
          className={result.error ? styles.resultPanelWarning : styles.resultPanelSuccess}
          data-testid="tool-debug-result"
        >
          <div className={styles.resultHeader}>
            <span className={result.error ? styles.statusDotWarning : styles.statusDotSuccess} />
            <span className={styles.resultTitle}>{t("executionFactory.debugResultTitle")}</span>
            <span className={styles.resultMeta}>
              HTTP {result.statusCode || "-"}
              {typeof result.durationMs === "number" ? ` · ${result.durationMs} ms` : ""}
            </span>
          </div>
          <pre className={styles.resultCode}>{JSON.stringify(result, null, 2)}</pre>
        </section>
      ) : null}
    </Modal>
  );
}
