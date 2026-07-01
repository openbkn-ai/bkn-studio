/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Divider, Drawer, Form, Input, Space, Tag, Typography } from "antd";

import { useEffect, useMemo, useState } from "react";

import { useTranslation } from "react-i18next";

import { AppButton } from "@/framework/ui/common/AppButton";
import { LabPermissionHint } from "@/modules/execution-factory-lab/components/LabPermissionHint";
import { executionFactoryLabPermissions } from "@/modules/execution-factory-lab/permissions";
import {
  createFunctionCapability,
  executePython,
  getPythonTemplate,
} from "@/modules/execution-factory-lab/services/capabilities-lab.service";
import type {
  CapabilityRecord,
  ExecutePythonResult,
} from "@/modules/execution-factory-lab/types/capability";
import { generateFunctionCode } from "@/modules/execution-factory-lab/utils/function-code-template";

const { Paragraph, Text, Title } = Typography;

type AddFunctionCapabilityDrawerProps = {
  open: boolean;
  onClose: () => void;
  onCreated?: (capability: CapabilityRecord) => void;
};

type FormValues = {
  name: string;
  description?: string;
  intent?: string;
  inputExample?: string;
  outputExample?: string;
  code: string;
};

const DEFAULT_INPUT_EXAMPLE = '{\n  "x": 1\n}';
const DEFAULT_OUTPUT_EXAMPLE = '{\n  "result": 1\n}';
const FALLBACK_TEMPLATE = `def handler(event):
    return event
`;

function parseJsonObject(value?: string): Record<string, unknown> | undefined {
  if (!value?.trim()) {
    return undefined;
  }

  const parsed = JSON.parse(value) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Expected a JSON object");
  }

  return parsed as Record<string, unknown>;
}

function getJsonType(value: unknown): string {
  if (Array.isArray(value)) {
    return "array";
  }
  if (value === null) {
    return "null";
  }
  return typeof value;
}

function inferIoDefinitions(example?: string, fallbackName = "event") {
  try {
    const parsed = parseJsonObject(example);
    const entries = Object.entries(parsed ?? {});
    if (entries.length === 0) {
      return [{ name: fallbackName, type: "object" }];
    }

    return entries.map(([name, value]) => ({
      name,
      type: getJsonType(value),
    }));
  } catch {
    return [{ name: fallbackName, type: "object" }];
  }
}

function formatRunResult(result: ExecutePythonResult) {
  return JSON.stringify(
    {
      output: result.output,
      stdout: result.stdout,
      stderr: result.stderr,
      error: result.error,
      durationMs: result.durationMs,
    },
    null,
    2,
  );
}

