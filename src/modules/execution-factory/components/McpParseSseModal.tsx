/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Form, Input, Modal, Typography } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { parseMcpSse } from "@/modules/execution-factory/services/mcp.service";
import type { McpParseSseResult } from "@/modules/execution-factory/types/mcp";

type McpParseSseModalProps = {
  onClose: () => void;
  onParsed?: (url: string, result: McpParseSseResult) => void;
  open: boolean;
};

type ParseFormValues = {
  url: string;
};

export function McpParseSseModal({ onClose, onParsed, open }: McpParseSseModalProps) {
  const { t } = useTranslation();
  const [form] = Form.useForm<ParseFormValues>();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<McpParseSseResult | null>(null);

  useEffect(() => {
    if (!open) {
      form.resetFields();
      setError(null);
      setResult(null);
    }
  }, [form, open]);

  const handleParse = async () => {
    setSubmitting(true);
    setError(null);
    setResult(null);

    try {
      const values = await form.validateFields();
      const parseResult = await parseMcpSse({ url: values.url });
      setResult(parseResult);
      onParsed?.(values.url, parseResult);
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
      okText={t("executionFactory.parseSse")}
      onCancel={onClose}
      onOk={() => {
        void handleParse();
      }}
      open={open}
      title={t("executionFactory.parseSseTitle")}
      width={720}
    >
      <Form form={form} layout="vertical">
        <Form.Item
          label={t("executionFactory.serviceUrl")}
          name="url"
          rules={[{ required: true, message: t("common.required") }]}
        >
          <Input placeholder="http://localhost:8080/mcp/sse" />
        </Form.Item>
      </Form>
      {error ? <Alert message={error} showIcon style={{ marginBottom: 16 }} type="error" /> : null}
      {result ? (
        <Alert
          description={
            <div>
              {result.tools.map((tool) => (
                <Typography.Paragraph key={tool.name} style={{ marginBottom: 8 }}>
                  <strong>{tool.name}</strong>
                  {tool.description ? ` — ${tool.description}` : null}
                </Typography.Paragraph>
              ))}
            </div>
          }
          message={t("executionFactory.parseSseResultTitle")}
          showIcon
          type="success"
        />
      ) : null}
    </Modal>
  );
}
