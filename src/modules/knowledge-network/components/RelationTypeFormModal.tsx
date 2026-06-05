import { Form, Input, Modal, Select } from "antd";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import type {
  KnowledgeNetworkObjectTypeRecord,
  KnowledgeNetworkRelationTypeMutationPayload,
  KnowledgeNetworkRelationTypeRecord,
} from "@/modules/knowledge-network/types/knowledge-network";

type RelationTypeFormModalProps = {
  mode: "create" | "edit";
  objectTypes: KnowledgeNetworkObjectTypeRecord[];
  onCancel: () => void;
  onSubmit: (values: KnowledgeNetworkRelationTypeMutationPayload) => Promise<void>;
  open: boolean;
  record?: KnowledgeNetworkRelationTypeRecord | null;
};

const COLOR_OPTIONS = [
  "#1677ff",
  "#13c2c2",
  "#52c41a",
  "#fa8c16",
  "#722ed1",
  "#eb2f96",
];

export function RelationTypeFormModal({
  mode,
  objectTypes,
  onCancel,
  onSubmit,
  open,
  record,
}: RelationTypeFormModalProps) {
  const { t } = useTranslation();
  const [form] = Form.useForm<KnowledgeNetworkRelationTypeMutationPayload>();

  useEffect(() => {
    if (!open) {
      return;
    }

    form.setFieldsValue({
      color: record?.color ?? COLOR_OPTIONS[0],
      description: record?.description ?? "",
      mappingMode: record?.mappingMode ?? "direct",
      name: record?.name ?? "",
      sourceObjectTypeId: record?.sourceObjectTypeId ?? undefined,
      tags: record?.tags ?? [],
      targetObjectTypeId: record?.targetObjectTypeId ?? undefined,
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
          ? t("knowledgeNetwork.relationTypeCreateTitle")
          : t("knowledgeNetwork.relationTypeEditTitle")
      }
    >
      <Form form={form} layout="vertical">
        <Form.Item
          label={t("knowledgeNetwork.relationTypeName")}
          name="name"
          rules={[
            {
              message: t("knowledgeNetwork.relationTypeNameRequired"),
              required: true,
            },
          ]}
        >
          <Input maxLength={64} />
        </Form.Item>
        <Form.Item label={t("knowledgeNetwork.descriptionField")} name="description">
          <Input.TextArea autoSize={{ minRows: 3, maxRows: 5 }} maxLength={240} />
        </Form.Item>
        <Form.Item
          label={t("knowledgeNetwork.relationTypeSourceObject")}
          name="sourceObjectTypeId"
          rules={[
            {
              message: t("knowledgeNetwork.relationTypeSourceObjectRequired"),
              required: true,
            },
          ]}
        >
          <Select
            optionFilterProp="label"
            options={objectTypes.map((item) => ({
              label: item.name,
              value: item.id,
            }))}
            placeholder={t("knowledgeNetwork.relationTypeSourceObjectPlaceholder")}
          />
        </Form.Item>
        <Form.Item
          label={t("knowledgeNetwork.relationTypeTargetObject")}
          name="targetObjectTypeId"
          rules={[
            {
              message: t("knowledgeNetwork.relationTypeTargetObjectRequired"),
              required: true,
            },
          ]}
        >
          <Select
            optionFilterProp="label"
            options={objectTypes.map((item) => ({
              label: item.name,
              value: item.id,
            }))}
            placeholder={t("knowledgeNetwork.relationTypeTargetObjectPlaceholder")}
          />
        </Form.Item>
        <Form.Item
          label={t("knowledgeNetwork.relationTypeMappingMode")}
          name="mappingMode"
        >
          <Select
            options={[
              {
                label: t("knowledgeNetwork.relationTypeDirectMapping"),
                value: "direct",
              },
              {
                label: t("knowledgeNetwork.relationTypeDataViewMapping"),
                value: "data-view",
              },
            ]}
          />
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
      </Form>
    </Modal>
  );
}
