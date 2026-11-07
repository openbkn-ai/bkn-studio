/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { Checkbox, Drawer, Form, Input, Radio, Select } from "antd";
import type { Rule } from "antd/es/form";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import {
  ResourceTagsSelect,
  validateKnowledgeNetworkTags,
} from "@/modules/knowledge-network/components/shared/ResourceTagsSelect";
import {
  RESOURCE_ID_MAX_LENGTH,
  RESOURCE_IDENTIFIER_PATTERN,
  RESOURCE_NAME_COUNT,
  RESOURCE_NAME_MAX_LENGTH,
} from "@/modules/knowledge-network/lib/resource-constraints";
import { VALUE_TYPE_BASE_TYPES } from "@/modules/knowledge-network/services/mappers/value-type.mapper";
import {
  createKnowledgeNetworkValueType,
  updateKnowledgeNetworkValueType,
  ValueTypeReferencedError,
} from "@/modules/knowledge-network/services/value-type.service";
import type {
  ValueType,
  ValueTypeBaseType,
  ValueTypeEnumItem,
  ValueTypeInput,
} from "@/modules/knowledge-network/types/knowledge-network";
import {
  constraintFieldsForType,
  enumValueFits,
  enumValueKey,
} from "@/modules/knowledge-network/utils/property-declarations";

import { LengthInputs, RangeInputs } from "./RangeInputs";
import {
  ValueTypeReferencedDialog,
  type ValueTypeReferencedRefusal,
} from "./ValueTypeReferencedDialog";
import styles from "./ValueTypeFormDrawer.module.css";

const PREFIX = "knowledgeNetwork.valueTypes";

type RuleMode = "enum" | "rules";

type ValueTypeFormValues = {
  baseType: ValueTypeBaseType;
  description?: string;
  enum?: ValueTypeEnumItem[];
  id?: string;
  length?: { max?: number | null; min?: number | null };
  name: string;
  pattern?: string;
  range?: { max?: number | string | null; min?: number | string | null };
  ruleMode: RuleMode;
  tags?: string[];
  unit?: string;
};

function toFormValues(
  valueType: ValueType | undefined,
  baseType: ValueTypeBaseType,
): ValueTypeFormValues {
  if (!valueType) {
    return { baseType, description: "", enum: [], name: "", ruleMode: "rules", tags: [] };
  }
  return {
    baseType: valueType.baseType,
    description: valueType.description,
    enum: valueType.enum?.map((item) => ({ ...item })) ?? [],
    id: valueType.id,
    length: valueType.length ? { ...valueType.length } : undefined,
    name: valueType.name,
    pattern: valueType.pattern,
    range: valueType.range ? { ...valueType.range } : undefined,
    ruleMode: valueType.enum?.length ? "enum" : "rules",
    tags: [...valueType.tags],
    unit: valueType.unit,
  };
}

function presentBounds<T extends number | string>(range?: {
  max?: T | null;
  min?: T | null;
}): { max?: T; min?: T } | undefined {
  const min = range?.min ?? undefined;
  const max = range?.max ?? undefined;
  const isSet = (bound?: T) => bound !== undefined && bound !== "";
  if (!isSet(min) && !isSet(max)) {
    return undefined;
  }
  return { ...(isSet(min) ? { min } : {}), ...(isSet(max) ? { max } : {}) };
}

