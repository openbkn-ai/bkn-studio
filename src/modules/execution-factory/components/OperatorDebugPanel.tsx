import { Alert, Form, Input, Typography } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { debugOperator } from "@/modules/execution-factory/services/operator.service";
import type {
  OperatorDebugResult,
  OperatorRecord,
  OperatorRunLogEntry,
} from "@/modules/execution-factory/types/operator";

type OperatorDebugPanelProps = {
  onRunComplete?: (entry: OperatorRunLogEntry) => void;
  record: OperatorRecord | null;
};

type DebugFormValues = {
  requestBody?: string;
};

export function OperatorDebugPanel({ onRunComplete, record }: OperatorDebugPanelProps) {
  const { t } = useTranslation();
  const [form] = Form.useForm<DebugFormValues>();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<OperatorDebugResult | null>(null);

  useEffect(() => {
    form.setFieldsValue({ requestBody: "{}" });
    setError(null);
    setResult(null);
  }, [form, record?.operatorId, record?.version]);

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

      const debugResult = await debugOperator({
        body,
        operatorId: record.operatorId,
        version: record.version,
      });
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

  if (!record) {
    return null;
  }

  return (
    <div>
      <Form form={form} layout="vertical">
        <Form.Item label={t("executionFactory.debugRequestBody")} name="requestBody">
          <Input.TextArea rows={6} />
        </Form.Item>
      </Form>
      {error ? <Alert message={error} showIcon style={{ marginBottom: 12 }} type="error" /> : null}
      <AppButton loading={submitting} onClick={() => void handleDebug()} type="primary">
        {t("executionFactory.runDebug")}
      </AppButton>
      {result ? (
        <div style={{ marginTop: 16 }}>
          <Typography.Title level={5}>{t("executionFactory.debugResultTitle")}</Typography.Title>
          <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      ) : null}
    </div>
  );
}
