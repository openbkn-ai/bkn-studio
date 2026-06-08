import { Alert, Collapse, Drawer, Form, Input, Radio, Spin } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { FunctionDefinitionFields } from "@/modules/execution-factory/components/FunctionDefinitionFields";
import { OpenApiSpecInput } from "@/modules/execution-factory/components/OpenApiSpecInput";
import { ToolGlobalParameterFields } from "@/modules/execution-factory/components/ToolGlobalParameterFields";
import {
  createTool,
  getToolDetail,
  updateTool,
} from "@/modules/execution-factory/services/tool.service";
import type { FunctionParameterDef } from "@/modules/execution-factory/types/function-input";
import type {
  ToolCreateInput,
  ToolEditInput,
  ToolGlobalParameter,
  ToolMetadataType,
} from "@/modules/execution-factory/types/tool";
import type { ToolboxMetadataType } from "@/modules/execution-factory/types/toolbox";
import { validateOpenApiDocumentText } from "@/modules/execution-factory/utils/metadata-content";

type ToolFormDrawerProps = {
  boxId: string;
  mode: "create" | "edit";
  onClose: () => void;
  onSuccess: () => void;
  open: boolean;
  toolId?: string;
  toolboxMetadataType?: ToolboxMetadataType;
};

type ToolFormValues = {
  name: string;
  description?: string;
  metadataType: ToolMetadataType;
  openapiSpec?: string;
  functionCode?: string;
  functionInputs?: FunctionParameterDef[];
  functionOutputs?: FunctionParameterDef[];
  globalParameters?: ToolGlobalParameter;
  useRule?: string;
};

function resolveDefaultMetadataType(toolboxMetadataType?: ToolboxMetadataType): ToolMetadataType {
  return toolboxMetadataType === "function" ? "function" : "openapi";
}

