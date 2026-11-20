/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Tabs } from "antd";
import { useTranslation } from "react-i18next";
import { precisionPreservingValueText } from "@/framework/request/precision-safe-json";
import { isDefinitionObject, objectValue } from "@/shared/api-definition/model";
import styles from "./ApiResourceDefinitionTables.module.css";
import { ApiVariablesTable } from "@/shared/api-definition/ApiVariablesTable";
import { ApiDefinitionFieldTable } from "@/shared/api-definition/ApiDefinitionFieldTable";

const labels: Record<string, string> = {
  method: "dataConnect.apiEditor.method",
  path: "dataConnect.apiEditor.path",
  content_type: "dataConnect.apiEditor.mediaType",
  description: "dataConnect.apiEditor.description",
  type: "dataConnect.apiEditor.schemaType",
  value: "dataConnect.apiEditor.fieldValue",
  required: "dataConnect.apiEditor.required",
  properties: "dataConnect.apiEditor.properties",
  items: "dataConnect.apiEditor.arrayItems",
  default_value: "dataConnect.apiEditor.defaultValue",
  serialize: "dataConnect.apiEditor.serialization",
  field: "dataConnect.apiEditor.relativeField",
  operation: "dataConnect.apiEditor.operation",
  http_status: "dataConnect.apiEditor.allowedStatuses",
  body_filter_condition: "dataConnect.apiEditor.condition",
  sub_conditions: "dataCatalog.apiResource.table.conditions",
  result_rows: "dataCatalog.apiResource.result_rows",
  result_total: "dataCatalog.apiResource.result_total",
  mode: "dataCatalog.apiResource.pagingMode",
  default_limit: "dataCatalog.apiResource.default_limit",
  max_limit: "dataCatalog.apiResource.max_limit",
  page_base: "dataCatalog.apiResource.page_base",
};
const dictionaries = new Set([
  "properties",
  "patternProperties",
  "$defs",
  "dependentSchemas",
  "fields",
]);
const literalValues = new Set(["value", "default_value", "const", "enum", "examples", "default"]);
const types = new Set(["object", "array", "string", "number", "integer", "boolean", "null"]);
const operations = new Set(["and", "or", "eq", "empty", "null", "not_exist"]);

type Row = {
  name: string;
  path: string;
  value: unknown;
  depth: number;
  branch: boolean;
  semantic: boolean;
};
function definitionRows(value: unknown, semantic: boolean): Row[] {
  const rows: Row[] = [];
  const append = (
    name: string,
    entry: unknown,
    path: string,
    depth: number,
    literal: boolean,
    dictionary: boolean,
  ) => {
    const children = isDefinitionObject(entry)
      ? Object.entries(entry)
      : Array.isArray(entry) &&
          entry.some((child) => isDefinitionObject(child) || Array.isArray(child))
        ? entry.map((child: unknown, index) => [`[${index}]`, child] as const)
        : [];
    const interpret = !literal && !dictionary;
    rows.push({
      name,
      path,
      value: entry,
      depth,
      branch: children.length > 0,
      semantic: interpret,
    });
    for (const [childName, child] of children)
      append(
        childName,
        child,
        `${path}${Array.isArray(entry) ? "" : "."}${childName}`,
        depth + 1,
        literal || (interpret && literalValues.has(name)),
        interpret && dictionaries.has(name),
      );
  };
  if (isDefinitionObject(value) && Object.keys(value).length) {
    for (const [name, entry] of Object.entries(value))
      append(name, entry, name, 0, !semantic, false);
  } else append("value", value, "value", 0, !semantic, false);
  return rows;
}

