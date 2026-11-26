/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { PlusOutlined } from "@ant-design/icons";
import {
  Alert,
  Checkbox,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Typography,
} from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { AppButton } from "@/framework/ui/common/AppButton";
import { DATA_PROPERTY_TYPES } from "@/modules/knowledge-network/components/object-type/data-attribute/constants";
import { RangeInputs } from "@/modules/knowledge-network/components/value-type/RangeInputs";
import { listObjectTypeResourceFields } from "@/modules/knowledge-network/services/knowledge-network.service";
import type { StoredRelationProperty } from "@/modules/knowledge-network/types/knowledge-network";
import { constraintFieldsForType } from "@/modules/knowledge-network/utils/property-declarations";

import {
  validateRelationProperties,
  type RelationTypeMappingField,
  type RelationTypeMappingReaders,
} from "./mapping-utils";

const PREFIX = "knowledgeNetwork.relationProperties.";

type PropertyFormValues = Pick<
  StoredRelationProperty,
  "name" | "displayName" | "type" | "required" | "mappedField"
> & {
  constraints?: { range?: { min?: number | string; max?: number | string } };
};

type Props = {
  networkId: string;
  resourceId?: string;
  readers?: RelationTypeMappingReaders;
  value: StoredRelationProperty[];
  onChange?: (properties: StoredRelationProperty[]) => void;
  readOnly?: boolean;
};

