import { Alert, Collapse, Form, Input, Radio, Result, Select, Spin, Switch } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";

import type { UnitFormSceneProps } from "@/modules/execution-factory/contracts/scenes";
import { useAppServices } from "@/framework/context/use-app-services";
import { PermissionGate } from "@/framework/permission/PermissionGate";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { CrudFormPage } from "@/framework/scaffold/CrudFormPage";
import { AppButton } from "@/framework/ui/common/AppButton";
import { FunctionCodeField } from "@/modules/execution-factory/components/FunctionCodeField";
import { FunctionParameterEditor } from "@/modules/execution-factory/components/FunctionParameterEditor";
import { OperatorDebugModal } from "@/modules/execution-factory/components/OperatorDebugModal";
import { OperatorExecuteControlFields } from "@/modules/execution-factory/components/OperatorExecuteControlFields";
import { OperatorRunLogPanel } from "@/modules/execution-factory/components/OperatorRunLogPanel";
import {
  getOperatorDetail,
  operatorDetailToFormValues,
  registerOperator,
  updateOperator,
} from "@/modules/execution-factory/services/operator.service";
import type {
  OperatorCategory,
  OperatorMetadataType,
  OperatorMutationInput,
  OperatorRecord,
  OperatorRunLogEntry,
} from "@/modules/execution-factory/types/operator";
import type { FunctionParameterDef } from "@/modules/execution-factory/types/function-input";
import { validateOpenApiDocumentText } from "@/modules/execution-factory/utils/metadata-content";
import { extractRequestErrorDetail } from "@/modules/execution-factory/utils/request-error-detail";

import styles from "./UnitFormScene.module.css";

const categoryOptions: OperatorCategory[] = [
  "other_category",
  "data_process",
  "data_transform",
  "data_store",
  "data_analysis",
  "data_query",
  "data_extract",
  "data_split",
  "model_train",
];

type FormValues = OperatorMutationInput & {
  functionCode?: string;
  functionInputs?: FunctionParameterDef[];
  functionOutputs?: FunctionParameterDef[];
};

