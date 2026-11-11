/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { evalScalarText } from "./eval-scalar-text";

import { Alert, Collapse, Input, Select, Space, Typography } from "antd";
import { useEffect, useRef, useState } from "react";
import { EvalCaseCriteria } from "./EvalCaseCriteria";
import { newCriterion, readCriteria, type CaseCriterion } from "./case-form-model";
import { definitionOnlyCase } from "./definition-only-case";
import { transformPrecisionSafeJSONRequest } from "@/framework/request/precision-safe-json";
import type { EvalCaseDefinition, EvalCaseResource } from "./m0-run.service";
import type { EvalTemplateRule } from "./types";
import { useEvalTranslation } from "./useEvalTranslation";
import styles from "./EvalCaseEditorDrawer.module.css";

// Shared by unsupported capability rules and real logical-property targets.
// Authoring does not call the resource, infer correct output or grant execution.
export function EvalDefinitionOnlyFields({
  networkId,
  resource,
  rule,
  target,
  reason,
  initialDefinition,
  onPrepared,
}: {
  networkId: string;
  resource: EvalCaseResource;
  rule: EvalTemplateRule;
  target?: { id: string; name: string };
  reason: string;
  initialDefinition?: EvalCaseDefinition;
  onPrepared: (definition?: EvalCaseDefinition) => void;
}) {
  const { t } = useEvalTranslation();
  const text = (key: string) => t(`knowledgeNetwork.eval.definitionOnly.${key}`);
  const [question, setQuestion] = useState(
    evalScalarText(initialDefinition?.input_spec.question ?? ""),
  );
  const [args, setArgs] = useState(
    transformPrecisionSafeJSONRequest(initialDefinition?.input_spec.arguments ?? {}),
  );
  const [criteria, setCriteria] = useState<CaseCriterion[]>(
    () => (initialDefinition && readCriteria(initialDefinition)) || [newCriterion()],
  );
  const [source, setSource] = useState<"business_expert" | "independent_sample">(
    initialDefinition?.expected_source.kind === "independent_sample"
      ? "independent_sample"
      : "business_expert",
  );
  const [evidence, setEvidence] = useState(
    initialDefinition?.expected_source.evidence_refs?.join("\n") ?? "",
  );
  const [error, setError] = useState("");
  const callback = useRef(onPrepared);
  callback.current = onPrepared;
  useEffect(() => {
    try {
      const definition = definitionOnlyCase({
        networkId,
        resource,
        rule,
        target,
        question,
        argumentsJson: args,
        criteria,
        source,
        evidence,
        reason,
      });
      if (initialDefinition?.diagnostic_spec.definition_only) {
        definition.diagnostic_spec = {
          ...initialDefinition.diagnostic_spec,
          ...definition.diagnostic_spec,
          rule_snapshot: initialDefinition.diagnostic_spec.rule_snapshot ?? rule,
          template_rule_revision:
            initialDefinition.diagnostic_spec.template_rule_revision ?? rule.revision ?? 0,
        };
      }
      callback.current(definition);
      setError("");
    } catch (cause) {
      callback.current(undefined);
      // Empty initial controls are explained by their labels, rather than a wall of errors.
      setError(
        question.trim() && evidence.trim()
          ? cause instanceof Error
            ? cause.message === "EVAL_DEFINITION_STEPS_REQUIRED"
              ? text("stepsRequired")
              : cause.message === "EVAL_DEFINITION_REFERENCES_REQUIRED"
                ? text("referencesRequired")
                : cause.message
            : text("incomplete")
          : "",
      );
    }
    return () => callback.current(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    networkId,
    resource,
    rule,
    target,
    question,
    args,
    criteria,
    source,
    evidence,
    reason,
    initialDefinition,
  ]);
  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <Alert type="info" showIcon message={text("title")} description={reason} />
      <label style={{ width: "100%" }}>
        <div className={styles.fieldLabel}>{text("steps")} *</div>
        <Input.TextArea
          aria-label={text("steps")}
          rows={3}
          maxLength={4000}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={text("stepsPlaceholder")}
        />
      </label>
      <Collapse
        size="small"
        items={[
          {
            key: "arguments",
            label: text("arguments"),
            children: (
              <Input.TextArea
                aria-label={text("argumentsLabel")}
                rows={3}
                value={args}
                onChange={(e) => setArgs(e.target.value)}
              />
            ),
          },
        ]}
      />
      <div>
        <div className={styles.fieldLabel}>{text("criteria")} *</div>
        <EvalCaseCriteria
          value={criteria}
          onChange={setCriteria}
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
      </div>
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
      <label style={{ width: "100%" }}>
        <div className={styles.fieldLabel}>{text("evidence")} *</div>
        <Input.TextArea
          aria-label={text("evidence")}
          rows={2}
          value={evidence}
          onChange={(e) => setEvidence(e.target.value)}
          placeholder={text("evidencePlaceholder")}
        />
      </label>
      <Typography.Text type="secondary">{text("hint")}</Typography.Text>
      {error && <Alert type="warning" message={error} />}
    </Space>
  );
}
