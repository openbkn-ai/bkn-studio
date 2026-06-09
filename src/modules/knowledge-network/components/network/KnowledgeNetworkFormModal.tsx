import { Form, Input, Modal } from "antd";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import type {
  KnowledgeNetworkMutationPayload,
  KnowledgeNetworkRecord,
} from "@/modules/knowledge-network/types/knowledge-network";

import styles from "./KnowledgeNetworkFormModal.module.css";
import {
  DEFAULT_RESOURCE_COLOR,
  ResourceColorSelect,
} from "@/modules/knowledge-network/components/shared/ResourceColorSelect";
import {
  ResourceTagsSelect,
  validateKnowledgeNetworkTags,
} from "@/modules/knowledge-network/components/shared/ResourceTagsSelect";

type KnowledgeNetworkFormModalProps = {
  mode: "create" | "edit";
  onCancel: () => void;
  onSubmit: (values: KnowledgeNetworkMutationPayload) => Promise<void>;
  open: boolean;
  record?: KnowledgeNetworkRecord | null;
};

type FormValues = KnowledgeNetworkMutationPayload;

const IDENTIFIER_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;

export function KnowledgeNetworkFormModal({
  mode,
  onCancel,
  onSubmit,
  open,
  record,
}: KnowledgeNetworkFormModalProps) {
  const { t } = useTranslation();
  const [form] = Form.useForm<FormValues>();

  useEffect(() => {
    if (!open) {
      return;
    }

    form.setFieldsValue({
      color: record?.color ?? DEFAULT_RESOURCE_COLOR,
      description: record?.description ?? "",
      identifier: record?.identifier ?? "",
      name: record?.name ?? "",
      tags: record?.tags ?? [],
    });
  }, [form, mode, open, record]);

  const handleCancel = () => {
    form.resetFields();
    onCancel();
  };

  return (
    <Modal
      cancelText={t("common.cancel")}
      destroyOnClose
      okText={mode === "create" ? t("common.create") : t("common.save")}
      onCancel={handleCancel}
      onOk={() => {
        void form.validateFields().then(async (values) => {
          await onSubmit(values);
          form.resetFields();
        });
      }}
      open={open}
      title={
        mode === "create"
          ? t("knowledgeNetwork.createTitle")
          : t("knowledgeNetwork.editTitle")
      }
      width={640}
    >
      <Form<FormValues>
        className={styles.form}
        form={form}
        layout="vertical"
        onFinish={(values) => {
          void onSubmit(values);
        }}
      >
        <Form.Item
          label={t("knowledgeNetwork.name")}
          name="name"
          rules={[
            { required: true, message: t("knowledgeNetwork.nameRequired") },
            { max: 40, message: t("knowledgeNetwork.nameMaxLength", { len: 40 }) },
          ]}
        >
          <Input placeholder={t("knowledgeNetwork.pleaseInput")} />
        </Form.Item>
        <Form.Item
          label={t("knowledgeNetwork.identifier")}
          name="identifier"
          rules={[
            { max: 40, message: t("knowledgeNetwork.identifierMaxLength", { len: 40 }) },
            {
              pattern: IDENTIFIER_PATTERN,
              message: t("knowledgeNetwork.identifierPattern"),
            },
          ]}
        >
          <Input
            disabled={mode === "edit"}
            placeholder={t("knowledgeNetwork.pleaseInput")}
          />
        </Form.Item>
        <Form.Item label={t("knowledgeNetwork.color")} name="color">
          <ResourceColorSelect inModal />
        </Form.Item>
        <Form.Item
          label={t("knowledgeNetwork.tags")}
          name="tags"
          rules={[
            {
              validator: (_rule, value) =>
                validateKnowledgeNetworkTags(t, _rule, value),
            },
          ]}
        >
          <ResourceTagsSelect />
        </Form.Item>
        <Form.Item label={t("knowledgeNetwork.descriptionField")} name="description">
          <Input.TextArea
            maxLength={1000}
            placeholder={t("knowledgeNetwork.pleaseInput")}
            rows={3}
            showCount
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
