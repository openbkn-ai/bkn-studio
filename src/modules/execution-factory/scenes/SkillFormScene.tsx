import { Alert, Form, Radio, Result, Upload } from "antd";
import type { UploadFile } from "antd/es/upload/interface";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import type { SkillFormSceneProps } from "@/modules/execution-factory/contracts/scenes";
import { useAppServices } from "@/framework/context/use-app-services";
import { PermissionGate } from "@/framework/permission/PermissionGate";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { CrudFormPage } from "@/framework/scaffold/CrudFormPage";
import { AppButton } from "@/framework/ui/common/AppButton";
import { registerSkill } from "@/modules/execution-factory/services/skill.service";

import styles from "./UnitFormScene.module.css";

export function SkillFormScene({ onBack, onSubmitSuccess }: SkillFormSceneProps) {
  const { t } = useTranslation();
  const { message } = useAppServices();
  const navigate = useNavigate();
  const [form] = Form.useForm<{ fileType: "zip" | "content"; source?: string }>();
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [contentText, setContentText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const fileType = Form.useWatch("fileType", form) as "zip" | "content" | undefined;

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }

    void navigate("/execution-factory/skills");
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    setSubmitting(true);

    try {
      if (values.fileType === "zip") {
        const uploadFile = fileList[0]?.originFileObj;

        if (!uploadFile) {
          throw new Error(t("executionFactory.skillUploadRequired"));
        }

        await registerSkill({
          file: uploadFile,
          fileType: "zip",
          source: values.source,
        });
      } else {
        if (!contentText.trim()) {
          throw new Error(t("executionFactory.skillContentRequired"));
        }

        await registerSkill({
          file: contentText,
          fileType: "content",
          source: values.source,
        });
      }

      void message.success(t("common.success"));

      if (onSubmitSuccess) {
        onSubmitSuccess();
        return;
      }

      void navigate("/execution-factory/skills");
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
      permissions="execution-factory:skill:create"
    >
      <CrudFormPage
        description={t("executionFactory.skillCreateDescription")}
        title={t("executionFactory.skillCreateTitle")}
      >
        <div className={styles.formSurface}>
          <p className={styles.formHint}>{t("executionFactory.skillCreateFlowHint")}</p>
          <Form form={form} initialValues={{ fileType: "zip" }} layout="vertical">
            <Form.Item label={t("executionFactory.skillFileType")} name="fileType">
              <Radio.Group>
                <Radio value="zip">zip</Radio>
                <Radio value="content">content</Radio>
              </Radio.Group>
            </Form.Item>
            {fileType === "zip" ? (
              <Form.Item label={t("executionFactory.skillUpload")}>
                <Upload
                  beforeUpload={() => false}
                  fileList={fileList}
                  maxCount={1}
                  onChange={({ fileList: nextFileList }) => setFileList(nextFileList)}
                >
                  <AppButton>{t("executionFactory.chooseFile")}</AppButton>
                </Upload>
              </Form.Item>
            ) : (
              <Form.Item label={t("executionFactory.skillContentTitle")}>
                <Alert
                  description={
                    <textarea
                      onChange={(event) => setContentText(event.target.value)}
                      rows={12}
                      style={{ width: "100%", fontFamily: "monospace" }}
                      value={contentText}
                    />
                  }
                  type="info"
                />
              </Form.Item>
            )}
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
    </PermissionGate>
  );
}
