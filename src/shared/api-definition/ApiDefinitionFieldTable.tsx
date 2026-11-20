/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { DownOutlined, RightOutlined } from "@ant-design/icons";
import { Fragment, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { isDefinitionObject, objectValue, valueType } from "./model";
import styles from "./ApiDefinitionFieldTable.module.css";

type Mode = "body" | "schema";
type ValueRenderer = (value: unknown) => ReactNode;
type Field = {
  key: string;
  name: string | undefined;
  path: string;
  value: unknown;
  required?: boolean;
  literal: boolean;
  children: Field[];
};
const prefix = "dataConnect.apiEditor.fieldTable.";
const compactKeywords = new Set([
  "const",
  "enum",
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "multipleOf",
  "minLength",
  "maxLength",
  "pattern",
  "format",
  "minItems",
  "maxItems",
  "uniqueItems",
  "minProperties",
  "maxProperties",
  "additionalProperties",
  "default",
]);
const structuralKeys = new Set(["type", "properties", "required", "description", "items"]);
const compositionKeywords = new Set(["oneOf", "anyOf", "allOf"]);

function fieldType(value: unknown, literal = false): string {
  if (literal) return value === undefined ? "—" : valueType(value);
  if (typeof value === "boolean") return value ? "any" : "never";
  const node = objectValue(value);
  const type = node.type;
  const types: unknown[] = Array.isArray(type) ? type : [type];
  return types
    .map((entry) => {
      if (entry === "array" && Object.hasOwn(node, "items")) {
        const itemTypes = Array.isArray(node.items)
          ? node.items.map((item: unknown) => fieldType(item)).join(", ")
          : fieldType(node.items);
        return `array〈${itemTypes}〉`;
      }
      return typeof entry === "string" ? entry : "—";
    })
    .join(" | ");
}

function propertyPath(parent: string, name: string): string {
  const part = /^[A-Za-z_$][\w$]*$/.test(name) ? name : `[${JSON.stringify(name)}]`;
  return parent ? `${parent}${part.startsWith("[") ? "" : "."}${part}` : part;
}

function buildField(
  name: string | undefined,
  value: unknown,
  mode: Mode,
  parts: (string | number)[],
  path: string,
  required?: boolean,
  literal = false,
): Field {
  const node = literal ? {} : objectValue(value);
  const properties = (schema: Record<string, unknown>, parent: string, keys: (string | number)[]) =>
    Object.entries(objectValue(schema.properties)).map(([field, definition]) =>
      buildField(
        field,
        definition,
        mode,
        [...keys, "properties", field],
        propertyPath(parent, field),
        Array.isArray(schema.required) && schema.required.includes(field),
      ),
    );
  const children = properties(node, path, parts);
  if (mode === "schema" && Object.hasOwn(node, "items")) {
    const item = objectValue(node.items);
    const itemPath = `${path}[]`;
    if (Object.keys(objectValue(item.properties)).length) {
      children.push(...properties(item, itemPath, [...parts, "items"]));
    } else if (isDefinitionObject(item.items) || Array.isArray(item.items)) {
      children.push(buildField("[]", node.items, mode, [...parts, "items"], itemPath));
    } else if (Array.isArray(node.items)) {
      children.push(
        ...node.items.map((entry: unknown, index) =>
          buildField(`[${index}]`, entry, mode, [...parts, "items", index], `${path}[${index}]`),
        ),
      );
    }
  }
  if (mode === "body" && Object.hasOwn(node, "value")) {
    if (Array.isArray(node.value)) {
      children.push(
        ...node.value.map((entry: unknown, index) =>
          buildField(
            `[${index}]`,
            entry,
            mode,
            [...parts, "value", index],
            `${path}[${index}]`,
            undefined,
            !isDefinitionObject(entry),
          ),
        ),
      );
    } else if (isDefinitionObject(node.value)) {
      children.push(
        buildField(undefined, node.value, mode, [...parts, "value"], `${path || "$"} → value`),
      );
    }
  }
  return { key: JSON.stringify(parts), name, value, path, required, literal, children };
}

function compactConstraint(value: unknown): boolean {
  return (
    !isDefinitionObject(value) &&
    (!Array.isArray(value) ||
      (value.length <= 6 &&
        value.every((entry) => !isDefinitionObject(entry) && !Array.isArray(entry))))
  );
}

/** Keep uncommon keywords available while the main table reads as business fields. */
function extraConfiguration(field: Field, mode: Mode): Record<string, unknown> {
  if (field.literal) return {};
  const node = objectValue(field.value);
  const entries = Object.entries(node).filter(([key, value]) => {
    if (key === "items") return mode === "body" || !isDefinitionObject(value);
    if (key === "properties") return !isDefinitionObject(value) || Object.keys(value).length === 0;
    if (key === "required") {
      const properties = objectValue(node.properties);
      return (
        !Array.isArray(value) ||
        value.length === 0 ||
        value.some((name: unknown) => typeof name !== "string" || !Object.hasOwn(properties, name))
      );
    }
    if (structuralKeys.has(key)) return false;
    if (mode === "body" && key === "serialize") return false;
    if (mode === "body" && key === "value") {
      return (
        Object.hasOwn(node, "properties") && !isDefinitionObject(value) && !Array.isArray(value)
      );
    }
    return mode === "body" || !compactKeywords.has(key) || !compactConstraint(value);
  });
  if (mode === "schema" && isDefinitionObject(node.items)) {
    const item = node.items;
    const declaresArray =
      node.type === "array" || (Array.isArray(node.type) && node.type.includes("array"));
    const itemProperties = objectValue(item.properties);
    // Keep item constraints and annotations alongside the flattened array fields.
    const itemDetails = Object.fromEntries(
      Object.entries(item).filter(([key, value]) => {
        if (key === "type") return !declaresArray;
        if (key === "properties") return !isDefinitionObject(value) || !Object.keys(value).length;
        if (key === "required")
          return (
            !Array.isArray(value) ||
            !value.length ||
            value.some(
              (name: unknown) => typeof name !== "string" || !Object.hasOwn(itemProperties, name),
            )
          );
        return true;
      }),
    );
    if (Object.keys(itemDetails).length) entries.push(["items", itemDetails]);
  }
  return Object.fromEntries(entries);
}

export function ApiDefinitionFieldTable({
  title,
  value,
  mode,
  renderValue,
}: {
  title: string;
  value: unknown;
  mode: Mode;
  renderValue: ValueRenderer;
}) {
  const { t } = useTranslation();
  const root = buildField(undefined, value, mode, [], "");
  const schema = objectValue(value);
  const hasProperties = Object.keys(objectValue(schema.properties)).length > 0;
  const showChildren = hasProperties || (mode === "schema" && root.children.length > 0);
  const compositionRoot =
    mode === "schema" &&
    !showChildren &&
    Object.entries(schema).some(
      ([key, value]) => compositionKeywords.has(key) && Array.isArray(value) && value.length > 0,
    );
  const fields = showChildren ? root.children : [root];
  const unrestricted =
    typeof value === "boolean" ||
    (mode === "schema" && isDefinitionObject(value) && !Object.keys(value).length);
  const typeText = (type: string) =>
    type === "any"
      ? t("dataConnect.apiEditor.acceptAny")
      : type === "never"
        ? t("dataConnect.apiEditor.acceptNone")
        : type;
  return (
    <section className={styles.section}>
      <h4 className={styles.title}>{title}</h4>
      {unrestricted ? (
        <p className={styles.summary}>
          {t(`dataConnect.apiEditor.${value === false ? "acceptNone" : "acceptAny"}`)}
        </p>
      ) : (
        <>
          <div className={styles.summary}>
            {!compositionRoot || Object.hasOwn(schema, "type") ? (
              <span>
                {t(`${prefix}rootType`)}：<code>{typeText(fieldType(value))}</code>
              </span>
            ) : null}
            {!showChildren && !compositionRoot ? null : (
              <>
                {Object.hasOwn(schema, "description") ? (
                  <span>{renderValue(schema.description)}</span>
                ) : null}
                {mode === "body" ? (
                  <ConstructionValue field={root} renderValue={renderValue} />
                ) : (
                  <Constraints field={root} renderValue={renderValue} empty={null} />
                )}
              </>
            )}
          </div>
          {showChildren || compositionRoot ? (
            <Configuration
              field={root}
              mode={mode}
              renderValue={renderValue}
              initiallyOpen={compositionRoot}
            />
          ) : null}
          {compositionRoot ? null : (
            <table
              className={`${styles.table} ${mode === "body" ? styles.body : ""}`}
              aria-label={title}
              role="table"
            >
              <thead>
                <tr>
                  <th scope="col">{t("dataConnect.apiEditor.fieldName")}</th>
                  <th scope="col">{t("dataConnect.apiEditor.schemaType")}</th>
                  <th scope="col">{t("dataConnect.apiEditor.required")}</th>
                  <th scope="col">
                    {t(
                      mode === "body"
                        ? `${prefix}construction`
                        : "dataConnect.apiEditor.description",
                    )}
                  </th>
                  <th scope="col">
                    {t(
                      mode === "body"
                        ? "dataConnect.apiEditor.description"
                        : `${prefix}constraints`,
                    )}
                  </th>
                </tr>
              </thead>
              <tbody>
                {fields.map((field) => (
                  <FieldRows
                    key={field.key}
                    field={field}
                    mode={mode}
                    depth={0}
                    renderValue={renderValue}
                  />
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </section>
  );
}

function FieldRows({
  field,
  mode,
  depth,
  renderValue,
}: {
  field: Field;
  mode: Mode;
  depth: number;
  renderValue: ValueRenderer;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(true);
  const node = field.literal ? {} : objectValue(field.value);
  const name =
    field.name === ""
      ? '""'
      : (field.name ?? t(`${prefix}${field.key === "[]" ? "root" : "source"}`));
  const path = field.path || name;
  const type = fieldType(field.value, field.literal);
  const detail = extraConfiguration(field, mode);
  const cell = (label: string, content: ReactNode) => (
    <td data-label={label}>
      <div>{content}</div>
    </td>
  );
  return (
    <Fragment>
      <tr>
        <th scope="row" aria-label={path} title={path}>
          <span
            className={styles.fieldName}
            style={{ paddingInlineStart: `${Math.min(depth, 4) * 14}px` }}
          >
            {field.children.length ? (
              <button
                type="button"
                className={styles.toggle}
                aria-label={path}
                aria-expanded={expanded}
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? <DownOutlined aria-hidden /> : <RightOutlined aria-hidden />}
                {name}
              </button>
            ) : (
              <span className={styles.leaf}>{name}</span>
            )}
          </span>
          {depth ? <span className={styles.mobilePath}>{path}</span> : null}
        </th>
        {cell(
          t("dataConnect.apiEditor.schemaType"),
          <code>
            {type === "any"
              ? t("dataConnect.apiEditor.acceptAny")
              : type === "never"
                ? t("dataConnect.apiEditor.acceptNone")
                : type}
          </code>,
        )}
        {cell(
          t("dataConnect.apiEditor.required"),
          field.required === undefined
            ? "—"
            : t(`dataConnect.apiEditor.${field.required ? "true" : "false"}`),
        )}
        {cell(
          t(mode === "body" ? `${prefix}construction` : "dataConnect.apiEditor.description"),
          mode === "body" ? (
            <ConstructionValue field={field} renderValue={renderValue} />
          ) : (
            renderValue(node.description)
          ),
        )}
        {cell(
          t(mode === "body" ? "dataConnect.apiEditor.description" : `${prefix}constraints`),
          mode === "body" ? (
            renderValue(node.description)
          ) : (
            <Constraints field={field} renderValue={renderValue} />
          ),
        )}
      </tr>
      {Object.keys(detail).length ? (
        <tr className={styles.detailRow}>
          <td colSpan={5}>
            <Configuration field={field} mode={mode} renderValue={renderValue} />
          </td>
        </tr>
      ) : null}
      {expanded
        ? field.children.map((child) => (
            <FieldRows
              key={child.key}
              field={child}
              mode={mode}
              depth={depth + 1}
              renderValue={renderValue}
            />
          ))
        : null}
    </Fragment>
  );
}

function ConstructionValue({ field, renderValue }: { field: Field; renderValue: ValueRenderer }) {
  const { t } = useTranslation();
  if (field.literal) return renderValue(field.value);
  const node = objectValue(field.value);
  let content: ReactNode = "—";
  if (Object.hasOwn(node, "properties")) content = t(`${prefix}objectConstruction`);
  else if (Array.isArray(node.value)) content = t(`${prefix}arrayConstruction`);
  else if (isDefinitionObject(node.value)) content = t(`${prefix}nodeConstruction`);
  else if (Object.hasOwn(node, "value")) content = renderValue(node.value);
  return (
    <div className={styles.stack}>
      {content}
      {Object.hasOwn(node, "serialize") ? (
        <span className={styles.serialization}>
          {t("dataConnect.apiEditor.serialization")}：{renderValue(node.serialize)}
        </span>
      ) : null}
    </div>
  );
}

function Constraints({
  field,
  renderValue,
  empty = "—",
}: {
  field: Field;
  renderValue: ValueRenderer;
  empty?: ReactNode;
}) {
  const { t } = useTranslation();
  const constraints = Object.entries(objectValue(field.value)).filter(
    ([key, value]) => compactKeywords.has(key) && compactConstraint(value),
  );
  if (!constraints.length) return <>{empty}</>;
  return (
    <dl className={styles.constraints}>
      {constraints.map(([key, value]) => (
        <div key={key}>
          <dt>{t(`${prefix}keywords.${key}`)}：</dt>
          <dd>
            {key === "enum" && Array.isArray(value) && value.length ? (
              <span className={styles.enumValues}>
                {value.map((entry: unknown, index) => (
                  <code key={index}>{renderValue(entry)}</code>
                ))}
              </span>
            ) : (
              renderValue(value)
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Configuration({
  field,
  mode,
  renderValue,
  initiallyOpen = false,
}: {
  field: Field;
  mode: Mode;
  renderValue: ValueRenderer;
  initiallyOpen?: boolean;
}) {
  const { t } = useTranslation();
  const entries = Object.entries(extraConfiguration(field, mode));
  if (!entries.length) return null;
  const name =
    field.name === ""
      ? '""'
      : (field.name ?? t(`${prefix}${field.key === "[]" ? "root" : "source"}`));
  return (
    <details className={styles.configuration} open={initiallyOpen}>
      <summary>
        {t(`${prefix}configuration`)} · <code>{field.path || name}</code>
      </summary>
      <dl>
        {entries.map(([key, value]) => (
          <div
            key={key}
            className={
              compositionKeywords.has(key) && Array.isArray(value) && value.length
                ? styles.composition
                : undefined
            }
          >
            <dt>
              {key === "items"
                ? t(`${prefix}itemConfiguration`)
                : compactKeywords.has(key)
                  ? t(`${prefix}keywords.${key}`)
                  : key}
            </dt>
            <dd>
              {compositionKeywords.has(key) && Array.isArray(value) && value.length ? (
                <div className={styles.branches}>
                  {value.map((entry: unknown, index) => (
                    <ApiDefinitionFieldTable
                      key={index}
                      title={`${key} · ${t(`${prefix}branch`)} ${index + 1}`}
                      value={entry}
                      mode="schema"
                      renderValue={renderValue}
                    />
                  ))}
                </div>
              ) : (
                renderValue(value)
              )}
            </dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
