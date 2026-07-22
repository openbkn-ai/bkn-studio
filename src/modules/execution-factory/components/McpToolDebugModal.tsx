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
import { debugMcpTool } from "@/modules/execution-factory/services/mcp.service";
import type { McpToolDebugResult } from "@/modules/execution-factory/types/mcp";
import { buildDefaultDebugBody } from "@/modules/execution-factory/utils/generate-sample-json";

import { JsonCodeBlock } from "./JsonCodeBlock";
import { JsonEditor } from "./JsonEditor";

type McpToolDebugModalProps = {
  inputSchema?: unknown;
  mcpId: string;
  onClose: () => void;
  open: boolean;
  toolName: string;
};

type DebugFormValues = {
  argumentsPayload?: string;
};

export function McpToolDebugModal({
  inputSchema,
  mcpId,
  onClose,
  open,
  toolName,
}: McpToolDebugModalProps) {
  const { t } = useTranslation();
  const [form] = Form.useForm<DebugFormValues>();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<McpToolDebugResult | null>(null);

  const generatedBody = useMemo(
    () => buildDefaultDebugBody({ inputSchema }),
    [inputSchema],
  );

  useEffect(() => {
    if (!open) {
      form.resetFields();
      setError(null);
      setResult(null);
      return;
    }

    form.setFieldsValue({ argumentsPayload: generatedBody });
  }, [form, generatedBody, open]);

  const handleDebug = async () => {
    setSubmitting(true);
    setError(null);
    setResult(null);

    try {
      const values = await form.validateFields();
      let argumentsPayload: Record<string, unknown> | undefined;

      if (values.argumentsPayload?.trim()) {
        argumentsPayload = JSON.parse(values.argumentsPayload) as Record<string, unknown>;
      }

      setResult(
        await debugMcpTool(mcpId, toolName, {
          arguments: argumentsPayload,
        }),
      );
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
      okText={t("executionFactory.debug")}
      onCancel={onClose}
      onOk={() => {
        void handleDebug();
      }}
      open={open}
      title={t("executionFactory.mcpToolDebugTitle", { tool: toolName })}
      width={760}
    >
      <Typography.Paragraph type="secondary">{t("executionFactory.debugSampleHint")}</Typography.Paragraph>
      <Form form={form} layout="vertical">
        <Form.Item label={t("executionFactory.debugRequestBody")} name="argumentsPayload">
          <JsonEditor height={180} />
        </Form.Item>
      </Form>
      {error ? <Alert message={error} showIcon style={{ marginBottom: 16 }} type="error" /> : null}
      {result ? (
        <Alert
          description={
            <JsonCodeBlock value={result} />
          }
          message={t("executionFactory.debugResultTitle")}
          showIcon
          type={result.isError ? "warning" : "success"}
        />
      ) : null}
    </Modal>
  );
}
