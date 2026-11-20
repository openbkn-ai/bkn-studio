/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Button, Checkbox, Input, Select, Typography } from "antd";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  parsePrecisionPreservingJSON,
  precisionPreservingValueText,
} from "@/framework/request/precision-safe-json";
import { ObjectMemberName } from "./ApiValueEditor";
import {
  defaultValue,
  isDefinitionObject,
  nextMemberName,
  objectValue,
  replaceMember,
  valueType,
  type DefinitionObject,
} from "./model";
import { useArrayEditorItems, useObjectEditorItems } from "./use-editor-items";
import { useEditorValidity } from "./validity";
import styles from "./editor.module.css";

type BodyNodeProps = {
  value: DefinitionObject;
  onChange: (value: DefinitionObject) => void;
  disabled?: boolean;
  enableJsonSerialization?: boolean;
  label: string;
};

const bodyTypes = ["string", "number", "integer", "boolean", "null", "object", "array"];

function bodyNodeType(node: DefinitionObject) {
  if (typeof node.type === "string") return node.type;
  return Object.hasOwn(node, "properties") ? "object" : valueType(node.value);
}

function createBodyNode(type: string): DefinitionObject {
  if (type === "object") return { type, properties: {} };
  return { type, value: type === "integer" ? 0 : defaultValue(type) };
}

function bodyValueSource(text: string, type: string): unknown {
  if (type === "string") return text;
  if (text.startsWith("{{") && text.endsWith("}}")) {
    // The server checks the expression syntax and the referenced value's type.
    const expression = text.slice(2, -2).trim();
    if (expression && !expression.startsWith("$") && !expression.includes("}}")) return text;
  }
  if (type === "boolean") {
    if (text === "true") return true;
    if (text === "false") return false;
    return undefined;
  }
  if (type === "null") return text === "null" ? null : undefined;
  if (type === "object" || type === "array") return text === "" ? "" : undefined;
  const jsonNumber = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/;
  if (!jsonNumber.test(text)) return undefined;
  try {
    return parsePrecisionPreservingJSON(text);
  } catch {
    return undefined;
  }
}

