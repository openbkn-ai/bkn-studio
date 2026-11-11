/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { Checkbox, Form, Input, Radio, Select } from "antd";
import type { FormInstance } from "antd";
import type { Rule } from "antd/es/form";
import { useTranslation } from "react-i18next";

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
import type {
  ValueType,
  ValueTypeBaseType,
  ValueTypeEnumItem,
} from "@/modules/knowledge-network/types/knowledge-network";
import {
  constraintFieldsForType,
  enumValueFits,
  enumValueKey,
} from "@/modules/knowledge-network/utils/property-declarations";

import { LengthInputs, RangeInputs } from "./RangeInputs";
import type { ValueTypeFormValues } from "./value-type-form-values";
import styles from "./ValueTypeForm.module.css";

const PREFIX = "knowledgeNetwork.valueTypes";

export function ValueTypeFormFields({
  form,
  readOnly = false,
  valueType,
}: {
  form: FormInstance<ValueTypeFormValues>;
  readOnly?: boolean;
  valueType?: ValueType;
}) {
  const { t } = useTranslation();
  const baseType = Form.useWatch("baseType", form) ?? valueType?.baseType ?? "string";
  const ruleMode = Form.useWatch("ruleMode", form) ?? "rules";
  const fields = constraintFieldsForType(baseType);

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

  return (
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
  );
}
