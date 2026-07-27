/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Form, Modal, Typography } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { HttpDebugRequestFields } from "@/modules/execution-factory/components/HttpDebugRequestFields";
import { debugTool } from "@/modules/execution-factory/services/tool.service";
import type { FunctionInputPayload } from "@/modules/execution-factory/types/function-input";
import type {
  ToolDebugResult,
  ToolRecord,
  ToolRunLogEntry,
  ToolIoSpec,
} from "@/modules/execution-factory/types/tool";
import { maskDebugRequestSecrets } from "@/modules/execution-factory/utils/debug-secrets";
import {
  buildHttpDebugInitialValues,
  buildHttpDebugRequest,
  type HttpDebugFormValues,
} from "@/modules/execution-factory/utils/http-debug-request";

import { DebugResultPanel } from "./DebugResultPanel";
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
  const [form] = Form.useForm<HttpDebugFormValues>();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ToolDebugResult | null>(null);

  const initialValues = useMemo(
    () => buildHttpDebugInitialValues(ioSpec, functionInput, defaultRequestBody),
    [defaultRequestBody, functionInput, ioSpec],
  );

  useEffect(() => {
    if (!open) {
      form.resetFields();
      setError(null);
      setResult(null);
      return;
    }

    form.setFieldsValue(initialValues);
  }, [form, initialValues, open]);

  const handleDebug = async () => {
    if (!record) {
      return;
    }

    setSubmitting(true);
    setError(null);
    setResult(null);

    try {
      const values = await form.validateFields();
      const debugRequest = buildHttpDebugRequest(values, ioSpec, record.path);
      const debugResult = await debugTool(boxId, record.toolId, debugRequest);
      setResult(debugResult);
      onRunComplete?.({
        id: `${Date.now()}`,
        timestamp: Date.now(),
        statusCode: debugResult.statusCode,
        durationMs: debugResult.durationMs,
        error: debugResult.error,
        body: debugResult.body,
        requestBody: maskDebugRequestSecrets(debugRequest),
      });
    } catch (caughtError) {
      setError(extractRequestErrorMessage(caughtError));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      /*
        请求体编辑器 + 结果 JSON 是这个弹窗的主体，720 宽会把每行都折断。放到
        1040 并让正文自己滚（而不是整页滚），底部的「运行调试」才始终点得到。
      */
      className={styles.modal}
      confirmLoading={submitting}
      destroyOnClose
      okText={t("executionFactory.runDebug")}
      onCancel={onClose}
      onOk={() => {
        void handleDebug();
      }}
      open={open}
      title={
        <span className={styles.title}>
          <span>{t("executionFactory.toolDebugTitle")}</span>
          {record ? <span className={styles.titleName}>{record.name}</span> : null}
        </span>
      }
      width="min(1040px, 92vw)"
    >
      <Typography.Paragraph type="secondary">{t("executionFactory.debugSampleHint")}</Typography.Paragraph>
      <Form form={form} layout="vertical">
        <HttpDebugRequestFields
          ioSpec={ioSpec}
          method={record?.method}
          path={record?.path}
          serverUrl={record?.serverUrl}
        />
      </Form>
      {error ? <Alert message={error} showIcon style={{ marginBottom: 16 }} type="error" /> : null}
      {result ? (
        <DebugResultPanel
          error={Boolean(result.error)}
          meta={`HTTP ${result.statusCode || "-"}${
            typeof result.durationMs === "number" ? ` · ${result.durationMs} ms` : ""
          }`}
          testId="tool-debug-result"
          value={result}
        />
      ) : null}
    </Modal>
  );
}
