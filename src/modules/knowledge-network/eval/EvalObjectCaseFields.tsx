/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { caseUiText } from "./case-ui-text";
import { evalScalarText } from "./eval-scalar-text";

import { Alert, Button, Input, Select, Space, Spin, Typography } from "antd";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getEvalTemplateConfig,
  type EvalCaseDefinition,
  type EvalCaseResource,
  type EvalTemplateConfig,
} from "./m0-run.service";
import { previewRuleApplication, type RuleApplicationRow } from "./rule-application.service";
import styles from "./EvalCaseEditorDrawer.module.css";
import { parsePrecisionPreservingJSON } from "@/framework/request/precision-safe-json";
import { EvalDefinitionOnlyFields } from "./EvalDefinitionOnlyFields";
import { useEvalTranslation } from "./useEvalTranslation";

type Props = {
  networkId: string;
  resource: EvalCaseResource;
  initialDefinition?: EvalCaseDefinition;
  onDefinitionOnlyChange?: (value: boolean) => void;
  onPrepared: (definition?: EvalCaseDefinition) => void;
};

// The server owns rule matching and executable definitions. Text is never compiled into a query here.
export function EvalObjectCaseFields({
  networkId,
  resource,
  initialDefinition,
  onPrepared,
  onDefinitionOnlyChange,
}: Props) {
  const { t } = useEvalTranslation();
  const definitionText = (key: string) => t(`knowledgeNetwork.eval.definitionOnly.${key}`);
  const text = (key: string) => t(`knowledgeNetwork.eval.objectRuleUi.${key}`);
  const [config, setConfig] = useState<EvalTemplateConfig>();
  const [kind, setKind] = useState<"objectType" | "objectProperty">(
    initialDefinition?.diagnostic_spec.rule_snapshot &&
      (initialDefinition.diagnostic_spec.rule_snapshot as { kind?: string }).kind ===
        "objectProperty"
      ? "objectProperty"
      : "objectType",
  );
  const [ruleId, setRuleId] = useState<string | undefined>(
    evalScalarText(initialDefinition?.diagnostic_spec.template_rule_id ?? "") || undefined,
  );
  const [rows, setRows] = useState<RuleApplicationRow[]>([]);
  const [target, setTarget] = useState<string>();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [sampleRows, setSampleRows] = useState("");
  const [recordDefinition, setRecordDefinition] = useState(
    !!initialDefinition?.diagnostic_spec.definition_only,
  );
  const [sampleRefs, setSampleRefs] = useState("");
  const [sampleFields, setSampleFields] = useState("");
  const [filterOperator, setFilterOperator] = useState("eq");
  const [filterValue, setFilterValue] = useState("");
  const generation = useRef(0);
  const invalidate = useCallback(() => {
    generation.current++;
  }, []);
  useEffect(() => {
    invalidate();
    return invalidate;
  }, [networkId, resource.kind, resource.id, ruleId, target, invalidate]);
  useEffect(() => {
    setSampleRows("");
    setSampleRefs("");
    setSampleFields("");
    setFilterValue("");
  }, [networkId, resource.kind, resource.id, ruleId]);
  useEffect(() => {
    let active = true;
    setError("");
    getEvalTemplateConfig(networkId)
      .then((value) => {
        if (active) setConfig(value);
      })
      .catch(() => {
        if (active) setError(caseUiText("failedToLoadChecksTryAgain"));
      });
    return () => {
      active = false;
    };
  }, [networkId, retry]);
  const rules = useMemo(
    () => config?.rules.filter((r) => r.kind === kind && r.enabled) ?? [],
    [config, kind],
  );
  useEffect(() => {
    onPrepared(undefined);
    setBusy(false);
    setRows([]);
    setTarget(undefined);
    setTotal(0);
    if (!ruleId) return;
    let active = true;
    setBusy(true);
    setError("");
    const timer = window.setTimeout(
      () => {
        void previewRuleApplication(networkId, {
          resources: [{ kind: resource.kind, id: resource.id }],
          rule_ids: [ruleId],
          page,
          limit: 100,
          ...(query ? { q: query } : {}),
        })
          .then((value) => {
            if (!active) return;
            setRows(value.entries);
            setTotal(value.total);
            const previousTarget = value.entries.find(
              (row) => row.target_id === initialDefinition?.diagnostic_spec.target_id,
            );
            if (previousTarget) setTarget(previousTarget.target_key);
            if (kind === "objectType" && value.entries.length === 1) {
              const row = value.entries[0];
              setTarget(row.target_key);
              if (row.prepared_definition && row.ready_for_save) {
                onPrepared(row.prepared_definition);
              }
            }
          })
          .catch(() => {
            if (active) setError(caseUiText("failedToLoadTheCheckConfigurationTryAgain"));
          })
          .finally(() => {
            if (active) setBusy(false);
          });
      },
      query ? 250 : 0,
    );
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [
    networkId,
    resource.kind,
    resource.id,
    ruleId,
    kind,
    query,
    page,
    retry,
    onPrepared,
    initialDefinition?.diagnostic_spec.target_id,
  ]);
  const selectedRule = rules.find((r) => r.id === ruleId);
  const checkType =
    selectedRule?.check?.type ?? config?.execution_support?.[ruleId ?? ""]?.check?.type;
  const definitionOnly =
    !!selectedRule &&
    (recordDefinition || config?.execution_support?.[selectedRule.id]?.status !== "supported");
  const modeCallback = useRef(onDefinitionOnlyChange);
  modeCallback.current = onDefinitionOnlyChange;
  useEffect(() => {
    modeCallback.current?.(definitionOnly);
    return () => modeCallback.current?.(false);
  }, [definitionOnly]);
  const selectedTarget = useMemo(() => {
    const row = rows.find((r) => r.target_key === target);
    return row ? { id: row.target_id, name: row.target_name } : undefined;
  }, [rows, target]);
  const needsSamples = ["instance_lookup", "mapped_values", "property_filter"].includes(
    checkType ?? "",
  );
  const editSample = (set: (value: string) => void, value: string) => {
    generation.current++;
    setBusy(false);
    set(value);
    setError("");
    onPrepared(undefined);
  };
  const prepareSample = async () => {
    const row = rows.find((item) => item.target_key === target);
    if (!row || !ruleId) return;
    const current = ++generation.current;
    onPrepared(undefined);
    setError("");
    setBusy(true);
    try {
      const args: Record<string, unknown> = {
        rows: parsePrecisionPreservingJSON(sampleRows),
        evidence_refs: sampleRefs
          .split("\n")
          .map((value) => value.trim())
          .filter(Boolean),
      };
      if (checkType === "mapped_values")
        args.fields = sampleFields
          .split(/[,，]/)
          .map((value) => value.trim())
          .filter(Boolean);
      if (checkType === "property_filter") {
        args.operator = filterOperator;
        args.value = parsePrecisionPreservingJSON(filterValue);
      }
      const preview = await previewRuleApplication(networkId, {
        resources: [{ kind: resource.kind, id: resource.id }],
        rule_ids: [ruleId],
        samples: [{ ...row.sample, arguments: args }],
        only_samples: true,
        page: 1,
        limit: 100,
      });
      if (current !== generation.current) return;
      const prepared = preview.entries.find((item) => item.target_key === target);
      if (!prepared?.ready_for_save || !prepared.prepared_definition) {
        setError(prepared?.missing.join("；") || prepared?.save_error || text("sampleInvalid"));
        return;
      }
      onPrepared(prepared.prepared_definition);
    } catch {
      if (current === generation.current) setError(text("sampleInvalid"));
    } finally {
      if (current === generation.current) setBusy(false);
    }
  };
  const unavailable = rows.find((r) => !r.prepared_definition);
  return (
    <Space direction="vertical" size={12} style={{ width: "100%" }}>
      <div className={styles.criteriaValues}>
        <div>
          <div className={styles.fieldLabel}>
            {caseUiText("knowledgeNetwork.eval.templateUi.columns.check")}
          </div>
          <Select
            aria-label={caseUiText("knowledgeNetwork.eval.templateUi.columns.check")}
            style={{ width: "100%" }}
            value={kind}
            disabled={!!initialDefinition?.diagnostic_spec.definition_only}
            options={[
              { value: "objectType", label: caseUiText("objectInstances") },
              { value: "objectProperty", label: caseUiText("objectProperties") },
            ]}
            onChange={(value) => {
              setKind(value);
              setRecordDefinition(false);
              setRuleId(undefined);
              setQuery("");
              setPage(1);
              onPrepared(undefined);
            }}
          />
        </div>
        <div>
          <div className={styles.fieldLabel}>{caseUiText("checkRequired")}</div>
          <Select
            aria-label={caseUiText("knowledgeNetwork.eval.relationChecks.check")}
            showSearch
            optionFilterProp="label"
            style={{ width: "100%" }}
            placeholder={definitionText("chooseCheck")}
            value={ruleId}
            disabled={!!initialDefinition?.diagnostic_spec.definition_only}
            loading={!config && !error}
            options={rules.map((r) => ({
              value: r.id,
              label: r.title,

              title: config?.execution_support?.[r.id]?.reason,
            }))}
            onChange={(value) => {
              setRuleId(value);
              setRecordDefinition(false);
              setQuery("");
              setPage(1);
              onPrepared(undefined);
            }}
          />
        </div>
      </div>
      {selectedRule && (
        <Typography.Text type="secondary">
          {config?.check_capabilities?.find((capability) => capability.type === checkType)?.help ??
            selectedRule.description}
        </Typography.Text>
      )}
      {busy && <Spin size="small" />}
      {kind === "objectProperty" && ruleId && (
        <>
          <div>
            <div className={styles.fieldLabel}>{caseUiText("propertyToCheckRequired")}</div>
            <Select
              aria-label={caseUiText("knowledgeNetwork.eval.relationChecks.property")}
              style={{ width: "100%" }}
              placeholder={caseUiText("selectAnActualPropertyToCheckSearchBy")}
              showSearch
              filterOption={false}
              loading={busy}
              value={target}
              onSearch={(value) => {
                setQuery(value);
                setPage(1);
              }}
              options={rows.map((r) => ({
                value: r.target_key,
                label: r.target_name,
                disabled: definitionOnly
                  ? !["applicable", "not_applicable"].includes(r.match)
                  : needsSamples
                    ? r.match !== "applicable"
                    : !r.ready_for_save || !r.prepared_definition,
                title: r.match_reason || r.execution_reason,
              }))}
              onChange={(key) => {
                const row = rows.find((r) => r.target_key === key);
                setTarget(key);
                onPrepared(row?.prepared_definition);
              }}
            />
          </div>
          {total > 100 && (
            <Space>
              <Button
                size="small"
                disabled={page === 1 || busy}
                onClick={() => setPage((p) => p - 1)}
              >
                {caseUiText("previous")}
              </Button>
              <Typography.Text type="secondary">
                {caseUiText("page")}
                {page}
                {caseUiText("of")}
                {total}
                {caseUiText("matches")}
              </Typography.Text>
              <Button
                size="small"
                disabled={page * 100 >= total || busy}
                onClick={() => setPage((p) => p + 1)}
              >
                {caseUiText("next")}
              </Button>
            </Space>
          )}
        </>
      )}
      {definitionOnly && selectedRule && selectedTarget && (
        <EvalDefinitionOnlyFields
          key={`${selectedRule.id}:${selectedTarget.id}`}
          networkId={networkId}
          resource={resource}
          rule={selectedRule}
          target={selectedTarget}
          reason={
            recordDefinition
              ? rows.find((r) => r.target_key === target)?.match_reason ||
                rows.find((r) => r.target_key === target)?.missing.join("；") ||
                definitionText("runtimeMissing")
              : config?.execution_support?.[selectedRule.id]?.reason ||
                definitionText("notSupported")
          }

          initialDefinition={initialDefinition}
          onPrepared={onPrepared}
        />
      )}
      {recordDefinition &&
        selectedRule &&
        config?.execution_support?.[selectedRule.id]?.status === "supported" &&
        rows.some((r) => r.match === "applicable") && (
          <Button
            onClick={() => {
              onPrepared(undefined);
              setRecordDefinition(false);
            }}
          >
            {definitionText("configureExecution")}
          </Button>
        )}
      {!definitionOnly &&
        selectedRule &&
        rows.length > 0 &&
        rows.every((r) => !r.ready_for_save) && (
          <Alert
            type="info"
            message={definitionText("conditionsMissing")}
            description={
              rows[0].match_reason || rows[0].missing.join("；") || rows[0].execution_reason
            }
            action={
              <Button
                size="small"
                onClick={() => {
                  onPrepared(undefined);
                  setRecordDefinition(true);
                }}
              >
                {definitionText("configure")}
              </Button>
            }
          />
        )}
      {!definitionOnly && needsSamples && ruleId && (
        <Space direction="vertical" style={{ width: "100%" }}>
          <Typography.Text type="secondary">
            {text(checkType === "mapped_values" ? "mappingHelp" : "sampleHelp")}
          </Typography.Text>
          {checkType === "mapped_values" && (
            <label style={{ display: "block", width: "100%" }}>
              {text("fields")}
              <Input
                aria-label={text("fields")}
                value={sampleFields}
                onChange={(e) => editSample(setSampleFields, e.target.value)}
              />
            </label>
          )}
          {checkType === "property_filter" && (
            <div className={styles.criteriaValues}>
              <label>
                {text("operator")}
                <Select
                  aria-label={text("operator")}
                  value={filterOperator}
                  style={{ width: "100%" }}
                  options={["eq", "ne", "gt", "gte", "lt", "lte"].map((value) => ({
                    value,
                    label: { eq: "=", ne: "≠", gt: ">", gte: "≥", lt: "<", lte: "≤" }[value],
                  }))}
                  onChange={(value) => editSample(setFilterOperator, value)}
                />
              </label>
              <label>
                {text("filterValue")}
                <Input
                  aria-label={text("filterValue")}
                  value={filterValue}
                  onChange={(e) => editSample(setFilterValue, e.target.value)}
                />
              </label>
            </div>
          )}
          <label style={{ display: "block", width: "100%" }}>
            {text("rows")}
            <Input.TextArea
              aria-label={text("rows")}
              rows={5}
              value={sampleRows}
              onChange={(e) => editSample(setSampleRows, e.target.value)}
            />
          </label>
          <label style={{ display: "block", width: "100%" }}>
            {text("refs")}
            <Input.TextArea
              aria-label={text("refs")}
              rows={2}
              value={sampleRefs}
              onChange={(e) => editSample(setSampleRefs, e.target.value)}
            />
          </label>
          <Button
            loading={busy}
            disabled={!target || !sampleRows.trim() || !sampleRefs.trim()}
            onClick={() => void prepareSample()}
          >
            {text("prepare")}
          </Button>
        </Space>
      )}
      {!busy && ruleId && !rows.length && !error && (
        <Typography.Text type="secondary">
          {caseUiText("noMatchingCheckTargetsAreAvailableForThis")}
        </Typography.Text>
      )}
      {!busy && !definitionOnly && !needsSamples && kind === "objectType" && unavailable && (
        <Alert
          type="warning"
          showIcon
          message={unavailable.match_reason || unavailable.execution_reason}
          description={unavailable.missing.join("；")}
        />
      )}
      {error && (
        <Alert
          type="error"
          showIcon
          message={error}
          action={
            <Button size="small" onClick={() => setRetry((v) => v + 1)}>
              {caseUiText("knowledgeNetwork.eval.suiteCaseUi.retry")}
            </Button>
          }
        />
      )}
    </Space>
  );
}
