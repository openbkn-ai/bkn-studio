import { Alert, Card, Form, Input, Result, Space, Spin, Typography } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import { PermissionGate } from "@/framework/permission/PermissionGate";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { CrudFormPage } from "@/framework/scaffold/CrudFormPage";
import { AppButton } from "@/framework/ui/common/AppButton";
import {
  createStarterRecord,
  getStarterRecord,
  updateStarterRecord,
} from "@/modules/starter/services/starter.service";
import type {
  StarterMutationInput,
  StarterRecord,
} from "@/modules/starter/types/starter";

import styles from "./StarterFormPage.module.css";

type StarterFormPageProps = {
  mode: "create" | "edit";
};

export function StarterFormPage({ mode }: StarterFormPageProps) {
  const { t } = useTranslation();
  const { message } = useAppServices();
  const navigate = useNavigate();
  const { recordId } = useParams<{ recordId: string }>();
  const [form] = Form.useForm<StarterMutationInput>();
  const [loading, setLoading] = useState(mode === "edit");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [record, setRecord] = useState<StarterRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (mode !== "edit" || !recordId) {
      setLoadError(null);
      form.setFieldsValue({
        name: "",
        owner: "",
        summary: "",
      });
      return;
    }

    void (async () => {
      setLoading(true);
      setLoadError(null);

      try {
        const currentRecord = await getStarterRecord(recordId);
        setRecord(currentRecord);

        if (currentRecord) {
          form.setFieldsValue({
            name: currentRecord.name,
            owner: currentRecord.owner,
            summary: `${currentRecord.name} module owned by ${currentRecord.owner}`,
          });
        }
      } catch (error) {
        setLoadError(extractRequestErrorMessage(error));
      } finally {
        setLoading(false);
      }
    })();
  }, [form, mode, recordId]);

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      const values = await form.validateFields();

      if (mode === "create") {
        await createStarterRecord(values);
      }

      if (mode === "edit" && recordId) {
        await updateStarterRecord(recordId, values);
      }

      message.success(t("common.success"));
      void navigate("/starter");
    } catch (error) {
      void message.error(extractRequestErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const permission = mode === "create" ? "starter:create" : "starter:edit";
  const title = mode === "create" ? t("starter.createTitle") : t("starter.editTitle");
  const description =
    mode === "create"
      ? t("starter.createDescription")
      : t("starter.editDescription");

  return (
    <PermissionGate
      fallback={<Result status="403" subTitle={t("common.noPermission")} title="403" />}
      permissions={permission}
    >
      <CrudFormPage
        actions={
          <div className={styles.actions}>
            <AppButton
              onClick={() => {
                void navigate("/starter");
              }}
            >
              {t("common.back")}
            </AppButton>
            <AppButton
              onClick={() => {
                void handleSubmit();
              }}
              loading={submitting}
              type="primary"
            >
              {t("common.save")}
            </AppButton>
          </div>
        }
        description={description}
        title={title}
      >
        {loading ? (
          <Spin />
        ) : loadError ? (
          <Alert
            action={
              <AppButton
                onClick={() => {
                  window.location.reload();
                }}
                type="link"
              >
                {t("common.retry")}
              </AppButton>
            }
            message={loadError}
            showIcon
            type="error"
          />
        ) : mode === "edit" && !record ? (
          <Alert message={t("common.notFound")} showIcon type="warning" />
        ) : (
          <Space direction="vertical" size={20} style={{ width: "100%" }}>
            <Card>
              <Typography.Title className={styles.cardTitle} level={5}>
                {t("common.basicInfo")}
              </Typography.Title>
              <Form form={form} layout="vertical">
                <Form.Item
                  label={t("starter.name")}
                  name="name"
                  rules={[{ message: t("common.required"), required: true }]}
                >
                  <Input />
                </Form.Item>
                <Form.Item
                  label={t("starter.owner")}
                  name="owner"
                  rules={[{ message: t("common.required"), required: true }]}
                >
                  <Input />
                </Form.Item>
              </Form>
            </Card>
            <Card>
              <Typography.Title className={styles.cardTitle} level={5}>
                {t("common.advancedConfig")}
              </Typography.Title>
              <Form form={form} layout="vertical">
                <Form.Item label={t("starter.summary")} name="summary">
                  <Input.TextArea placeholder={t("starter.summaryPlaceholder")} rows={4} />
                </Form.Item>
              </Form>
            </Card>
          </Space>
        )}
      </CrudFormPage>
    </PermissionGate>
  );
}
