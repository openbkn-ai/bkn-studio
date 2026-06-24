import { Alert, Form, Input, Modal } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { AppButton } from "@/framework/ui/common/AppButton";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { FunctionAiGenerateModal } from "@/modules/execution-factory/components/FunctionAiGenerateModal";
import { executeFunction } from "@/modules/execution-factory/services/function.service";
import type { FunctionExecuteResult } from "@/modules/execution-factory/types/function";

type FunctionExecuteModalProps = {
  initialCode?: string;
  onClose: () => void;
  open: boolean;
};

type ExecuteFormValues = {
  code: string;
  eventPayload?: string;
};

export function FunctionExecuteModal({
  initialCode,
  onClose,
  open,
}: FunctionExecuteModalProps) {
  const { t } = useTranslation();
  const [form] = Form.useForm<ExecuteFormValues>();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FunctionExecuteResult | null>(null);
  const [aiGenerateOpen, setAiGenerateOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      form.resetFields();
      setError(null);
      setResult(null);
      return;
    }

    form.setFieldsValue({
      code: initialCode ?? "def handler(event):\n    return event",
      eventPayload: "{}",
    });
  }, [form, initialCode, open]);

  const handleExecute = async () => {
    setSubmitting(true);
    setError(null);
    setResult(null);

    try {
      const values = await form.validateFields();
      let event: Record<string, unknown> | undefined;

      if (values.eventPayload?.trim()) {
        event = JSON.parse(values.eventPayload) as Record<string, unknown>;
      }

      setResult(
        await executeFunction({
          code: values.code,
          event,
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
      okText={t("executionFactory.runFunction")}
      onCancel={onClose}
      onOk={() => {
        void handleExecute();
      }}
      open={open}
      title={t("executionFactory.functionExecuteTitle")}
      width={760}
    >
      <Form form={form} layout="vertical">
        <Form.Item label={t("executionFactory.functionCode")} name="code">
          <Input.TextArea rows={8} />
        </Form.Item>
        <AppButton onClick={() => setAiGenerateOpen(true)} style={{ marginBottom: 16 }}>
          {t("executionFactory.functionAiGenerate")}
        </AppButton>
        <Form.Item label={t("executionFactory.debugRequestBody")} name="eventPayload">
          <Input.TextArea placeholder="{}" rows={4} />
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
      <FunctionAiGenerateModal
        initialCode={form.getFieldValue("code")}
        onApply={(content) => {
          if (typeof content === "string") {
            form.setFieldValue("code", content);
          }
        }}
        onClose={() => setAiGenerateOpen(false)}
        open={aiGenerateOpen}
      />
    </Modal>
  );
}
