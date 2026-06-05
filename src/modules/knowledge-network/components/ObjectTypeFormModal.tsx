import { Form, Input, Modal, Select } from "antd";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import type {
  ConceptGroupRecord,
  KnowledgeNetworkObjectTypeMutationPayload,
  KnowledgeNetworkObjectTypeRecord,
} from "@/modules/knowledge-network/types/knowledge-network";

type ObjectTypeFormModalProps = {
  conceptGroups: ConceptGroupRecord[];
  mode: "create" | "edit";
  onCancel: () => void;
  onSubmit: (values: KnowledgeNetworkObjectTypeMutationPayload) => Promise<void>;
  open: boolean;
  record?: KnowledgeNetworkObjectTypeRecord | null;
};

const COLOR_OPTIONS = [
  "#1677ff",
  "#13c2c2",
  "#52c41a",
  "#fa8c16",
  "#722ed1",
  "#eb2f96",
];

export function ObjectTypeFormModal({
  conceptGroups,
  mode,
  onCancel,
  onSubmit,
  open,
  record,
}: ObjectTypeFormModalProps) {
  const { t } = useTranslation();
  const [form] = Form.useForm<KnowledgeNetworkObjectTypeMutationPayload>();

  useEffect(() => {
    if (!open) {
      return;
    }

    form.setFieldsValue({
      color: record?.color ?? COLOR_OPTIONS[0],
      conceptGroupIds: record?.conceptGroupIds ?? [],
      description: record?.description ?? "",
      icon: record?.icon ?? "",
      name: record?.name ?? "",
      tags: record?.tags ?? [],
    });
  }, [form, open, record]);

  return (
    <Modal
      cancelText={t("common.cancel")}
      destroyOnClose
      okText={mode === "create" ? t("common.create") : t("common.save")}
      onCancel={() => {
        form.resetFields();
        onCancel();
      }}
      onOk={() => {
        void form.validateFields().then(async (values) => {
          await onSubmit(values);
          form.resetFields();
        });
      }}
      open={open}
      title={
        mode === "create"
          ? t("knowledgeNetwork.objectTypeCreateTitle")
          : t("knowledgeNetwork.objectTypeEditTitle")
      }
    >
      <Form form={form} layout="vertical">
        <Form.Item
          label={t("knowledgeNetwork.objectTypeName")}
          name="name"
          rules={[
            {
              message: t("knowledgeNetwork.objectTypeNameRequired"),
              required: true,
            },
          ]}
        >
          <Input maxLength={64} />
        </Form.Item>
        <Form.Item label={t("knowledgeNetwork.descriptionField")} name="description">
          <Input.TextArea autoSize={{ minRows: 3, maxRows: 5 }} maxLength={240} />
        </Form.Item>
        <Form.Item label={t("knowledgeNetwork.tags")} name="tags">
          <Select mode="tags" tokenSeparators={[","]} />
        </Form.Item>
        <Form.Item label={t("knowledgeNetwork.color")} name="color">
          <Select
            options={COLOR_OPTIONS.map((value) => ({
              label: value,
              value,
            }))}
          />
        </Form.Item>
        <Form.Item
          label={t("knowledgeNetwork.objectTypeConceptGroups")}
          name="conceptGroupIds"
        >
          <Select
            allowClear
            mode="multiple"
            optionFilterProp="label"
            options={conceptGroups.map((item) => ({
              label: item.name,
              value: item.id,
            }))}
            placeholder={t("knowledgeNetwork.objectTypeConceptGroupsPlaceholder")}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
