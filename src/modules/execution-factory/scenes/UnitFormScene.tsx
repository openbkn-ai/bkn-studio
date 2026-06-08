import { Alert, Anchor, Collapse, Form, Input, Radio, Result, Select, Spin, Switch } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";

import type { UnitFormSceneProps } from "@/modules/execution-factory/contracts/scenes";
import { useAppServices } from "@/framework/context/use-app-services";
import { PermissionGate } from "@/framework/permission/PermissionGate";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { CrudFormPage } from "@/framework/scaffold/CrudFormPage";
import { AppButton } from "@/framework/ui/common/AppButton";
import { FunctionDefinitionFields } from "@/modules/execution-factory/components/FunctionDefinitionFields";
import { OpenApiSpecInput } from "@/modules/execution-factory/components/OpenApiSpecInput";
import { OperatorDebugPanel } from "@/modules/execution-factory/components/OperatorDebugPanel";
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
  const lockedMetadataType =
    mode === "create" &&
    (metadataTypeParam === "function" || metadataTypeParam === "openapi")
      ? metadataTypeParam
      : null;
  const [form] = Form.useForm<FormValues>();
  const [loading, setLoading] = useState(mode === "edit");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sessionLogs, setSessionLogs] = useState<OperatorRunLogEntry[]>([]);
  const metadataType = Form.useWatch("metadataType", form) as
    | OperatorMetadataType
    | undefined;
  const [loadedValues, setLoadedValues] = useState<Partial<FormValues> | null>(null);
  const [debugRecord, setDebugRecord] = useState<Awaited<
    ReturnType<typeof getOperatorDetail>
  > | null>(null);

  useEffect(() => {
    void (async () => {
      if (mode !== "edit" || !operatorId) {
        setLoadedValues(null);
        setDebugRecord(null);
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

  const anchorItems = useMemo(() => {
    const items = [
      { href: "#operator-basic", key: "basic", title: t("executionFactory.formSectionBasic") },
    ];

    if (metadataType === "openapi") {
      items.push({
        href: "#operator-openapi",
        key: "openapi",
        title: t("executionFactory.metadataTypes.openapi"),
      });
    }

    if (metadataType === "function") {
      items.push(
        {
          href: "#function-inputs",
          key: "function-inputs",
          title: t("executionFactory.functionInputs"),
        },
        {
          href: "#function-logic",
          key: "function-logic",
          title: t("executionFactory.functionLogic"),
        },
        {
          href: "#function-outputs",
          key: "function-outputs",
          title: t("executionFactory.functionOutputs"),
        },
      );
    }

    items.push({
      href: "#operator-execute-control",
      key: "executeControl",
      title: t("executionFactory.executeControlTitle"),
    });

    if (mode === "create") {
      items.push({
        href: "#operator-publish",
        key: "publish",
        title: t("executionFactory.formSectionPublish"),
      });
    }

    if (mode === "edit") {
      items.push({
        href: "#operator-debug",
        key: "debug",
        title: t("executionFactory.runLogTitle"),
      });
    }

    return items;
  }, [metadataType, mode, t]);

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }

    void navigate("/execution-factory/units?activeTab=operator");
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

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
        const record = await registerOperator({
          ...values,
          metadataType: resolvedMetadataType,
          functionInput,
        });
        void message.success(t("common.success"));
        void navigate(
          `/execution-factory/units?activeTab=operator&detailId=${record.operatorId}`,
        );
        return;
      }

      if (operatorId) {
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

      void navigate("/execution-factory/units?activeTab=operator");
    } catch (error) {
      if (error && typeof error === "object" && "errorFields" in error) {
        const firstField = (
          error as { errorFields?: Array<{ name?: Array<string | number> }> }
        ).errorFields?.[0]?.name?.[0];

        if (typeof firstField === "string") {
          document
            .querySelector(`[id="operator-${firstField}"]`)
            ?.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }

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
          <div className={styles.formLayout}>
            <Anchor
              affix={false}
              className={styles.formAnchor}
              items={anchorItems}
              offsetTop={12}
            />
            <div className={styles.formMain}>
              <div className={styles.formSurface}>
                <p className={styles.formHint}>
                  {mode === "create"
                    ? t("executionFactory.createFlowHint")
                    : t("executionFactory.editFlowHint")}
                </p>
                {mode === "create" ? (
                  <Alert
                    message={t("executionFactory.quickPublishHint")}
                    showIcon
                    style={{ marginBottom: 16 }}
                    type="info"
                  />
                ) : null}
                <Form form={form} layout="vertical">
                  <section id="operator-basic">
                    {mode === "create" && lockedMetadataType ? (
                      <>
                        <Alert
                          message={t("executionFactory.operatorCreateTypeLockedHint")}
                          showIcon
                          style={{ marginBottom: 16 }}
                          type="info"
                        />
                        <Form.Item hidden name="metadataType">
                          <Input />
                        </Form.Item>
                      </>
                    ) : null}
                    {mode === "create" && !lockedMetadataType ? (
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
                    ) : null}
                    {mode === "edit" ? (
                      <Form.Item hidden name="metadataType">
                        <Input />
                      </Form.Item>
                    ) : null}
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
                  </section>
                  {metadataType === "openapi" ? (
                    <section id="operator-openapi">
                      <Form.Item
                        extra={t("executionFactory.openapiImportHint")}
                        label={t("executionFactory.openapiSpec")}
                        name="openapiSpec"
                        rules={[{ required: true, message: t("common.required") }]}
                      >
                        <OpenApiSpecInput
                          onMetadataHints={(hints) => {
                            if (!form.getFieldValue("name") && hints.title) {
                              form.setFieldValue("name", hints.title);
                            }
                            if (!form.getFieldValue("description") && hints.description) {
                              form.setFieldValue("description", hints.description);
                            }
                          }}
                        />
                      </Form.Item>
                    </section>
                  ) : null}
                  {metadataType === "function" ? (
                    <section id="operator-function">
                      <FunctionDefinitionFields />
                    </section>
                  ) : null}
                  <section id="operator-execute-control">
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
                  </section>
                  {mode === "create" ? (
                    <section id="operator-publish">
                      <Form.Item
                        extra={t("executionFactory.directPublishHint")}
                        label={t("executionFactory.directPublish")}
                        name="directPublish"
                        valuePropName="checked"
                      >
                        <Switch />
                      </Form.Item>
                    </section>
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
              {mode === "edit" && operatorId ? (
                <aside className={styles.debugAside} id="operator-debug">
                  <h3 className={styles.debugTitle}>{t("executionFactory.runLogTitle")}</h3>
                  <PermissionGate permissions="execution-factory:operator:debug">
                    <OperatorDebugPanel
                      onRunComplete={handleDebugRunComplete}
                      record={debugRecord}
                    />
                  </PermissionGate>
                  <OperatorRunLogPanel operatorId={operatorId} sessionLogs={sessionLogs} />
                </aside>
              ) : null}
            </div>
          </div>
        ) : null}
      </CrudFormPage>
    </PermissionGate>
  );
}
