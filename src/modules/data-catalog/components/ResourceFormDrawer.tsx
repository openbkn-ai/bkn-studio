import { Drawer, Form, Input, Select, Space } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { createCatalogResource } from "@/modules/data-catalog/services/resource.service";
import type {
  CatalogResource,
  ResourceCategory,
} from "@/modules/data-catalog/types/data-catalog";
import type { DataConnectRecord } from "@/modules/data-connect/types/data-connect";

type ResourceFormValues = {
  catalogId: string;
  category: ResourceCategory;
  description?: string;
  name: string;
  schemaText?: string;
  sourceIdentifier: string;
};

type ResourceFormDrawerProps = {
  catalogs: DataConnectRecord[];
  defaultCatalogId?: string;
  onClose: () => void;
  onCreated: (resource: CatalogResource) => void;
  open: boolean;
};

function parseSchemaText(text?: string) {
  if (!text) {
    return [];
  }

  return text
    .split("\n")
    .map((line) => {
      const parts = line.trim().split(/\s+/);
      if (!parts[0]) {
        return null;
      }
      return { name: parts[0], type: parts[1] ?? "varchar(128)" };
    })
    .filter((field): field is { name: string; type: string } => field !== null);
}

export function ResourceFormDrawer({
  catalogs,
  defaultCatalogId,
  onClose,
  onCreated,
  open,
}: ResourceFormDrawerProps) {
  const { t } = useTranslation();
  const { message } = useAppServices();
  const [form] = Form.useForm<ResourceFormValues>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      form.resetFields();
      form.setFieldsValue({
        catalogId: defaultCatalogId,
        category: "table",
      });
    }
  }, [defaultCatalogId, form, open]);

  const handleSubmit = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      const resource = await createCatalogResource({
        catalogId: values.catalogId,
        category: values.category,
        description: values.description?.trim() ?? "",
        name: values.name.trim(),
        schema: parseSchemaText(values.schemaText),
        sourceIdentifier: values.sourceIdentifier.trim(),
      });
      message.success(t("dataCatalog.resource.created", { name: resource.name }));
      onCreated(resource);
      onClose();
    } catch (error) {
      void message.error(extractRequestErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      destroyOnHidden
      footer={
        <Space style={{ display: "flex", justifyContent: "flex-end" }}>
          <span style={{ marginRight: "auto", color: "#8b98ac", fontSize: 12 }}>
            POST /vega-backend/v1/resources
          </span>
          <AppButton onClick={onClose}>{t("common.cancel")}</AppButton>
          <AppButton loading={saving} onClick={() => void handleSubmit()} type="primary">
            {t("common.create")}
          </AppButton>
        </Space>
      }
      onClose={onClose}
      open={open}
      title={t("dataCatalog.resource.createTitle")}
      width={520}
    >
      <Form form={form} layout="vertical">
        <Form.Item
          label={t("dataCatalog.resource.name")}
          name="name"
          rules={[{ required: true, message: t("dataCatalog.form.required") }]}
        >
          <Input maxLength={255} placeholder={t("dataCatalog.resource.namePlaceholder")} />
        </Form.Item>
        <Form.Item
          label={t("dataCatalog.resource.catalog")}
          name="catalogId"
          rules={[{ required: true, message: t("dataCatalog.form.required") }]}
        >
          <Select
            options={catalogs.map((catalog) => ({
              label: `${catalog.name}(${
                catalog.type === "logical"
                  ? t("dataCatalog.kind.logical")
                  : t("dataCatalog.kind.physical")
              })`,
              value: catalog.id,
            }))}
            placeholder={t("dataCatalog.resource.catalogPlaceholder")}
            showSearch
            optionFilterProp="label"
          />
        </Form.Item>
        <Form.Item label={t("dataCatalog.resource.category")} name="category">
          <Select
            options={(["table", "logicview", "dataset"] as const).map((category) => ({
              label: t(`dataCatalog.categories.${category}`),
              value: category,
            }))}
          />
        </Form.Item>
        <Form.Item
          extra={t("dataCatalog.resource.sourceIdentifierHint")}
          label={t("dataCatalog.resource.sourceIdentifier")}
          name="sourceIdentifier"
          rules={[{ required: true, message: t("dataCatalog.form.required") }]}
        >
          <Input placeholder={t("dataCatalog.resource.sourceIdentifierPlaceholder")} />
        </Form.Item>
        <Form.Item label={t("dataCatalog.resource.description")} name="description">
          <Input placeholder={t("dataCatalog.form.optional")} />
        </Form.Item>
        <Form.Item
          extra={t("dataCatalog.resource.schemaHint")}
          label={t("dataCatalog.resource.schemaDefinition")}
          name="schemaText"
        >
          <Input.TextArea
            placeholder={"customer_id bigint\nname varchar(128)\nupdated_at datetime"}
            rows={4}
          />
        </Form.Item>
      </Form>
    </Drawer>
  );
}
