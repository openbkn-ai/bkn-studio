/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Form, Input, Radio, Result, Select, Spin, Tabs, Upload } from "antd";
import type { UploadFile } from "antd/es/upload/interface";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import type { SkillEditSceneProps } from "@/modules/execution-factory/contracts/scenes";
import { useAppServices } from "@/framework/context/use-app-services";
import { PermissionGate } from "@/framework/permission/PermissionGate";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { CrudFormPage } from "@/framework/scaffold/CrudFormPage";
import { AppButton } from "@/framework/ui/common/AppButton";
import {
  getSkill,
  updateSkillMetadata,
  updateSkillPackage,
} from "@/modules/execution-factory/services/skill.service";
import type { SkillMetadataEditInput } from "@/modules/execution-factory/types/skill";

import styles from "./UnitFormScene.module.css";

type MetadataFormValues = SkillMetadataEditInput;

export function SkillEditScene({
  onBack,
  onSubmitSuccess,
  skillId,
}: SkillEditSceneProps) {
  const { t } = useTranslation();
  const { message } = useAppServices();
  const navigate = useNavigate();
  const [metadataForm] = Form.useForm<MetadataFormValues>();
  const [packageForm] = Form.useForm<{ fileType: "zip" | "content" }>();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [contentText, setContentText] = useState("");
  const fileType = Form.useWatch("fileType", packageForm) as "zip" | "content" | undefined;

  useEffect(() => {
    if (!skillId) {
      setLoading(false);
      return;
    }

    void (async () => {
      setLoading(true);
      setLoadError(null);

      try {
        const record = await getSkill(skillId);
        metadataForm.setFieldsValue({
          category: (record.category as MetadataFormValues["category"]) ?? "other_category",
          description: record.description ?? "",
          name: record.name,
        });
        packageForm.setFieldsValue({ fileType: "zip" });
      } catch (error) {
        setLoadError(extractRequestErrorMessage(error));
      } finally {
        setLoading(false);
      }
    })();
  }, [metadataForm, packageForm, skillId]);

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }

    void navigate("/execution-factory/skills");
  };

  const handleMetadataSubmit = async () => {
    if (!skillId) {
      return;
    }

    const values = await metadataForm.validateFields();
    setSubmitting(true);

    try {
      await updateSkillMetadata(skillId, values);
      void message.success(t("common.success"));
      onSubmitSuccess?.();
    } catch (error) {
      void message.error(extractRequestErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handlePackageSubmit = async () => {
    if (!skillId) {
      return;
    }

    const values = await packageForm.validateFields();
    setSubmitting(true);

    try {
      if (values.fileType === "zip") {
        const uploadFile = fileList[0]?.originFileObj;

        if (!uploadFile) {
          throw new Error(t("executionFactory.skillUploadRequired"));
        }

        await updateSkillPackage(skillId, {
          file: uploadFile,
          fileType: "zip",
        });
      } else {
        if (!contentText.trim()) {
          throw new Error(t("executionFactory.skillContentRequired"));
        }

        await updateSkillPackage(skillId, {
          file: contentText,
          fileType: "content",
        });
      }

      void message.success(t("common.success"));
      onSubmitSuccess?.();
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
      permissions="execution-factory:skill:edit"
    >
      <CrudFormPage
        description={t("executionFactory.skillEditDescription")}
        title={t("executionFactory.skillEditTitle")}
      >
        {loading ? <Spin /> : null}
        {!loading && loadError ? <Alert message={loadError} showIcon type="error" /> : null}
        {!loading && !loadError ? (
          <div className={styles.formSurface}>
            <Tabs
              items={[
                {
                  key: "metadata",
                  label: t("executionFactory.skillEditMetadataTab"),
                  children: (
                    <>
                      <Form form={metadataForm} layout="vertical">
                        <Form.Item
                          label={t("executionFactory.skillName")}
                          name="name"
                          rules={[{ required: true, message: t("common.required") }]}
                        >
                          <Input />
                        </Form.Item>
                        <Form.Item
                          label={t("common.description")}
                          name="description"
                          rules={[{ required: true, message: t("common.required") }]}
                        >
                          <Input.TextArea rows={3} />
                        </Form.Item>
                        <Form.Item
                          label={t("executionFactory.category")}
                          name="category"
                          rules={[{ required: true, message: t("common.required") }]}
                        >
                          <Select
                            options={(
                              ["other_category", "system"] as const
                            ).map((value) => ({
                              label: t(`executionFactory.skillCategories.${value}`),
                              value,
                            }))}
                          />
                        </Form.Item>
                        <Form.Item label={t("executionFactory.skillSource")} name="source">
                          <Select
                            allowClear
                            options={(["custom", "internal"] as const).map((value) => ({
                              label: t(`executionFactory.skillSources.${value}`),
                              value,
                            }))}
                          />
                        </Form.Item>
                      </Form>
                      <div className={styles.formActions}>
                        <AppButton onClick={handleBack}>{t("common.cancel")}</AppButton>
                        <AppButton
                          loading={submitting}
                          onClick={() => {
                            void handleMetadataSubmit();
                          }}
                          type="primary"
                        >
                          {t("common.save")}
                        </AppButton>
                      </div>
                    </>
                  ),
                },
                {
                  key: "package",
                  label: t("executionFactory.skillEditPackageTab"),
                  children: (
                    <>
                      <p className={styles.formHint}>
                        {t("executionFactory.skillEditPackageHint")}
                      </p>
                      <Form form={packageForm} initialValues={{ fileType: "zip" }} layout="vertical">
                        <Form.Item label={t("executionFactory.skillFileType")} name="fileType">
                          <Radio.Group>
                            <Radio value="zip">
                              {t("executionFactory.skillFileTypes.zip")}
                            </Radio>
                            <Radio value="content">
                              {t("executionFactory.skillFileTypes.content")}
                            </Radio>
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
                            <textarea
                              onChange={(event) => setContentText(event.target.value)}
                              rows={12}
                              style={{ width: "100%", fontFamily: "monospace" }}
                              value={contentText}
                            />
                          </Form.Item>
                        )}
                      </Form>
                      <div className={styles.formActions}>
                        <AppButton onClick={handleBack}>{t("common.cancel")}</AppButton>
                        <AppButton
                          loading={submitting}
                          onClick={() => {
                            void handlePackageSubmit();
                          }}
                          type="primary"
                        >
                          {t("common.save")}
                        </AppButton>
                      </div>
                    </>
                  ),
                },
              ]}
            />
          </div>
        ) : null}
      </CrudFormPage>
    </PermissionGate>
  );
}
