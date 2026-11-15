/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Button, Space, Typography } from "antd";
import { useMemo, useState } from "react";
import {
  formatPrecisionSafeJSON,
  parsePrecisionPreservingJSON,
  transformPrecisionSafeJSONRequest,
} from "@/framework/request/precision-safe-json";
import { SchemaScalarInput, type ScalarInputLabels } from "@/framework/json/SchemaScalarInput";
import { jsonValueText } from "@/framework/json/json-value-text";
import { JsonInput } from "@/framework/json/JsonInput";
import { caseArgumentTemplate } from "./case-argument-template";
import { simpleInputFields } from "./case-form-model";
import { evalScalarText } from "./eval-scalar-text";
import type { CaseSchema } from "./case-form.service";
import { useEvalTranslation } from "./useEvalTranslation";
import styles from "./EvalCaseEditorDrawer.module.css";
import { EvalFieldLabel } from "./EvalFieldLabel";

// A short declared description can serve as the business label. Never infer a name from an identifier.
const parameterTitle = (schema: CaseSchema, name: string): string => {
  if (typeof schema.title === "string" && schema.title.trim()) return schema.title;
  if (
    typeof schema.description === "string" &&
    schema.description.trim() &&
    Array.from(schema.description).length <= 24 &&
    !schema.description.includes("\n")
  )
    return schema.description;
  return name;
};

