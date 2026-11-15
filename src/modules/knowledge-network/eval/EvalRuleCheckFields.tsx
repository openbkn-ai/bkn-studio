/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { EvalHelpTooltip } from "./EvalFieldLabel";
import { JsonTextBlock } from "@/framework/json/JsonTextBlock";
import { caseUiText } from "./case-ui-text";
import { useEvalTranslation } from "./useEvalTranslation";
import { Alert, InputNumber, Select, Space } from "antd";
import { useState } from "react";
import { EvalRuleProgramFields } from "./EvalRuleProgramFields";
import { JsonInput } from "@/framework/json/JsonInput";
import { newDeclarationProgram, newRuleProgram } from "./rule-check-model";
import { EvalCaseCriteria } from "./EvalCaseCriteria";
import { compileCriteria, newCriterion, type CaseCriterion } from "./case-form-model";
import {
  ruleCheckAllowsAll,
  ruleCheckCriteria,
  type DeclarationProgram,
  type EvalRuleCheck,
  type RuleCheckCapability,
} from "./rule-check-model";
import { parsePrecisionPreservingJSON } from "@/framework/request/precision-safe-json";

type Props = {
  kind: string;
  value?: EvalRuleCheck;
  capabilities: RuleCheckCapability[];
  disabled?: boolean;
  onChange: (value?: EvalRuleCheck) => void;
};
export function EvalRuleCheckFields({ kind, value, capabilities, disabled, onChange }: Props) {
  const { t } = useEvalTranslation();
  const [criteria, setCriteria] = useState<CaseCriterion[]>(
    value?.type === "result_compare" ? ruleCheckCriteria(value) : [newCriterion()],
  );
  const [enumType, setEnumType] = useState(() => {
    const first = value?.values?.[0];
    return typeof first === "boolean"
      ? "boolean"
      : typeof first === "number" || (first != null && typeof first === "object")
        ? "number"
        : "string";
  });
  const [enumError, setEnumError] = useState("");
  const [declarationText, setDeclarationText] = useState(() =>
    JSON.stringify(value?.declaration ?? newDeclarationProgram(kind), null, 2),
  );
  const [declarationError, setDeclarationError] = useState("");
  const options = capabilities.filter((item) => item.kinds.includes(kind));
  const selected = options.find((item) => item.type === value?.type);
  const bindings =
    selected?.bindings?.filter((binding) =>
      kind === "objectProperty" ? binding === "property" : binding !== "property",
    ) ?? [];
  const names: Record<string, string> = {
    primary_keys: caseUiText("objectPrimaryKeyAllComponents"),
    display_key: caseUiText("objectDisplayKey"),
    property: caseUiText("propertySelectedWhenApplyingTheRule"),
    fields: caseUiText("actualFieldsSpecifiedInTheRule"),
    "relation-definition": caseUiText("validRelationDefinitionAndMappings"),
    "relation-query": caseUiText("relationQueryAvailable"),
    "relation-result": caseUiText("correctRelationResults"),
    "relation-cardinality": caseUiText("relationCountsMatchTheDeclaration"),
    "relation-required": caseUiText("requiredRelationsPresent"),
    "relation-direction": caseUiText("correctForwardAndReverseTraversal"),
    "relation-integrity": caseUiText("validRelationEndpoints"),
    "relation-characteristics": caseUiText("relationCharacteristicsMatchTheDeclaration"),
    "relation-property-values": caseUiText("relationPropertyValuesSatisfyConstraints"),
  };
  const update = (patch: Partial<EvalRuleCheck>) => value && onChange({ ...value, ...patch });
  const changeCriteria = (next: CaseCriterion[]) => {
    setCriteria(next);
    try {
      const compiled = compileCriteria(next, true);
      update({ assertions: compiled.assertions, expected: compiled.expected_spec });
    } catch {
      update({ assertions: [], expected: {} });
    }
  };
  return (
    <Space direction="vertical" style={{ width: "100%" }} size={12}>
      <label>
        {caseUiText("checkMethod")}
        {selected && <EvalHelpTooltip title={selected.help} label={caseUiText("checkMethod")} />}
        <Select
          aria-label={caseUiText("checkMethod")}
          style={{ width: "100%" }}
          disabled={disabled}
          value={value?.type ?? ""}
          options={[
            { value: "", label: caseUiText("descriptionOnlyNoAutomaticExecution") },
            ...options.map((item) => ({ value: item.type, label: item.name })),
            ...(value && !selected
              ? [{ value: value.type, label: caseUiText("theCurrentCheckMethodIsUnavailable") }]
              : []),
          ]}
          onChange={(type) => {
            const next = options.find((item) => item.type === type);
            const binding = next?.bindings?.find((b) =>
              kind === "objectProperty" ? b === "property" : b !== "property",
            );
            onChange(
              type
                ? {
                    type,
                    binding,
                    ...(type === "program" ? { program: newRuleProgram(kind) } : {}),
                    ...(type === "declaration" ? { declaration: newDeclarationProgram(kind) } : {}),
                    scope:
                      type === "declaration"
                        ? undefined
                        : kind === "objectType" || kind === "objectProperty"
                          ? { mode: "sample", limit: 100 }
                          : { mode: "invocation" },
                  }
                : undefined,
            );
            if (type === "declaration")
              setDeclarationText(JSON.stringify(newDeclarationProgram(kind), null, 2));
            setCriteria([newCriterion()]);
            setEnumError("");
          }}
        />
      </label>
      {value && !!bindings.length && (
        <label>
          {caseUiText("checkField")}
          <Select
            aria-label={caseUiText("checkField")}
            style={{ width: "100%" }}
            disabled={disabled}
            value={value.binding}
            options={bindings.map((binding) => ({
              value: binding,
              label: names[binding] ?? binding,
            }))}
            onChange={(binding) =>
              update({
                binding,
                scope:
                  kind === "relationType" ? { mode: "invocation" } : { mode: "sample", limit: 100 },
              })
            }
          />
        </label>
      )}
      {value && value.type !== "declaration" && ["objectType", "objectProperty"].includes(kind) && (
        <Space>
          <span>{caseUiText("defaultCheckScope")}</span>
          <Select
            aria-label={caseUiText("defaultCheckScope")}
            disabled={disabled}
            value={value.scope?.mode ?? "sample"}
            options={[
              { value: "sample", label: caseUiText("knowledgeNetwork.eval.resultUi.sampleScope") },
              ...(ruleCheckAllowsAll(value)
                ? [{ value: "all", label: caseUiText("knowledgeNetwork.eval.suiteCaseUi.allRows") }]
                : []),
            ]}
            onChange={(mode) =>
              update({ scope: mode === "sample" ? { mode, limit: 100 } : { mode } })
            }
          />
          {value.scope?.mode !== "all" && (
            <InputNumber
              aria-label={caseUiText("knowledgeNetwork.eval.ruleApplication.sampleRows")}
              disabled={disabled}
              min={1}
              max={1000}
              precision={0}
              value={value.scope?.limit ?? 100}
              onChange={(limit) => update({ scope: { mode: "sample", limit: limit ?? 100 } })}
            />
          )}
        </Space>
      )}
      {value?.type === "declaration" && (
        <>
          <JsonInput
            ariaLabel={t("knowledgeNetwork.eval.declaration.program")}
            readOnly={disabled}
            height={360}
            value={declarationText}
            onChange={(text) => {
              setDeclarationText(text);
              try {
                const declaration = parsePrecisionPreservingJSON(text);
                update({ declaration: declaration as DeclarationProgram });
                setDeclarationError("");
              } catch {
                update({ declaration: undefined });
                setDeclarationError(t("knowledgeNetwork.eval.declaration.invalidJson"));
              }
            }}
          />
          {declarationError && <Alert type="error" message={declarationError} />}
        </>
      )}
      {value?.type === "program" && (
        <EvalRuleProgramFields
          kind={kind}
          value={value.program ?? newRuleProgram(kind)}
          disabled={disabled}
          onChange={(program) => update({ program })}
        />
      )}
      {value?.type === "numeric_range" && (
        <Space>
          <InputNumber
            aria-label={caseUiText("knowledgeNetwork.eval.caseEditor.minimum")}
            placeholder={caseUiText("minimumInclusive")}
            stringMode
            disabled={disabled}
            value={value.minimum}
            onChange={(minimum) => update({ minimum: minimum ?? undefined })}
          />
          <InputNumber
            aria-label={caseUiText("knowledgeNetwork.eval.caseEditor.maximum")}
            placeholder={caseUiText("maximumInclusive")}
            stringMode
            disabled={disabled}
            value={value.maximum}
            onChange={(maximum) => update({ maximum: maximum ?? undefined })}
          />
        </Space>
      )}
      {value?.type === "enum" && (
        <>
          <Select
            aria-label={caseUiText("allowedValueType")}
            value={enumType}
            disabled={disabled}
            options={[
              {
                value: "string",
                label: caseUiText("knowledgeNetwork.eval.caseEditor.valueTypes.string"),
              },
              {
                value: "number",
                label: caseUiText("knowledgeNetwork.eval.caseEditor.valueTypes.number"),
              },
              { value: "boolean", label: caseUiText("boolean") },
            ]}
            onChange={(type) => {
              setEnumType(type);
              update({ values: [] });
              setEnumError("");
            }}
          />
          <Select
            aria-label={caseUiText("allowedValues")}
            mode="tags"
            style={{ width: "100%" }}
            placeholder={caseUiText("enterAnAllowedValueAndPressEnter")}
            disabled={disabled}
            value={value.values?.map(String)}
            onChange={(values) => {
              try {
                update({
                  values: values.map((item) => {
                    if (enumType === "string") return item;
                    const v = parsePrecisionPreservingJSON(item);
                    if (
                      enumType === "boolean"
                        ? typeof v !== "boolean"
                        : !/^[-+0-9.eE]+$/.test(item) || !Number.isFinite(Number(item))
                    )
                      throw Error();
                    return v;
                  }),
                });
                setEnumError("");
              } catch {
                update({ values: [] });
                setEnumError(caseUiText("enterAllowedValuesMatchingTheSelectedType"));
              }
            }}
          />
          {enumError && <Alert type="error" message={enumError} />}
        </>
      )}
      {value?.type === "result_compare" &&
        (disabled ? (
          <JsonTextBlock maxHeight={360} text={JSON.stringify(value.assertions, null, 2)} />
        ) : (
          <EvalCaseCriteria
            value={criteria}
            onChange={changeCriteria}
            predicates={[
              "equals",
              "exists",
              "contains",
              "numeric_range",
              "approx",
              "regex",
              "json_schema",
            ]}
          />
        ))}
    </Space>
  );
}
