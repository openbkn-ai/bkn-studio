/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { CloudUploadOutlined } from "@ant-design/icons";
import { Form, Upload, message as antMessage } from "antd";
import type { UploadFile } from "antd/es/upload/interface";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { CapabilityBusinessIntro } from "@/modules/execution-factory/components/CapabilityBusinessIntro";
import { CapabilityCategoryFields } from "@/modules/execution-factory/components/CapabilityCategoryFields";
import { registerSkill } from "@/modules/execution-factory/services/skill.service";

import styles from "./create-menu.module.css";

type CreateSkillFormProps = {
  formId?: string;
  onImported: (skillId: string) => void;
};

function detectSkillFileType(file?: File): "zip" | "content" | null {
  if (!file) {
    return null;
  }

  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith(".zip")) {
    return "zip";
  }

  if (lowerName === "skill.md") {
    return "content";
  }

  return null;
}

export function CreateSkillForm({ formId, onImported }: CreateSkillFormProps) {
  const { t } = useTranslation();
  const { message } = useAppServices();
  const [form] = Form.useForm<{ category: string }>();
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setFileList([]);
  }, [form]);

  const handleSubmit = async (values: { category: string }) => {
    const uploadFile = fileList[0]?.originFileObj;
    const fileType = detectSkillFileType(uploadFile);

    if (!uploadFile || !fileType) {
      void message.info(t("executionFactory.skillUnsupportedFile"));
      return;
    }

    setSubmitting(true);

    try {
      const record = await registerSkill({
        category: values.category,
        file: uploadFile,
        fileType,
      });
      void message.success(t("executionFactory.skillImportSuccess"));
      onImported(record.skillId);
    } catch (error) {
      void message.error(extractRequestErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Form
      form={form}
      id={formId}
      layout="vertical"
      onFinish={(values) => void handleSubmit(values)}
    >
      <fieldset disabled={submitting} style={{ border: 0, margin: 0, padding: 0 }}>
        <CapabilityBusinessIntro messageKey="executionFactory.businessIntro.skillImportTop" />
        <CapabilityCategoryFields />
        <Form.Item label={t("executionFactory.skillUpload")} required>
          <Upload.Dragger
            beforeUpload={(file) => {
              if (!detectSkillFileType(file)) {
                antMessage.info(t("executionFactory.skillUnsupportedFile"));
                return Upload.LIST_IGNORE;
              }

              return false;
            }}
            className={styles.uploadDragger}
            fileList={fileList}
            maxCount={1}
            onChange={({ fileList: nextFileList }) => setFileList(nextFileList.slice(-1))}
          >
            <p className="ant-upload-drag-icon">
              <CloudUploadOutlined />
            </p>
            <p className="ant-upload-text">{t("executionFactory.skillUploadDraggerHint")}</p>
            <p className="ant-upload-hint">{t("executionFactory.skillUploadDraggerSubHint")}</p>
          </Upload.Dragger>
        </Form.Item>
      </fieldset>
    </Form>
  );
}
