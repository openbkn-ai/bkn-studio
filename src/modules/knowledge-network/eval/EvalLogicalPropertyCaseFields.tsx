/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */
import { Alert, Input, Select, Spin } from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import { getCaseTargetSchema, type CaseTargetSchema } from "./case-form.service";
import {
  compileCriteria,
  newCriterion,
  readCriteria,
  validateCaseArguments,
} from "./case-form-model";
import type { EvalCaseDefinition } from "./m0-run.service";
import { previewRuleApplication, type RuleApplicationRow } from "./rule-application.service";
import { EvalCaseCriteria } from "./EvalCaseCriteria";
import { EvalResourceArguments } from "./EvalResourceArguments";
import { EvalFieldLabel } from "./EvalFieldLabel";
import { useEvalTranslation } from "./useEvalTranslation";
import { transformPrecisionSafeJSONRequest } from "@/framework/request/precision-safe-json";

export function EvalLogicalPropertyCaseFields({
  networkId,
  row,
  initialDefinition,
  onPrepared,
}: {
  networkId: string;
  row: RuleApplicationRow;
  initialDefinition?: EvalCaseDefinition;
  onPrepared: (definition?: EvalCaseDefinition) => void;
}) {
  const { t } = useEvalTranslation();
  const l = (key: string) => t(`knowledgeNetwork.eval.logicalPropertyUi.${key}`);
  const [contract, setContract] = useState<CaseTargetSchema>();
  const [error, setError] = useState("");
  const [args, setArgs] = useState(() =>
    transformPrecisionSafeJSONRequest(
      initialDefinition?.input_spec.arguments ?? { dynamic_params: {} },
    ),
  );
  const [criteria, setCriteria] = useState(() => {
    const existing = (initialDefinition ? readCriteria(initialDefinition) : undefined) ?? [];
    return existing.length ? existing : [{ ...newCriterion(), path: "$.result" }];
  });
  const [source, setSource] = useState<"business_expert" | "independent_sample">(
    initialDefinition?.expected_source.kind === "independent_sample"
      ? "independent_sample"
      : "business_expert",
  );
  const [notes, setNotes] = useState(
    initialDefinition?.expected_source.evidence_refs?.join("\n") ?? "",
  );
  const callback = useRef(onPrepared);
  callback.current = onPrepared;
  useEffect(() => {
    let active = true;
    callback.current(undefined);
    setContract(undefined);
    setError("");
    getCaseTargetSchema(
      { kind: row.resource.kind, id: row.resource.id, name: row.resource_name },
      networkId,
    )
      .then((value) => {
        if (active) setContract(value);
      })
      .catch(() => {
        if (active) setError(t("knowledgeNetwork.eval.relationChecks.previewError"));
      });
    return () => {
      active = false;
    };
  }, [networkId, row.resource.kind, row.resource.id, row.resource_name, t]);
  const name =
    (initialDefinition?.execution_spec.logical_property as string | undefined) ??
    row.target_name.slice(`${row.resource_name} / `.length);
  const property = contract?.logical_properties?.find((p) => p.name === name);
  const call = row.check?.binding === "call";
  const form = useMemo<CaseTargetSchema | undefined>(
    () =>
      property
        ? {
            available: true,
            object_type_id: row.resource.id,
            input: {
              type: "object",
              properties: {
                _instance_identities: {
                  type: "array",
                  minItems: 1,
                  maxItems: 1,
                  items: { type: "object" },
                },
                dynamic_params: property.input,
              },
              required: ["_instance_identities", "dynamic_params"],
              additionalProperties: false,
            },
            output: property.output,
          }
        : undefined,
    [property, row.resource.id],
  );
  useEffect(() => {
    callback.current(undefined);
    if (!form) return;
    let sample: RuleApplicationRow["sample"];
    try {
      const argumentsValue = validateCaseArguments(args, form.input);
      const compiled = call ? undefined : compileCriteria(criteria);
      sample = {
        ...row.sample,
        arguments: argumentsValue,
        scope: { mode: "invocation" },
        ...(compiled
          ? {
              expected: compiled.expected_spec,
              assertions: compiled.assertions,
              source_kind: source,
              evidence_refs: notes
                .split("\n")
                .map((x) => x.trim())
                .filter(Boolean),
            }
          : {
              expected: { available: true, parameters_valid: true },
              source_kind: "declared_contract",
              evidence_refs: [],
            }),
      };
    } catch {
      return;
    }
    let active = true;
    const timer = setTimeout(() => {
      previewRuleApplication(networkId, {
        resources: [row.resource],
        rule_ids: [row.rule_id],
        samples: [sample],
        only_samples: true,
        page: 1,
        limit: 1,
      })
        .then((value) => {
          if (!active) return;
          const prepared = value.entries.find((r) => r.target_key === row.target_key);
          callback.current(prepared?.ready_for_save ? prepared.prepared_definition : undefined);
          setError(prepared?.missing.join("；") ?? "");
        })
        .catch(() => {
          if (active) setError(t("knowledgeNetwork.eval.relationChecks.previewError"));
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [args, criteria, source, notes, form, call, networkId, row, t]);
  if (!contract) return error ? <Alert type="error" message={error} /> : <Spin size="small" />;
  if (!form) return <Alert type="warning" message={l("unavailable")} />;
  return (
    <>
      <EvalFieldLabel hint={l("help")}>
        {t("knowledgeNetwork.eval.definitionOnly.arguments")}
      </EvalFieldLabel>
      <EvalResourceArguments
        networkId={networkId}
        kind="objectType"
        contract={form}
        value={args}
        onChange={setArgs}
      />
      {call ? (
        <EvalFieldLabel hint={l("callStandard")}>
          {t("knowledgeNetwork.eval.definitionOnly.criteria")}
        </EvalFieldLabel>
      ) : (
        <>
          <EvalFieldLabel required>
            {t("knowledgeNetwork.eval.definitionOnly.criteria")}
          </EvalFieldLabel>
          <EvalCaseCriteria
            value={criteria}
            onChange={setCriteria}
            schema={form.output}
            predicates={[
              "equals",
              "exists",
              "contains",
              "regex",
              "numeric_range",
              "approx",
              "json_schema",
            ]}
          />
          <EvalFieldLabel required>
            {t("knowledgeNetwork.eval.definitionOnly.source")}
          </EvalFieldLabel>
          <Select
            aria-label={t("knowledgeNetwork.eval.definitionOnly.source")}
            style={{ width: "100%" }}
            value={source}
            onChange={setSource}
            options={[
              { value: "business_expert", label: t("knowledgeNetwork.eval.definitionOnly.expert") },
              {
                value: "independent_sample",
                label: t("knowledgeNetwork.eval.definitionOnly.sample"),
              },
            ]}
          />
          <EvalFieldLabel>{t("knowledgeNetwork.eval.definitionOnly.evidence")}</EvalFieldLabel>
          <Input.TextArea
            aria-label={t("knowledgeNetwork.eval.definitionOnly.evidence")}
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </>
      )}
      {error && <Alert type="warning" message={error} />}
    </>
  );
}