export function RelationPropertiesEditor({
  networkId,
  resourceId,
  readers,
  value,
  onChange,
  readOnly = false,
}: Props) {
  const { t } = useTranslation();
  const [fields, setFields] = useState<RelationTypeMappingField[]>([]);
  const [fieldsError, setFieldsError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [saveError, setSaveError] = useState<string>();
  const [rangeCleared, setRangeCleared] = useState(false);
  const [form] = Form.useForm<PropertyFormValues>();
  const propertyType = Form.useWatch("type", form);
  const rangeKind = constraintFieldsForType(propertyType).range;
  const draftRange = Form.useWatch((values: PropertyFormValues) => values.constraints?.range, form);
  const savedRange = editingIndex === null ? undefined : value[editingIndex]?.constraints?.range;

  useEffect(() => {
    if (readOnly || !resourceId) return;
    let active = true;
    setLoading(true);
    setFieldsError(false);
    setFields([]);
    const read = readers
      ? readers.readResourceFields(resourceId)
      : listObjectTypeResourceFields(networkId, resourceId);
    void read
      .then((result) => {
        if (active) setFields(result);
      })
      .catch(() => {
        if (active) setFieldsError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [networkId, readers, readOnly, resourceId]);

  const edit = (index: number | null) => {
    const property: StoredRelationProperty =
      index === null ? { name: "", type: "string", required: false } : value[index];
    setEditingIndex(index);
    setSaveError(undefined);
    setRangeCleared(false);
    form.resetFields();
    // The complete declaration and unsupported constraints survive edits to the exposed fields.
    form.setFieldsValue({
      name: property.name,
      displayName: property.displayName,
      type: property.type,
      required: property.required,
      mappedField: property.mappedField ?? property.name,
      constraints: {
        range: { min: property.constraints?.range?.min, max: property.constraints?.range?.max },
      },
    });
    form.setFields(
      (["name", "displayName", "type"] as const).map((name) => ({ name, touched: false })),
    );
    setOpen(true);
  };

  const save = async () => {
    try {
      const fieldsValue = await form.validateFields();
      const original = editingIndex === null ? undefined : value[editingIndex];
      const constraints = { ...original?.constraints, ...fieldsValue.constraints };
      if (fieldsValue.constraints?.range)
        constraints.range = { ...original?.constraints?.range, ...fieldsValue.constraints.range };
      const range = constraints.range;
      if (range) {
        constraints.range = { ...range };
        if (range.min === undefined || range.min === null || range.min === "")
          delete constraints.range.min;
        if (range.max === undefined || range.max === null || range.max === "")
          delete constraints.range.max;
        if (Object.keys(constraints.range).length === 0) delete constraints.range;
      }
      if (rangeCleared) delete constraints.range;
      const selectedField = fields.find((field) => field.name === fieldsValue.mappedField);
      const previousField = original?.declaration?.mapped_field;
      const mappedDeclaration =
        previousField && typeof previousField === "object" && !Array.isArray(previousField)
          ? previousField
          : {};
      const property: StoredRelationProperty = {
        ...original,
        ...fieldsValue,
        name: fieldsValue.name.trim(),
        ...(selectedField
          ? {
              declaration: {
                ...original?.declaration,
                mapped_field: {
                  ...mappedDeclaration,
                  name: selectedField.name,
                  type: selectedField.type,
                },
              },
            }
          : {}),
        constraints,
      };
      const next =
        editingIndex === null
          ? [...value, property]
          : value.map((item, index) => (index === editingIndex ? property : item));
      const error = validateRelationProperties(t, next);
      if (error) {
        setSaveError(error);
        return;
      }
      onChange?.(next);
      setOpen(false);
    } catch {
      // Field validation displays its own errors and retains the draft.
    }
  };

  const rangeText = (property: StoredRelationProperty) => {
    const range = property.constraints?.range;
    return range
      ? `${range.min ?? t(PREFIX + "unbounded")} – ${range.max ?? t(PREFIX + "unbounded")}`
      : "—";
  };

  return (
    <section aria-label={t(PREFIX + "title")}>
      <Space direction="vertical" style={{ width: "100%" }}>
        <Typography.Title level={5}>{t(PREFIX + "title")}</Typography.Title>
        {!readOnly && (
          <Typography.Paragraph type="secondary">{t(PREFIX + "hint")}</Typography.Paragraph>
        )}
        {fieldsError && <Alert type="error" showIcon message={t(PREFIX + "fieldsUnavailable")} />}
        <Table<StoredRelationProperty>
          dataSource={value}
          rowKey="name"
          pagination={false}
          scroll={{ x: 760 }}
          locale={{ emptyText: t(PREFIX + "empty") }}
          columns={[
            { title: t(PREFIX + "name"), dataIndex: "name" },
            { title: t(PREFIX + "displayName"), dataIndex: "displayName" },
            { title: t(PREFIX + "type"), dataIndex: "type" },
            {
              title: t(PREFIX + "mappedField"),
              render: (_, property) => property.mappedField ?? property.name,
            },
            {
              title: t(PREFIX + "required"),
              render: (_, property) =>
                t(PREFIX + (property.required ? "requiredYes" : "requiredNo")),
            },
            { title: t(PREFIX + "range"), render: (_, property) => rangeText(property) },
            {
              title: t("common.actions"),
              render: (_, property, index) => (
                <Space>
                  <AppButton type="link" onClick={() => edit(index)}>
                    {t(PREFIX + (readOnly ? "view" : "edit"))}
                  </AppButton>
                  {!readOnly && (
                    <Popconfirm
                      title={t(PREFIX + "removeConfirm")}
                      onConfirm={() => onChange?.(value.filter((item) => item !== property))}
                    >
                      <AppButton type="link" danger>
                        {t(PREFIX + "remove")}
                      </AppButton>
                    </Popconfirm>
                  )}
                </Space>
              ),
            },
          ]}
        />
        {!readOnly && (
          <AppButton icon={<PlusOutlined />} disabled={!resourceId} onClick={() => edit(null)}>
            {t(PREFIX + "add")}
          </AppButton>
        )}
        {!readOnly && !resourceId && (
          <Typography.Text type="secondary">{t(PREFIX + "chooseResource")}</Typography.Text>
        )}
      </Space>
      <Modal
        open={open}
        title={t(PREFIX + (readOnly ? "view" : editingIndex === null ? "add" : "edit"))}
        onCancel={() => setOpen(false)}
        onOk={() => {
          void save();
        }}
        okText={t("common.save")}
        cancelText={t("common.cancel")}
        footer={readOnly ? null : undefined}
        width={640}
        forceRender
      >
        {saveError && <Alert type="error" showIcon message={saveError} />}
        <Form<PropertyFormValues>
          form={form}
          layout="vertical"
          disabled={readOnly}
          onValuesChange={(changed: Partial<PropertyFormValues>) => {
            if (changed.constraints?.range) setRangeCleared(false);
          }}
        >
          <Form.Item
            name="name"
            label={t(PREFIX + "name")}
            rules={[{ required: true, whitespace: true, message: t(PREFIX + "nameRequired") }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="displayName" label={t(PREFIX + "displayName")}>
            <Input />
          </Form.Item>
          <Form.Item
            name="mappedField"
            label={t(PREFIX + "mappedField")}
            rules={[{ required: true, message: t(PREFIX + "fieldRequired") }]}
          >
            <Select
              loading={loading}
              showSearch
              optionFilterProp="label"
              options={fields.map((field) => ({
                value: field.name,
                label: `${field.displayName || field.name} (${field.type})`,
              }))}
              onChange={(name: string) => {
                if (editingIndex !== null) return;
                const field = fields.find((item) => item.name === name);
                if (!field) return;
                if (!form.isFieldTouched("name")) form.setFieldValue("name", field.name);
                if (!form.isFieldTouched("displayName"))
                  form.setFieldValue("displayName", field.displayName);
                if (
                  !form.isFieldTouched("type") &&
                  (DATA_PROPERTY_TYPES as readonly string[]).includes(field.type)
                )
                  form.setFieldValue("type", field.type);
              }}
            />
          </Form.Item>
          <Form.Item
            name="type"
            label={t(PREFIX + "type")}
            rules={[{ required: true, message: t(PREFIX + "typeRequired") }]}
          >
            <Select
              showSearch
              options={Array.from(
                new Set<string>([...DATA_PROPERTY_TYPES, ...(propertyType ? [propertyType] : [])]),
              ).map((type) => ({ value: type, label: type }))}
            />
          </Form.Item>
          <Form.Item name="required" valuePropName="checked">
            <Checkbox>{t(PREFIX + "required")}</Checkbox>
          </Form.Item>
          {!readOnly && !rangeKind && savedRange && !rangeCleared && (
            <Alert type="warning" showIcon message={t(PREFIX + "rangeIncompatible")} />
          )}
          {!readOnly &&
            !rangeCleared &&
            (savedRange || draftRange?.min !== undefined || draftRange?.max !== undefined) && (
              <AppButton
                onClick={() => {
                  setRangeCleared(true);
                  form.setFieldValue(["constraints", "range"], undefined);
                }}
              >
                {t(PREFIX + "clearRange")}
              </AppButton>
            )}
          {rangeKind && (
            <>
              <Typography.Text strong>{t(PREFIX + "range")}</Typography.Text>
              <RangeInputs kind={rangeKind} name={["constraints", "range"]} />
            </>
          )}
        </Form>
        {editingIndex !== null && value[editingIndex]?.constraints && (
          <>
            <Typography.Text strong>{t(PREFIX + "constraints")}</Typography.Text>
            <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
              {JSON.stringify(value[editingIndex].constraints, null, 2)}
            </pre>
          </>
        )}
      </Modal>
    </section>
  );
}
