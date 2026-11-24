/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { EvalDeclarationCaseFields } from "./EvalDeclarationCaseFields";
import { EvalRuleProgramFields } from "./EvalRuleProgramFields";
import { newRuleProgram, validateRuleProgram, type EvalRuleProgram } from "./rule-check-model";
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
import { EvalFieldLabel } from "./EvalFieldLabel";
import { parsePrecisionPreservingJSON } from "@/framework/request/precision-safe-json";
import { EvalLogicalPropertyCaseFields } from "./EvalLogicalPropertyCaseFields";
import { EvalDefinitionOnlyFields } from "./EvalDefinitionOnlyFields";
import { useEvalTranslation } from "./useEvalTranslation";
import { getKnowledgeNetworkObjectTypeDetail } from "../services/object-type.service";
import type { ObjectTypeDetail } from "../types/object-type";

function propertyFieldName(row: RuleApplicationRow) {
  const prefix = `${row.resource_name} / `;
  return row.target_name.startsWith(prefix)
    ? row.target_name.slice(prefix.length)
    : row.target_name;
}

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
  const [propertyDetails, setPropertyDetails] = useState<{
    networkId: string;
    resourceId: string;
    detail: ObjectTypeDetail;
  }>();
  const [sampleRows, setSampleRows] = useState("");
  const [businessProgram, setBusinessProgram] = useState<EvalRuleProgram>(() =>
    newRuleProgram("objectType"),
  );
  const [standardVersion, setStandardVersion] = useState("");
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
    setBusinessProgram(newRuleProgram("objectType"));
    setStandardVersion("");
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
    setPropertyDetails(undefined);
    if (kind !== "objectProperty") return;
    let active = true;
    void getKnowledgeNetworkObjectTypeDetail(networkId, resource.id, { skipErrorToast: true })
      .then((detail) => {
        if (active && detail) setPropertyDetails({ networkId, resourceId: resource.id, detail });
      })
      // A display-name lookup must not block an otherwise valid check. Fall
      // back to the field names already supplied by the authorized preview.
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [kind, networkId, resource.id, retry]);
  const propertyNames = useMemo(() => {
    if (propertyDetails?.networkId !== networkId || propertyDetails.resourceId !== resource.id)
      return new Map<string, string>();
    const logical = ruleId === "object-logic-property" || ruleId?.startsWith("logic-property-");
    const properties = logical
      ? propertyDetails.detail.logicProperties
      : propertyDetails.detail.dataProperties;
    return new Map(properties.map((p) => [p.name, p.displayName.trim() || p.name]));
  }, [propertyDetails, networkId, resource.id, ruleId]);
  const propertySearch = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (kind !== "objectProperty" || !needle) return undefined;
    const matches = [...propertyNames].filter(([name, label]) =>
      `${name}\n${label}`.toLocaleLowerCase().includes(needle),
    );
    // Keep ordinary field-name searches server-paginated. Only translate when
    // a business name matches that the server's technical-name filter misses.
    if (!matches.some(([name]) => !name.toLocaleLowerCase().includes(needle))) return undefined;
    return new Set(matches.map(([name]) => name));
  }, [query, kind, propertyNames]);
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
        const request = {
          resources: [{ kind: resource.kind, id: resource.id }],
          rule_ids: [ruleId],
          page: propertySearch ? 1 : page,
          limit: 100,
          ...(propertySearch
            ? propertySearch.size === 1
              ? { q: [...propertySearch][0] }
              : {}
            : query
              ? { q: query }
              : {}),
        };
        void previewRuleApplication(networkId, request)
          .then(async (value) => {
            if (!active || !propertySearch) return value;
            const matches = value.entries.filter((r) => propertySearch.has(propertyFieldName(r)));
            // Business-name matches can span server pages (including several
            // fields sharing a display name). Keep only actual preview targets.
            for (let next = 2; (next - 1) * value.limit < value.total; next++) {
              if (!active) return value;
              const more = await previewRuleApplication(networkId, { ...request, page: next });
              matches.push(...more.entries.filter((r) => propertySearch.has(propertyFieldName(r))));
            }
            return {
              ...value,
              page,
              total: matches.length,
              entries: matches.slice((page - 1) * value.limit, page * value.limit),
            };
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
              if (row.match === "applicable" && row.prepared_definition && row.ready_for_save) {
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
    propertySearch,
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
  const selectedRow = rows.find((r) => r.target_key === target);
  const selectedTarget = useMemo(
    () => (selectedRow ? { id: selectedRow.target_id, name: selectedRow.target_name } : undefined),
    [selectedRow],
  );
  const selectedReason =
    selectedRow?.match_reason ||
    selectedRow?.missing.join("；") ||
    selectedRow?.execution_reason ||
    definitionText("runtimeMissing");
  const needsProgram = !!selectedRule?.check?.program_input;
  const needsSamples =
    needsProgram ||
    ["instance_lookup", "mapped_values", "property_filter"].includes(checkType ?? "");
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
      const evidenceRefs = sampleRefs
        .split("\n")
        .map((value) => value.trim())
        .filter(Boolean);
      if (needsProgram) validateRuleProgram(businessProgram);
      const args: Record<string, unknown> = needsProgram
        ? {
            program: {
              ...businessProgram,
              standard: { version: standardVersion.trim(), evidence_refs: evidenceRefs },
            },
          }
        : {
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
        setError(
          prepared?.missing.join("；") ||
            prepared?.save_error ||
            text(needsProgram ? "businessInvalid" : "sampleInvalid"),
        );
        return;
      }
      setRows((currentRows) =>
        currentRows.map((item) => (item.target_key === target ? prepared : item)),
      );
      onPrepared(prepared.prepared_definition);
    } catch {
      if (current === generation.current)
        setError(text(needsProgram ? "businessInvalid" : "sampleInvalid"));
    } finally {
      if (current === generation.current) setBusy(false);
    }
  };
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
          <EvalFieldLabel
            required
            hint={
              selectedRule &&
              (config?.check_capabilities?.find((capability) => capability.type === checkType)
                ?.help ??
                selectedRule.description)
            }
          >
            {caseUiText("checkRequired")}
          </EvalFieldLabel>
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
      {busy && <Spin size="small" />}
      {kind === "objectProperty" && ruleId && (
        <>
          <div>
            <EvalFieldLabel required>{caseUiText("propertyToCheckRequired")}</EvalFieldLabel>
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
                label: propertyNames.get(propertyFieldName(r)) || propertyFieldName(r),
                // Users must be able to select a visible target to inspect why
                // it is not executable. Selection never grants execution.
                disabled: r.match === "excluded" || r.match === "disabled",
                title: r.match_reason || r.execution_reason,
              }))}
              onChange={(key) => {
                const row = rows.find((r) => r.target_key === key);
                setTarget(key);
                onPrepared(
                  !definitionOnly && row?.match === "applicable" && row.ready_for_save
                    ? row.prepared_definition
                    : undefined,
                );
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
      {!definitionOnly && checkType === "declaration" && selectedRow?.match === "applicable" && (
        <EvalDeclarationCaseFields
          key={selectedRow.target_key}
          networkId={networkId}
          row={selectedRow}
          initialDefinition={initialDefinition}
          onPrepared={onPrepared}
        />
      )}
      {!definitionOnly &&
        checkType === "logical_property" &&
        selectedRow &&
        selectedRow.match === "applicable" && (
          <EvalLogicalPropertyCaseFields
            key={selectedRow.target_key}
            networkId={networkId}
            row={selectedRow}
            initialDefinition={initialDefinition}
            onPrepared={onPrepared}
          />
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
              ? selectedReason
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
        selectedRow?.match === "applicable" && (
          <Button
            onClick={() => {
              onPrepared(selectedRow.ready_for_save ? selectedRow.prepared_definition : undefined);
              setRecordDefinition(false);
            }}
          >
            {definitionText("configureExecution")}
          </Button>
        )}
      {!definitionOnly &&
        selectedRule &&
        selectedRow &&
        !busy &&
        !error &&
        !selectedRow.ready_for_save &&
        !(needsSamples && selectedRow.match === "applicable") &&
        checkType !== "logical_property" &&
        checkType !== "declaration" && (
          <Alert
            type="info"
            message={t("knowledgeNetwork.eval.objectRuleUi.targetNotReady", {
              target:
                kind === "objectProperty"
                  ? propertyNames.get(propertyFieldName(selectedRow)) ||
                    propertyFieldName(selectedRow)
                  : resource.name,
            })}
            description={
              <>
                <div>{selectedReason}</div>
                {selectedRow.match === "not_applicable" && selectedRule.appliesWhen && (
                  <div>
                    {t("knowledgeNetwork.eval.objectRuleUi.applicability", {
                      condition: selectedRule.appliesWhen,
                    })}
                  </div>
                )}
              </>
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
      {!definitionOnly && needsSamples && ruleId && selectedRow?.match === "applicable" && (
        <Space direction="vertical" style={{ width: "100%" }}>
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
          {needsProgram ? (
            <>
              <label style={{ display: "block", width: "100%" }}>
                <EvalFieldLabel hint={text("businessHelp")}>
                  {text("standardVersion")}
                </EvalFieldLabel>
                <Input
                  aria-label={text("standardVersion")}
                  value={standardVersion}
                  onChange={(e) => editSample(setStandardVersion, e.target.value)}
                />
              </label>
              <EvalRuleProgramFields
                kind="objectType"
                value={businessProgram}
                onChange={(value) => {
                  generation.current++;
                  setBusy(false);
                  setBusinessProgram(value);
                  setError("");
                  onPrepared(undefined);
                }}
              />
            </>
          ) : (
            <label style={{ display: "block", width: "100%" }}>
              <EvalFieldLabel
                hint={text(checkType === "mapped_values" ? "mappingHelp" : "sampleHelp")}
              >
                {text("rows")}
              </EvalFieldLabel>
              <Input.TextArea
                aria-label={text("rows")}
                rows={4}
                value={sampleRows}
                onChange={(e) => editSample(setSampleRows, e.target.value)}
              />
            </label>
          )}
          <label style={{ display: "block", width: "100%" }}>
            {text(needsProgram ? "standardRefs" : "refs")}
            <Input.TextArea
              aria-label={text(needsProgram ? "standardRefs" : "refs")}
              rows={2}
              value={sampleRefs}
              onChange={(e) => editSample(setSampleRefs, e.target.value)}
            />
          </label>
          <Typography.Text type="secondary">
            {text(needsProgram ? "standardRequired" : "sampleRequired")}
          </Typography.Text>
          <Button
            loading={busy}
            disabled={
              !target ||
              (needsProgram ? !standardVersion.trim() || !sampleRefs.trim() : !sampleRows.trim())
            }
            onClick={() => void prepareSample()}
          >
            {text(needsProgram ? "prepareBusiness" : "prepare")}
          </Button>
        </Space>
      )}
      {!busy && ruleId && !rows.length && !error && (
        <Typography.Text type="secondary">
          {caseUiText("noMatchingCheckTargetsAreAvailableForThis")}
        </Typography.Text>
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
