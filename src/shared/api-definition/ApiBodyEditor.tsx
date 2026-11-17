/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { AutoComplete, Button, Input, Select, Typography } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  parsePrecisionPreservingJSON,
  precisionPreservingValueText,
} from "@/framework/request/precision-safe-json";
import { ObjectMemberName } from "./ApiValueEditor";
import { nextMemberName, objectValue, replaceMember, type DefinitionObject } from "./model";
import { useArrayEditorItems, useObjectEditorItems } from "./use-editor-items";
import { useEditorValidity } from "./validity";
import styles from "./editor.module.css";

type BodyNodeProps = {
  value: DefinitionObject;
  onChange: (value: DefinitionObject) => void;
  disabled?: boolean;
  variableNames: string[];
  label: string;
};

const bodyTypes = ["string", "number", "boolean", "null", "object", "array"];

function createBodyNode(type: string): DefinitionObject {
  if (type === "object") return { type, properties: {} };
  if (type === "array") return { type, value: [] };
  return {
    type,
    value: type === "number" ? 0 : type === "boolean" ? false : type === "null" ? null : "",
  };
}

function numericSource(text: string): unknown {
  if (/^\{\{\s*[A-Za-z][A-Za-z0-9_]*\s*\}\}$/.test(text)) return text;
  if (!/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(text)) return undefined;
  try {
    return parsePrecisionPreservingJSON(text);
  } catch {
    return undefined;
  }
}

function BodyScalarInput({ value, onChange, disabled, variableNames, label }: BodyNodeProps) {
  const { t } = useTranslation();
  const current = precisionPreservingValueText(value.value);
  const [text, setText] = useState(current);
  useEffect(() => setText(current), [current]);
  const parsed = value.type === "number" ? numericSource(text) : text;
  const valid = parsed !== undefined;
  useEditorValidity(valid || !!disabled);
  return (
    <div className={styles.scalar}>
      <AutoComplete
        value={text}
        disabled={disabled}
        options={variableNames.map((name) => ({ value: `{{ ${name} }}` }))}
        filterOption={(input, option) =>
          (option?.value ?? "").toLowerCase().includes(input.toLowerCase())
        }
        onChange={(next) => {
          setText(next);
          const source = value.type === "number" ? numericSource(next) : next;
          if (source !== undefined) onChange(replaceMember(value, "value", source));
        }}
      >
        <Input aria-label={label} disabled={disabled} status={valid ? undefined : "error"} />
      </AutoComplete>
      {!valid ? (
        <Typography.Text type="danger">
          {t("dataConnect.apiEditor.errors.bodyNumber")}
        </Typography.Text>
      ) : null}
    </div>
  );
}

function BodyNodeActions({
  value,
  onChange,
  disabled,
  label,
  onRemove,
}: BodyNodeProps & { onRemove: () => void }) {
  const { t } = useTranslation();
  return (
    <div className={styles.bodyFieldActions}>
      <Select<string>
        aria-label={`${label} ${t("dataConnect.apiEditor.valueType")}`}
        value={typeof value.type === "string" ? value.type : "string"}
        disabled={disabled}
        options={bodyTypes.map((type) => ({
          value: type,
          label: t(`dataConnect.apiEditor.types.${type}`),
        }))}
        onChange={(type) => onChange(createBodyNode(type))}
      />
      <Button
        type="text"
        size="middle"
        danger
        disabled={disabled}
        aria-label={`${t("dataConnect.apiEditor.remove")} ${label}`}
        onClick={onRemove}
      >
        {t("dataConnect.apiEditor.remove")}
      </Button>
    </div>
  );
}

