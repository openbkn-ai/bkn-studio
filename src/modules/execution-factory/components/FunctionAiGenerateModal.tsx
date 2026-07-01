/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Form, Input, Modal, Select } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import {
  generateFunction,
  getFunctionPrompt,
} from "@/modules/execution-factory/services/function.service";
import type { FunctionAiGenerateType } from "@/modules/execution-factory/types/function";

type FunctionAiGenerateModalProps = {
  initialCode?: string;
  onApply?: (content: unknown) => void;
  onClose: () => void;
  open: boolean;
};

type GenerateFormValues = {
  code?: string;
  query?: string;
  type: FunctionAiGenerateType;
};

export function FunctionAiGenerateModal({
  initialCode,
  onApply,
  onClose,
  open,
}: FunctionAiGenerateModalProps) {
  const { t } = useTranslation();
  const [form] = Form.useForm<GenerateFormValues>();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<unknown>(null);
  const generateType = Form.useWatch("type", form) as FunctionAiGenerateType | undefined;

  useEffect(() => {
    if (!open) {
      form.resetFields();
      setError(null);
      setResult(null);
      return;
    }

    form.setFieldsValue({
      code: initialCode,
      type: "python_function_generator",
    });

    void (async () => {
      try {
        const promptResult = await getFunctionPrompt("python_function_generator");

        if (promptResult.prompt) {
          form.setFieldValue("query", promptResult.prompt);
        }
      } catch {
        // Prompt template is optional for local mock mode.
      }
    })();
  }, [form, initialCode, open]);

  const handleGenerate = async () => {
    setSubmitting(true);
    setError(null);
    setResult(null);

    try {
      const values = await form.validateFields();
      const generateResult = await generateFunction({
        code: values.code,
        query: values.query,
        type: values.type,
      });
      setResult(generateResult.content ?? generateResult);
    } catch (caughtError) {
      setError(extractRequestErrorMessage(caughtError));
    } finally {
      setSubmitting(false);
    }
  };

  const handleApply = () => {
    if (result !== null && result !== undefined) {
      onApply?.(result);
    }

    onClose();
  };

  return (
    <Modal
      destroyOnClose
      footer={null}
      onCancel={onClose}
      open={open}
      title={t("executionFactory.functionAiGenerateTitle")}
      width={760}
    >
      <Form form={form} layout="vertical">
        <Form.Item label={t("executionFactory.functionAiGenerateType")} name="type">
          <Select
            options={(
              ["python_function_generator", "metadata_param_generator"] as FunctionAiGenerateType[]
            ).map((type) => ({
              label: type,
              value: type,
            }))}
          />
        </Form.Item>
        {generateType === "python_function_generator" ? (
          <Form.Item
            label={t("executionFactory.functionAiGenerateQuery")}
            name="query"
            rules={[{ required: true, message: t("common.required") }]}
          >
            <Input.TextArea rows={4} />
          </Form.Item>
        ) : (
          <Form.Item
            label={t("executionFactory.functionCode")}
            name="code"
            rules={[{ required: true, message: t("common.required") }]}
          >
            <Input.TextArea rows={8} />
          </Form.Item>
        )}
      </Form>
      {error ? <Alert message={error} showIcon style={{ marginBottom: 16 }} type="error" /> : null}
      {result ? (
        <Alert
          description={
            <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
              {typeof result === "string" ? result : JSON.stringify(result, null, 2)}
            </pre>
          }
          message={t("executionFactory.functionAiGenerateResultTitle")}
          showIcon
          style={{ marginBottom: 16 }}
          type="success"
        />
      ) : null}
      <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
        <AppButton onClick={onClose}>{t("common.cancel")}</AppButton>
        <AppButton
          loading={submitting}
          onClick={() => {
            void handleGenerate();
          }}
          type="primary"
        >
          {t("executionFactory.functionAiGenerate")}
        </AppButton>
        {result ? (
          <AppButton onClick={handleApply} type="primary">
            {t("executionFactory.functionAiGenerateApply")}
          </AppButton>
        ) : null}
      </div>
    </Modal>
  );
}
