/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Button, Input, InputNumber, Select, Space, Typography } from "antd";
import { useState } from "react";
import {
  parsePrecisionPreservingJSON,
  transformPrecisionSafeJSONRequest,
} from "@/framework/request/precision-safe-json";
import { simpleInputFields } from "./case-form-model";
import { evalScalarText } from "./eval-scalar-text";
import type { CaseSchema } from "./case-form.service";
import { useEvalTranslation } from "./useEvalTranslation";
import styles from "./EvalCaseEditorDrawer.module.css";

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
  const [raw, setRaw] = useState(false);
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
        <Button size="small" type="link" onClick={() => setRaw((v) => !v)}>
          {raw ? l("structuredInput") : l("advancedJson")}
        </Button>
      )}
      {!fields || raw || !valid || unknown ? (
        <div>
          <Typography.Paragraph type="secondary">
            {l(fields ? "advancedJsonHelp" : "argumentJsonHelp")}
          </Typography.Paragraph>
          <Input.TextArea
            aria-label={l("argumentsJson")}
            value={value}
            placeholder={l("argumentJsonPlaceholder")}
            autoSize={{ minRows: 3, maxRows: 10 }}
            onChange={(e) => emit(e.target.value)}
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
              <div className={styles.fieldLabel}>
                <Typography.Text>
                  {f.required ? "* " : ""}
                  {parameterTitle(f.schema, f.name)}
                </Typography.Text>
                <Typography.Text type="secondary" className={styles.fieldHint}>
                  {parameterTitle(f.schema, f.name) !== f.name ? `${f.name} · ` : ""}
                  {l(`argumentTypes.${evalScalarText(f.schema.type)}`)} ·{" "}
                  {l(f.required ? "parameterRequired" : "parameterOptional")}
                </Typography.Text>
              </div>
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
                <Input.TextArea
                  aria-label={f.name}
                  value={
                    data[f.name] === undefined
                      ? ""
                      : transformPrecisionSafeJSONRequest(data[f.name])
                  }
                  placeholder={l(
                    `argumentArray${({ number: "Number", integer: "Number", boolean: "Boolean", string: "String" } as Record<string, string>)[String((f.schema.items as CaseSchema | undefined)?.type)] ?? ""}`,
                  )}
                  autoSize={{ minRows: 2, maxRows: 6 }}
                  onChange={(e) => {
                    changeJson(f.name, e.target.value);
                  }}
                />
              ) : f.schema.type === "boolean" ? (
                <Select
                  aria-label={f.name}
                  style={{ width: "100%" }}
                  allowClear
                  value={data[f.name]}
                  placeholder={l("argumentBoolean")}
                  options={[
                    { value: true, label: l("yesValue") },
                    { value: false, label: l("noValue") },
                  ].filter(
                    (option) =>
                      !Array.isArray(f.schema.enum) || f.schema.enum.includes(option.value),
                  )}
                  onChange={(v: unknown) => change(f.name, v)}
                />
              ) : Array.isArray(f.schema.enum) ? (
                <Select
                  aria-label={f.name}
                  style={{ width: "100%" }}
                  allowClear
                  value={data[f.name]}
                  placeholder={l("argumentEnum")}
                  options={(f.schema.enum as unknown[]).map((v) => ({
                    value: v,
                    label: String(v),
                  }))}
                  onChange={(v: unknown) => change(f.name, v)}
                />
              ) : ["integer", "number"].includes(String(f.schema.type)) ? (
                <InputNumber<string>
                  stringMode
                  style={{ width: "100%" }}
                  aria-label={f.name}
                  placeholder={l(
                    f.schema.type === "integer" ? "argumentInteger" : "argumentNumber",
                  )}
                  value={data[f.name] === undefined ? undefined : String(data[f.name])}
                  onChange={(v) =>
                    change(
                      f.name,
                      v === null || v === "" ? undefined : parsePrecisionPreservingJSON(v),
                    )
                  }
                />
              ) : (
                <Input
                  aria-label={f.name}
                  placeholder={l("argumentString")}
                  value={data[f.name] === undefined ? "" : String(data[f.name])}
                  onChange={(e) => {
                    const text = e.target.value;
                    if (f.schema.type === "string") change(f.name, text);
                    else {
                      try {
                        change(
                          f.name,
                          text === "" ? undefined : parsePrecisionPreservingJSON(text),
                        );
                      } catch {
                        setRaw(true);
                      }
                    }
                  }}
                />
              )}
              {["number", "integer"].includes(String(f.schema.type)) &&
                ["minimum", "maximum"].some((bound) => typeof f.schema[bound] === "number") && (
                  <Typography.Text type="secondary" style={{ display: "block" }}>
                    {["minimum", "maximum"]
                      .filter((bound) => typeof f.schema[bound] === "number")
                      .map((bound) => `${l(bound)}: ${evalScalarText(f.schema[bound])}`)
                      .join(" · ")}
                  </Typography.Text>
                )}
              {typeof f.schema.description === "string" &&
                f.schema.description !== parameterTitle(f.schema, f.name) && (
                  <Typography.Text type="secondary">{f.schema.description}</Typography.Text>
                )}
            </div>
          ))}
        </div>
      )}
    </Space>
  );
}