function BodyNodeValue(props: BodyNodeProps) {
  const { value, onChange, disabled, variableNames, label } = props;
  const { t } = useTranslation();
  const complex = value.type === "object" || value.type === "array";
  const valueLabel = `${label} ${t("dataConnect.apiEditor.fieldValue")}`;
  if (complex) {
    return (
      <details className={styles.bodyChildren} open>
        <summary>
          <span className={styles.fieldTitle}>{t("dataConnect.apiEditor.fieldValue")}</span>
          <span>
            {t(
              value.type === "object"
                ? "dataConnect.apiEditor.childFields"
                : "dataConnect.apiEditor.arrayItems",
            )}{" "}
            (
            {value.type === "object"
              ? Object.keys(objectValue(value.properties)).length
              : Array.isArray(value.value)
                ? value.value.length
                : 0}
            )
          </span>
        </summary>
        {value.type === "object" ? <ApiBodyEditor {...props} /> : <BodyArrayEditor {...props} />}
      </details>
    );
  }
  return (
    <label className={styles.inlineField}>
      <span className={styles.fieldTitle}>{t("dataConnect.apiEditor.fieldValue")}</span>
      {value.type === "boolean" ? (
        <Select
          aria-label={valueLabel}
          value={value.value}
          disabled={disabled}
          options={[
            { value: true, label: t("dataConnect.apiEditor.true") },
            { value: false, label: t("dataConnect.apiEditor.false") },
            ...variableNames.map((name) => ({ value: `{{ ${name} }}`, label: `{{ ${name} }}` })),
          ]}
          onChange={(next) => onChange(replaceMember(value, "value", next))}
        />
      ) : value.type === "null" ? (
        <Input aria-label={valueLabel} value="null" disabled />
      ) : (
        <BodyScalarInput {...props} label={valueLabel} />
      )}
    </label>
  );
}

function BodyArrayEditor({ value, onChange, disabled, variableNames, label }: BodyNodeProps) {
  const { t } = useTranslation();
  const entries: unknown[] = Array.isArray(value.value) ? value.value : [];
  const items = useArrayEditorItems(entries);
  return (
    <div className={styles.stack}>
      {entries.map((entry, index) => {
        const props = {
          value: objectValue(entry),
          onChange: (next: DefinitionObject) =>
            onChange(replaceMember(value, "value", items.replace(index, next))),
          disabled,
          variableNames,
          label: `${label}[${index}]`,
        };
        return (
          <div
            className={`${styles.member} ${styles.bodyMember}`}
            key={items.keys[index]}
            role="group"
            aria-label={props.label}
          >
            <div className={styles.memberHeader}>
              <span className={styles.fieldTitle}>
                {t("dataConnect.apiEditor.item", { index: index + 1 })}
              </span>
              <BodyNodeActions
                {...props}
                onRemove={() => onChange(replaceMember(value, "value", items.remove(index)))}
              />
            </div>
            <BodyNodeValue {...props} />
          </div>
        );
      })}
      <Button
        disabled={disabled}
        aria-label={`${label} ${t("dataConnect.apiEditor.addItem")}`}
        onClick={() =>
          onChange(replaceMember(value, "value", items.append(createBodyNode("string"))))
        }
      >
        {t("dataConnect.apiEditor.addItem")}
      </Button>
    </div>
  );
}

export function ApiBodyEditor({ value, onChange, disabled, variableNames, label }: BodyNodeProps) {
  const { t } = useTranslation();
  const properties = objectValue(value.properties);
  const items = useObjectEditorItems(properties);
  return (
    <div className={styles.stack}>
      {Object.entries(properties).map(([name, entry]) => {
        const props = {
          value: objectValue(entry),
          onChange: (next: DefinitionObject) =>
            onChange(replaceMember(value, "properties", items.replace(name, next))),
          disabled,
          variableNames,
          label: `${label}.${name}`,
        };
        return (
          <div
            className={`${styles.member} ${styles.bodyMember}`}
            key={items.keys.get(name)}
            role="group"
            aria-label={props.label}
          >
            <div className={styles.memberHeader}>
              <ObjectMemberName
                name={name}
                entries={properties}
                onRename={(next) =>
                  onChange(replaceMember(value, "properties", items.rename(name, next)))
                }
                disabled={disabled}
                label={`${label} ${t("dataConnect.apiEditor.fieldName")} ${name}`}
                visibleLabel={t("dataConnect.apiEditor.fieldName")}
              />
              <BodyNodeActions
                {...props}
                onRemove={() =>
                  onChange(replaceMember(value, "properties", items.replace(name, undefined)))
                }
              />
            </div>
            <BodyNodeValue {...props} />
          </div>
        );
      })}
      <Button
        disabled={disabled}
        aria-label={`${label} ${t("dataConnect.apiEditor.addField")}`}
        onClick={() =>
          onChange(
            replaceMember(
              value,
              "properties",
              items.replace(nextMemberName(properties), createBodyNode("string")),
            ),
          )
        }
      >
        {t("dataConnect.apiEditor.addField")}
      </Button>
    </div>
  );
}
