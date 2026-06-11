import { Alert, Drawer, Form, Input, Switch } from "antd";

import { useMemo, useState } from "react";

import { useTranslation } from "react-i18next";

import { AppButton } from "@/framework/ui/common/AppButton";
import { createHttpCapability } from "@/modules/execution-factory-lab/services/capabilities-lab.service";
import type { CapabilityRecord } from "@/modules/execution-factory-lab/types/capability";
import {
  buildOpenApiFromQuickApi,
  parseCurlCommand,
} from "@/modules/execution-factory-lab/utils/curl-to-openapi";

type AddHttpCapabilityDrawerProps = {
  open: boolean;
  onClose: () => void;
  onCreated?: (capability: CapabilityRecord) => void;
};

type FormValues = {
  curlText: string;
  summary: string;
  description?: string;
  orchestrationEnabled?: boolean;
};

export function AddHttpCapabilityDrawer({
  open,
  onClose,
  onCreated,
}: AddHttpCapabilityDrawerProps) {
  const { t } = useTranslation();
  const [form] = Form.useForm<FormValues>();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const curlText = Form.useWatch("curlText", form) ?? "";

  const parsed = useMemo(() => parseCurlCommand(curlText), [curlText]);

  const handleSubmit = async (values: FormValues) => {
    setError(null);

    const parseResult = parseCurlCommand(values.curlText);
    if (!parseResult.ok) {
      setError(parseResult.reason);
      return;
    }

    const openapiSpec = buildOpenApiFromQuickApi({
      method: parseResult.value.method,
      serverUrl: parseResult.value.serverUrl,
      path: parseResult.value.path,
      summary: values.summary || parseResult.value.summary,
      description: values.description,
      queryParams: parseResult.value.queryParams,
    });

    setSubmitting(true);

    try {
      const capability = await createHttpCapability({
        openapiSpec,
        serviceUrl: parseResult.value.serverUrl,
        name: values.summary || parseResult.value.summary,
        description: values.description,
        orchestrationEnabled: values.orchestrationEnabled,
      });

      onCreated?.(capability);
      form.resetFields();
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
      title={t("executionFactoryLab.addDrawerTitle")}
      width={560}
      extra={
        <AppButton
          loading={submitting}
          onClick={() => form.submit()}
          type="primary"
        >
          {t("executionFactoryLab.submitAdd")}
        </AppButton>
      }
    >
      <p style={{ color: "rgba(0,0,0,0.55)", marginTop: 0 }}>
        {t("executionFactoryLab.addDrawerHint")}
      </p>

      {error ? <Alert message={error} showIcon style={{ marginBottom: 12 }} type="error" /> : null}

      <Form
        form={form}
        layout="vertical"
        onFinish={(values) => void handleSubmit(values)}
      >
        <Form.Item
          label={t("executionFactoryLab.curlLabel")}
          name="curlText"
          rules={[{ required: true, message: "required" }]}
        >
          <Input.TextArea autoSize={{ minRows: 4, maxRows: 10 }} placeholder="curl https://..." />
        </Form.Item>

        {parsed.ok ? (
          <Alert
            message={`${parsed.value.method} ${parsed.value.serverUrl}${parsed.value.path}`}
            style={{ marginBottom: 12 }}
            type="info"
          />
        ) : null}

        <Form.Item label={t("executionFactoryLab.summaryLabel")} name="summary">
          <Input placeholder={parsed.ok ? parsed.value.summary : undefined} />
        </Form.Item>

        <Form.Item label={t("executionFactoryLab.descriptionLabel")} name="description">
          <Input.TextArea autoSize={{ minRows: 2, maxRows: 5 }} />
        </Form.Item>

        <Form.Item
          label={t("executionFactoryLab.orchestrationSwitch")}
          name="orchestrationEnabled"
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>
        <p style={{ color: "rgba(0,0,0,0.45)", marginTop: -8 }}>
          {t("executionFactoryLab.orchestrationHint")}
        </p>
      </Form>
    </Drawer>
  );
}
