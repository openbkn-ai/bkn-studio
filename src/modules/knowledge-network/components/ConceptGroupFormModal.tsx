import { Form, Input, Modal, Select } from "antd";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import type {
  ConceptGroupMutationPayload,
  ConceptGroupRecord,
} from "@/modules/knowledge-network/types/knowledge-network";

type ConceptGroupFormModalProps = {
  mode: "create" | "edit";
  onCancel: () => void;
  onSubmit: (values: ConceptGroupMutationPayload) => Promise<void>;
  open: boolean;
  record?: ConceptGroupRecord | null;
};

type FormValues = ConceptGroupMutationPayload;

const defaultColor = "#1677ff";

export function ConceptGroupFormModal({
  mode,
  onCancel,
  onSubmit,
  open,
  record,
}: ConceptGroupFormModalProps) {
  const { t } = useTranslation();
  const [form] = Form.useForm<FormValues>();

  useEffect(() => {
    if (!open) {
      return;
    }

    form.setFieldsValue({
      color: record?.color ?? defaultColor,
      description: record?.description ?? "",
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
          ? t("knowledgeNetwork.conceptGroupCreateTitle")
          : t("knowledgeNetwork.conceptGroupEditTitle")
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
          label={t("knowledgeNetwork.conceptGroupName")}
          name="name"
          rules={[
            {
              required: true,
              message: t("knowledgeNetwork.conceptGroupNameRequired"),
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
        <Form.Item
          label={t("knowledgeNetwork.descriptionField")}
          name="description"
        >
          <Input.TextArea autoSize={{ minRows: 3, maxRows: 5 }} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
