/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { caseUiText } from "./case-ui-text";
import { Button, Checkbox, Input, InputNumber, Select, Space, Typography } from "antd";
import { useEffect, useState } from "react";
import { isCaseResultPath, newCriterion, type CaseCriterion } from "./case-form-model";
import type { CaseSchema } from "./case-form.service";
import { useEvalTranslation } from "./useEvalTranslation";
import BigNumber from "bignumber.js";
import {
  parsePrecisionPreservingJSON,
  transformPrecisionSafeJSONRequest,
} from "@/framework/request/precision-safe-json";
import styles from "./EvalCaseEditorDrawer.module.css";

type Props = {
  value?: CaseCriterion[];
  onChange?: (value: CaseCriterion[]) => void;
  predicates: string[];
  schema?: CaseSchema;
};
export function EvalCaseCriteria({ value = [], onChange, predicates, schema }: Props) {
  const { t } = useEvalTranslation();
  const l = (key: string) => t(`knowledgeNetwork.eval.caseEditor.${key}`);
  const update = (index: number, patch: Partial<CaseCriterion>) =>
    onChange?.(value.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  const [advancedPaths, setAdvancedPaths] = useState<Record<string, boolean>>({});
  const fieldLabel = (path: string, child: CaseSchema) => {
    const name = path.startsWith("$.result.")
      ? path.slice(9)
      : path === "$.result"
        ? caseUiText("knowledgeNetwork.eval.terms.actual")
        : path.slice(2);
    const readable = name
      .replace(/\[(\d+)\]/g, (_, index: string) =>
        caseUiText("arrayItemNumber", { position: Number(index) + 1 }),
      )
      .replace(/\./g, " · ");
    return typeof child.title === "string" ? `${child.title}（${readable}）` : readable;
  };
  const schemaFields = (
    node: CaseSchema | undefined,
    path = "$",
    depth = 0,
  ): { value: string; label: string; schema: CaseSchema }[] => {
    if (depth > 6) return [];
    const children: { value: string; schema: CaseSchema }[] = Object.entries(
      (node?.properties ?? {}) as Record<string, CaseSchema>,
    )
      .filter(
        ([key, child]) =>
          !/[.[\]*]/.test(key) && !!child && typeof child === "object" && !Array.isArray(child),
      )
      .map(([key, schema]) => ({ value: `${path}.${key}`, schema }));
    if (Array.isArray(node?.["x-eval-items"])) {
      for (const [index, schema] of (node["x-eval-items"] as CaseSchema[]).slice(0, 10).entries()) {
        children.push({ value: `${path}[${index}]`, schema });
      }
    }
    return children.flatMap(({ value, schema }) => [
      { value, label: fieldLabel(value, schema), schema },
      ...schemaFields(schema, value, depth + 1),
    ]);
  };
  const nestedFields = schemaFields(schema);
  const fields = [{ value: "$", label: l("wholeResult") }, ...nestedFields];
  // Persisted business fields remain readable before another trial discovers them.
  for (const criterion of value) {
    if (isCaseResultPath(criterion.path) && !fields.some((f) => f.value === criterion.path))
      fields.push({ value: criterion.path, label: fieldLabel(criterion.path, {}) });
  }
  const outputType = (path: string): CaseCriterion["valueType"] | undefined => {
    const target =
      path === "$" ? schema : nestedFields.find((field) => field.value === path)?.schema;
    // A persisted editor choice is not a declared source type. Keep the type
    // selector available when the source has not provided a schema.
    if (!target) return undefined;
    const type = target.type;
    return type === "string"
      ? "string"
      : type === "integer" || type === "number"
        ? "number"
        : type === "boolean"
          ? "boolean"
          : type === "array" || type === "object"
            ? "json"
            : undefined;
  };
  const allowedPredicates = (path: string) => {
    const type = outputType(path);
    return predicates.filter(
      (p) =>
        p === "json_schema" ||
        p === "equals" ||
        p === "exists" ||
        p === "observation_only" ||
        !type ||
        (type === "number" && ["numeric_range", "approx"].includes(p)) ||
        (type === "string" && ["contains", "regex"].includes(p)),
    );
  };
  useEffect(() => {
    const next = value.map((c) => {
      const type = outputType(c.path);
      return c.type === "equals" && type && !c.valueProvided && c.value === ""
        ? { ...c, valueType: type }
        : c;
    });
    if (next.some((c, i) => c.valueType !== value[i].valueType)) onChange?.(next);
  });
  const rangeOption = (c: CaseCriterion, index: number, key: string) => {
    let config: Record<string, unknown> = {};
    try {
      const v: unknown = parsePrecisionPreservingJSON(c.value || "{}");
      if (v && typeof v === "object" && !Array.isArray(v)) config = v as Record<string, unknown>;
    } catch {
      /* numeric inputs retain their own validation */
    }
    return (
      <Checkbox
        checked={config[key] !== false}
        onChange={(e) =>
          update(index, {
            value: transformPrecisionSafeJSONRequest({ ...config, [key]: e.target.checked }),
            valueType: "json",
          })
        }
      >
        {l(key)}
      </Checkbox>
    );
  };
  const configField = (c: CaseCriterion, index: number, key: string, label: string) => {
    let config: Record<string, unknown> = {};
    try {
      const parsed: unknown = parsePrecisionPreservingJSON(c.value || "{}");
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
        config = parsed as Record<string, unknown>;
    } catch {
      /* keep invalid text in advanced input */
    }
    const current = config[key];
    return (
      <div>
        <div className={styles.fieldLabel}>{label}</div>
        <InputNumber<string>
          stringMode
          style={{ width: "100%" }}
          aria-label={label}
          placeholder={label}
          value={
            typeof current === "number" || BigNumber.isBigNumber(current)
              ? String(current)
              : undefined
          }
          onChange={(value) => {
            const next = { ...config };
            if (value === null || value === "") delete next[key];
            else next[key] = parsePrecisionPreservingJSON(value);
            update(index, { value: transformPrecisionSafeJSONRequest(next), valueType: "json" });
          }}
        />
      </div>
    );
  };
  return (
    <Space direction="vertical" size={12} style={{ width: "100%" }}>
      {value.map((c, index) => (
        <div key={c.id} className={styles.criterion}>
          <div className={styles.criterionControls}>
            <div>
              <div className={styles.fieldLabel}>{l("resultField")}</div>
              {advancedPaths[c.id] || !fields.some((f) => f.value === c.path) ? (
                <Input
                  aria-label={`${l("resultField")} ${index + 1}`}
                  value={c.path}
                  disabled={c.type === "json_schema"}
                  onChange={(e) =>
                    update(index, {
                      path: e.target.value,
                      value: "",
                      valueProvided: false,
                      valueType: outputType(e.target.value) ?? c.valueType,
                    })
                  }
                />
              ) : (
                <Select
                  style={{ width: "100%" }}
                  aria-label={`${l("resultField")} ${index + 1}`}
                  value={c.path}
                  showSearch
                  optionFilterProp="label"
                  disabled={c.type === "json_schema"}
                  options={fields}
                  onChange={(path) =>
                    update(index, {
                      path,
                      type: allowedPredicates(path).includes(c.type) ? c.type : "equals",
                      valueType: outputType(path) ?? c.valueType,
                      value: "",
                      valueProvided: false,
                    })
                  }
                />
              )}
              <Button
                type="link"
                size="small"
                disabled={c.type === "json_schema"}
                onClick={() => setAdvancedPaths((v) => ({ ...v, [c.id]: !v[c.id] }))}
              >
                {l("advancedPath")}
              </Button>
              {advancedPaths[c.id] && <div className={styles.fieldHint}>{l("fieldPathHelp")}</div>}
            </div>
            <div>
              <div className={styles.fieldLabel}>{l("predicate")}</div>
              <Select
                style={{ width: "100%" }}
                aria-label={`${l("predicate")} ${index + 1}`}
                value={c.type}
                options={allowedPredicates(c.path).map((type) => ({
                  value: type,
                  label: l(`predicates.${type}`),
                }))}
                onChange={(type) =>
                  update(index, {
                    type,
                    value: "",
                    valueProvided: false,
                    valueType: ["numeric_range", "approx", "json_schema"].includes(type)
                      ? "json"
                      : type === "equals"
                        ? (outputType(c.path) ?? "string")
                        : "string",
                    path: type === "json_schema" ? "$" : c.path,
                  })
                }
              />
            </div>
            <Button
              className={styles.criterionRemove}
              aria-label={`${l("removeCriterion")} ${index + 1}`}
              type="text"
              danger
              disabled={value.length === 1}
              onClick={() => onChange?.(value.filter((_, i) => i !== index))}
            >
              {l("remove")}
            </Button>
          </div>
          {!["exists", "observation_only"].includes(c.type) && (
            <Typography.Paragraph type="secondary" className={styles.conditionHelp}>
              {l(`comparisonHints.${c.type}`)}
            </Typography.Paragraph>
          )}
          {c.type === "numeric_range" ? (
            <div className={styles.criteriaValues}>
              <div>
                {configField(c, index, "min", l("minimum"))}
                {rangeOption(c, index, "include_min")}
              </div>
              <div>
                {configField(c, index, "max", l("maximum"))}
                {rangeOption(c, index, "include_max")}
              </div>
            </div>
          ) : c.type === "approx" ? (
            <Space direction="vertical" style={{ width: "100%" }}>
              {configField(c, index, "value", l("referenceValue"))}
              <div className={styles.criteriaValues}>
                {configField(c, index, "absolute_tolerance", l("absoluteTolerance"))}
                {configField(c, index, "relative_tolerance", l("relativeTolerance"))}
              </div>
            </Space>
          ) : ["exists", "observation_only"].includes(c.type) ? (
            <Typography.Text type="secondary">
              {l(c.type === "exists" ? "existsHint" : "observeHint")}
            </Typography.Text>
          ) : (
            <div>
              {c.type === "equals" && !outputType(c.path) && (
                <div className={styles.valueTypeControl}>
                  <div className={styles.fieldLabel}>{l("expectedTypeHelp")}</div>
                  <Select
                    aria-label={`${l("valueType")} ${index + 1}`}
                    style={{ width: 180 }}
                    value={c.valueType}
                    options={["string", "number", "boolean", "json"].map((type) => ({
                      value: type,
                      label: l(`valueTypes.${type}`),
                    }))}
                    onChange={(valueType) =>
                      update(index, { valueType, value: "", valueProvided: false })
                    }
                  />
                  <div className={styles.fieldHint}>{l("unknownTypeHelp")}</div>
                </div>
              )}
              <div className={styles.fieldLabel}>{l("expectedValue")}</div>
              {c.type === "equals" && c.valueType === "number" ? (
                <InputNumber<string>
                  stringMode
                  style={{ width: "100%" }}
                  aria-label={`${l("expectedValue")} ${index + 1}`}
                  placeholder={l("numberPlaceholder")}
                  value={c.value || undefined}
                  onChange={(v) =>
                    update(index, { value: v ?? "", valueProvided: v !== null && v !== "" })
                  }
                />
              ) : c.type === "equals" && c.valueType === "boolean" ? (
                <Select
                  style={{ width: "100%" }}
                  allowClear
                  aria-label={`${l("expectedValue")} ${index + 1}`}
                  placeholder={l("booleanPlaceholder")}
                  value={c.value === "true" || c.value === "false" ? c.value : undefined}
                  options={[
                    { value: "true", label: l("yesValue") },
                    { value: "false", label: l("noValue") },
                  ]}
                  onChange={(v) =>
                    update(index, { value: v ?? "", valueProvided: v !== undefined })
                  }
                />
              ) : (
                <Input.TextArea
                  aria-label={`${l("expectedValue")} ${index + 1}`}
                  value={c.value}
                  rows={c.type === "json_schema" || c.valueType === "json" ? 3 : 1}
                  placeholder={
                    c.type === "json_schema"
                      ? '{"type":"object","required":["id"]}'
                      : l(c.valueType === "json" ? "jsonPlaceholder" : "stringPlaceholder")
                  }
                  onChange={(e) => update(index, { value: e.target.value, valueProvided: true })}
                />
              )}
              {c.type === "equals" && c.valueType === "string" && (
                <Checkbox
                  checked={c.value === "" && c.valueProvided === true}
                  onChange={(e) => update(index, { value: "", valueProvided: e.target.checked })}
                >
                  {l("emptyText")}
                </Checkbox>
              )}
            </div>
          )}
        </div>
      ))}
      <Button onClick={() => onChange?.([...value, newCriterion()])} disabled={value.length >= 20}>
        {l("addCriterion")}
      </Button>
    </Space>
  );
}