/** All metadata stays read-only; only each variable's sensitive flag masks its value. */
export function ApiResourceDefinitionTables({ name, value }: { name: string; value: unknown }) {
  const { t } = useTranslation();
  const definition = objectValue(value);
  const tableTitle = (key: string) => t(`dataCatalog.apiResource.${key}`);
  if (name === "variables")
    return isDefinitionObject(value) ? (
      <ApiVariablesTable variables={value} title={t("dataCatalog.apiResource.variables")} />
    ) : (
      <TreeTable title={t("dataCatalog.apiResource.variables")} value={value} semantic={false} />
    );
  if (name === "request") {
    const general = Object.fromEntries(
      Object.entries(definition).filter(
        ([key]) => !["headers", "parameters", "body"].includes(key),
      ),
    );
    return (
      <div className={styles.sections}>
        {Object.keys(general).length ||
        !isDefinitionObject(value) ||
        !Object.keys(definition).length ? (
          <TreeTable
            title={tableTitle("request")}
            value={isDefinitionObject(value) ? general : value}
          />
        ) : null}
        {Object.hasOwn(definition, "headers") ? (
          <TreeTable
            title={t("dataConnect.apiEditor.headers")}
            value={definition.headers}
            semantic={false}
          />
        ) : null}
        {Object.hasOwn(definition, "parameters") ? (
          <ParametersTable value={definition.parameters} />
        ) : null}
        {Object.hasOwn(definition, "body") ? (
          <ApiDefinitionFieldTable
            title={t("dataConnect.apiEditor.body")}
            value={definition.body}
            mode="body"
            renderValue={(value) => <DefinitionValue value={value} booleanLiteral />}
          />
        ) : null}
      </div>
    );
  }
  if (name === "response") {
    const statuses = objectValue(definition.statuses);
    const general = Object.fromEntries(
      Object.entries(definition).filter(([key]) => key !== "statuses"),
    );
    return (
      <div className={styles.sections}>
        {Object.keys(general).length ||
        !isDefinitionObject(value) ||
        !Object.keys(definition).length ? (
          <TreeTable
            title={tableTitle("response")}
            value={isDefinitionObject(value) ? general : value}
          />
        ) : null}
        {Object.keys(statuses).length ? (
          <Tabs
            className={styles.statusTabs}
            size="small"
            ref={(tabs) => {
              // Tabs does not forward an accessible name to its tablist.
              tabs?.nativeElement
                ?.querySelector('[role="tablist"]')
                ?.setAttribute("aria-label", t("dataConnect.apiEditor.responseStatus"));
            }}
            items={Object.entries(statuses).map(([status, entry]) => {
              const response = objectValue(entry);
              const fields = Object.fromEntries(
                Object.entries(response).filter(([key]) => !["headers", "schema"].includes(key)),
              );
              return {
                key: status,
                label: status,
                children: (
                  <div className={styles.sections}>
                    <TreeTable
                      title={`${t("dataConnect.apiEditor.responseStatus")} ${status}`}
                      value={isDefinitionObject(entry) ? fields : entry}
                    />
                    {Object.hasOwn(response, "headers") ? (
                      <TreeTable
                        title={`${status} ${tableTitle("table.responseHeaders")}`}
                        value={response.headers}
                        semantic={false}
                      />
                    ) : null}
                    {Object.hasOwn(response, "schema") ? (
                      <ApiDefinitionFieldTable
                        title={`${status} ${tableTitle("table.schema")}`}
                        value={response.schema}
                        mode="schema"
                        renderValue={(value) => <DefinitionValue value={value} booleanLiteral />}
                      />
                    ) : null}
                  </div>
                ),
              };
            })}
          />
        ) : null}
        {Object.hasOwn(definition, "statuses") && !Object.keys(statuses).length ? (
          <TreeTable
            title={t("dataConnect.apiEditor.responseStatus")}
            value={definition.statuses}
          />
        ) : null}
      </div>
    );
  }
  if (name === "success_rule") {
    const general = Object.fromEntries(
      Object.entries(definition).filter(([key]) => key !== "body_filter_condition"),
    );
    return (
      <div className={styles.sections}>
        <TreeTable
          title={tableTitle("success")}
          value={isDefinitionObject(value) ? general : value}
        />
        {Object.hasOwn(definition, "body_filter_condition") ? (
          <TreeTable
            title={t("dataConnect.apiEditor.condition")}
            value={definition.body_filter_condition}
          />
        ) : null}
      </div>
    );
  }
  return <TreeTable title={name === "paging_rule" ? tableTitle("paging") : name} value={value} />;
}

