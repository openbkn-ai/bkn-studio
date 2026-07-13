/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Form, Input, InputNumber, Select, Switch } from "antd";
import type { Rule } from "antd/es/form";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import {
  getConnectorFieldPlaceholder,
  getConnectorTemplateMeta,
  groupConnectorFields,
  humanizeConnectorFieldLabel,
  resolveConnectorFieldControl,
  type ConnectorFieldControl,
} from "@/modules/data-connect/lib/connector-template";
import type {
  DataConnectConnectorType,
} from "@/modules/data-connect/types/data-connect";

import styles from "./DataConnectConfigForm.module.css";

type DataConnectConfigFormProps = {
  isEdit?: boolean;
  selectedConnectorType?: DataConnectConnectorType;
};

type SafeNamePath = string | number | Array<string | number>;

const NAME_MAX_LENGTH = 255;
const DESCRIPTION_MAX_LENGTH = 1000;
const TAG_MAX_LENGTH = 40;
const TAGS_MAX_NUMBER = 5;
const TAG_INVALID_CHARACTERS = [
  "/",
  ":",
  "?",
  "\\",
  '"',
  "<",
  ">",
  "|",
  "：",
  "？",
  "‘",
  "’",
  "“",
  "”",
  "！",
  "《",
  "》",
  ",",
  "#",
  "[",
  "]",
  "{",
  "}",
  "%",
  "&",
  "*",
  "$",
  "^",
  "!",
  "=",
  ".",
  "'",
];