/** The value type the form describes; rules the base type does not take are left out. */
function toInput(values: ValueTypeFormValues, kept?: ValueType): ValueTypeInput {
  const fields = constraintFieldsForType(values.baseType);
  const unit = fields.unit ? values.unit?.trim() || undefined : undefined;
  const common = {
    baseType: values.baseType,
    color: kept?.color,
    description: values.description?.trim() ?? "",
    icon: kept?.icon,
    ...(kept ? {} : values.id?.trim() ? { id: values.id.trim() } : {}),
    name: values.name.trim(),
    tags: values.tags ?? [],
    unit,
  };

  if (values.ruleMode === "enum") {
    return {
      ...common,
      enum: (values.enum ?? []).map((item) => ({
        ...(item.deprecated ? { deprecated: true } : {}),
        ...(item.description?.trim() ? { description: item.description.trim() } : {}),
        display: item.display.trim(),
        value: item.value.trim(),
      })),
    };
  }

  return {
    ...common,
    length: fields.length ? presentBounds(values.length) : undefined,
    pattern: fields.pattern ? values.pattern || undefined : undefined,
    range: fields.range ? presentBounds(values.range) : undefined,
  };
}

const isBaseType = (value?: string): value is ValueTypeBaseType =>
  Boolean(value) && (VALUE_TYPE_BASE_TYPES as readonly string[]).includes(value!);

type ValueTypeFormDrawerProps = {
  /** The base type a new value type starts with, such as the type of the property it is made for. */
  defaultBaseType?: string;
  networkId: string;
  onClose: () => void;
  /** Called with the value type's ID once it is saved. */
  onSaved: (valueTypeId: string) => void;
  open: boolean;
  /** Shows the value type without letting it change. */
  readOnly?: boolean;
  /** The value type to edit; absent, a new one is made. */
  valueType?: ValueType;
};

/**
 * Creates, edits or shows one value type. It opens over the value type list and over the data
 * property drawer alike, pushing the drawer it opens from aside.
 */
