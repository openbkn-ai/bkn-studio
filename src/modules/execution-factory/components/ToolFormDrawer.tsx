import { Alert, Drawer, Form, Input, Radio, Spin } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { FunctionAiGenerateModal } from "@/modules/execution-factory/components/FunctionAiGenerateModal";
import { FunctionExecuteModal } from "@/modules/execution-factory/components/FunctionExecuteModal";
import {
  createTool,
  getTool,
  updateTool,
} from "@/modules/execution-factory/services/tool.service";
import type {
  ToolCreateInput,
  ToolEditInput,
  ToolMetadataType,
} from "@/modules/execution-factory/types/tool";

type ToolFormDrawerProps = {
  boxId: string;
  mode: "create" | "edit";
  onClose: () => void;
  onSuccess: () => void;
  open: boolean;
  toolId?: string;
};

type ToolFormValues = ToolCreateInput &
  ToolEditInput & {
    metadataType: ToolMetadataType;
  };

export function ToolFormDrawer({
  boxId,
  mode,
  onClose,
  onSuccess,
  open,
  toolId,
}: ToolFormDrawerProps) {
  const { t } = useTranslation();
  const { message } = useAppServices();
  const [form] = Form.useForm<ToolFormValues>();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [functionExecuteOpen, setFunctionExecuteOpen] = useState(false);
  const [functionAiGenerateOpen, setFunctionAiGenerateOpen] = useState(false);
  const [functionCode, setFunctionCode] = useState("");
  const metadataType = Form.useWatch("metadataType", form) as ToolMetadataType | undefined;

  useEffect(() => {
    if (!open) {
      return;
    }

    void (async () => {
      if (mode === "create") {
        form.setFieldsValue({ metadataType: "openapi" });
        return;
      }

      if (!toolId) {
        return;
      }

      setLoading(true);
      setLoadError(null);

      try {
        const record = await getTool(boxId, toolId);
        form.setFieldsValue({
          description: record.description,
          metadataType: record.metadataType ?? "openapi",
          name: record.name,
          useRule: record.useRule,
        });
      } catch (error) {
        setLoadError(extractRequestErrorMessage(error));
      } finally {
        setLoading(false);
      }
    })();
  }, [boxId, form, mode, open, toolId]);

  const handleSubmit = async () => {
    const values = await form.validateFields();
    setSubmitting(true);

    try {
      if (mode === "create") {
        await createTool(boxId, {
          metadataType: values.metadataType,
          openapiSpec: values.openapiSpec,
          useRule: values.useRule,
        });
      } else if (toolId) {
        await updateTool(boxId, toolId, {
          description: values.description,
          metadataType: values.metadataType,
          name: values.name,
          openapiSpec: values.openapiSpec,
          useRule: values.useRule,
        });
      }

      void message.success(t("common.success"));
      onSuccess();
      onClose();
    } catch (error) {
      void message.error(extractRequestErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Drawer
      destroyOnClose
      extra={
        <div style={{ display: "flex", gap: 12 }}>
          <AppButton onClick={onClose}>{t("common.cancel")}</AppButton>
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
      }
      onClose={onClose}
      open={open}
      title={
        mode === "create"
          ? t("executionFactory.toolCreateTitle")
          : t("executionFactory.toolEditTitle")
      }
      width={720}
    >
      {loading ? <Spin /> : null}
      {!loading && loadError ? <Alert message={loadError} showIcon type="error" /> : null}
      {!loading && !loadError ? (
        <Form form={form} layout="vertical">
          {mode === "create" ? (
            <Form.Item
              label={t("executionFactory.metadataType")}
              name="metadataType"
              rules={[{ required: true, message: t("common.required") }]}
            >
              <Radio.Group>
                <Radio value="openapi">
                  {t("executionFactory.metadataTypes.openapi")}
                </Radio>
                <Radio value="function">
                  {t("executionFactory.metadataTypes.function")}
                </Radio>
              </Radio.Group>
            </Form.Item>
          ) : (
            <Form.Item
              label={t("executionFactory.toolName")}
              name="name"
              rules={[{ required: true, message: t("common.required") }]}
            >
              <Input />
            </Form.Item>
          )}
          {mode === "edit" ? (
            <Form.Item label={t("common.description")} name="description">
              <Input.TextArea rows={3} />
            </Form.Item>
          ) : null}
          <Form.Item label={t("executionFactory.useRule")} name="useRule">
            <Input.TextArea rows={2} />
          </Form.Item>
          {(mode === "create" || metadataType === "openapi") && metadataType === "openapi" ? (
            <Form.Item
              label={t("executionFactory.openapiSpec")}
              name="openapiSpec"
              rules={
                mode === "create"
                  ? [{ required: true, message: t("common.required") }]
                  : undefined
              }
            >
              <Input.TextArea placeholder="{...}" rows={10} />
            </Form.Item>
          ) : null}
          {metadataType === "function" ? (
            <div style={{ display: "flex", gap: 12 }}>
              <AppButton onClick={() => setFunctionAiGenerateOpen(true)}>
                {t("executionFactory.functionAiGenerate")}
              </AppButton>
              <AppButton onClick={() => setFunctionExecuteOpen(true)}>
                {t("executionFactory.runFunction")}
              </AppButton>
            </div>
          ) : null}
        </Form>
      ) : null}
      <FunctionExecuteModal
        initialCode={functionCode}
        onClose={() => setFunctionExecuteOpen(false)}
        open={functionExecuteOpen}
      />
      <FunctionAiGenerateModal
        initialCode={functionCode}
        onApply={(content) => {
          if (typeof content === "string") {
            setFunctionCode(content);
          }
        }}
        onClose={() => setFunctionAiGenerateOpen(false)}
        open={functionAiGenerateOpen}
      />
    </Drawer>
  );
}
