import { Form, Input, InputNumber, Select, Switch } from "antd";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

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

function getFieldLabel(name: string) {
  return name
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^\w/, (char) => char.toUpperCase());
}

export function DataConnectConfigForm({
  isEdit = false,
  selectedConnectorType,
}: DataConnectConfigFormProps) {
  const { t } = useTranslation();

  const fields = useMemo(
    () =>
      Object.entries(selectedConnectorType?.fieldConfig ?? {}).sort((left, right) =>
        left[0].localeCompare(right[0]),
      ),
    [selectedConnectorType?.fieldConfig],
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
          </div>
        ) : null}
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
        {fields.map(([fieldName, fieldConfig]) => (
          <Form.Item
            className={fieldConfig.type === "object" || fieldConfig.type === "array" ? styles.full : ""}
            extra={
              isEdit && fieldConfig.encrypted
                ? t("dataConnect.encryptedFieldEditHint")
                : fieldConfig.description || undefined
            }
            key={fieldName}
            label={fieldConfig.name || getFieldLabel(fieldName)}
            name={["connectorConfig", fieldName]}
            rules={[{ message: t("common.required"), required: fieldConfig.required }]}
            valuePropName={fieldConfig.type === "boolean" ? "checked" : "value"}
          >
            {renderField(
              fieldConfig.type,
              fieldConfig.encrypted,
              t("dataConnect.encryptedFieldPlaceholder", {
                field: fieldConfig.name || getFieldLabel(fieldName),
              }),
            )}
          </Form.Item>
        ))}
      </div>
    </div>
  );
}

function renderField(fieldType: string, encrypted: boolean, encryptedPlaceholder: string) {
  if (encrypted) {
    return <Input.Password placeholder={encryptedPlaceholder} />;
  }

  switch (fieldType) {
    case "integer":
    case "number":
      return <InputNumber className={styles.numberInput} />;
    case "boolean":
      return <Switch />;
    case "array":
      return <Select mode="tags" open={false} />;
    case "object":
      return <Input.TextArea rows={4} />;
    default:
      return <Input />;
  }
}
