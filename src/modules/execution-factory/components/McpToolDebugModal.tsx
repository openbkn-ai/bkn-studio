import { Alert, Form, Input, Modal } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { debugMcpTool } from "@/modules/execution-factory/services/mcp.service";
import type { McpToolDebugResult } from "@/modules/execution-factory/types/mcp";

type McpToolDebugModalProps = {
  mcpId: string;
  onClose: () => void;
  open: boolean;
  toolName: string;
};

type DebugFormValues = {
  argumentsPayload?: string;
};

export function McpToolDebugModal({
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

  useEffect(() => {
    if (!open) {
      form.resetFields();
      setError(null);
      setResult(null);
      return;
    }

    form.setFieldsValue({ argumentsPayload: "{}" });
  }, [form, open]);

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
      <Form form={form} layout="vertical">
        <Form.Item label={t("executionFactory.debugRequestBody")} name="argumentsPayload">
          <Input.TextArea placeholder="{}" rows={6} />
        </Form.Item>
      </Form>
      {error ? <Alert message={error} showIcon style={{ marginBottom: 16 }} type="error" /> : null}
      {result ? (
        <Alert
          description={
            <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
              {JSON.stringify(result, null, 2)}
            </pre>
          }
          message={t("executionFactory.debugResultTitle")}
          showIcon
          type={result.isError ? "warning" : "success"}
        />
      ) : null}
    </Modal>
  );
}