type Props = {
  value?: string;
  onChange?: (value: string) => void;
  schema?: CaseSchema;
  hiddenFields?: string[];
  systemArguments?: Record<string, unknown>;
};
export function EvalCaseArguments({
  value = "{}",
  onChange,
  schema,
  hiddenFields = [],
  systemArguments = {},
}: Props) {
  const { t } = useEvalTranslation();
  const l = (key: string) => t(`knowledgeNetwork.eval.caseEditor.${key}`);
  const scalarLabels: ScalarInputLabels = {
    boolean: l("argumentBoolean"),
    enum: l("argumentEnum"),
    integer: l("argumentInteger"),
    number: l("argumentNumber"),
    string: l("argumentString"),
    yes: l("yesValue"),
    no: l("noValue"),
  };
  const [raw, setRaw] = useState(false);
  const contractKey = useMemo(() => transformPrecisionSafeJSONRequest(schema ?? {}), [schema]);
  const [editedContract, setEditedContract] = useState<string>();
  const fields = simpleInputFields(schema);
  let data: Record<string, unknown> = {};
  let valid = true;
  try {
    const v: unknown = parsePrecisionPreservingJSON(value);
    if (!v || typeof v !== "object" || Array.isArray(v)) valid = false;
    else data = v as Record<string, unknown>;
  } catch {
    valid = false;
  }
  const visibleFields = fields?.filter((f) => !hiddenFields.includes(f.name));
  const unknown = !!fields && Object.keys(data).some((key) => !fields.some((f) => f.name === key));
  const jsonMode = !fields || raw || !valid || unknown;
  const suggested =
    jsonMode && valid && !unknown && editedContract !== contractKey
      ? caseArgumentTemplate(schema, data, hiddenFields)
      : data;
  const hasTemplate = suggested !== data;
  const jsonText = hasTemplate
    ? formatPrecisionSafeJSON(transformPrecisionSafeJSONRequest(suggested))
    : value;
  const emit = (text: string) => {
    if (Object.keys(systemArguments).length) {
      try {
        const parsed = parsePrecisionPreservingJSON(text);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
          text = transformPrecisionSafeJSONRequest({ ...parsed, ...systemArguments });
      } catch {
        /* Preserve incomplete JSON until it can be validated. */
      }
    }
    onChange?.(text);
  };
  const change = (name: string, next: unknown) => {
    const result = { ...data };
    if (next === undefined) delete result[name];
    else result[name] = next;
    emit(transformPrecisionSafeJSONRequest(result));
  };
  const changeJson = (name: string, text: string) => {
    try {
      change(name, text.trim() ? parsePrecisionPreservingJSON(text) : undefined);
    } catch {
      const next = { ...data };
      delete next[name];
      const prefix = transformPrecisionSafeJSONRequest(next).slice(0, -1);
      emit(`${prefix}${Object.keys(next).length ? "," : ""}${JSON.stringify(name)}:${text}}`);
    }
  };
  return (
    <Space direction="vertical" style={{ width: "100%" }} size={8}>
      {fields && !!visibleFields?.length && (
        <Button
          size="small"
          type="link"
          onClick={() => {
            if (!raw) setEditedContract(undefined);
            setRaw((v) => !v);
          }}
        >
          {raw ? l("structuredInput") : l("advancedJson")}
        </Button>
      )}
      {jsonMode ? (
        <div>
          <EvalFieldLabel
            hint={l(
              hasTemplate
                ? "argumentTemplateHelp"
                : fields
                  ? "advancedJsonHelp"
                  : "argumentJsonHelp",
            )}
          >
            {l("argumentsJson")}
          </EvalFieldLabel>
          <JsonInput
            ariaLabel={l("argumentsJson")}
            schema={schema}
            value={jsonText}
            placeholder={l("argumentJsonPlaceholder")}
            onChange={(text) => {
              setEditedContract(contractKey);
              emit(text);
            }}
          />
        </div>
      ) : visibleFields?.length === 0 ? (
        <Typography.Text type="secondary">{l("noArguments")}</Typography.Text>
      ) : (
        <div className={styles.argumentGrid}>
          {visibleFields?.map((f) => (
            <div
              key={f.name}
              className={
                ["object", "array"].includes(String(f.schema.type))
                  ? styles.argumentGroup
                  : undefined
              }
            >
              <EvalFieldLabel
                required={f.required}
                hint={
                  <>
                    {parameterTitle(f.schema, f.name) !== f.name ? `${f.name} · ` : ""}
                    {l(`argumentTypes.${evalScalarText(f.schema.type)}`)} ·{" "}
                    {l(f.required ? "parameterRequired" : "parameterOptional")}
                    {["minimum", "maximum"]
                      .filter((bound) => typeof f.schema[bound] === "number")
                      .map((bound) => ` · ${l(bound)}: ${evalScalarText(f.schema[bound])}`)
                      .join("")}
                    {typeof f.schema.description === "string" &&
                    f.schema.description !== parameterTitle(f.schema, f.name)
                      ? ` · ${f.schema.description}`
                      : ""}
                  </>
                }
              >
                {parameterTitle(f.schema, f.name)}
              </EvalFieldLabel>
              {!f.required &&
                Object.hasOwn(data, f.name) &&
                !Object.hasOwn(systemArguments, f.name) && (
                  <Button
                    type="text"
                    size="small"
                    aria-label={`${l("removeArgument")} ${f.name}`}
                    onClick={() => change(f.name, undefined)}
                  >
                    {l("removeArgument")}
                  </Button>
                )}
              {f.schema.type === "object" ? (
                <div
                  style={{
                    paddingLeft: 12,
                    borderLeft: "2px solid var(--ant-color-border, #e5e7eb)",
                  }}
                >
                  <EvalCaseArguments
                    schema={f.schema}
                    value={transformPrecisionSafeJSONRequest(
                      data[f.name] === undefined ? {} : data[f.name],
                    )}
                    onChange={(next) => changeJson(f.name, next)}
                    hiddenFields={hiddenFields
                      .filter((path) => path.startsWith(f.name + "."))
                      .map((path) => path.slice(f.name.length + 1))}
                  />
                </div>
              ) : f.schema.type === "array" ? (
                <ArrayArgument
                  name={f.name}
                  schema={f.schema}
                  value={data[f.name]}
                  onChange={(text) => changeJson(f.name, text)}
                />
              ) : (
                <SchemaScalarInput
                  name={f.name}
                  schema={f.schema}
                  value={data[f.name]}
                  labels={scalarLabels}
                  onChange={(next) => change(f.name, next)}
                  onJsonChange={(text) => changeJson(f.name, text)}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </Space>
  );
}

/** Array rows serialize through the same JSON path as the original text input. */
function ArrayArgument({
  name,
  schema,
  value,
  onChange,
}: {
  name: string;
  schema: CaseSchema;
  value: unknown;
  onChange: (text: string) => void;
}) {
  const { t } = useEvalTranslation();
  const l = (key: string, options?: Record<string, unknown>) =>
    t(`knowledgeNetwork.eval.caseEditor.${key}`, options);
  const [raw, setRaw] = useState(false);
  const item =
    schema.items && typeof schema.items === "object" && !Array.isArray(schema.items)
      ? (schema.items as CaseSchema)
      : undefined;
  const supported =
    item &&
    !item.$ref &&
    !item.oneOf &&
    !item.anyOf &&
    !item.allOf &&
    ["string", "number", "integer", "boolean", "object"].includes(String(item.type));
  const rows: unknown[] = Array.isArray(value) ? (value as unknown[]) : [];
  // This is a rendering budget, not an input limit: large arrays keep the full JSON editor.
  const structured = supported && rows.length <= 50;
  const text = value === undefined ? "" : transformPrecisionSafeJSONRequest(value);
  const changeItem = (index: number, next: string) => {
    const parts = rows.map((row, i) => (i === index ? next : jsonValueText(row)));
    onChange(`[${parts.join(",")}]`);
  };
  return (
    <Space direction="vertical" size={8} style={{ width: "100%" }}>
      {structured && (
        <Button size="small" type="link" onClick={() => setRaw((next) => !next)}>
          {l(raw ? "structuredInput" : "advancedJson")}
        </Button>
      )}
      {!structured || raw || (value !== undefined && !Array.isArray(value)) ? (
        <JsonInput ariaLabel={name} value={text} schema={schema} height={120} onChange={onChange} />
      ) : (
        <>
          {rows.map((row, index) => (
            <div key={index} className={styles.arrayItem}>
              <div className={styles.arrayItemHeader}>
                <Typography.Text type="secondary">
                  {l("arrayItem", { index: index + 1 })}
                </Typography.Text>
                <Button
                  size="small"
                  type="text"
                  aria-label={l("removeArrayItem", { index: index + 1 })}
                  onClick={() =>
                    onChange(transformPrecisionSafeJSONRequest(rows.filter((_, i) => i !== index)))
                  }
                >
                  {l("remove")}
                </Button>
              </div>
              {item.type === "object" ? (
                <EvalCaseArguments
                  schema={item}
                  value={jsonValueText(row)}
                  onChange={(next) => changeItem(index, next)}
                />
              ) : (
                <SchemaScalarInput
                  name={`${name}[${index}]`}
                  schema={item}
                  value={row}
                  labels={{
                    boolean: l("argumentBoolean"),
                    enum: l("argumentEnum"),
                    integer: l("argumentInteger"),
                    number: l("argumentNumber"),
                    string: l("argumentString"),
                    yes: l("yesValue"),
                    no: l("noValue"),
                  }}
                  onChange={(next) =>
                    changeItem(index, jsonValueText(next === undefined ? null : next))
                  }
                  onJsonChange={(next) => changeItem(index, next)}
                />
              )}
            </div>
          ))}
          <Button
            size="small"
            onClick={() => {
              const empty =
                item.type === "object"
                  ? {}
                  : item.type === "string"
                    ? ""
                    : item.type === "boolean"
                      ? false
                      : 0;
              onChange(transformPrecisionSafeJSONRequest([...rows, empty]));
            }}
          >
            {l("addArrayItem")}
          </Button>
        </>
      )}
    </Space>
  );
}
