import { Form, Input, Modal, Select } from "antd";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import type {
  KnowledgeNetworkActionTypeMutationPayload,
  KnowledgeNetworkActionTypeRecord,
  KnowledgeNetworkObjectTypeRecord,
} from "@/modules/knowledge-network/types/knowledge-network";

type ActionTypeFormModalProps = {
  mode: "create" | "edit";
  objectTypes: KnowledgeNetworkObjectTypeRecord[];
  onCancel: () => void;
  onSubmit: (values: KnowledgeNetworkActionTypeMutationPayload) => Promise<void>;
  open: boolean;
  record?: KnowledgeNetworkActionTypeRecord | null;
};

const COLOR_OPTIONS = [
  "#1677ff",
  "#13c2c2",
  "#52c41a",
  "#fa8c16",
  "#722ed1",
  "#eb2f96",
];

export function ActionTypeFormModal({
  mode,
  objectTypes,
  onCancel,
  onSubmit,
  open,
  record,
}: ActionTypeFormModalProps) {
  const { t } = useTranslation();
  const [form] = Form.useForm<KnowledgeNetworkActionTypeMutationPayload>();

  useEffect(() => {
    if (!open) {
      return;
    }

    form.setFieldsValue({
      actionKind: record?.actionKind ?? "create",
      color: record?.color ?? COLOR_OPTIONS[0],
      description: record?.description ?? "",
      name: record?.name ?? "",
      objectTypeId: record?.objectTypeId ?? undefined,
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
          ? t("knowledgeNetwork.actionTypeCreateTitle")
          : t("knowledgeNetwork.actionTypeEditTitle")
      }
    >
      <Form form={form} layout="vertical">
        <Form.Item
          label={t("knowledgeNetwork.actionTypeName")}
          name="name"
          rules={[
            {
              message: t("knowledgeNetwork.actionTypeNameRequired"),
              required: true,
            },
          ]}
        >
          <Input maxLength={64} />
        </Form.Item>
        <Form.Item
          label={t("knowledgeNetwork.actionTypeKind")}
          name="actionKind"
          rules={[
            {
              message: t("knowledgeNetwork.actionTypeKindRequired"),
              required: true,
            },
          ]}
        >
          <Select
            options={[
              {
                label: t("knowledgeNetwork.actionTypeKindCreate"),
                value: "create",
              },
              {
                label: t("knowledgeNetwork.actionTypeKindUpdate"),
                value: "update",
              },
              {
                label: t("knowledgeNetwork.actionTypeKindDelete"),
                value: "delete",
              },
              {
                label: t("knowledgeNetwork.actionTypeKindNotify"),
                value: "notify",
              },
            ]}
          />
        </Form.Item>
        <Form.Item
          label={t("knowledgeNetwork.actionTypeObject")}
          name="objectTypeId"
          rules={[
            {
              message: t("knowledgeNetwork.actionTypeObjectRequired"),
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
            placeholder={t("knowledgeNetwork.actionTypeObjectPlaceholder")}
          />
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
      </Form>
    </Modal>
  );
}
