/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Button, Checkbox, Input, Select, Typography } from "antd";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { EditorValidity } from "./EditorValidity";
import { ObjectMemberName, type ValueEditorProps } from "./ApiValueEditor";
import {
  isDefinitionObject,
  nextMemberName,
  objectValue,
  replaceMember,
  type DefinitionObject,
} from "./model";
import { useObjectEditorItems } from "./use-editor-items";
import styles from "./editor.module.css";

export type ApiSchemaEditorProps = ValueEditorProps;
const schemaTypes = ["object", "array", "string", "integer", "number", "boolean"];

function removeNonObjectFields(schema: DefinitionObject): DefinitionObject {
  if (
    schema.type === undefined ||
    schema.type === "object" ||
    (Array.isArray(schema.type) && schema.type.includes("object"))
  )
    return schema;
  return replaceMember(replaceMember(schema, "properties", undefined), "required", undefined);
}

function SchemaTypeEditor({ value, onChange, disabled, label }: ValueEditorProps) {
  const { t } = useTranslation();
  const id = useId();
  const schema = objectValue(value);
  const types = schemaTypes.map((value) => ({
    value,
    label: t(`dataConnect.apiEditor.types.${value}`),
  }));
  return (
    <div className={`${styles.inlineField} ${styles.schemaTypeField}`}>
      <label className={styles.fieldTitle} htmlFor={id}>
        {t("dataConnect.apiEditor.schemaType")}
      </label>
      <Select
        id={id}
        aria-label={`${label} ${t("dataConnect.apiEditor.schemaType")}`}
        disabled={disabled}
        allowClear={typeof value !== "boolean"}
        mode={Array.isArray(schema.type) ? "multiple" : undefined}
        value={
          typeof value === "boolean"
            ? value
              ? "__any_schema"
              : "__no_schema"
            : (schema.type as string | string[] | undefined)
        }
        options={
          typeof value !== "boolean"
            ? types
            : [
                ...types,
                { value: "__any_schema", label: t("dataConnect.apiEditor.acceptAny") },
                { value: "__no_schema", label: t("dataConnect.apiEditor.acceptNone") },
              ]
        }
        onChange={(type: string | string[] | undefined) => {
          if (type === "__any_schema" || type === "__no_schema") {
            onChange(type === "__any_schema");
            return;
          }
          let next = replaceMember(
            schema,
            "type",
            Array.isArray(type) && type.length === 0 ? undefined : type,
          );
          if (type === "object" && !Object.hasOwn(schema, "properties"))
            next = { ...next, properties: {} };
          if (type === "array" && !Object.hasOwn(schema, "items"))
            next = { ...next, items: { type: "string" } };
          onChange(removeNonObjectFields(next));
        }}
      />
    </div>
  );
}

function SchemaPropertiesEditor({ value, onChange, disabled, label }: ApiSchemaEditorProps) {
  const { t } = useTranslation();
  const schema = objectValue(value);
  const properties = objectValue(schema.properties);
  const items = useObjectEditorItems(properties);
  const [focusedName, setFocusedName] = useState<string>();
  const required: unknown[] = Array.isArray(schema.required) ? schema.required : [];
  const renameOrRemove = (name: string, nextName?: string) => {
    const nextProperties =
      nextName === undefined ? items.replace(name, undefined) : items.rename(name, nextName);
    let next: DefinitionObject = { ...schema, properties: nextProperties };
    if (required.includes(name)) {
      const nextRequired = [
        ...new Set(
          required.flatMap((entry) =>
            entry === name ? (nextName === undefined ? [] : [nextName]) : [entry],
          ),
        ),
      ];
      next = replaceMember(next, "required", nextRequired.length ? nextRequired : undefined);
    }
    onChange(next);
  };
  return (
    <section className={`${styles.stack} ${styles.schemaProperties}`}>
      <span className={styles.fieldTitle}>{t("dataConnect.apiEditor.properties")}</span>
      {Object.entries(properties).map(([name, entry]) => (
        <div
          className={`${styles.member} ${styles.schemaPropertyCard}`}
          key={items.keys.get(name)}
          role="group"
          aria-label={`${label}.${name}`}
        >
          <div className={styles.schemaPropertyHeader}>
            <ObjectMemberName
              name={name}
              entries={properties}
              disabled={disabled}
              visibleLabel={t("dataConnect.apiEditor.propertyName")}
              label={`${label}.properties ${t("dataConnect.apiEditor.propertyName")} ${name}`}
              autoFocus={focusedName === name}
              onRename={(nextName) => renameOrRemove(name, nextName)}
            />
            <SchemaTypeEditor
              value={entry}
              disabled={disabled}
              label={`${label}.${name}`}
              onChange={(next) => onChange({ ...schema, properties: items.replace(name, next) })}
            />
            <Checkbox
              disabled={disabled}
              checked={required.includes(name)}
              aria-label={`${label}.${name} ${t("dataConnect.apiEditor.required")}`}
              onChange={(event) => {
                const nextRequired = event.target.checked
                  ? [...required, name]
                  : required.filter((entry) => entry !== name);
                onChange(
                  replaceMember(schema, "required", nextRequired.length ? nextRequired : undefined),
                );
              }}
            >
              {t("dataConnect.apiEditor.required")}
            </Checkbox>
            <Button disabled={disabled} type="text" danger onClick={() => renameOrRemove(name)}>
              {t("dataConnect.apiEditor.remove")}
            </Button>
          </div>
          <SchemaNodeEditor
            value={entry}
            disabled={disabled}
            label={`${label}.${name}`}
            hideType
            onChange={(next) => onChange({ ...schema, properties: items.replace(name, next) })}
          />
        </div>
      ))}
      <Button
        disabled={disabled}
        onClick={() => {
          const name = nextMemberName(properties);
          setFocusedName(name);
          onChange({ ...schema, properties: items.replace(name, { type: "string" }) });
        }}
      >
        {t("dataConnect.apiEditor.addProperty")}
      </Button>
    </section>
  );
}

