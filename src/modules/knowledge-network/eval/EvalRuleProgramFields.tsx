/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { caseUiText } from "./case-ui-text";
import { useEvalTranslation } from "./useEvalTranslation";
import { evalScalarText } from "./eval-scalar-text";

import { Button, Checkbox, Input, InputNumber, Select, Space, Typography, Alert } from "antd";
import { useEffect, useRef, useState } from "react";
import BigNumber from "bignumber.js";
import {
  parsePrecisionPreservingJSON,
  transformPrecisionSafeJSONRequest,
  formatPrecisionSafeJSON,
} from "@/framework/request/precision-safe-json";
import type { EvalRuleProgram, RuleConditionGroup, RuleValueCondition } from "./rule-check-model";

const operators = () =>
  [
    ["non_empty", caseUiText("notEmpty")],
    ["exists", caseUiText("fieldExists")],
    ["eq", caseUiText("equals")],
    ["ne", caseUiText("notEqual")],
    ["gt", caseUiText("greaterThan")],
    ["gte", caseUiText("greaterThanOrEqual")],
    ["lt", caseUiText("lessThan")],
    ["lte", caseUiText("lessThanOrEqual")],
    ["in", caseUiText("inSet")],
    ["not_in", caseUiText("notInSet")],
    ["regex", caseUiText("matchesRegularExpression")],
    ["date", caseUiText("validDateFormat")],
  ].map(([value, label]) => ({ value, label }));
