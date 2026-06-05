import { Form, Input, Modal, Select } from "antd";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import type {
  KnowledgeNetworkMutationPayload,
  KnowledgeNetworkRecord,
} from "@/modules/knowledge-network/types/knowledge-network";

type KnowledgeNetworkFormModalProps = {
  mode: "create" | "edit";
  onCancel: () => void;
  onSubmit: (values: KnowledgeNetworkMutationPayload) => Promise<void>;
  open: boolean;
  record?: KnowledgeNetworkRecord | null;
};

type FormValues = KnowledgeNetworkMutationPayload;

const defaultColor = "#1677ff";

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
      color: record?.color ?? defaultColor,
      description: record?.description ?? "",
      identifier: record?.identifier ?? "",
      name: record?.name ?? "",
      tags: record?.tags ?? [],
    });
  }, [form, open, record]);

  return (
    <Modal
      destroyOnClose
      onCancel={onCancel}
      onOk={() => {
        void form.submit();
      }}
      open={open}
      title={
        mode === "create"
          ? t("knowledgeNetwork.createTitle")
          : t("knowledgeNetwork.editTitle")
      }
    >
      <Form<FormValues>
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
          ]}
        >
          <Input />
        </Form.Item>
        <Form.Item
          label={t("knowledgeNetwork.identifier")}
          name="identifier"
          rules={[
            {
              required: true,
              message: t("knowledgeNetwork.identifierRequired"),
            },
          ]}
        >
          <Input />
        </Form.Item>
        <Form.Item label={t("knowledgeNetwork.color")} name="color">
          <Input />
        </Form.Item>
        <Form.Item label={t("knowledgeNetwork.tags")} name="tags">
          <Select mode="tags" tokenSeparators={[","]} />
        </Form.Item>
        <Form.Item label={t("knowledgeNetwork.description")} name="description">
          <Input.TextArea autoSize={{ minRows: 3, maxRows: 5 }} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