export function ValueTypeFormDrawer({
  defaultBaseType,
  networkId,
  onClose,
  onSaved,
  open,
  readOnly = false,
  valueType,
}: ValueTypeFormDrawerProps) {
  const { t } = useTranslation();
  const { message } = useAppServices();
  const [form] = Form.useForm<ValueTypeFormValues>();
  const baseType = Form.useWatch("baseType", form) ?? valueType?.baseType ?? "string";
  const ruleMode = Form.useWatch("ruleMode", form) ?? "rules";
  const [submitting, setSubmitting] = useState(false);
  const [refusal, setRefusal] = useState<ValueTypeReferencedRefusal | null>(null);
  const fields = constraintFieldsForType(baseType);

  useEffect(() => {
    if (!open) {
      return;
    }
    setSubmitting(false);
    form.resetFields();
    form.setFieldsValue(
      toFormValues(valueType, isBaseType(defaultBaseType) ? defaultBaseType : "string"),
    );
  }, [defaultBaseType, form, open, valueType]);

  const handleBaseTypeChange = (next: ValueTypeBaseType) => {
    const previous = constraintFieldsForType(baseType);
    const nextFields = constraintFieldsForType(next);
    // Bounds written for another kind of range would only be refused.
    if (previous.range !== nextFields.range) {
      form.setFieldValue("range", undefined);
    }
    if (!nextFields.length) form.setFieldValue("length", undefined);
    if (!nextFields.pattern) form.setFieldValue("pattern", undefined);
    if (!nextFields.unit) form.setFieldValue("unit", undefined);
  };

  const enumValueRules: Rule[] = [
    { message: t(`${PREFIX}.form.enumValueRequired`), required: true, whitespace: true },
    ({ getFieldValue }) => ({
      validator: (_rule, value?: string) => {
        const code = value?.trim() ?? "";
        if (!code) {
          return Promise.resolve();
        }
        const currentBase = getFieldValue("baseType") as string;
        if (!enumValueFits(currentBase, code)) {
          return Promise.reject(
            new Error(t(`${PREFIX}.form.enumValueInvalid`, { type: currentBase, value: code })),
          );
        }
        const codes = ((getFieldValue("enum") as ValueTypeEnumItem[] | undefined) ?? []).map(
          (item) => enumValueKey(currentBase, item?.value?.trim() ?? ""),
        );
        const key = enumValueKey(currentBase, code);
        return codes.filter((item) => item === key).length > 1
          ? Promise.reject(new Error(t(`${PREFIX}.form.enumDuplicate`, { value: code })))
          : Promise.resolve();
      },
    }),
  ];

  const handleSubmit = async () => {
    let values: ValueTypeFormValues;
    try {
      await form.validateFields();
      values = form.getFieldsValue(true) as ValueTypeFormValues;
    } catch {
      return;
    }

    const input = toInput(values, valueType);
    setSubmitting(true);
    try {
      let savedId = valueType?.id ?? "";
      if (valueType) {
        await updateKnowledgeNetworkValueType(networkId, valueType.id, input);
        void message.success(t(`${PREFIX}.form.saved`));
      } else {
        savedId = await createKnowledgeNetworkValueType(networkId, input);
        void message.success(t(`${PREFIX}.form.created`));
      }
      onSaved(savedId);
      onClose();
    } catch (error) {
      if (error instanceof ValueTypeReferencedError) {
        setRefusal({ action: "update", name: input.name, references: error.references });
      } else {
        void message.error(extractRequestErrorMessage(error));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const title = readOnly
    ? t(`${PREFIX}.form.viewTitle`)
    : valueType
      ? t(`${PREFIX}.form.editTitle`)
      : t(`${PREFIX}.form.createTitle`);

  return (
    <Drawer
      destroyOnHidden
      footer={
        <div className={styles.footer}>
          <AppButton onClick={onClose}>{t("common.cancel")}</AppButton>
          {readOnly ? null : (
            <AppButton loading={submitting} onClick={() => void handleSubmit()} type="primary">
              {t("common.save")}
            </AppButton>
          )}
        </div>
      }
      maskClosable={false}
      onClose={onClose}
      open={open}
      title={title}
      width={640}
    >
      <Form colon={false} disabled={readOnly} form={form} layout="vertical">
        <div className={styles.row}>
          <Form.Item
            label={t(`${PREFIX}.form.name`)}
            name="name"
            rules={[
              { message: t(`${PREFIX}.form.nameRequired`), required: true, whitespace: true },
              { max: RESOURCE_NAME_MAX_LENGTH },
            ]}
          >
            <Input count={RESOURCE_NAME_COUNT} placeholder={t("knowledgeNetwork.pleaseInput")} />
          </Form.Item>
          <Form.Item
            extra={valueType ? undefined : t(`${PREFIX}.form.idHint`)}
            label={t(`${PREFIX}.form.id`)}
            name="id"
            rules={[
              { max: RESOURCE_ID_MAX_LENGTH },
              { message: t(`${PREFIX}.form.idPattern`), pattern: RESOURCE_IDENTIFIER_PATTERN },
            ]}
          >
            <Input className={styles.mono} disabled={Boolean(valueType) || readOnly} />
          </Form.Item>
        </div>
        <Form.Item
          label={t(`${PREFIX}.form.tags`)}
          name="tags"
          rules={[{ validator: (rule, value) => validateKnowledgeNetworkTags(t, rule, value) }]}
        >
          <ResourceTagsSelect />
        </Form.Item>
        <Form.Item label={t(`${PREFIX}.form.description`)} name="description">
          <Input.TextArea autoSize={{ maxRows: 6, minRows: 2 }} maxLength={1000} showCount />
        </Form.Item>
        <Form.Item
          extra={valueType && !readOnly ? t(`${PREFIX}.form.baseTypeHint`) : undefined}
          label={t(`${PREFIX}.form.baseType`)}
          name="baseType"
          rules={[{ required: true }]}
        >
          <Select
            onChange={handleBaseTypeChange}
            options={VALUE_TYPE_BASE_TYPES.map((item) => ({ label: item, value: item }))}
          />
        </Form.Item>
        <Form.Item label={t(`${PREFIX}.form.ruleMode`)} name="ruleMode">
          <Radio.Group
            options={[
              { label: t(`${PREFIX}.form.ruleEnum`), value: "enum" },
              { label: t(`${PREFIX}.form.ruleValue`), value: "rules" },
            ]}
          />
        </Form.Item>

        {ruleMode === "enum" ? (
          <Form.List
            name="enum"
            rules={[
              {
                validator: (_rule, items?: unknown[]) =>
                  items?.length
                    ? Promise.resolve()
                    : Promise.reject(new Error(t(`${PREFIX}.form.enumEmpty`))),
              },
            ]}
          >
            {(items, { add, remove }, { errors }) => (
              <div className={styles.enumTable}>
                <div className={`${styles.enumRow} ${styles.enumHeader}`}>
                  <span>{t(`${PREFIX}.enumColumn.value`)}</span>
                  <span>{t(`${PREFIX}.enumColumn.display`)}</span>
                  <span>{t(`${PREFIX}.form.enumDeprecated`)}</span>
                  <span>{t(`${PREFIX}.enumColumn.description`)}</span>
                  <span />
                </div>
                {items.map((item) => (
                  <div className={styles.enumRow} key={item.key}>
                    <Form.Item
                      dependencies={[["baseType"]]}
                      name={[item.name, "value"]}
                      rules={enumValueRules}
                    >
                      <Input
                        aria-label={t(`${PREFIX}.enumColumn.value`)}
                        className={styles.mono}
                        onChange={() => {
                          // The other codes are checked for repeats too.
                          void form
                            .validateFields(
                              items
                                .filter((other) => other.key !== item.key)
                                .map((other) => ["enum", other.name, "value"]),
                            )
                            .catch(() => undefined);
                        }}
                      />
                    </Form.Item>
                    <Form.Item
                      name={[item.name, "display"]}
                      rules={[
                        {
                          message: t(`${PREFIX}.form.enumDisplayRequired`),
                          required: true,
                          whitespace: true,
                        },
                      ]}
                    >
                      <Input aria-label={t(`${PREFIX}.enumColumn.display`)} />
                    </Form.Item>
                    <Form.Item name={[item.name, "deprecated"]} valuePropName="checked">
                      <Checkbox aria-label={t(`${PREFIX}.form.enumDeprecated`)} />
                    </Form.Item>
                    <Form.Item name={[item.name, "description"]}>
                      <Input aria-label={t(`${PREFIX}.enumColumn.description`)} />
                    </Form.Item>
                    {readOnly ? (
                      <span />
                    ) : (
                      <AppButton
                        aria-label={t(`${PREFIX}.form.enumRemove`)}
                        icon={<DeleteOutlined />}
                        onClick={() => remove(item.name)}
                        type="text"
                      />
                    )}
                  </div>
                ))}
                <Form.ErrorList errors={errors} />
                {readOnly ? null : (
                  <AppButton
                    className={styles.enumAdd}
                    icon={<PlusOutlined />}
                    onClick={() => add({ display: "", value: "" })}
                    type="dashed"
                  >
                    {t(`${PREFIX}.form.enumAdd`)}
                  </AppButton>
                )}
              </div>
            )}
          </Form.List>
        ) : (
          <>
            {fields.range ? <RangeInputs kind={fields.range} name={["range"]} /> : null}
            {fields.length ? <LengthInputs name={["length"]} /> : null}
            {fields.pattern ? (
              <Form.Item
                extra={t(`${PREFIX}.rules.patternHint`)}
                label={t(`${PREFIX}.rules.pattern`)}
                name="pattern"
              >
                <Input className={styles.mono} />
              </Form.Item>
            ) : null}
          </>
        )}
        {fields.unit ? (
          <Form.Item label={t(`${PREFIX}.rules.unit`)} name="unit">
            <Input className={styles.unit} />
          </Form.Item>
        ) : null}
      </Form>
      {refusal ? (
        <ValueTypeReferencedDialog
          networkId={networkId}
          onClose={() => setRefusal(null)}
          refusal={refusal}
        />
      ) : null}
    </Drawer>
  );
}
