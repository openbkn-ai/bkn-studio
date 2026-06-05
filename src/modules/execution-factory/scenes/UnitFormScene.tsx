import { Alert, Form, Input, Radio, Result, Select, Spin, Switch } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import type { UnitFormSceneProps } from "@/modules/execution-factory/contracts/scenes";
import { useAppServices } from "@/framework/context/use-app-services";
import { PermissionGate } from "@/framework/permission/PermissionGate";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { CrudFormPage } from "@/framework/scaffold/CrudFormPage";
import { AppButton } from "@/framework/ui/common/AppButton";
import {
  getOperator,
  registerOperator,
  updateOperator,
} from "@/modules/execution-factory/services/operator.service";
import type {
  OperatorCategory,
  OperatorMetadataType,
  OperatorMutationInput,
} from "@/modules/execution-factory/types/operator";

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

export function UnitFormScene({
  mode,
  onBack,
  onSubmitSuccess,
  operatorId,
}: UnitFormSceneProps) {
  const { t } = useTranslation();
  const { message } = useAppServices();
  const navigate = useNavigate();
  const [form] = Form.useForm<OperatorMutationInput>();
  const [loading, setLoading] = useState(mode === "edit");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const metadataType = Form.useWatch("metadataType", form) as
    | OperatorMetadataType
    | undefined;

  useEffect(() => {
    void (async () => {
      if (mode !== "edit" || !operatorId) {
        form.setFieldsValue({
          category: "other_category",
          directPublish: false,
          metadataType: "openapi",
        });
        return;
      }

      setLoading(true);
      setLoadError(null);

      try {
        const record = await getOperator(operatorId);
        form.setFieldsValue({
          category: record.category,
          description: record.description,
          metadataType: record.metadataType,
          name: record.name,
        });
      } catch (error) {
        setLoadError(extractRequestErrorMessage(error));
      } finally {
        setLoading(false);
      }
    })();
  }, [form, mode, operatorId]);

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
      if (mode === "create") {
        await registerOperator({
          ...values,
          metadataType: values.metadataType ?? "openapi",
        });
      } else if (operatorId) {
        await updateOperator({
          ...values,
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
                    <Radio value="openapi">OpenAPI</Radio>
                    <Radio value="function">Function</Radio>
                  </Radio.Group>
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
                    label: value,
                    value,
                  }))}
                />
              </Form.Item>
              {mode === "create" && metadataType === "openapi" ? (
                <Form.Item
                  label={t("executionFactory.openapiSpec")}
                  name="openapiSpec"
                  rules={[{ required: true, message: t("common.required") }]}
                >
                  <Input.TextArea placeholder="{...}" rows={10} />
                </Form.Item>
              ) : null}
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
