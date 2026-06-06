import { Alert, Collapse, Form, Input, Spin } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import type { ToolDetailSceneProps } from "@/modules/execution-factory/contracts/scenes";
import { useAppServices } from "@/framework/context/use-app-services";
import { PermissionGate } from "@/framework/permission/PermissionGate";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { CrudFormPage } from "@/framework/scaffold/CrudFormPage";
import { AppButton } from "@/framework/ui/common/AppButton";
import { FunctionCodeField } from "@/modules/execution-factory/components/FunctionCodeField";
import { FunctionParameterEditor } from "@/modules/execution-factory/components/FunctionParameterEditor";
import { ToolDebugModal } from "@/modules/execution-factory/components/ToolDebugModal";
import { ToolGlobalParameterFields } from "@/modules/execution-factory/components/ToolGlobalParameterFields";
import { ToolIoPanel } from "@/modules/execution-factory/components/ToolIoPanel";
import {
  getToolDetail,
  updateTool,
} from "@/modules/execution-factory/services/tool.service";
import type {
  ToolGlobalParameter,
  ToolIoSpec,
  ToolMetadataType,
  ToolRunLogEntry,
} from "@/modules/execution-factory/types/tool";
import type { FunctionParameterDef } from "@/modules/execution-factory/types/function-input";

import styles from "./UnitFormScene.module.css";

type ToolFormValues = {
  name: string;
  description?: string;
  useRule?: string;
  openapiSpec?: string;
  functionCode?: string;
  functionInputs?: FunctionParameterDef[];
  functionOutputs?: FunctionParameterDef[];
  globalParameters?: ToolGlobalParameter;
};

export function ToolDetailScene({ boxId, onBack, toolId }: ToolDetailSceneProps) {
  const { t } = useTranslation();
  const { message } = useAppServices();
  const navigate = useNavigate();
  const [form] = Form.useForm<ToolFormValues>();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [metadataType, setMetadataType] = useState<ToolMetadataType>("openapi");
  const [ioSpec, setIoSpec] = useState<ToolIoSpec | undefined>();
  const [debugOpen, setDebugOpen] = useState(false);
  const [sessionLogs, setSessionLogs] = useState<ToolRunLogEntry[]>([]);
  const functionInputs = Form.useWatch("functionInputs", form);
  const functionOutputs = Form.useWatch("functionOutputs", form);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setLoadError(null);

      try {
        const record = await getToolDetail(boxId, toolId);
        const type = record.metadataType ?? "openapi";
        setMetadataType(type);
        setIoSpec(record.ioSpec);
        form.setFieldsValue({
          name: record.name,
          description: record.description,
          useRule: record.useRule,
          openapiSpec: record.openapiSpec,
          functionCode: record.functionInput?.code,
          functionInputs: record.functionInput?.inputs,
          functionOutputs: record.functionInput?.outputs,
          globalParameters: record.globalParameters
            ? {
                ...record.globalParameters,
                value:
                  record.globalParameters.value !== undefined
                    ? JSON.stringify(record.globalParameters.value, null, 2)
                    : undefined,
              }
            : undefined,
        });
      } catch (error) {
        setLoadError(extractRequestErrorMessage(error));
      } finally {
        setLoading(false);
      }
    })();
  }, [boxId, form, toolId]);

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }

    void navigate(`/execution-factory/toolboxes/${boxId}/tools`);
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    setSubmitting(true);

    try {
      await updateTool(boxId, toolId, {
        name: values.name,
        description: values.description,
        useRule: values.useRule,
        metadataType,
        openapiSpec: metadataType === "openapi" ? values.openapiSpec : undefined,
        globalParameters: values.globalParameters,
        functionInput:
          metadataType === "function"
            ? {
                code: values.functionCode,
                description: values.description,
                inputs: values.functionInputs,
                name: values.name,
                outputs: values.functionOutputs,
                script_type: "python",
              }
            : undefined,
      });
      void message.success(t("common.success"));
      handleBack();
    } catch (error) {
      void message.error(extractRequestErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDebugRunComplete = (entry: ToolRunLogEntry) => {
    setSessionLogs((current) => [entry, ...current].slice(0, 20));
  };

  const functionInput =
    metadataType === "function"
      ? { inputs: functionInputs, outputs: functionOutputs }
      : undefined;

  return (
    <PermissionGate
      fallback={
        <Alert message={t("common.noPermission")} showIcon type="warning" />
      }
      permissions="execution-factory:tool:edit"
    >
      <CrudFormPage
        description={t("executionFactory.toolDetailDescription")}
        title={t("executionFactory.toolDetailTitle")}
      >
        {loading ? <Spin /> : null}
        {!loading && loadError ? <Alert message={loadError} showIcon type="error" /> : null}
        {!loading && !loadError ? (
          <div className={styles.formSurface}>
            <Form form={form} layout="vertical">
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
              <Form.Item label={t("executionFactory.useRule")} name="useRule">
                <Input.TextArea rows={2} />
              </Form.Item>
              {metadataType === "openapi" ? (
                <Form.Item
                  label={t("executionFactory.openapiSpec")}
                  name="openapiSpec"
                  rules={[{ required: true, message: t("common.required") }]}
                >
                  <Input.TextArea rows={14} />
                </Form.Item>
              ) : (
                <>
                  <Form.Item
                    label={t("executionFactory.functionCode")}
                    name="functionCode"
                    rules={[{ required: true, message: t("common.required") }]}
                  >
                    <FunctionCodeField />
                  </Form.Item>
                  <FunctionParameterEditor />
                </>
              )}
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
            <section style={{ marginTop: 24 }}>
              <h3 style={{ marginBottom: 12 }}>{t("executionFactory.toolboxInputOutputTitle")}</h3>
              <ToolIoPanel
                functionInput={functionInput}
                ioSpec={ioSpec}
                runLogs={sessionLogs}
              />
            </section>
            <div className={styles.formActions}>
              <AppButton onClick={handleBack}>{t("common.cancel")}</AppButton>
              <PermissionGate permissions="execution-factory:tool:debug">
                <AppButton onClick={() => setDebugOpen(true)}>
                  {t("executionFactory.debug")}
                </AppButton>
              </PermissionGate>
              <AppButton loading={submitting} onClick={() => void handleSubmit()} type="primary">
                {t("common.save")}
              </AppButton>
            </div>
          </div>
        ) : null}
      </CrudFormPage>
      <ToolDebugModal
        boxId={boxId}
        ioSpec={ioSpec}
        onClose={() => setDebugOpen(false)}
        onRunComplete={handleDebugRunComplete}
        open={debugOpen}
        record={{
          toolId,
          name: form.getFieldValue("name") ?? toolId,
          status: "enabled",
        }}
      />
    </PermissionGate>
  );
}
