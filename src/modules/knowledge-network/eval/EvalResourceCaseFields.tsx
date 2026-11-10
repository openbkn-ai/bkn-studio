/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { evalScalarText } from "./eval-scalar-text";

import { Alert, Button, Input, Select, Space, Spin, Typography } from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import { EvalResourceArguments } from "./EvalResourceArguments";
import { EvalCaseArguments } from "./EvalCaseArguments";
import { EvalCaseCriteria } from "./EvalCaseCriteria";
import {
  compileCriteria,
  newCriterion,
  readCriteria,
  validateCaseArguments,
  type CaseCriterion,
} from "./case-form-model";
import type { CaseTargetSchema } from "./case-form.service";
import {
  getEvalTemplateConfig,
  type EvalCaseDefinition,
  type EvalCaseResource,
  type EvalTemplateConfig,
} from "./m0-run.service";
import { previewRuleApplication, type RuleApplicationRow } from "./rule-application.service";
import { transformPrecisionSafeJSONRequest } from "@/framework/request/precision-safe-json";
import { useEvalTranslation } from "./useEvalTranslation";
import styles from "./EvalCaseEditorDrawer.module.css";
import { EvalDefinitionOnlyFields } from "./EvalDefinitionOnlyFields";
import { resourceCaseChecks } from "./rule-check-model";
const predicates = [
  "equals",
  "exists",
  "contains",
  "regex",
  "numeric_range",
  "approx",
  "json_schema",
];