const unary = (operator: string) => ["non_empty", "exists"].includes(operator);
function Literal({
  condition,
  disabled,
  onChange,
}: {
  condition: RuleValueCondition;
  disabled?: boolean;
  onChange: (value: unknown) => void;
}) {
  const [type, setType] = useState(
    typeof condition.value === "boolean"
      ? "boolean"
      : typeof condition.value === "number" ||
          (typeof condition.value === "object" &&
            condition.value != null &&
            !Array.isArray(condition.value))
        ? "number"
        : condition.value === null
          ? "null"
          : "string",
  );
  const [draft, setDraft] = useState(() =>
    Array.isArray(condition.value)
      ? transformPrecisionSafeJSONRequest(condition.value)
      : evalScalarText(condition.value ?? ""),
  );
  const emitted = useRef<{ value: unknown } | null>(null);
  const emit = (value: unknown) => {
    emitted.current = { value };
    onChange(value);
  };
  useEffect(() => {
    if (emitted.current && Object.is(emitted.current.value, condition.value)) return;
    const value = condition.value;
    setDraft(
      Array.isArray(value) ? transformPrecisionSafeJSONRequest(value) : evalScalarText(value ?? ""),
    );
    if (value !== undefined && !Array.isArray(value))
      setType(
        value === null
          ? "null"
          : typeof value === "boolean"
            ? "boolean"
            : typeof value === "number" || BigNumber.isBigNumber(value)
              ? "number"
              : "string",
      );
  }, [condition.value]);
  const list = ["in", "not_in"].includes(condition.operator);
  if (condition.operator === "date")
    return (
      <Select
        aria-label={caseUiText("dateFormat")}
        disabled={disabled}
        value={condition.value as string | undefined}
        style={{ minWidth: 160 }}
        options={[
          { value: "date", label: caseUiText("date20261108") },
          { value: "datetime", label: caseUiText("dateAndTime20261108123000") },
          { value: "rfc3339", label: caseUiText("withTimeZone20261108t1230000800") },
        ]}
        onChange={emit}
      />
    );
  return (
    <Space.Compact style={{ flex: 1, minWidth: 180 }}>
      {!list && condition.operator !== "regex" && (
        <Select
          aria-label={caseUiText("comparisonValueType")}
          disabled={disabled}
          style={{ width: 90 }}
          value={type}
          options={[
            {
              value: "string",
              label: caseUiText("knowledgeNetwork.eval.caseEditor.valueTypes.string"),
            },
            {
              value: "number",
              label: caseUiText("knowledgeNetwork.eval.caseEditor.valueTypes.number"),
            },
            { value: "boolean", label: caseUiText("yesNo") },
            { value: "null", label: caseUiText("null") },
          ]}
          onChange={(v) => {
            setType(v);
            setDraft("");
            emit(v === "null" ? null : undefined);
          }}
        />
      )}
      {type === "boolean" && !list ? (
        <Select
          aria-label={caseUiText("comparisonValue")}
          disabled={disabled}
          style={{ width: 110 }}
          value={condition.value as boolean | undefined}
          options={[
            { value: true, label: caseUiText("knowledgeNetwork.eval.resultUi.traceStates.yes") },
            { value: false, label: caseUiText("knowledgeNetwork.eval.resultUi.traceStates.no") },
          ]}
          onChange={emit}
        />
      ) : type === "null" && !list ? (
        <Input aria-label={caseUiText("comparisonValue")} disabled value="null" />
      ) : (
        <Input
          aria-label={caseUiText("comparisonValue")}
          disabled={disabled}
          value={draft}
          placeholder={
            list
              ? caseUiText("jsonArrayForExampleNormalCompleted")
              : condition.operator === "regex"
                ? caseUiText("forExampleAZ209")
                : caseUiText("independentlyVerifiedComparisonValue")
          }
          onChange={(e) => {
            const raw = e.target.value;
            setDraft(raw);
            try {
              if (
                type === "number" &&
                !list &&
                condition.operator !== "regex" &&
                (!/^-?(0|[1-9][0-9]*)(\.[0-9]+)?([eE][+-]?[0-9]+)?$/.test(raw) ||
                  !new BigNumber(raw).isFinite())
              )
                throw Error();
              emit(
                list || (type === "number" && condition.operator !== "regex")
                  ? parsePrecisionPreservingJSON(raw)
                  : raw,
              );
            } catch {
              emit(undefined);
            }
          }}
        />
      )}
    </Space.Compact>
  );
}
function Conditions({
  label,
  value,
  kind,
  reference,
  disabled,
  onChange,
}: {
  label: string;
  value: RuleConditionGroup;
  kind: string;
  reference: boolean;
  disabled?: boolean;
  onChange: (value: RuleConditionGroup) => void;
}) {
  const update = (index: number, patch: Partial<RuleValueCondition>) =>
    onChange({
      ...value,
      conditions: value.conditions.map((c, i) => (i === index ? { ...c, ...patch } : c)),
    });
  return (
    <Space direction="vertical" size={8} style={{ width: "100%" }}>
      <Space>
        <Typography.Text strong>{label}</Typography.Text>
        <Select
          aria-label={caseUiText("conditionGroupMode", { label })}
          disabled={disabled}
          value={value.mode}
          options={[
            { value: "all", label: caseUiText("allConditions") },
            { value: "any", label: caseUiText("anyCondition") },
          ]}
          onChange={(mode) => onChange({ ...value, mode })}
        />
      </Space>
      {value.conditions.map((condition, index) => (
        <div
          key={index}
          role="group"
          aria-label={caseUiText("conditionGroupRow", { label, position: index + 1 })}
          style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}
        >
          <Input
            aria-label={caseUiText("checkField")}
            disabled={disabled}
            style={{ width: 150 }}
            value={condition.field}
            placeholder={
              kind === "objectProperty"
                ? caseUiText("propertyOrAnActualFieldName")
                : caseUiText("actualFieldName")
            }
            onChange={(e) => update(index, { field: e.target.value })}
          />
          <Select
            aria-label={caseUiText("comparisonOperator")}
            disabled={disabled}
            style={{ width: 140 }}
            value={condition.operator}
            options={operators()}
            onChange={(operator) =>
              update(index, {
                operator,
                value: undefined,
                other_field: undefined,
                reference_field: undefined,
              })
            }
          />
          {!unary(condition.operator) && (
            <>
              {!["in", "not_in", "date", "regex"].includes(condition.operator) && (
                <Select
                  aria-label={caseUiText("compareAgainst")}
                  disabled={disabled}
                  style={{ width: 120 }}
                  value={
                    condition.other_field !== undefined
                      ? "field"
                      : condition.reference_field !== undefined
                        ? "reference"
                        : "value"
                  }
                  options={[
                    { value: "value", label: caseUiText("fixedValue") },
                    { value: "field", label: caseUiText("anotherField") },
                    ...(reference
                      ? [{ value: "reference", label: caseUiText("referenceField") }]
                      : []),
                  ]}
                  onChange={(v) =>
                    update(index, {
                      other_field: v === "field" ? "" : undefined,
                      reference_field: v === "reference" ? "" : undefined,
                      value: undefined,
                    })
                  }
                />
              )}
              {condition.other_field !== undefined || condition.reference_field !== undefined ? (
                <Input
                  aria-label={caseUiText("comparisonField")}
                  disabled={disabled}
                  style={{ flex: 1, minWidth: 140 }}
                  value={condition.other_field ?? condition.reference_field}
                  placeholder={caseUiText("actualFieldName")}
                  onChange={(e) =>
                    update(
                      index,
                      condition.other_field !== undefined
                        ? { other_field: e.target.value }
                        : { reference_field: e.target.value },
                    )
                  }
                />
              ) : (
                <Literal
                  key={`${condition.operator}:value`}
                  condition={condition}
                  disabled={disabled}
                  onChange={(value) => update(index, { value })}
                />
              )}
            </>
          )}
          <Button
            type="text"
            disabled={disabled}
            onClick={() =>
              onChange({ ...value, conditions: value.conditions.filter((_, i) => i !== index) })
            }
          >
            {caseUiText("knowledgeNetwork.eval.caseEditor.remove")}
          </Button>
        </div>
      ))}
      <Button
        aria-label={caseUiText("addConditionGroup", { label })}
        disabled={disabled || value.conditions.length >= 20}
        onClick={() =>
          onChange({
            ...value,
            conditions: [
              ...value.conditions,
              { field: kind === "objectProperty" ? "$property" : "", operator: "non_empty" },
            ],
          })
        }
      >
        {caseUiText("addCondition")}
      </Button>
    </Space>
  );
}
export function EvalRuleProgramFields({
  kind,
  value,
  disabled,
  onChange,
}: {
  kind: string;
  value: EvalRuleProgram;
  disabled?: boolean;
  onChange: (value: EvalRuleProgram) => void;
}) {
  useEvalTranslation();
  const [referenceJSON, setReferenceJSON] = useState(() =>
    formatPrecisionSafeJSON(transformPrecisionSafeJSONRequest(value.reference?.rows ?? [])),
  );
  const [referenceError, setReferenceError] = useState("");
  const update = (patch: Partial<EvalRuleProgram>) => onChange({ ...value, ...patch });
  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <Typography.Text type="secondary">
        {caseUiText("fieldNamesMustMatchTheResourceDeclarationAnd")}
        {kind === "objectProperty"
          ? caseUiText("propertyRefersToThePropertySelectedWhenApplying")
          : ""}
        {caseUiText("filtersAndRowChecksCoverOnlyThisSample")}
      </Typography.Text>
      <Checkbox
        disabled={disabled}
        checked={!!value.reference}
        onChange={(e) => {
          setReferenceJSON("[]");
          update({
            reference: e.target.checked
              ? { keys: [{ field: "", reference_field: "" }], rows: [], evidence_refs: [] }
              : undefined,
            where: undefined,
            aggregates: undefined,
          });
        }}
      >
        {caseUiText("locateAndVerifyUsingAnIndependentReferenceSample")}
      </Checkbox>
      {value.reference && (
        <Space direction="vertical" size={8} style={{ width: "100%" }}>
          <Typography.Text>{caseUiText("mapEveryComponentOfTheObjectPrimaryKey")}</Typography.Text>
          {value.reference.keys.map((key, i) => (
            <Space key={i}>
              <Input
                aria-label={caseUiText("objectPrimaryKeyField")}
                placeholder={caseUiText("objectPrimaryKeyField")}
                disabled={disabled}
                value={key.field}
                onChange={(e) =>
                  update({
                    reference: {
                      ...value.reference!,
                      keys: value.reference!.keys.map((k, index) =>
                        index === i ? { ...k, field: e.target.value } : k,
                      ),
                    },
                  })
                }
              />
              <span>{caseUiText("mapsTo")}</span>
              <Input
                aria-label={caseUiText("referencePrimaryKeyField")}
                placeholder={caseUiText("primaryKeyFieldInTheReferenceTable")}
                disabled={disabled}
                value={key.reference_field}
                onChange={(e) =>
                  update({
                    reference: {
                      ...value.reference!,
                      keys: value.reference!.keys.map((k, index) =>
                        index === i ? { ...k, reference_field: e.target.value } : k,
                      ),
                    },
                  })
                }
              />
              <Button
                disabled={disabled}
                onClick={() =>
                  update({
                    reference: {
                      ...value.reference!,
                      keys: value.reference!.keys.filter((_, index) => index !== i),
                    },
                  })
                }
              >
                {caseUiText("knowledgeNetwork.eval.caseEditor.remove")}
              </Button>
            </Space>
          ))}
          <Button
            disabled={disabled || value.reference.keys.length >= 16}
            onClick={() =>
              update({
                reference: {
                  ...value.reference!,
                  keys: [...value.reference!.keys, { field: "", reference_field: "" }],
                },
              })
            }
          >
            {caseUiText("addPrimaryKeyField")}
          </Button>
          <label>
            {caseUiText("expectedMatchCountFieldOptional")}
            <Input
              aria-label={caseUiText("expectedMatchCountField")}
              disabled={disabled}
              value={value.reference.matches_field}
              placeholder={caseUiText("leaveEmptyToRequireOneMatchPerKey")}
              onChange={(e) =>
                update({
                  reference: { ...value.reference!, matches_field: e.target.value || undefined },
                })
              }
            />
          </label>
          <label>
            {caseUiText("verifiedReferenceRecordsJsonArray")}
            <Input.TextArea
              aria-label={caseUiText("independentReferenceRecords")}
              disabled={disabled}
              rows={4}
              value={referenceJSON}
              placeholder={caseUiText("forExampleIdSampleaCorrectcount2DoNotUseThisRunS")}
              onChange={(e) => {
                setReferenceJSON(e.target.value);
                try {
                  const rows = parsePrecisionPreservingJSON(e.target.value);
                  if (
                    !Array.isArray(rows) ||
                    !rows.every(
                      (row: unknown): row is Record<string, unknown> =>
                        !!row && typeof row === "object" && !Array.isArray(row),
                    )
                  )
                    throw Error();
                  update({ reference: { ...value.reference!, rows } });
                  setReferenceError("");
                } catch {
                  update({ reference: { ...value.reference!, rows: [] } });
                  setReferenceError(caseUiText("enterAJsonArrayOfObjects"));
                }
              }}
            />
          </label>
          {referenceError && <Alert type="error" message={referenceError} />}
          <label>
            {caseUiText("referenceEvidence")}
            <Input.TextArea
              aria-label={caseUiText("referenceEvidence")}
              disabled={disabled}
              rows={2}
              value={value.reference.evidence_refs.join("\n")}
              placeholder={caseUiText("provideVerificationRecordsBusinessRulesOrDocumentLocations")}
              onChange={(e) =>
                update({
                  reference: {
                    ...value.reference!,
                    evidence_refs: e.target.value.split("\n").filter(Boolean),
                  },
                })
              }
            />
          </label>
        </Space>
      )}
      {!value.reference && (
        <>
          <Checkbox
            checked={!!value.where}
            disabled={disabled}
            onChange={(e) =>
              update({
                where: e.target.checked
                  ? {
                      mode: "all",
                      conditions: [
                        {
                          field: kind === "objectProperty" ? "$property" : "",
                          operator: "non_empty",
                        },
                      ],
                    }
                  : undefined,
              })
            }
          >
            {caseUiText("checkOnlySampledRecordsThatMatchTheConditions")}
          </Checkbox>
          {value.where && (
            <Conditions
              label={caseUiText("filterConditions")}
              value={value.where}
              kind={kind}
              reference={false}
              disabled={disabled}
              onChange={(where) => update({ where })}
            />
          )}
        </>
      )}
      <Checkbox
        disabled={disabled}
        checked={!!value.expect}
        onChange={(e) =>
          update({
            expect: e.target.checked
              ? {
                  mode: "all",
                  conditions: [
                    { field: kind === "objectProperty" ? "$property" : "", operator: "non_empty" },
                  ],
                }
              : undefined,
          })
        }
      >
        {caseUiText("rowChecks")}
      </Checkbox>
      {value.expect && (
        <Conditions
          label={caseUiText("rowChecks")}
          value={value.expect}
          kind={kind}
          reference={!!value.reference}
          disabled={disabled}
          onChange={(expect) => update({ expect })}
        />
      )}
      {!value.reference && (
        <>
          {!!value.aggregates?.length && (
            <Space direction="vertical" style={{ width: "100%" }}>
              <Space>
                <Typography.Text strong>{caseUiText("aggregateComparisons")}</Typography.Text>
                <Select
                  aria-label={caseUiText("aggregationScope")}
                  disabled={disabled}
                  value={value.aggregate_scope ?? "complete"}
                  options={[
                    {
                      value: "complete",
                      label: caseUiText("allVisibleDataIncompleteRetrievalCannotBeEvaluated"),
                    },
                    { value: "sample", label: caseUiText("thisSampleOnly") },
                  ]}
                  onChange={(aggregate_scope) => update({ aggregate_scope })}
                />
              </Space>
              {value.aggregates.map((a, i) => (
                <Space key={i} wrap>
                  <Select
                    aria-label={caseUiText("aggregationMethod")}
                    disabled={disabled}
                    value={a.function}
                    style={{ width: 130 }}
                    options={[
                      ["count", caseUiText("recordCount")],
                      ["non_null_count", caseUiText("nonNullValueCount")],
                      ["distinct_count", caseUiText("distinctValueCount")],
                      ["sum", caseUiText("sum")],
                      ["min", caseUiText("knowledgeNetwork.eval.caseEditor.minimum")],
                      ["max", caseUiText("knowledgeNetwork.eval.caseEditor.maximum")],
                    ].map(([value, label]) => ({ value, label }))}
                    onChange={(fn) =>
                      update({
                        aggregates: value.aggregates!.map((item, index) =>
                          index === i
                            ? {
                                ...item,
                                function: fn,
                                field:
                                  fn === "count"
                                    ? undefined
                                    : kind === "objectProperty"
                                      ? "$property"
                                      : "",
                              }
                            : item,
                        ),
                      })
                    }
                  />
                  {a.function !== "count" && (
                    <Input
                      aria-label={caseUiText("aggregationField")}
                      disabled={disabled}
                      style={{ width: 150 }}
                      placeholder={caseUiText("actualFieldName")}
                      value={a.field}
                      onChange={(e) =>
                        update({
                          aggregates: value.aggregates!.map((item, index) =>
                            index === i ? { ...item, field: e.target.value } : item,
                          ),
                        })
                      }
                    />
                  )}
                  <Select
                    aria-label={caseUiText("aggregateComparisonOperator")}
                    disabled={disabled}
                    style={{ width: 120 }}
                    value={a.operator}
                    options={operators().filter((o) =>
                      ["eq", "ne", "gt", "gte", "lt", "lte"].includes(o.value),
                    )}
                    onChange={(operator) =>
                      update({
                        aggregates: value.aggregates!.map((item, index) =>
                          index === i ? { ...item, operator } : item,
                        ),
                      })
                    }
                  />
                  <InputNumber
                    aria-label={caseUiText("expectedAggregateValue")}
                    disabled={disabled}
                    stringMode
                    value={a.value === undefined ? undefined : evalScalarText(a.value)}
                    onChange={(v) =>
                      update({
                        aggregates: value.aggregates!.map((item, index) =>
                          index === i
                            ? {
                                ...item,
                                value: v === null ? undefined : parsePrecisionPreservingJSON(v),
                              }
                            : item,
                        ),
                      })
                    }
                  />
                  <Button
                    disabled={disabled}
                    onClick={() =>
                      update({ aggregates: value.aggregates!.filter((_, index) => index !== i) })
                    }
                  >
                    {caseUiText("knowledgeNetwork.eval.caseEditor.remove")}
                  </Button>
                </Space>
              ))}
            </Space>
          )}
          <Button
            disabled={disabled || (value.aggregates?.length ?? 0) >= 10}
            onClick={() =>
              update({
                aggregates: [
                  ...(value.aggregates ?? []),
                  { function: "count", operator: "gte", value: 1 },
                ],
              })
            }
          >
            {caseUiText("addAggregateComparison")}
          </Button>
        </>
      )}
    </Space>
  );
}