/** Graphical Schema editing never normalizes unrelated keywords or business data. */
export function ApiSchemaEditor(props: ApiSchemaEditorProps) {
  return (
    <EditorValidity onValidityChange={props.onValidityChange}>
      <SchemaNodeEditor {...props} />
    </EditorValidity>
  );
}

export function SchemaNodeEditor({
  value,
  onChange,
  disabled,
  label,
  hideType = false,
}: ApiSchemaEditorProps & { hideType?: boolean }) {
  const { t } = useTranslation();
  const descriptionId = useId();
  if (typeof value === "boolean")
    return hideType ? null : (
      <SchemaTypeEditor value={value} onChange={onChange} disabled={disabled} label={label} />
    );
  const schema = objectValue(value);
  const update = (key: string, next: unknown) =>
    onChange(removeNonObjectFields(replaceMember(schema, key, next)));
  const descriptionField =
    schema.description === undefined || typeof schema.description === "string";
  const object =
    schema.type === "object" ||
    (Array.isArray(schema.type) && schema.type.includes("object")) ||
    (schema.type === undefined && Object.hasOwn(schema, "properties"));
  const array =
    schema.type === "array" ||
    (Array.isArray(schema.type) && schema.type.includes("array")) ||
    (schema.type === undefined && Object.hasOwn(schema, "items"));

  return (
    <div className={`${styles.stack} ${hideType ? styles.schemaPropertyNode : ""}`}>
      {!isDefinitionObject(value) && value !== undefined ? (
        <Typography.Text type="danger">{t("dataConnect.apiEditor.errors.schema")}</Typography.Text>
      ) : null}
      <div className={styles.schemaFields}>
        {!hideType ? (
          <SchemaTypeEditor value={value} onChange={onChange} disabled={disabled} label={label} />
        ) : null}
        {descriptionField ? (
          <label className={styles.inlineField} htmlFor={descriptionId}>
            <span className={styles.fieldTitle}>{t("dataConnect.apiEditor.description")}</span>
            <Input
              id={descriptionId}
              aria-label={`${label}.description`}
              value={typeof schema.description === "string" ? schema.description : ""}
              disabled={disabled}
              onChange={(event) => update("description", event.target.value)}
            />
          </label>
        ) : null}
      </div>
      {object ? (
        <SchemaPropertiesEditor
          value={schema}
          onChange={onChange}
          disabled={disabled}
          label={label}
        />
      ) : null}
      {array ? (
        <section className={styles.stack}>
          <div className={styles.memberHeader}>
            <span className={styles.fieldTitle}>{t("dataConnect.apiEditor.arrayElement")}</span>
            {Object.hasOwn(schema, "items") ? (
              <Button
                type="text"
                danger
                disabled={disabled}
                onClick={() => update("items", undefined)}
              >
                {t("dataConnect.apiEditor.remove")}
              </Button>
            ) : null}
          </div>
          {Object.hasOwn(schema, "items") ? (
            <div className={styles.member}>
              <SchemaNodeEditor
                value={schema.items}
                onChange={(next) => update("items", next)}
                disabled={disabled}
                label={`${label}.items`}
              />
            </div>
          ) : (
            <Button disabled={disabled} onClick={() => update("items", { type: "string" })}>
              {t("dataConnect.apiEditor.defineArrayItems")}
            </Button>
          )}
        </section>
      ) : null}
    </div>
  );
}