// New Case and rule application use the same schema editor and server preview.
// Executable definitions come from server preview. Definition-only inputs stay
// unbound and are independently validated by the save API.
export function EvalResourceCaseFields({
  networkId,
  resource,
  contract,
  outputSchema,
  onArgumentsChange,
  initialDefinition,
  ruleId: lockedRule,
  onPrepared,
  onDefinitionOnlyChange,
}: {
  networkId: string;
  resource: EvalCaseResource;
  contract: CaseTargetSchema;
  outputSchema?: CaseTargetSchema["output"];
  onArgumentsChange?: (value: string) => void;
  initialDefinition?: EvalCaseDefinition;
  ruleId?: string;
  onPrepared: (definition?: EvalCaseDefinition) => void;
  onDefinitionOnlyChange?: (value: boolean) => void;
}) {
  const { t } = useEvalTranslation();
  const definitionText = (key: string) => t(`knowledgeNetwork.eval.definitionOnly.${key}`);
  const text = (key: string) => t(`knowledgeNetwork.eval.resourceCases.${key}`);
  const [config, setConfig] = useState<EvalTemplateConfig>();
  const [ruleId, setRuleId] = useState<string | undefined>(
    lockedRule ??
      (evalScalarText(initialDefinition?.diagnostic_spec.template_rule_id ?? "") || undefined),
  );
  const [args, setArgs] = useState(
    transformPrecisionSafeJSONRequest({
      ...(initialDefinition?.input_spec.arguments as object),
      ...contract.system_arguments,
    }),
  );
  const [criteria, setCriteria] = useState<CaseCriterion[]>(() => {
    const previous = initialDefinition && readCriteria(initialDefinition);
    return previous?.length ? previous : [newCriterion()];
  });
  const [source, setSource] = useState(() =>
    initialDefinition?.expected_source.kind === "independent_sample"
      ? "independent_sample"
      : "business_expert",
  );
  const [evidence, setEvidence] = useState(
    initialDefinition?.expected_source.evidence_refs?.join("\n") ?? "",
  );
  const [base, setBase] = useState<RuleApplicationRow>();
  const [recordDefinition, setRecordDefinition] = useState(
    !!initialDefinition?.diagnostic_spec.definition_only,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const preparedCallback = useRef(onPrepared);
  preparedCallback.current = onPrepared;
  const rules = useMemo(
    () => config?.rules.filter((r) => r.kind === resource.kind && r.enabled) ?? [],
    [config, resource.kind],
  );
  const supported = rules.filter(
    (r) =>
      config?.execution_support?.[r.id]?.status === "supported" &&
      resourceCaseChecks.includes(
        (r.check ?? config?.execution_support?.[r.id]?.check)?.type ?? "",
      ),
  );
  const unsupported = rules.filter((r) => !supported.some((candidate) => candidate.id === r.id));
  const selected = rules.find((r) => r.id === ruleId);
  const check = selected?.check ?? config?.execution_support?.[ruleId ?? ""]?.check;
  const definitionOnly =
    !!selected && (recordDefinition || !supported.some((r) => r.id === selected.id));
  const modeCallback = useRef(onDefinitionOnlyChange);
  modeCallback.current = onDefinitionOnlyChange;
  useEffect(() => {
    modeCallback.current?.(definitionOnly);
    return () => modeCallback.current?.(false);
  }, [definitionOnly]);
  const business = check?.type === "resource_result";
  const needsReference =
    business &&
    (check?.independent_value ||
      criteria.some((c) =>
        ["equals", "contains", "regex", "numeric_range", "approx"].includes(c.type),
      ));
  const changeArguments = (value: string) => {
    setArgs(value);
    onArgumentsChange?.(value);
  };

  useEffect(() => {
    let active = true;
    setError("");
    getEvalTemplateConfig(networkId)
      .then((c) => {
        if (active) setConfig(c);
      })
      .catch(() => {
        if (active) setError(text("ruleError"));
      });
    return () => {
      active = false;
    };
    // Locale is presentation only; retry reloads the same rules explicitly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [networkId, retry]);
  useEffect(() => {
    let active = true;
    setBase(undefined);
    // The definition editor owns its preparation. Clearing here after config
    // loads would erase a restored, complete definition until the user edits it.
    if (definitionOnly) return;
    preparedCallback.current(undefined);
    if (!ruleId || !check || !resourceCaseChecks.includes(check.type)) return;
    setBusy(true);
    previewRuleApplication(networkId, {
      resources: [{ kind: resource.kind, id: resource.id }],
      rule_ids: [ruleId],
      page: 1,
      limit: 1,
    })
      .then((result) => {
        if (active) setBase(result.entries[0]);
      })
      .catch(() => {
        if (active) setError(text("previewError"));
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
    // Rule identity and config revision own this initial preview, not each input edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [networkId, resource.kind, resource.id, ruleId, config?.checksum, definitionOnly, retry]);
  useEffect(() => {
    let active = true;
    if (definitionOnly) return;
    preparedCallback.current(undefined);
    setError("");
    setBusy(false);
    if (!base || !selected || base.match !== "applicable" || contract.available === false) return;
    let sample;
    try {
      const argumentsValue = validateCaseArguments(args || "{}", contract.input);
      if (
        check?.independent_value &&
        !criteria.some((c) =>
          ["equals", "contains", "regex", "numeric_range", "approx"].includes(c.type),
        )
      )
        throw Error(text("independentValueRequired"));
      const compiled = business ? compileCriteria(criteria) : undefined;
      if (needsReference && !evidence.trim()) return;
      sample = {
        ...base.sample,
        arguments: argumentsValue,
        scope: { mode: "invocation" },
        ...(compiled
          ? {
              expected: compiled.expected_spec,
              assertions: compiled.assertions,
              source_kind: needsReference
                ? (source as "business_expert" | "independent_sample")
                : ("declared_contract" as const),
              evidence_refs: needsReference
                ? evidence
                    .split("\n")
                    .map((x) => x.trim())
                    .filter(Boolean)
                : base.sample.evidence_refs,
            }
          : {}),
      };
    } catch (e) {
      setError(e instanceof Error ? e.message : text("incomplete"));
      return;
    }
    setBusy(true);
    const timer = window.setTimeout(() => {
      void previewRuleApplication(networkId, {
        resources: [{ kind: resource.kind, id: resource.id }],
        rule_ids: [selected.id],
        samples: [sample],
        page: 1,
        limit: 1,
      })
        .then((result) => {
          if (!active) return;
          const row = result.entries[0];
          if (row?.ready_for_save && row.prepared_definition)
            preparedCallback.current(row.prepared_definition);
          else
            setError(
              row?.missing.join("；") ||
                row?.save_error ||
                row?.execution_reason ||
                text("incomplete"),
            );
        })
        .catch(() => {
          if (active) setError(text("previewError"));
        })
        .finally(() => {
          if (active) setBusy(false);
        });
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
    // A new reference, parameter, predicate or source contract invalidates the old definition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    networkId,
    resource.kind,
    resource.id,
    base,
    selected,
    args,
    criteria,
    source,
    evidence,
    needsReference,
    business,
    definitionOnly,
    contract,
    retry,
  ]);
  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <div>
        <div className={styles.fieldLabel}>{text("check")} *</div>
        <Select
          aria-label={text("check")}
          style={{ width: "100%" }}
          showSearch
          optionFilterProp="label"
          value={ruleId}
          disabled={!!lockedRule}
          loading={!config && !error}
          placeholder={text("chooseCheck")}
          options={[
            {
              label: definitionText("executionReady"),
              options: supported.map((r) => ({ value: r.id, label: r.title })),
            },
            {
              label: definitionText("recordable"),
              options: unsupported.map((r) => ({ value: r.id, label: r.title })),
            },
          ]}
          onChange={(id) => {
            setRuleId(id);
            setRecordDefinition(false);
            setBase(undefined);
            setError("");
            setCriteria([newCriterion()]);
            preparedCallback.current(undefined);
          }}
        />
      </div>
      {selected && <Typography.Text type="secondary">{selected.description}</Typography.Text>}
      {!definitionOnly && contract.available === false && (
        <Alert
          type="warning"
          message={contract.reason}
          action={
            selected && (
              <Button size="small" onClick={() => setRecordDefinition(true)}>
                {definitionText("configure")}
              </Button>
            )
          }
        />
      )}
      {definitionOnly && selected && (
        <EvalDefinitionOnlyFields
          key={selected.id}
          networkId={networkId}
          resource={resource}
          rule={selected}
          reason={
            recordDefinition
              ? contract.reason || base?.execution_reason || definitionText("runtimeMissing")
              : config?.execution_support?.[selected.id]?.reason || text("unsupportedReason")
          }
          initialDefinition={
            initialDefinition?.diagnostic_spec.definition_only ? initialDefinition : undefined
          }
          onPrepared={onPrepared}
        />
      )}
      {recordDefinition &&
        selected &&
        supported.some((r) => r.id === selected.id) &&
        contract.available === true && (
          <Button onClick={() => setRecordDefinition(false)}>
            {definitionText("configureExecution")}
          </Button>
        )}
      {ruleId && !definitionOnly && contract.available !== false && (
        <>
          {check?.independent_value && (
            <Typography.Paragraph type="secondary">
              {text(
                resource.kind === "function" ? "validInputSamples" : "independentMetricSamples",
              )}
            </Typography.Paragraph>
          )}
          <div>
            <div className={styles.fieldLabel}>{text("arguments")}</div>
            {resource.kind === "function" ? (
              <EvalCaseArguments
                value={args}
                onChange={changeArguments}
                schema={contract.input}
                systemArguments={contract.system_arguments}
                hiddenFields={Object.keys(contract.system_arguments ?? {})}
              />
            ) : (
              <EvalResourceArguments
                value={args}
                onChange={changeArguments}
                kind={resource.kind}
                networkId={networkId}
                contract={contract}
              />
            )}
          </div>
          {business ? (
            <>
              <div>
                <div className={styles.fieldLabel}>{text("criteria")} *</div>
                <EvalCaseCriteria
                  value={criteria}
                  onChange={setCriteria}
                  predicates={predicates}
                  schema={outputSchema ?? contract.output}
                />
              </div>
              {needsReference && (
                <>
                  <div>
                    <div className={styles.fieldLabel}>{text("source")} *</div>
                    <Select
                      aria-label={text("source")}
                      style={{ width: "100%" }}
                      value={source}
                      onChange={setSource}
                      options={[
                        { value: "business_expert", label: text("expert") },
                        { value: "independent_sample", label: text("sample") },
                      ]}
                    />
                  </div>
                  <div>
                    <div className={styles.fieldLabel}>{text("evidence")} *</div>
                    <Input.TextArea
                      aria-label={text("evidence")}
                      rows={2}
                      value={evidence}
                      onChange={(e) => setEvidence(e.target.value)}
                      placeholder={text("evidencePlaceholder")}
                    />
                  </div>
                </>
              )}
            </>
          ) : (
            <Typography.Text type="secondary">
              {text(
                check?.type === "output_contract"
                  ? "schemaStandard"
                  : check?.type === "input_contract"
                    ? "inputStandard"
                    : check?.type === "result_compare"
                      ? "fixedStandard"
                      : "availabilityStandard",
              )}
            </Typography.Text>
          )}
        </>
      )}
      {busy && <Spin size="small" />}
      {error && (
        <Alert
          type="warning"
          message={error}
          action={<Button onClick={() => setRetry((n) => n + 1)}>{text("retry")}</Button>}
        />
      )}
      {!definitionOnly && base && base.match !== "applicable" && (
        <Alert
          type="warning"
          message={base.match_reason || text("incomplete")}
          action={
            <Button size="small" onClick={() => setRecordDefinition(true)}>
              {definitionText("configure")}
            </Button>
          }
        />
      )}
    </Space>
  );
}
