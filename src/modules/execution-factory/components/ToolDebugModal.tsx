import { Alert, Form, Input, Modal, Typography } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { debugTool } from "@/modules/execution-factory/services/tool.service";
import type {
  ToolDebugResult,
  ToolDetail,
  ToolRecord,
  ToolRunLogEntry,
  ToolIoSpec,
} from "@/modules/execution-factory/types/tool";
import { buildDefaultDebugBody } from "@/modules/execution-factory/utils/tool-io";

type ToolDebugModalProps = {
  boxId: string;
  defaultRequestBody?: string;
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

  useEffect(() => {
    if (!open) {
      form.resetFields();
      setError(null);
      setResult(null);
      return;
    }

    form.setFieldsValue({
      requestBody: defaultRequestBody ?? buildDefaultDebugBody(ioSpec),
    });
  }, [defaultRequestBody, form, ioSpec, open]);

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
      <Form form={form} layout="vertical">
        <Form.Item label={t("executionFactory.debugRequestBody")} name="requestBody">
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
          type={result.error ? "warning" : "success"}
        />
      ) : null}
    </Modal>
  );
}
