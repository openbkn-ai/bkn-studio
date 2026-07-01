/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { CloudUploadOutlined } from "@ant-design/icons";
import { Form, Modal, Upload, message as antMessage } from "antd";
import type { UploadFile } from "antd/es/upload/interface";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { updateSkillPackage } from "@/modules/execution-factory/services/skill.service";

import styles from "./create-menu.module.css";

type UpdateSkillPackageModalProps = {
  open: boolean;
  skillId: string | null;
  skillName?: string;
  onClose: () => void;
  onUpdated: () => void;
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

export function UpdateSkillPackageModal({
  open,
  skillId,
  skillName,
  onClose,
  onUpdated,
}: UpdateSkillPackageModalProps) {
  const { t } = useTranslation();
  const { message } = useAppServices();
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    setFileList([]);
  }, [open, skillId]);

  const handleSubmit = async () => {
    if (!skillId) {
      return;
    }

    const uploadFile = fileList[0]?.originFileObj;
    const fileType = detectSkillFileType(uploadFile);

    if (!uploadFile || !fileType) {
      void message.info(t("executionFactory.skillUnsupportedFile"));
      return;
    }

    setSubmitting(true);

    try {
      await updateSkillPackage(skillId, {
        file: uploadFile,
        fileType,
      });
      void message.success(t("executionFactory.skillPackageUpdateSuccess"));
      onClose();
      onUpdated();
    } catch (error) {
      void message.error(extractRequestErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      confirmLoading={submitting}
      destroyOnClose
      okText={t("common.confirm")}
      onCancel={onClose}
      onOk={() => void handleSubmit()}
      open={open}
      title={t("executionFactory.updateSkillPackageTitle", { name: skillName ?? skillId ?? "" })}
      width={560}
    >
      <Form layout="vertical">
        <Form.Item label={t("executionFactory.skillUpload")} required>
          <Upload.Dragger
            beforeUpload={(file) => {
              if (!detectSkillFileType(file as File)) {
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
      </Form>
    </Modal>
  );
}