export function ToolFormDrawer({
  boxId,
  mode,
  onClose,
  onSuccess,
  open,
  toolId,
  toolboxMetadataType,
}: ToolFormDrawerProps) {
  const { t } = useTranslation();
  const { message } = useAppServices();
  const [form] = Form.useForm<ToolFormValues>();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const defaultMetadataType = useMemo(
    () => resolveDefaultMetadataType(toolboxMetadataType),
    [toolboxMetadataType],
  );
  const watchedMetadataType = Form.useWatch("metadataType", form) as ToolMetadataType | undefined;
  const metadataType = watchedMetadataType ?? defaultMetadataType;
  const lockMetadataType = toolboxMetadataType === "function";

  useEffect(() => {
    if (!open) {
      return;
    }

    void (async () => {
      if (mode === "create") {
        form.resetFields();
        form.setFieldsValue({
          functionInputs: [],
          functionOutputs: [],
          metadataType: defaultMetadataType,
        });
        return;
      }

      if (!toolId) {
        return;
      }

      setLoading(true);
      setLoadError(null);

      try {
        const record = await getToolDetail(boxId, toolId);
        form.setFieldsValue({
          description: record.description,
          functionCode: record.functionInput?.code,
          functionInputs: record.functionInput?.inputs ?? [],
          functionOutputs: record.functionInput?.outputs ?? [],
          globalParameters: record.globalParameters
            ? {
                ...record.globalParameters,
                value:
                  record.globalParameters.value !== undefined
                    ? JSON.stringify(record.globalParameters.value, null, 2)
                    : undefined,
              }
            : undefined,
          metadataType: record.metadataType ?? defaultMetadataType,
          name: record.name,
          openapiSpec: record.openapiSpec,
          useRule: record.useRule,
        });
      } catch (error) {
        setLoadError(extractRequestErrorMessage(error));
      } finally {
        setLoading(false);
      }
    })();
  }, [boxId, defaultMetadataType, form, mode, open, toolId]);

  const handleSubmit = async () => {
    const values = await form.validateFields();

    if (values.metadataType === "openapi") {
      const openApiValidation = validateOpenApiDocumentText(values.openapiSpec);
      if (!openApiValidation.ok) {
        void message.error(openApiValidation.reason);
        return;
      }
    }

    setSubmitting(true);

    try {
      if (mode === "create") {
        const input: ToolCreateInput = {
          metadataType: values.metadataType,
          useRule: values.useRule,
          globalParameters: values.globalParameters,
          openapiSpec: values.metadataType === "openapi" ? values.openapiSpec : undefined,
          functionInput:
            values.metadataType === "function"
              ? {
                  code: values.functionCode,
                  description: values.description,
                  inputs: values.functionInputs,
                  name: values.name,
                  outputs: values.functionOutputs,
                  script_type: "python",
                }
              : undefined,
        };
        const result = await createTool(boxId, input);

        if (result.failureCount > 0) {
          void message.warning(
            t("executionFactory.importPartialFailureTitle") +
              `: ${result.failures.map((item) => item.toolName).join(", ")}`,
          );
        }
      } else if (toolId) {
        const input: ToolEditInput = {
          name: values.name,
          description: values.description,
          metadataType: values.metadataType,
          useRule: values.useRule,
          globalParameters: values.globalParameters,
          openapiSpec: values.metadataType === "openapi" ? values.openapiSpec : undefined,
          functionInput:
            values.metadataType === "function"
              ? {
                  code: values.functionCode,
                  description: values.description,
                  inputs: values.functionInputs,
                  name: values.name,
                  outputs: values.functionOutputs,
                  script_type: "python",
                }
              : undefined,
        };
        await updateTool(boxId, toolId, input);
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
      width={840}
    >
      {loading ? <Spin /> : null}
      {!loading && loadError ? <Alert message={loadError} showIcon type="error" /> : null}
      {!loading && !loadError ? (
        <Form form={form} layout="vertical">
          {mode === "create" && !lockMetadataType ? (
            <Form.Item
              label={t("executionFactory.metadataType")}
              name="metadataType"
              rules={[{ required: true, message: t("common.required") }]}
            >
              <Radio.Group>
                <Radio value="openapi">{t("executionFactory.metadataTypes.openapi")}</Radio>
                <Radio value="function">{t("executionFactory.metadataTypes.function")}</Radio>
              </Radio.Group>
            </Form.Item>
          ) : null}
          {lockMetadataType ? (
            <>
              <Form.Item hidden name="metadataType">
                <Input />
              </Form.Item>
              <Alert
                description={t("executionFactory.functionToolCreateHint")}
                message={t("executionFactory.metadataTypes.function")}
                showIcon
                style={{ marginBottom: 16 }}
                type="info"
              />
            </>
          ) : null}
          {mode === "create" && metadataType === "function" ? (
            <>
              <Form.Item
                label={t("executionFactory.toolName")}
                name="name"
                rules={[{ required: true, message: t("common.required") }]}
              >
                <Input />
              </Form.Item>
              <Form.Item label={t("common.description")} name="description">
                <Input.TextArea rows={3} />
              </Form.Item>
            </>
          ) : null}
          {mode === "edit" ? (
            <>
              <Form.Item
                label={t("executionFactory.toolName")}
                name="name"
                rules={[{ required: true, message: t("common.required") }]}
              >
                <Input />
              </Form.Item>
              <Form.Item label={t("common.description")} name="description">
                <Input.TextArea rows={3} />
              </Form.Item>
            </>
          ) : null}
          <Form.Item label={t("executionFactory.useRule")} name="useRule">
            <Input.TextArea rows={2} />
          </Form.Item>
          {metadataType === "openapi" ? (
            <Form.Item
              label={t("executionFactory.openapiSpec")}
              name="openapiSpec"
              rules={
                mode === "create"
                  ? [{ required: true, message: t("common.required") }]
                  : undefined
              }
            >
              <OpenApiSpecInput rows={10} />
            </Form.Item>
          ) : null}
          {metadataType === "function" ? <FunctionDefinitionFields /> : null}
          <Collapse
            ghost
            items={[
              {
                key: "globalParameters",
                label: t("executionFactory.globalParametersTitle"),
                children: <ToolGlobalParameterFields />,
              },
            ]}
          />
        </Form>
      ) : null}
    </Drawer>
  );
}
