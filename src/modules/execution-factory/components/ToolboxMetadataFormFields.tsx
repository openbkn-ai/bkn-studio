import { Form, Input, Select } from "antd";
import { useTranslation } from "react-i18next";

const categoryOptions = ["box_category", "custom_category", "platform_category"];

export function ToolboxMetadataFormFields() {
  const { t } = useTranslation();

  return (
    <>
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
      <Form.Item label={t("executionFactory.serviceUrl")} name="serviceUrl">
        <Input placeholder="https://example.com/toolbox" />
      </Form.Item>
      <Form.Item label={t("executionFactory.category")} name="category">
        <Select
          options={categoryOptions.map((value) => ({
            label: t(`executionFactory.toolboxCategories.${value}`),
            value,
          }))}
        />
      </Form.Item>
    </>
  );
}
