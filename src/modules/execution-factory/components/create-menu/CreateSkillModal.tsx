import { CloudUploadOutlined } from "@ant-design/icons";
import { Form, Modal, Select, Upload, message as antMessage } from "antd";
import type { UploadFile } from "antd/es/upload/interface";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { listOperatorCategories } from "@/modules/execution-factory/services/category.service";
import { registerSkill } from "@/modules/execution-factory/services/skill.service";

import styles from "./create-menu.module.css";

type CreateSkillModalProps = {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
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

export function CreateSkillModal({ open, onClose, onImported }: CreateSkillModalProps) {
  const { t } = useTranslation();
  const { message } = useAppServices();
  const [category, setCategory] = useState("");
  const [categories, setCategories] = useState<Array<{ value: string; label: string }>>(
    [],
  );
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    void (async () => {
      const items = await listOperatorCategories();
      const options = items.map((item) => ({
        value: item.categoryType,
        label: item.name,
      }));
      setCategories(options);
      const defaultCategory =
        options.find((item) => item.label.includes("未分类"))?.value ??
        options[0]?.value ??
        "other_category";
      setCategory(defaultCategory);
      setFileList([]);
    })();
  }, [open]);

  const handleSubmit = async () => {
    if (!category) {
      void message.info(t("executionFactory.skillCategoryRequired"));
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
      await registerSkill({
        category,
        file: uploadFile,
        fileType,
      });
      void message.success(t("executionFactory.skillImportSuccess"));
      onClose();
      onImported();
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
      title={t("executionFactory.importSkillTitle")}
      width={560}
    >
      <Form layout="vertical">
        <Form.Item label={t("executionFactory.category")} required>
          <Select onChange={setCategory} options={categories} value={category} />
        </Form.Item>
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