export function DataConnectConfigForm({
  isEdit = false,
  selectedConnectorType,
}: DataConnectConfigFormProps) {
  const { t } = useTranslation();

  const groupedFields = useMemo(
    () => groupConnectorFields(selectedConnectorType),
    [selectedConnectorType],
  );

  const templateMeta = selectedConnectorType
    ? getConnectorTemplateMeta(selectedConnectorType)
    : null;

  const tagRules: Rule[] = [
    {
      validator: (_: unknown, value?: string[]) => {
        const tags = value ?? [];

        if (tags.length > TAGS_MAX_NUMBER) {
          return Promise.reject(
            new Error(t("dataConnect.tagsMaxLength", { count: TAGS_MAX_NUMBER })),
          );
        }

        for (const tag of tags) {
          if (tag.trim().length === 0) {
            return Promise.reject(new Error(t("dataConnect.tagRequired")));
          }

          if (tag.length > TAG_MAX_LENGTH) {
            return Promise.reject(
              new Error(t("dataConnect.tagLengthLimit", { count: TAG_MAX_LENGTH })),
            );
          }

          if (tag.split("").some((character) => TAG_INVALID_CHARACTERS.includes(character))) {
            return Promise.reject(new Error(t("dataConnect.tagInvalidCharacters")));
          }
        }

        return Promise.resolve();
      },
    },
  ];

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <div className={styles.headerCopy}>
          <h3 className={styles.title}>{t("dataConnect.configStepTitle")}</h3>
          <p className={styles.description}>{t("dataConnect.configStepDescription")}</p>
        </div>
        {selectedConnectorType ? (
          <div className={styles.summary}>
            <span className={styles.summaryName}>{selectedConnectorType.name}</span>
            <span className={styles.summaryBadge}>{templateMeta?.label}</span>
          </div>
        ) : null}
      </div>

      <section className={styles.section}>
        <div className={styles.sectionTitle}>基础信息</div>
        <div className={styles.grid}>
          <InlineField
            label={t("dataConnect.name")}
            name="name"
            required
            rules={[
              { message: t("common.required"), required: true },
              {
                max: NAME_MAX_LENGTH,
                message: t("dataConnect.nameLengthLimit", { count: NAME_MAX_LENGTH }),
              },
            ]}
            span="half"
          >
            <Input maxLength={NAME_MAX_LENGTH} placeholder="例如 供应链主库" />
          </InlineField>
          <InlineField
            label={t("common.status")}
            name="enabled"
            span="half"
            valuePropName="checked"
          >
            <Switch
              checkedChildren={t("common.enabled")}
              disabled={isEdit}
              unCheckedChildren={t("common.disabled")}
            />
          </InlineField>
          <InlineField
            align="start"
            label={t("common.description")}
            name="description"
            rules={[
              {
                max: DESCRIPTION_MAX_LENGTH,
                message: t("dataConnect.descriptionLengthLimit", {
                  count: DESCRIPTION_MAX_LENGTH,
                }),
              },
            ]}
            span="full"
          >
            <Input.TextArea
              maxLength={DESCRIPTION_MAX_LENGTH}
              placeholder="简要说明用途（可选）"
              rows={2}
            />
          </InlineField>
          <InlineField
            label={t("dataConnect.tags")}
            name="tags"
            rules={tagRules}
            span="full"
          >
            <Select
              mode="tags"
              open={false}
              placeholder={t("dataConnect.tagsPlaceholder")}
            />
          </InlineField>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionTitle}>连接配置</div>
        <div className={styles.groupStack}>
          {groupedFields.map((group) => (
            <div className={styles.group} key={group.key}>
              <div className={styles.groupTitle}>{group.title}</div>
              <div className={styles.grid}>
                {group.fields.map(([fieldName, fieldConfig]) => {
                  const control = resolveConnectorFieldControl(fieldName, fieldConfig.type);
                  const label = fieldConfig.name || humanizeConnectorFieldLabel(fieldName);

                  return (
                    <InlineField
                      align={control.kind === "json" ? "start" : "center"}
                      extra={
                        isEdit && fieldConfig.encrypted
                          ? t("dataConnect.encryptedFieldEditHint")
                          : undefined
                      }
                      key={fieldName}
                      label={label}
                      name={["connectorConfig", fieldName]}
                      required={fieldConfig.required}
                      rules={[
                        {
                          message: t("common.required"),
                          required: fieldConfig.required,
                        },
                      ]}
                      span={
                        control.kind === "json" || control.kind === "tags" ? "full" : "half"
                      }
                      valuePropName={control.kind === "switch" ? "checked" : "value"}
                    >
                      {renderField({
                        connectorType: selectedConnectorType?.type,
                        control,
                        encrypted: fieldConfig.encrypted,
                        encryptedPlaceholder: t("dataConnect.encryptedFieldPlaceholder", {
                          field: label,
                        }),
                        fieldName,
                        fieldType: fieldConfig.type,
                      })}
                    </InlineField>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

type InlineFieldProps = {
  align?: "center" | "start";
  children: ReactNode;
  extra?: string;
  label: string;
  name: SafeNamePath;
  required?: boolean;
  rules?: Rule[];
  span?: "full" | "half";
  valuePropName?: string;
};

function InlineField({
  align = "center",
  children,
  extra,
  label,
  name,
  required = false,
  rules,
  span = "half",
  valuePropName,
}: InlineFieldProps) {
  return (
    <div
      className={[
        styles.field,
        span === "full" ? styles.spanFull : styles.spanHalf,
        align === "start" ? styles.fieldStart : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <label className={styles.fieldLabel}>
        {required ? <span className={styles.requiredMark}>*</span> : null}
        <span>{label}</span>
      </label>
      <div className={styles.fieldBody}>
        <Form.Item
          className={styles.fieldItem}
          extra={extra}
          name={name}
          rules={rules}
          valuePropName={valuePropName}
        >
          {children}
        </Form.Item>
      </div>
    </div>
  );
}

function renderField(options: {
  connectorType?: string;
  control: ConnectorFieldControl;
  encrypted: boolean;
  encryptedPlaceholder: string;
  fieldName: string;
  fieldType: string;
}) {
  const {
    connectorType,
    control,
    encrypted,
    encryptedPlaceholder,
    fieldName,
    fieldType,
  } = options;

  if (encrypted) {
    return <Input.Password placeholder={encryptedPlaceholder} />;
  }

  const placeholder = getConnectorFieldPlaceholder(fieldName, fieldType, connectorType);

  switch (control.kind) {
    case "number":
      return (
        <InputNumber
          className={styles.numberInput}
          controls={false}
          placeholder={placeholder}
        />
      );
    case "switch":
      return <Switch checkedChildren="开" unCheckedChildren="关" />;
    case "select":
      return (
        <Select
          allowClear
          options={control.options}
          placeholder={`请选择${humanizeConnectorFieldLabel(fieldName)}`}
        />
      );
    case "tags":
      return <Select mode="tags" open={false} placeholder={placeholder} />;
    case "json":
      return <Input.TextArea placeholder={placeholder} rows={3} />;
    default:
      return <Input placeholder={placeholder} />;
  }
}