export function AddFunctionCapabilityDrawer({
  open,
  onClose,
  onCreated,
}: AddFunctionCapabilityDrawerProps) {
  const { t } = useTranslation();
  const [form] = Form.useForm<FormValues>();
  const [submitting, setSubmitting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runResult, setRunResult] = useState<ExecutePythonResult | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [hasSuccessfulRun, setHasSuccessfulRun] = useState(false);
  const [templateCode, setTemplateCode] = useState(FALLBACK_TEMPLATE);

  const code = Form.useWatch("code", form);
  const inputExample = Form.useWatch("inputExample", form);
  const outputExample = Form.useWatch("outputExample", form);
  const name = Form.useWatch("name", form);

  const canCreate = Boolean(name?.trim() && code?.trim() && hasSuccessfulRun);

  const inferredIoPreview = useMemo(
    () => ({
      inputs: inferIoDefinitions(inputExample, "event"),
      outputs: inferIoDefinitions(outputExample, "result"),
    }),
    [inputExample, outputExample],
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    setError(null);
    setRunResult(null);
    setRunError(null);
    setHasSuccessfulRun(false);
    form.setFieldsValue({
      inputExample: DEFAULT_INPUT_EXAMPLE,
      outputExample: DEFAULT_OUTPUT_EXAMPLE,
    });

    void getPythonTemplate()
      .then((template) => {
        const templateText = typeof template === "string" ? template : "";
        const nextTemplate = templateText.trim() ? templateText : FALLBACK_TEMPLATE;
        setTemplateCode(nextTemplate);
        form.setFieldsValue({ code: nextTemplate });
      })
      .catch(() => {
        setTemplateCode(FALLBACK_TEMPLATE);
        form.setFieldsValue({ code: FALLBACK_TEMPLATE });
      });
  }, [form, open]);

  const resetRunState = () => {
    setRunResult(null);
    setRunError(null);
    setHasSuccessfulRun(false);
  };

  const handleGenerateCode = () => {
    const values = form.getFieldsValue();
    form.setFieldsValue({ code: generateFunctionCode(values) });
    resetRunState();
  };

  const handleUseTemplate = () => {
    form.setFieldsValue({ code: templateCode });
    resetRunState();
  };

  const handleExecute = async () => {
    setTesting(true);
    setRunResult(null);
    setRunError(null);
    setHasSuccessfulRun(false);
    try {
      const values = await form.validateFields(["code", "inputExample"]);
      const event = parseJsonObject(values.inputExample);
      const result = await executePython({ code: values.code, event });
      setRunResult(result);
      if (result.error) {
        setRunError(result.error);
      } else {
        setHasSuccessfulRun(true);
      }
    } catch (executeError) {
      setRunError(executeError instanceof Error ? executeError.message : String(executeError));
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = async (values: FormValues) => {
    if (!hasSuccessfulRun) {
      setError(t("executionFactoryLab.functionCreateNeedsRun"));
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const capability = await createFunctionCapability({
        name: values.name.trim(),
        description: values.description?.trim() || values.intent?.trim(),
        code: values.code,
        inputs: inferredIoPreview.inputs,
        outputs: inferredIoPreview.outputs,
      });
      form.resetFields();
      setRunResult(null);
      setRunError(null);
      setHasSuccessfulRun(false);
      onCreated?.(capability);
      onClose();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : String(submitError));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Drawer
      destroyOnClose
      onClose={onClose}
      open={open}
      title={t("executionFactoryLab.addFunctionWizardTitle")}
      width={760}
    >
      {error ? <Alert message={error} showIcon style={{ marginBottom: 12 }} type="error" /> : null}

      <Space direction="vertical" size={4} style={{ marginBottom: 16, width: "100%" }}>
        <Title level={5} style={{ margin: 0 }}>
          {t("executionFactoryLab.functionWizardIntroTitle")}
        </Title>
        <Paragraph style={{ margin: 0 }}>
          {t("executionFactoryLab.functionWizardIntroBody")}
        </Paragraph>
      </Space>

      <Form
        form={form}
        layout="vertical"
        onFinish={(values) => void handleSubmit(values)}
        onValuesChange={(_, allValues) => {
          if (
            allValues.code !== code ||
            allValues.inputExample !== inputExample ||
            allValues.outputExample !== outputExample
          ) {
            resetRunState();
          }
        }}
      >
        <Divider orientation="left">{t("executionFactoryLab.functionWizardStepDescribe")}</Divider>
        <Form.Item
          label={t("executionFactoryLab.summaryLabel")}
          name="name"
          rules={[{ required: true, message: t("executionFactoryLab.summaryLabel") }]}
        >
          <Input placeholder={t("executionFactoryLab.functionNamePlaceholder")} />
        </Form.Item>
        <Form.Item label={t("executionFactoryLab.functionIntentLabel")} name="intent">
          <Input.TextArea
            autoSize={{ minRows: 2, maxRows: 4 }}
            placeholder={t("executionFactoryLab.functionIntentPlaceholder")}
          />
        </Form.Item>
        <Form.Item label={t("executionFactoryLab.descriptionLabel")} name="description">
          <Input.TextArea
            autoSize={{ minRows: 2, maxRows: 4 }}
            placeholder={t("executionFactoryLab.functionDescriptionPlaceholder")}
          />
        </Form.Item>

        <Divider orientation="left">{t("executionFactoryLab.functionWizardStepExamples")}</Divider>
        <Form.Item
          label={t("executionFactoryLab.functionInputExampleLabel")}
          name="inputExample"
          rules={[{ required: true, message: t("executionFactoryLab.functionInputExampleLabel") }]}
        >
          <Input.TextArea autoSize={{ minRows: 4, maxRows: 8 }} />
        </Form.Item>
        <Form.Item label={t("executionFactoryLab.functionOutputExampleLabel")} name="outputExample">
          <Input.TextArea autoSize={{ minRows: 4, maxRows: 8 }} />
        </Form.Item>
        <Space size={8} wrap>
          <Text type="secondary">{t("executionFactoryLab.functionIoPreview")}</Text>
          {inferredIoPreview.inputs.map((item) => (
            <Tag key={`input-${item.name}`}>{`in: ${item.name} (${item.type})`}</Tag>
          ))}
          {inferredIoPreview.outputs.map((item) => (
            <Tag key={`output-${item.name}`} color="blue">{`out: ${item.name} (${item.type})`}</Tag>
          ))}
        </Space>

        <Divider orientation="left">{t("executionFactoryLab.functionWizardStepCode")}</Divider>
        <Space style={{ marginBottom: 8 }} wrap>
          <AppButton onClick={handleGenerateCode}>
            {t("executionFactoryLab.functionGenerateCodeAction")}
          </AppButton>
          <AppButton onClick={handleUseTemplate}>
            {t("executionFactoryLab.functionUseTemplateAction")}
          </AppButton>
        </Space>
        <Form.Item
          label={t("executionFactoryLab.functionCodeLabel")}
          name="code"
          rules={[{ required: true, message: t("executionFactoryLab.functionCodeLabel") }]}
        >
          <Input.TextArea
            autoSize={{ minRows: 12, maxRows: 24 }}
            onChange={resetRunState}
          />
        </Form.Item>

        <Divider orientation="left">{t("executionFactoryLab.functionWizardStepRun")}</Divider>
        <Space direction="vertical" style={{ width: "100%" }}>
          <LabPermissionHint permissions={executionFactoryLabPermissions.functionDebug}>
            <AppButton loading={testing} onClick={() => void handleExecute()} type="primary">
              {t("executionFactoryLab.functionRunExampleAction")}
            </AppButton>
          </LabPermissionHint>
          {hasSuccessfulRun ? (
            <Alert
              message={t("executionFactoryLab.functionRunSuccess")}
              showIcon
              type="success"
            />
          ) : null}
          {runError ? <Alert message={runError} showIcon type="error" /> : null}
          {runResult ? (
            <pre
              style={{
                background: "#f5f5f5",
                borderRadius: 8,
                margin: 0,
                maxHeight: 300,
                overflow: "auto",
                padding: 12,
              }}
            >
              {formatRunResult(runResult)}
            </pre>
          ) : null}
        </Space>

        <Divider />
        <Space style={{ justifyContent: "flex-end", width: "100%" }}>
          <AppButton disabled={submitting || testing} onClick={onClose}>
            {t("executionFactoryLab.cancelEditAction")}
          </AppButton>
          <AppButton
            disabled={!canCreate}
            htmlType="submit"
            loading={submitting}
            type="primary"
          >
            {hasSuccessfulRun
              ? t("executionFactoryLab.submitAddFunction")
              : t("executionFactoryLab.functionCreateDisabledAction")}
          </AppButton>
        </Space>
      </Form>
    </Drawer>
  );
}
