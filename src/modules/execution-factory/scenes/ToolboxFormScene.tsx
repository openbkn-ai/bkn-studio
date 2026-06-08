import { Alert, Form, Input, Radio, Result, Spin } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import type { ToolboxFormSceneProps } from "@/modules/execution-factory/contracts/scenes";
import { useAppServices } from "@/framework/context/use-app-services";
import { PermissionGate } from "@/framework/permission/PermissionGate";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { CrudFormPage } from "@/framework/scaffold/CrudFormPage";
import { AppButton } from "@/framework/ui/common/AppButton";
import { OpenApiSpecInput } from "@/modules/execution-factory/components/OpenApiSpecInput";
import { ToolboxMetadataFormFields } from "@/modules/execution-factory/components/ToolboxMetadataFormFields";
import {
  createToolbox,
  getToolbox,
  updateToolbox,
} from "@/modules/execution-factory/services/toolbox.service";
import type {
  ToolboxMetadataType,
  ToolboxMutationInput,
} from "@/modules/execution-factory/types/toolbox";
import { validateOpenApiDocumentText } from "@/modules/execution-factory/utils/metadata-content";

import styles from "./UnitFormScene.module.css";

export function ToolboxFormScene({
  boxId,
  mode,
  onBack,
  onSubmitSuccess,
}: ToolboxFormSceneProps) {
  const { t } = useTranslation();
  const { message } = useAppServices();
  const navigate = useNavigate();
  const [form] = Form.useForm<ToolboxMutationInput>();
  const [loading, setLoading] = useState(mode === "edit");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const metadataType = Form.useWatch("metadataType", form) as
    | ToolboxMetadataType
    | undefined;

  useEffect(() => {
    void (async () => {
      if (mode !== "edit" || !boxId) {
        form.setFieldsValue({
          category: "box_category",
          metadataType: "openapi",
        });
        return;
      }

      setLoading(true);
      setLoadError(null);

      try {
        const record = await getToolbox(boxId);
        form.setFieldsValue({
          category: record.categoryType ?? record.categoryName,
          description: record.description,
          metadataType: record.metadataType,
          name: record.name,
          serviceUrl: record.serviceUrl,
        });
      } catch (error) {
        setLoadError(extractRequestErrorMessage(error));
      } finally {
        setLoading(false);
      }
    })();
  }, [boxId, form, mode]);

  const permission =
    mode === "create"
      ? "execution-factory:toolbox:create"
      : "execution-factory:toolbox:edit";
  const pageTitle =
    mode === "create"
      ? t("executionFactory.toolboxCreateTitle")
      : t("executionFactory.toolboxEditTitle");
  const pageDescription =
    mode === "create"
      ? t("executionFactory.toolboxCreateDescription")
      : t("executionFactory.toolboxEditDescription");

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }

    void navigate("/execution-factory/units?activeTab=toolbox");
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();

    if (mode === "create" && values.metadataType === "openapi") {
      const openApiValidation = validateOpenApiDocumentText(values.openapiSpec);
      if (!openApiValidation.ok) {
        void message.error(openApiValidation.reason);
        return;
      }
    }

    setSubmitting(true);

    try {
      if (mode === "create") {
        const record = await createToolbox({
          ...values,
          metadataType: values.metadataType ?? "openapi",
        });

        if (values.metadataType === "function") {
          void message.success(t("common.success"));
          void navigate(`/execution-factory/toolboxes/${record.boxId}/tools?create=1`);
          return;
        }
      } else if (boxId) {
        await updateToolbox({
          ...values,
          boxId,
        });
      }

      void message.success(t("common.success"));

      if (onSubmitSuccess) {
        onSubmitSuccess();
        return;
      }

      void navigate("/execution-factory/units?activeTab=toolbox");
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
      permissions={permission}
    >
      <CrudFormPage description={pageDescription} title={pageTitle}>
        {loading ? <Spin /> : null}
        {!loading && loadError ? (
          <Alert message={loadError} showIcon type="error" />
        ) : null}
        {!loading && !loadError ? (
          <div className={styles.formSurface}>
            <p className={styles.formHint}>
              {mode === "create"
                ? metadataType === "function"
                  ? t("executionFactory.toolboxCreateFunctionFlowHint")
                  : t("executionFactory.toolboxCreateFlowHint")
                : t("executionFactory.toolboxEditFlowHint")}
            </p>
            {mode === "create" && metadataType === "function" ? (
              <Alert
                message={t("executionFactory.createToolboxFunctionNextStep")}
                showIcon
                style={{ marginBottom: 16 }}
                type="info"
              />
            ) : null}
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
              ) : null}
              <ToolboxMetadataFormFields />
              {mode === "edit" && metadataType ? (
                <Form.Item label={t("executionFactory.metadataType")}>
                  <Input
                    disabled
                    value={t(`executionFactory.metadataTypes.${metadataType}`)}
                  />
                </Form.Item>
              ) : null}
              {mode === "create" && metadataType === "openapi" ? (
                <Form.Item
                  label={t("executionFactory.openapiSpec")}
                  name="openapiSpec"
                  rules={[{ required: true, message: t("common.required") }]}
                >
                  <OpenApiSpecInput rows={10} />
                </Form.Item>
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
        ) : null}
      </CrudFormPage>
    </PermissionGate>
  );
}