export function UnitFormScene({
  mode,
  onBack,
  onSubmitSuccess,
  operatorId,
}: UnitFormSceneProps) {
  const { t } = useTranslation();
  const { message } = useAppServices();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const metadataTypeParam = searchParams.get("metadataType");
  const [form] = Form.useForm<FormValues>();
  const [loading, setLoading] = useState(mode === "edit");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);
  const [debugRecord, setDebugRecord] = useState<OperatorRecord | null>(null);
  const [sessionLogs, setSessionLogs] = useState<OperatorRunLogEntry[]>([]);
  const metadataType = Form.useWatch("metadataType", form) as
    | OperatorMetadataType
    | undefined;
  const [loadedValues, setLoadedValues] = useState<Partial<FormValues> | null>(
    null,
  );

  useEffect(() => {
    void (async () => {
      if (mode !== "edit" || !operatorId) {
        setLoadedValues(null);
        form.setFieldsValue({
          category: "other_category",
          directPublish: false,
          executeControl: { timeout: 3000 },
          metadataType:
            metadataTypeParam === "function" || metadataTypeParam === "openapi"
              ? metadataTypeParam
              : "openapi",
        });
        return;
      }

      setLoading(true);
      setLoadError(null);
      setLoadedValues(null);

      try {
        const record = await getOperatorDetail(operatorId);
        setDebugRecord(record);
        setLoadedValues({
          ...operatorDetailToFormValues(record),
          functionInputs: record.functionInput?.inputs,
          functionOutputs: record.functionInput?.outputs,
        });
      } catch (error) {
        setLoadError(extractRequestErrorMessage(error));
      } finally {
        setLoading(false);
      }
    })();
  }, [form, metadataTypeParam, mode, operatorId]);

  useEffect(() => {
    if (!loadedValues) {
      return;
    }

    form.resetFields();
    form.setFieldsValue(loadedValues);
  }, [form, loadedValues, operatorId]);

  const permission =
    mode === "create"
      ? "execution-factory:operator:create"
      : "execution-factory:operator:edit";
  const pageTitle =
    mode === "create"
      ? t("executionFactory.createTitle")
      : t("executionFactory.editTitle");
  const pageDescription =
    mode === "create"
      ? t("executionFactory.createDescription")
      : t("executionFactory.editDescription");

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }

    void navigate("/execution-factory/units");
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    setSubmitting(true);

    try {
      const resolvedMetadataType = values.metadataType ?? "openapi";
      if (resolvedMetadataType === "openapi") {
        const openApiValidation = validateOpenApiDocumentText(values.openapiSpec);
        if (!openApiValidation.ok) {
          void message.error(openApiValidation.reason);
          return;
        }
      }

      const functionInput =
        resolvedMetadataType === "function"
          ? {
              code: values.functionCode,
              description: values.description,
              inputs: values.functionInputs,
              name: values.name,
              outputs: values.functionOutputs,
              script_type: "python" as const,
            }
          : undefined;

      if (mode === "create") {
        await registerOperator({
          ...values,
          metadataType: resolvedMetadataType,
          functionInput,
        });
      } else if (operatorId) {
        await updateOperator({
          ...values,
          metadataType: resolvedMetadataType,
          functionInput,
          operatorId,
        });
      }

      void message.success(t("common.success"));

      if (onSubmitSuccess) {
        onSubmitSuccess();
        return;
      }

      void navigate("/execution-factory/units");
    } catch (error) {
      const errorDetail = extractRequestErrorDetail(error);
      const detailText =
        typeof errorDetail.detail === "string"
          ? errorDetail.detail
          : Array.isArray(errorDetail.detail)
            ? errorDetail.detail.join("；")
            : undefined;
      const errorMessage = detailText
        ? `${errorDetail.message}（${detailText}）`
        : errorDetail.message;
      void message.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDebugRunComplete = (entry: OperatorRunLogEntry) => {
    setSessionLogs((current) => [entry, ...current].slice(0, 20));
  };

  return (
    <PermissionGate
      fallback={
        <Result status="403" subTitle={t("common.noPermission")} title="403" />
      }
      permissions={permission}
    >
      <CrudFormPage description={pageDescription} title={pageTitle}>
        {loading ? <Spin /> : null}
        {!loading && loadError ? (
          <Alert message={loadError} showIcon type="error" />
        ) : null}
        {!loading && !loadError && (mode === "create" || loadedValues) ? (
          <div className={styles.formSurface}>
            <p className={styles.formHint}>
              {mode === "create"
                ? t("executionFactory.createFlowHint")
                : t("executionFactory.editFlowHint")}
            </p>
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
                <Form.Item hidden name="metadataType">
                  <Input />
                </Form.Item>
              )}
              <Form.Item
                label={t("executionFactory.operatorName")}
                name="name"
                rules={[{ required: true, message: t("common.required") }]}
              >
                <Input />
              </Form.Item>
              <Form.Item label={t("common.description")} name="description">
                <Input.TextArea rows={3} />
              </Form.Item>
              <Form.Item label={t("executionFactory.category")} name="category">
                <Select
                  options={categoryOptions.map((value) => ({
                    label: t(`executionFactory.operatorCategories.${value}`),
                    value,
                  }))}
                />
              </Form.Item>
              {metadataType === "openapi" ? (
                <Form.Item
                  label={t("executionFactory.openapiSpec")}
                  name="openapiSpec"
                  rules={[{ required: true, message: t("common.required") }]}
                >
                  <Input.TextArea placeholder="{...}" rows={10} />
                </Form.Item>
              ) : null}
              {metadataType === "function" ? (
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
              ) : null}
              <Collapse
                ghost
                items={[
                  {
                    key: "executeControl",
                    label: t("executionFactory.executeControlTitle"),
                    children: <OperatorExecuteControlFields />,
                  },
                ]}
              />
              {mode === "create" ? (
                <Form.Item
                  label={t("executionFactory.directPublish")}
                  name="directPublish"
                  valuePropName="checked"
                >
                  <Switch />
                </Form.Item>
              ) : null}
            </Form>
            {mode === "edit" && operatorId ? (
              <section style={{ marginTop: 24 }}>
                <div
                  style={{
                    alignItems: "center",
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 12,
                  }}
                >
                  <h3 style={{ margin: 0 }}>{t("executionFactory.runLogTitle")}</h3>
                  <PermissionGate permissions="execution-factory:operator:debug">
                    <AppButton onClick={() => setDebugOpen(true)} type="primary">
                      {t("executionFactory.debug")}
                    </AppButton>
                  </PermissionGate>
                </div>
                <OperatorRunLogPanel operatorId={operatorId} sessionLogs={sessionLogs} />
              </section>
            ) : null}
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
        ) : null}
      </CrudFormPage>
      <OperatorDebugModal
        onClose={() => setDebugOpen(false)}
        onRunComplete={handleDebugRunComplete}
        open={debugOpen}
        record={debugRecord}
      />
    </PermissionGate>
  );
}
