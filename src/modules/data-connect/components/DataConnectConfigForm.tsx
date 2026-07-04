/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Form, Input, InputNumber, Select, Switch } from "antd";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import {
  getConnectorFieldPlaceholder,
  groupConnectorFields,
  humanizeConnectorFieldLabel,
} from "@/modules/data-connect/lib/connector-template";
import type {
  DataConnectConnectorType,
} from "@/modules/data-connect/types/data-connect";

import styles from "./DataConnectConfigForm.module.css";

type DataConnectConfigFormProps = {
  isEdit?: boolean;
  selectedConnectorType?: DataConnectConnectorType;
};

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

  const tagRules = [
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
        <div>
          <h3 className={styles.title}>{t("dataConnect.configStepTitle")}</h3>
          <p className={styles.description}>{t("dataConnect.configStepDescription")}</p>
        </div>
        {selectedConnectorType ? (
          <div className={styles.summary}>
            <strong>{selectedConnectorType.name}</strong>
            <span>{selectedConnectorType.type}</span>
            <span>{Object.keys(selectedConnectorType.fieldConfig ?? {}).length} 个配置字段</span>
          </div>
        ) : null}
      </div>
      <section className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <div>
            <h4 className={styles.sectionTitle}>基础信息</h4>
            <p className={styles.sectionHint}>定义连接名称、用途描述与标签，便于后续识别和管理。</p>
          </div>
        </div>
        <div className={styles.grid}>
          <Form.Item
            label={t("dataConnect.name")}
            name="name"
            rules={[
              { message: t("common.required"), required: true },
              { max: NAME_MAX_LENGTH, message: t("dataConnect.nameLengthLimit", { count: NAME_MAX_LENGTH }) },
            ]}
          >
            <Input maxLength={NAME_MAX_LENGTH} />
          </Form.Item>
          <Form.Item label={t("common.status")} name="enabled" valuePropName="checked">
            <Switch
              checkedChildren={t("common.enabled")}
              disabled={isEdit}
              unCheckedChildren={t("common.disabled")}
            />
          </Form.Item>
          <Form.Item
            className={styles.full}
            label={t("common.description")}
            name="description"
            rules={[
              {
                max: DESCRIPTION_MAX_LENGTH,
                message: t("dataConnect.descriptionLengthLimit", { count: DESCRIPTION_MAX_LENGTH }),
              },
            ]}
          >
            <Input.TextArea maxLength={DESCRIPTION_MAX_LENGTH} rows={4} />
          </Form.Item>
          <Form.Item
            className={styles.full}
            label={t("dataConnect.tags")}
            name="tags"
            rules={tagRules}
          >
            <Select mode="tags" open={false} placeholder={t("dataConnect.tagsPlaceholder")} />
          </Form.Item>
        </div>
      </section>
      <section className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <div>
            <h4 className={styles.sectionTitle}>连接配置</h4>
            <p className={styles.sectionHint}>填写连接目标的访问参数。敏感字段不会在编辑时回显。</p>
          </div>
        </div>
        <div className={styles.groupStack}>
          {groupedFields.map((group) => (
            <section className={styles.innerSection} key={group.key}>
              <div className={styles.innerSectionTitle}>{group.title}</div>
              <div className={styles.grid}>
                {group.fields.map(([fieldName, fieldConfig]) => (
                  <Form.Item
                    className={
                      fieldConfig.type === "object" || fieldConfig.type === "array"
                        ? styles.full
                        : ""
                    }
                    extra={
                      isEdit && fieldConfig.encrypted
                        ? t("dataConnect.encryptedFieldEditHint")
                        : fieldConfig.description || undefined
                    }
                    key={fieldName}
                    label={fieldConfig.name || humanizeConnectorFieldLabel(fieldName)}
                    name={["connectorConfig", fieldName]}
                    rules={[{ message: t("common.required"), required: fieldConfig.required }]}
                    valuePropName={fieldConfig.type === "boolean" ? "checked" : "value"}
                  >
                    {renderField(
                      fieldName,
                      fieldConfig.type,
                      fieldConfig.encrypted,
                      t("dataConnect.encryptedFieldPlaceholder", {
                        field: fieldConfig.name || humanizeConnectorFieldLabel(fieldName),
                      }),
                    )}
                  </Form.Item>
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>
    </div>
  );
}

function renderField(
  fieldName: string,
  fieldType: string,
  encrypted: boolean,
  encryptedPlaceholder: string,
) {
  if (encrypted) {
    return <Input.Password placeholder={encryptedPlaceholder} />;
  }

  const placeholder = getConnectorFieldPlaceholder(fieldName, fieldType);

  switch (fieldType) {
    case "integer":
    case "number":
      return <InputNumber className={styles.numberInput} placeholder={placeholder} />;
    case "boolean":
      return <Switch />;
    case "array":
      return <Select mode="tags" open={false} placeholder={placeholder} />;
    case "object":
      return <Input.TextArea placeholder={placeholder} rows={4} />;
    default:
      return <Input placeholder={placeholder} />;
  }
}
