import { Alert, Drawer, Form, Input, Space, Steps, Table } from "antd";

import { useEffect, useState } from "react";

import { useTranslation } from "react-i18next";

import { AppButton } from "@/framework/ui/common/AppButton";
import { CategorySelect } from "@/modules/execution-factory-lab/components/CategorySelect";
import {
  parseMcpSse,
  registerMcpCapability,
} from "@/modules/execution-factory-lab/services/capabilities-lab.service";
import { useLabFeatures } from "@/modules/execution-factory-lab/hooks/useLabFeatures";
import type { CapabilityRecord, McpParsedTool } from "@/modules/execution-factory-lab/types/capability";

type RegisterMcpDrawerProps = {
  open: boolean;
  onClose: () => void;
  onRegistered?: (capability: CapabilityRecord) => void;
};

type FormValues = {
  name: string;
  description?: string;
  url: string;
  category?: string;
};

export function RegisterMcpDrawer({ open, onClose, onRegistered }: RegisterMcpDrawerProps) {
  const { t } = useTranslation();
  const { features } = useLabFeatures();
  const [form] = Form.useForm<FormValues>();
  const [submitting, setSubmitting] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tools, setTools] = useState<McpParsedTool[]>([]);
  const [wizardStep, setWizardStep] = useState(0);
  const requireParse = features.mcp_sse_wizard;

  useEffect(() => {
    if (!open) {
      form.resetFields();
      setTools([]);
      setWizardStep(0);
      setError(null);
    }
  }, [form, open]);

  const handleParse = async () => {
    const values = await form.validateFields(["url"]);
    setParsing(true);
    setError(null);
    try {
      const parsed = await parseMcpSse({ url: values.url.trim(), mode: "sse" });
      setTools(parsed);
      setWizardStep(1);
    } catch (parseError) {
      setError(parseError instanceof Error ? parseError.message : String(parseError));
    } finally {
      setParsing(false);
    }
  };

  const handleSubmit = async (values: FormValues) => {
    if (requireParse && tools.length === 0) {
      setError(t("executionFactoryLab.mcpParseRequired"));
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const capability = await registerMcpCapability({
        name: values.name.trim(),
        description: values.description?.trim(),
        url: values.url.trim(),
        mode: "sse",
        category: values.category,
      });
      form.resetFields();
      setTools([]);
      setWizardStep(0);
      onRegistered?.(capability);
      onClose();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : String(submitError));
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = !requireParse || tools.length > 0;

  return (
    <Drawer
      destroyOnClose
      onClose={onClose}
      open={open}
      title={t("executionFactoryLab.registerMcpTitle")}
      width={640}
    >
      {requireParse ? (
        <Steps
          current={wizardStep}
          items={[
            { title: t("executionFactoryLab.mcpWizardStepConnect") },
            { title: t("executionFactoryLab.mcpWizardStepVerify") },
            { title: t("executionFactoryLab.mcpWizardStepRegister") },
          ]}
          size="small"
          style={{ marginBottom: 20 }}
        />
      ) : null}

      {error ? <Alert message={error} showIcon style={{ marginBottom: 12 }} type="error" /> : null}

      {requireParse && tools.length === 0 ? (
        <Alert
          message={t("executionFactoryLab.mcpParseRequired")}
          showIcon
          style={{ marginBottom: 12 }}
          type="warning"
        />
      ) : null}

      <Form form={form} layout="vertical" onFinish={(values) => void handleSubmit(values)}>
        <Form.Item
          label={t("executionFactoryLab.summaryLabel")}
          name="name"
          rules={[{ required: true, message: t("executionFactoryLab.summaryLabel") }]}
        >
          <Input />
        </Form.Item>
        <Form.Item label={t("executionFactoryLab.descriptionLabel")} name="description">
          <Input.TextArea autoSize={{ minRows: 2, maxRows: 4 }} />
        </Form.Item>
        <Form.Item
          label={t("executionFactoryLab.mcpUrlLabel")}
          name="url"
          rules={[{ required: true, message: t("executionFactoryLab.mcpUrlLabel") }]}
        >
          <Input placeholder="http://ef-mcp-mock:8096/sse" />
        </Form.Item>
        <Form.Item label={t("executionFactoryLab.categoryLabel")} name="category" initialValue="other_category">
          <CategorySelect />
        </Form.Item>
        <Space style={{ marginBottom: 16 }}>
          {requireParse ? (
            <AppButton loading={parsing} onClick={() => void handleParse()} type="default">
              {t("executionFactoryLab.parseMcpSseAction")}
            </AppButton>
          ) : null}
          <AppButton disabled={!canSubmit} htmlType="submit" loading={submitting} type="primary">
            {t("executionFactoryLab.registerMcpSubmit")}
          </AppButton>
        </Space>
        {tools.length > 0 ? (
          <Table
            columns={[
              { title: t("executionFactoryLab.mcpToolNamePlaceholder"), dataIndex: "name" },
              { title: t("executionFactoryLab.descriptionLabel"), dataIndex: "description" },
            ]}
            dataSource={tools.map((tool) => ({ ...tool, key: tool.name }))}
            pagination={false}
            size="small"
          />
        ) : null}
      </Form>
    </Drawer>
  );
}
