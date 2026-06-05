import { Form, Input, Radio, Result, Select } from "antd";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import type { McpFormSceneProps } from "@/modules/execution-factory/contracts/scenes";
import { useAppServices } from "@/framework/context/use-app-services";
import { PermissionGate } from "@/framework/permission/PermissionGate";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { CrudFormPage } from "@/framework/scaffold/CrudFormPage";
import { AppButton } from "@/framework/ui/common/AppButton";
import { McpParseSseModal } from "@/modules/execution-factory/components/McpParseSseModal";
import { registerMcp } from "@/modules/execution-factory/services/mcp.service";
import type { McpCreationType } from "@/modules/execution-factory/types/mcp";

import styles from "./UnitFormScene.module.css";

export function McpFormScene({ onBack, onSubmitSuccess }: McpFormSceneProps) {
  const { t } = useTranslation();
  const { message } = useAppServices();
  const navigate = useNavigate();
  const [form] = Form.useForm<{
    creationType: McpCreationType;
    description?: string;
    mode?: "sse" | "stream";
    name: string;
    url?: string;
  }>();
  const [submitting, setSubmitting] = useState(false);
  const [parseOpen, setParseOpen] = useState(false);
  const creationType = Form.useWatch("creationType", form) as McpCreationType | undefined;

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }

    void navigate("/execution-factory/mcp");
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    setSubmitting(true);

    try {
      await registerMcp({
        creationType: values.creationType,
        description: values.description,
        mode: values.mode,
        name: values.name,
        url: values.url,
      });
      void message.success(t("common.success"));

      if (onSubmitSuccess) {
        onSubmitSuccess();
        return;
      }

      void navigate("/execution-factory/mcp");
    } catch (error) {
      void message.error(extractRequestErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PermissionGate
      fallback={
        <Result status="403" subTitle={t("common.noPermission")} title="403" />
      }
      permissions="execution-factory:mcp:create"
    >
      <CrudFormPage
        description={t("executionFactory.mcpCreateDescription")}
        title={t("executionFactory.mcpCreateTitle")}
      >
        <div className={styles.formSurface}>
          <Form
            form={form}
            initialValues={{ creationType: "custom", mode: "sse" }}
            layout="vertical"
          >
            <Form.Item
              label={t("executionFactory.mcpName")}
              name="name"
              rules={[{ required: true, message: t("common.required") }]}
            >
              <Input />
            </Form.Item>
            <Form.Item label={t("common.description")} name="description">
              <Input.TextArea rows={3} />
            </Form.Item>
            <Form.Item
              label={t("executionFactory.mcpCreationType")}
              name="creationType"
              rules={[{ required: true, message: t("common.required") }]}
            >
              <Radio.Group>
                <Radio value="custom">custom</Radio>
                <Radio value="tool_imported">tool_imported</Radio>
              </Radio.Group>
            </Form.Item>
            {creationType === "custom" ? (
              <>
                <Form.Item label={t("executionFactory.mcpMode")} name="mode">
                  <Select
                    options={[
                      { label: "sse", value: "sse" },
                      { label: "stream", value: "stream" },
                    ]}
                  />
                </Form.Item>
                <Form.Item label={t("executionFactory.serviceUrl")} name="url">
                  <Input placeholder="http://localhost:8080/mcp" />
                </Form.Item>
                <AppButton onClick={() => setParseOpen(true)}>
                  {t("executionFactory.parseSse")}
                </AppButton>
              </>
            ) : null}
          </Form>
          <div className={styles.formActions}>
            <AppButton onClick={handleBack}>{t("common.cancel")}</AppButton>
            <AppButton
              loading={submitting}
              onClick={() => {
                void handleSubmit();
              }}
              type="primary"
            >
              {t("common.save")}
            </AppButton>
          </div>
        </div>
      </CrudFormPage>
      <McpParseSseModal
        onClose={() => setParseOpen(false)}
        onParsed={(url) => {
          form.setFieldValue("url", url);
        }}
        open={parseOpen}
      />
    </PermissionGate>
  );
}
