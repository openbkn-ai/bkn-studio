import { ApiOutlined, ThunderboltOutlined } from "@ant-design/icons";
import { Form, Input, Modal, Radio, Select } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { listOperatorCategories } from "@/modules/execution-factory/services/category.service";
import { createToolbox } from "@/modules/execution-factory/services/toolbox.service";
import type { ToolboxMetadataType } from "@/modules/execution-factory/types/toolbox";

import styles from "./create-menu.module.css";

type CreateToolboxModalProps = {
  open: boolean;
  onClose: () => void;
  onCreated: (boxId: string) => void;
};

type FormValues = {
  name: string;
  description?: string;
  category: string;
  metadataType: ToolboxMetadataType;
};

export function CreateToolboxModal({ open, onClose, onCreated }: CreateToolboxModalProps) {
  const { t } = useTranslation();
  const { message } = useAppServices();
  const [form] = Form.useForm<FormValues>();
  const [submitting, setSubmitting] = useState(false);
  const [categories, setCategories] = useState<Array<{ value: string; label: string }>>(
    [],
  );
  const metadataType = Form.useWatch("metadataType", form);

  const metadataOptions = useMemo(
    () => [
      {
        key: "openapi" as const,
        icon: ApiOutlined,
        title: t("executionFactory.metadataTypes.openapi"),
        desc: t("executionFactory.createToolboxOpenApiDesc"),
      },
      {
        key: "function" as const,
        icon: ThunderboltOutlined,
        title: t("executionFactory.metadataTypes.function"),
        desc: t("executionFactory.createToolboxFunctionDesc"),
      },
    ],
    [t],
  );

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
      form.setFieldsValue({
        category: options[0]?.value ?? "other_category",
        metadataType: "openapi",
      });
    })();
  }, [form, open]);

  const handleSubmit = async () => {
    const values = await form.validateFields();
    setSubmitting(true);

    try {
      const record = await createToolbox({
        name: values.name,
        description: values.description,
        category: values.category,
        metadataType: values.metadataType,
        serviceUrl: "http://127.0.0.1:9000",
      });
      void message.success(t("executionFactory.createToolboxSuccess"));
      onClose();
      onCreated(record.boxId);
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
      title={t("executionFactory.createToolboxModalTitle")}
      width={640}
    >
      <Form form={form} layout="vertical">
        <Form.Item
          label={t("executionFactory.toolboxName")}
          name="name"
          rules={[{ required: true, message: t("common.required") }]}
        >
          <Input />
        </Form.Item>
        <Form.Item label={t("common.description")} name="description">
          <Input.TextArea rows={3} />
        </Form.Item>
        <Form.Item
          label={t("executionFactory.category")}
          name="category"
          rules={[{ required: true, message: t("common.required") }]}
        >
          <Select options={categories} />
        </Form.Item>
        <Form.Item label={t("executionFactory.createToolboxTypeLabel")} required>
          <p className={styles.modalHint}>{t("executionFactory.createToolboxTypeHint")}</p>
          <Form.Item name="metadataType" noStyle rules={[{ required: true }]}>
            <Radio.Group style={{ width: "100%" }}>
              <div className={styles.optionGrid}>
                {metadataOptions.map(({ key, title, desc, icon: Icon }) => (
                  <label
                    className={`${styles.optionCard} ${
                      metadataType === key ? styles.optionCardActive : ""
                    }`}
                    key={key}
                  >
                    <Radio value={key} />
                    <Icon style={{ fontSize: 22, color: "#1677ff" }} />
                    <div className={styles.optionTitle}>{title}</div>
                    <div className={styles.optionDesc}>{desc}</div>
                  </label>
                ))}
              </div>
            </Radio.Group>
          </Form.Item>
        </Form.Item>
      </Form>
    </Modal>
  );
}