function BodyValueInput({ value, onChange, disabled, label }: BodyNodeProps) {
  const { t } = useTranslation();
  const id = useId();
  const type = bodyNodeType(value);
  const container = type === "array" || type === "object";
  const inputLabel = t(
    container ? "dataConnect.apiEditor.bodyReference" : "dataConnect.apiEditor.fieldValue",
  );
  const raw = value.value;
  const current =
    raw === undefined || (container && typeof raw !== "string")
      ? ""
      : precisionPreservingValueText(raw);
  const [text, setText] = useState(current);
  useEffect(() => setText(current), [current]);
  const valid = (raw === undefined && text === "") || bodyValueSource(text, type) !== undefined;
  useEditorValidity(valid || !!disabled);
  return (
    <div className={styles.inlineField}>
      <label className={styles.fieldTitle} htmlFor={id}>
        {inputLabel}
      </label>
      <div className={styles.scalar}>
        <Input
          id={id}
          aria-label={`${label} ${inputLabel}`}
          aria-invalid={valid ? undefined : true}
          aria-describedby={valid ? undefined : `${id}-error`}
          value={text}
          disabled={disabled}
          status={valid ? undefined : "error"}
          onChange={(event) => {
            const next = event.target.value;
            setText(next);
            const source = bodyValueSource(next, type);
            if (source === undefined) return;
            if (container && source === "") {
              const next = replaceMember(value, "value", type === "array" ? [] : undefined);
              if (type === "object" && !Object.hasOwn(next, "properties")) next.properties = {};
              onChange(next);
              return;
            }
            onChange(replaceMember(value, "value", source));
          }}
        />
        {!valid ? (
          <Typography.Text id={`${id}-error`} type="danger">
            {t("dataConnect.apiEditor.errors.bodyValue")}
          </Typography.Text>
        ) : null}
      </div>
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
        value={bodyNodeType(value)}
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

function BodySerialization({ value, onChange, disabled }: BodyNodeProps) {
  const { t } = useTranslation();
  const errorId = useId();
  const addedType = useRef(false);
  const serializeJson = value.serialize === "json";
  const missingValue = serializeJson && value.value === undefined;
  useEditorValidity(!missingValue || !!disabled);
  return (
    <details className={styles.bodyChildren}>
      <summary>
        <span className={styles.fieldTitle}>{t("dataConnect.apiEditor.serialization")}</span>
        {serializeJson ? <span>JSON</span> : null}
      </summary>
      <Checkbox
        checked={serializeJson}
        disabled={disabled}
        aria-invalid={missingValue ? true : undefined}
        aria-describedby={missingValue ? errorId : undefined}
        onChange={(event) => {
          if (event.target.checked) {
            addedType.current = !Object.hasOwn(value, "type");
            onChange({ ...value, type: "string", serialize: "json" });
            return;
          }
          const next = replaceMember(value, "serialize", undefined);
          onChange(addedType.current ? replaceMember(next, "type", undefined) : next);
          addedType.current = false;
        }}
      >
        {t("dataConnect.apiEditor.bodySerializeJson")}
      </Checkbox>
      {missingValue ? (
        <Typography.Text id={errorId} type="danger">
          {t("dataConnect.apiEditor.errors.bodySerializeValue")}
        </Typography.Text>
      ) : null}
    </details>
  );
}

function BodyNodeValue({ root = false, ...props }: BodyNodeProps & { root?: boolean }) {
  const { value, onChange, label } = props;
  const { t } = useTranslation();
  const type = bodyNodeType(value);
  const raw = value.value;
  const serialization =
    props.enableJsonSerialization &&
    type === "string" &&
    (value.serialize === undefined || value.serialize === "json") ? (
      <BodySerialization {...props} />
    ) : null;
  if (isDefinitionObject(raw) || (Array.isArray(raw) && type !== "array")) {
    const nested = isDefinitionObject(raw) ? raw : { type: "array", value: raw };
    return (
      <>
        <BodyNodeValue
          {...props}
          label={`${label}.value`}
          value={nested}
          onChange={(next) =>
            onChange(replaceMember(value, "value", Array.isArray(raw) ? next.value : next))
          }
        />
        {serialization}
      </>
    );
  }
  if (type !== "object" && type !== "array") {
    return (
      <>
        <BodyValueInput {...props} />
        {serialization}
      </>
    );
  }

  const count =
    type === "object"
      ? Object.keys(objectValue(value.properties)).length
      : Array.isArray(raw)
        ? raw.length
        : 0;
  const reference = typeof raw === "string";
  const children =
    type === "object" ? <BodyObjectEditor {...props} /> : <BodyArrayEditor {...props} />;
  return (
    <>
      {reference || count === 0 ? <BodyValueInput {...props} /> : null}
      {reference ? null : root ? (
        children
      ) : (
        <details className={styles.bodyChildren} open>
          <summary>
            <span className={styles.fieldTitle}>{t("dataConnect.apiEditor.fieldValue")}</span>
            <span>
              {t(
                type === "object"
                  ? "dataConnect.apiEditor.childFields"
                  : "dataConnect.apiEditor.arrayItems",
              )}{" "}
              ({count})
            </span>
          </summary>
          {children}
        </details>
      )}
    </>
  );
}

function BodyArrayEditor({
  value,
  onChange,
  disabled,
  label,
  enableJsonSerialization,
}: BodyNodeProps) {
  const { t } = useTranslation();
  const entries: unknown[] = Array.isArray(value.value) ? value.value : [];
  const items = useArrayEditorItems(entries);
  const addedWrappers = useRef(new WeakSet<DefinitionObject>());
  return (
    <div className={styles.stack}>
      {entries.map((entry, index) => {
        const constructed = isDefinitionObject(entry);
        const preserveConstruction = constructed && !addedWrappers.current.has(entry);
        const props = {
          value: constructed ? entry : { type: valueType(entry), value: entry },
          onChange: (next: DefinitionObject) => {
            const serialized = Object.hasOwn(next, "serialize");
            // Only unwrap nodes added to serialize a raw element in this draft.
            if (!preserveConstruction && serialized) addedWrappers.current.add(next);
            const item =
              preserveConstruction || serialized || !Object.hasOwn(next, "value")
                ? next
                : next.value;
            onChange(replaceMember(value, "value", items.replace(index, item)));
          },
          disabled,
          enableJsonSerialization,
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

function BodyObjectEditor({
  value,
  onChange,
  disabled,
  label,
  enableJsonSerialization,
}: BodyNodeProps) {
  const { t } = useTranslation();
  const properties = objectValue(value.properties);
  const items = useObjectEditorItems(properties);
  const editPropertyName = (name: string, nextName?: string) => {
    const next = replaceMember(
      value,
      "properties",
      nextName === undefined ? items.replace(name, undefined) : items.rename(name, nextName),
    );
    if (Array.isArray(value.required)) {
      next.required = value.required.flatMap((entry: unknown) =>
        entry !== name ? [entry] : nextName === undefined ? [] : [nextName],
      );
    }
    onChange(next);
  };
  return (
    <div className={styles.stack}>
      {Object.entries(properties).map(([name, entry]) => {
        const props = {
          value: objectValue(entry),
          onChange: (next: DefinitionObject) =>
            onChange(replaceMember(value, "properties", items.replace(name, next))),
          disabled,
          enableJsonSerialization,
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
                onRename={(next) => editPropertyName(name, next)}
                disabled={disabled}
                label={`${label} ${t("dataConnect.apiEditor.fieldName")} ${name}`}
                visibleLabel={t("dataConnect.apiEditor.fieldName")}
              />
              <BodyNodeActions {...props} onRemove={() => editPropertyName(name)} />
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

export function ApiBodyEditor(props: BodyNodeProps) {
  const { t } = useTranslation();
  return (
    <div className={styles.stack}>
      <p className={styles.hint}>
        {t("dataConnect.apiEditor.bodyTemplateHint")} <code>{"{{ name }}"}</code>
      </p>
      <BodyNodeValue {...props} root />
    </div>
  );
}