function TreeTable({
  title,
  value,
  semantic = true,
}: {
  title: string;
  value: unknown;
  semantic?: boolean;
}) {
  const { t } = useTranslation();
  const rows = definitionRows(value, semantic);
  return (
    <section className={styles.section}>
      <h4 className={styles.title}>{title}</h4>
      <table className={`${styles.table} ${styles.treeTable}`} aria-label={title}>
        <thead>
          <tr>
            <th scope="col">{t("dataCatalog.apiResource.table.field")}</th>
            <th scope="col">{t("dataConnect.apiEditor.value")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className={row.branch ? styles.branch : undefined}>
              <th scope="row" aria-label={row.path} title={row.path}>
                <span
                  className={styles.field}
                  style={{ paddingInlineStart: `${Math.min(row.depth, 4) * 12}px` }}
                >
                  {row.semantic && Object.hasOwn(labels, row.name) ? t(labels[row.name]) : row.name}
                </span>
              </th>
              <td>
                <DefinitionCell row={row} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function DefinitionCell({ row }: { row: Row }) {
  const { t } = useTranslation();
  if (row.branch)
    return (
      <span className={styles.hint}>
        {t(`dataConnect.apiEditor.types.${Array.isArray(row.value) ? "array" : "object"}`)}
      </span>
    );
  if (row.semantic && row.name === "type" && typeof row.value === "string" && types.has(row.value))
    return <span>{t(`dataConnect.apiEditor.types.${row.value}`)}</span>;
  if (
    row.semantic &&
    row.name === "operation" &&
    typeof row.value === "string" &&
    operations.has(row.value)
  )
    return <span>{t(`dataConnect.apiEditor.operations.${row.value}`)}</span>;
  return <DefinitionValue value={row.value} />;
}

function ParametersTable({ value }: { value: unknown }) {
  const { t } = useTranslation();
  if (!Array.isArray(value))
    return (
      <TreeTable title={t("dataConnect.apiEditor.parameters")} value={value} semantic={false} />
    );
  return (
    <section className={styles.section}>
      <h4 className={styles.title}>{t("dataConnect.apiEditor.parameters")}</h4>
      <table
        className={`${styles.table} ${styles.parameters}`}
        aria-label={t("dataConnect.apiEditor.parameters")}
      >
        <thead>
          <tr>
            <th scope="col">{t("dataConnect.apiEditor.parameterName")}</th>
            <th scope="col">{t("dataConnect.apiEditor.parameterValue")}</th>
            <th scope="col">{t("dataConnect.apiEditor.defaultValue")}</th>
            <th scope="col">{t("dataConnect.apiEditor.required")}</th>
          </tr>
        </thead>
        <tbody>
          {value.length ? (
            value.map((entry: unknown, index) => {
              const parameter = objectValue(entry);
              const extra = Object.fromEntries(
                Object.entries(parameter).filter(
                  ([key]) => !["name", "value", "default_value", "required"].includes(key),
                ),
              );
              return (
                <tr key={index}>
                  <th scope="row">
                    <DefinitionValue value={parameter.name} />
                  </th>
                  <td>
                    <DefinitionValue value={isDefinitionObject(entry) ? parameter.value : entry} />
                    {Object.keys(extra).length ? (
                      <TreeTable
                        title={t("dataCatalog.apiResource.table.additional")}
                        value={extra}
                        semantic={false}
                      />
                    ) : null}
                  </td>
                  <td>
                    <DefinitionValue value={parameter.default_value} />
                  </td>
                  <td>
                    <DefinitionValue value={parameter.required} />
                  </td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={4}>{t("dataCatalog.apiResource.table.emptyArray")}</td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}

function DefinitionValue({
  value,
  booleanLiteral = false,
}: {
  value: unknown;
  booleanLiteral?: boolean;
}) {
  const { t } = useTranslation();
  if (isDefinitionObject(value))
    return Object.keys(value).length ? (
      <TreeTable title={t("dataConnect.apiEditor.value")} value={value} semantic={false} />
    ) : (
      <span>{t("dataCatalog.apiResource.table.emptyObject")}</span>
    );
  if (Array.isArray(value))
    return value.length ? (
      <ol className={styles.array}>
        {value.map((entry: unknown, index) => (
          <li key={index}>
            <DefinitionValue value={entry} booleanLiteral={booleanLiteral} />
          </li>
        ))}
      </ol>
    ) : (
      <span>{t("dataCatalog.apiResource.table.emptyArray")}</span>
    );
  if (value === null) return <span>null</span>;
  if (value === undefined) return <span>—</span>;
  if (value === "")
    return <span className={styles.hint}>{t("dataCatalog.apiResource.table.emptyString")}</span>;
  if (typeof value === "boolean")
    return (
      <span>
        {booleanLiteral ? String(value) : t(`dataConnect.apiEditor.${value ? "true" : "false"}`)}
      </span>
    );
  return <span className={styles.value}>{precisionPreservingValueText(value)}</span>;
}
