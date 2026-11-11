/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { EvalDefinitionOnlyFields } from "./EvalDefinitionOnlyFields";
import { EvalResourceCaseFields } from "./EvalResourceCaseFields";
import { resourceCaseKinds, resourceCaseChecks } from "./rule-check-model";
import { EvalRelationCaseFields } from "./EvalRelationCaseFields";
import type { EvalCaseDefinition } from "./m0-run.service";
import { EvalResourceArguments } from "./EvalResourceArguments";
import { ruleCheckAllowsAll } from "./rule-check-model";

import {
  formatPrecisionSafeJSON,
  transformPrecisionSafeJSONRequest,
} from "@/framework/request/precision-safe-json";
import { validateCaseArguments } from "./case-form-model";
import { evalReferenceLabel } from "./eval-readable-references";
import { EvalPaginatedTable as Table } from "./EvalPaginatedTable";
import { Alert, Button, Drawer, Input, InputNumber, Select, Space, Steps, Tag } from "antd";
import axios from "axios";
import { useCallback, useEffect, useMemo, useRef, useState, type Key } from "react";
import { TablePaginationBar } from "@/framework/ui/common/TablePaginationBar";
import { listEvalCaseResourcesPage, type EvalCaseResource } from "./m0-run.service";
import type { EvalTemplateRule } from "./types";
import { useEvalTranslation } from "./useEvalTranslation";
import { useEvalFeedback } from "./useEvalFeedback";
import {
  previewRuleApplication,
  saveRuleApplication,
  type RuleApplicationPreview,
  type RuleApplicationRow,
  type RuleApplicationSample,
  type RuleApplicationSavedItem,
  type RuleApplicationSeed,
} from "./rule-application.service";
import styles from "./EvalRuleApplicationDrawer.module.css";

type Props = {
  title?: string;
  networkId: string;
  rules: EvalTemplateRule[];
  seed: RuleApplicationSeed;
  onClose: () => void;
  onSaved: () => void;
  onOpenCase: (id: string) => void;
};
const resourceKey = (resource: { kind: string; id: string }) => `${resource.kind}:${resource.id}`;

function SampleEditor({
  rule,
  networkId,
  row,
  onChange,
  onCopy,
  onDirty,
}: {
  networkId: string;
  rule?: EvalTemplateRule;
  row: RuleApplicationRow;
  onChange: (sample: RuleApplicationSample, prepared?: EvalCaseDefinition) => void;
  onCopy: () => void;
  onDirty: (dirty: boolean) => void;
}) {
  const { t } = useEvalTranslation();
  const label = (key: string) => t(`knowledgeNetwork.eval.ruleApplication.${key}`);
  const [sample, setSample] = useState(row.sample);
  const [recordDefinition, setRecordDefinition] = useState(false);
  const [argumentsText, setArgumentsText] = useState(
    formatPrecisionSafeJSON(
      transformPrecisionSafeJSONRequest({
        ...row.sample.arguments,
        ...row.input_contract?.system_arguments,
      }),
    ),
  );
  const [expectedText, setExpectedText] = useState(
    row.sample.expected
      ? formatPrecisionSafeJSON(transformPrecisionSafeJSONRequest(row.sample.expected))
      : "",
  );
  const [error, setError] = useState("");
  const fixedObjectInput =
    row.resource.kind === "objectType" &&
    row.execution === "ready" &&
    row.expected_locked &&
    !Object.keys(row.sample.arguments ?? {}).length;
  const changeSample = (next: RuleApplicationSample) => {
    setSample(next);
    onDirty(true);
  };
  const apply = () => {
    try {
      const args = validateCaseArguments(argumentsText);
      const expected = validateCaseArguments(expectedText);
      onChange({
        ...sample,
        arguments: args,
        expected: expected,
      });
      setError("");
      onDirty(false);
    } catch {
      setError(label("jsonError"));
    }
  };
  if (
    rule &&
    (recordDefinition || (!row.check && row.execution !== "ready") || row.sample.definition_only)
  ) {
    return (
      <DefinitionSampleEditor
        networkId={networkId}
        row={row}
        rule={rule}
        onChange={onChange}
        onCopy={onCopy}
        onDirty={onDirty}
      />
    );
  }
  if (
    rule &&
    row.execution !== "ready" &&
    row.configuration !== "complete" &&
    !recordDefinition &&
    row.match === "not_applicable"
  ) {
    return (
      <Alert
        type="info"
        message={row.match_reason || row.execution_reason}
        action={
          <Button onClick={() => setRecordDefinition(true)}>
            {t("knowledgeNetwork.eval.definitionOnly.configure")}
          </Button>
        }
      />
    );
  }
  if (row.check?.type === "relation_check" && row.input_contract?.relation) {
    return (
      <RelationSampleEditor
        networkId={networkId}
        row={row}
        onChange={onChange}
        onCopy={onCopy}
        onDirty={onDirty}
      />
    );
  }
  if (
    resourceCaseKinds.includes(row.resource.kind) &&
    row.input_contract?.rule_based &&
    resourceCaseChecks.includes(row.check?.type ?? "")
  ) {
    return (
      <ResourceSampleEditor
        networkId={networkId}
        row={row}
        onChange={onChange}
        onCopy={onCopy}
        onDirty={onDirty}
      />
    );
  }
  return (
    <div className={styles.editor}>
      <div className={styles.grid}>
        <div className={styles.full}>
          <label>{label("caseName")}</label>
          <Input
            aria-label={label("caseName")}
            maxLength={255}
            value={sample.title}
            onChange={(e) => changeSample({ ...sample, title: e.target.value })}
          />
        </div>
        <div className={styles.full}>
          <label>{label("question")}</label>
          <Input.TextArea
            rows={3}
            aria-label={label("question")}
            maxLength={4000}
            value={sample.question}
            onChange={(e) => changeSample({ ...sample, question: e.target.value })}
          />
        </div>
        <div className={styles.field}>
          <label>{label("arguments")}</label>
          {fixedObjectInput ? (
            <span>{label("noArguments")}</span>
          ) : row.input_contract ? (
            <EvalResourceArguments
              networkId={networkId}
              kind={row.resource.kind}
              contract={row.input_contract}
              value={argumentsText}
              onChange={(value) => {
                setArgumentsText(value);
                onDirty(true);
              }}
            />
          ) : (
            <Input.TextArea
              aria-label={label("arguments")}
              rows={4}
              value={argumentsText}
              onChange={(e) => {
                setArgumentsText(e.target.value);
                onDirty(true);
              }}
            />
          )}
        </div>
        <div className={styles.field}>
          <label>{label("expected")}</label>
          <Input.TextArea
            disabled={row.expected_locked}
            aria-label={label("expected")}
            rows={4}
            value={expectedText}
            onChange={(e) => {
              setExpectedText(e.target.value);
              onDirty(true);
            }}
          />
        </div>
        <div className={styles.field}>
          <label>{label("scope")}</label>
          <Space>
            <Select
              aria-label={label("scope")}
              value={String(sample.scope.mode)}
              options={
                row.sample.scope.mode === "invocation"
                  ? [{ value: "invocation", label: label("invocation") }]
                  : [
                      { value: "sample", label: label("sampling") },
                      ...((
                        row.check
                          ? ruleCheckAllowsAll(row.check)
                          : ["object-key-completeness", "object-key-uniqueness"].includes(
                              row.rule_id,
                            )
                      )
                        ? [{ value: "all", label: label("allData") }]
                        : []),
                    ]
              }
              onChange={(mode) =>
                changeSample({
                  ...sample,
                  scope: mode === "sample" ? { mode, limit: sample.scope.limit ?? 100 } : { mode },
                })
              }
            />
            {sample.scope.mode === "sample" && (
              <InputNumber
                aria-label={label("sampleRows")}
                precision={0}
                min={1}
                max={1000}
                value={Number(sample.scope.limit)}
                onChange={(limit) =>
                  changeSample({ ...sample, scope: { ...sample.scope, limit: limit ?? 100 } })
                }
              />
            )}
          </Space>
        </div>
        <div className={styles.field}>
          <label>{label("source")}</label>
          <Select
            aria-label={label("source")}
            disabled={row.expected_locked}
            style={{ width: "100%" }}
            value={sample.source_kind}
            options={[
              { value: "declared_contract", label: label("contract") },
              { value: "independent_sample", label: label("independent") },
              { value: "business_expert", label: label("expert") },
            ]}
            onChange={(source_kind) => changeSample({ ...sample, source_kind })}
          />
        </div>
        <div className={`${styles.field} ${styles.full}`}>
          <label>{label("evidence")}</label>
          <Input.TextArea
            aria-label={label("evidence")}
            readOnly={row.expected_locked}
            rows={2}
            value={sample.evidence_refs?.join("\n")}
            onChange={(e) =>
              changeSample({
                ...sample,
                evidence_refs: e.target.value
                  .split("\n")
                  .map((v) => v.trim())
                  .filter(Boolean),
              })
            }
          />
        </div>
      </div>
      {error && <Alert type="error" showIcon message={error} />}
      <Space className={styles.toolbar}>
        <Button type="primary" onClick={apply}>
          {label("applyConfiguration")}
        </Button>
        <Button onClick={onCopy}>{label("newSample")}</Button>
      </Space>
    </div>
  );
}

function RelationSampleEditor({
  networkId,
  row,
  onChange,
  onCopy,
  onDirty,
}: {
  networkId: string;
  row: RuleApplicationRow;
  onChange: (sample: RuleApplicationSample, prepared?: EvalCaseDefinition) => void;
  onCopy: () => void;
  onDirty: (dirty: boolean) => void;
}) {
  const { t } = useEvalTranslation();
  const label = (key: string) => t(`knowledgeNetwork.eval.ruleApplication.${key}`);
  const [title, setTitle] = useState(row.sample.title);
  const [definition, setDefinition] = useState<EvalCaseDefinition>();
  const [preparedSample, setPreparedSample] = useState<RuleApplicationSample>();
  const dirty = useRef(onDirty);
  dirty.current = onDirty;
  const prepare = useCallback((value?: EvalCaseDefinition) => {
    setDefinition(value);
    dirty.current(true);
  }, []);
  const initial = useRef({
    title: row.sample.title,
    category: "relation",
    risk_level: "medium",
    input_spec: { arguments: row.sample.arguments },
    execution_spec: { runner: "resource_query", relation_rule: row.check?.binding },
    expected_spec: row.sample.expected ?? {},
    expected_source: {
      kind: row.sample.source_kind ?? "business_expert",
      evidence_refs: row.sample.evidence_refs ?? [],
    },
    assertions: [],
    diagnostic_spec: {},
  } as EvalCaseDefinition);
  const apply = () => {
    if (!definition || !title.trim()) return;
    onChange(
      {
        ...(preparedSample ?? row.sample),
        title: title.trim(),
        arguments: definition.input_spec.arguments as Record<string, unknown>,
        expected: definition.expected_spec,
        source_kind: definition.expected_source.kind,
        evidence_refs: definition.expected_source.evidence_refs,
      },
      definition,
    );
    onDirty(false);
  };
  return (
    <div className={styles.editor}>
      <label>{label("caseName")}</label>
      <Input
        aria-label={label("caseName")}
        maxLength={255}
        value={title}
        onChange={(event) => {
          setTitle(event.target.value);
          onDirty(true);
        }}
      />
      <EvalRelationCaseFields
        networkId={networkId}
        resource={{ ...row.resource, name: row.resource_name }}
        contract={row.input_contract!.relation!}
        initialDefinition={initial.current}
        applicationRuleId={row.rule_id}
        lockedCheck={row.check?.binding}
        onPrepared={prepare}
        onSamplePrepared={setPreparedSample}
      />
      <Space className={styles.toolbar}>
        <Button type="primary" disabled={!definition || !title.trim()} onClick={apply}>
          {label("applyConfiguration")}
        </Button>
        <Button onClick={onCopy}>{label("newSample")}</Button>
      </Space>
    </div>
  );
}

function ResourceSampleEditor({
  networkId,
  row,
  onChange,
  onCopy,
  onDirty,
}: {
  networkId: string;
  row: RuleApplicationRow;
  onChange: (sample: RuleApplicationSample, prepared?: EvalCaseDefinition) => void;
  onCopy: () => void;
  onDirty: (dirty: boolean) => void;
}) {
  const { t } = useEvalTranslation();
  const label = (key: string) => t(`knowledgeNetwork.eval.ruleApplication.${key}`);
  const [title, setTitle] = useState(row.sample.title);
  const [definition, setDefinition] = useState<EvalCaseDefinition>();
  const dirty = useRef(onDirty);
  dirty.current = onDirty;
  const prepare = useCallback((value?: EvalCaseDefinition) => {
    setDefinition(value);
    dirty.current(true);
  }, []);
  const initial = useRef<EvalCaseDefinition>(
    row.prepared_definition ?? {
      title: row.sample.title,
      category: "fact",
      risk_level: "medium",
      input_spec: { arguments: row.sample.arguments },
      execution_spec: {
        runner: row.resource.kind === "function" ? "direct_capability" : "resource_query",
      },
      expected_spec: row.sample.expected ?? {},
      expected_source: {
        kind: row.sample.source_kind ?? "business_expert",
        evidence_refs: row.sample.evidence_refs ?? [],
      },
      assertions: row.sample.assertions ?? [],
      diagnostic_spec: { template_rule_id: row.rule_id },
    },
  );
  const apply = () => {
    if (!definition || !title.trim()) return;
    onChange(
      {
        ...row.sample,
        definition_only: !!definition.diagnostic_spec.definition_only,
        title: title.trim(),
        arguments: definition.input_spec.arguments as Record<string, unknown>,
        expected: definition.expected_spec,
        source_kind: definition.expected_source.kind,
        evidence_refs: definition.expected_source.evidence_refs,
        ...(row.check?.type === "resource_result"
          ? { assertions: definition.assertions.filter((a) => a.type !== "evidence_complete") }
          : {}),
      },
      definition,
    );
    onDirty(false);
  };
  return (
    <div className={styles.editor}>
      <label>{label("caseName")}</label>
      <Input
        aria-label={label("caseName")}
        value={title}
        maxLength={255}
        onChange={(e) => {
          setTitle(e.target.value);
          onDirty(true);
        }}
      />
      <EvalResourceCaseFields
        networkId={networkId}
        resource={{ ...row.resource, name: row.resource_name }}
        contract={row.input_contract!}
        ruleId={row.rule_id}
        initialDefinition={initial.current}
        onPrepared={prepare}
      />
      <Space className={styles.toolbar}>
        <Button type="primary" disabled={!definition || !title.trim()} onClick={apply}>
          {label("applyConfiguration")}
        </Button>
        <Button onClick={onCopy}>{label("newSample")}</Button>
      </Space>
    </div>
  );
}

function DefinitionSampleEditor({
  networkId,
  row,
  rule,
  onChange,
  onCopy,
  onDirty,
}: {
  networkId: string;
  row: RuleApplicationRow;
  rule: EvalTemplateRule;
  onChange: (sample: RuleApplicationSample, prepared?: EvalCaseDefinition) => void;
  onCopy: () => void;
  onDirty: (dirty: boolean) => void;
}) {
  const { t } = useEvalTranslation();
  const label = (key: string) => t(`knowledgeNetwork.eval.ruleApplication.${key}`);
  const [definition, setDefinition] = useState<EvalCaseDefinition>();
  const [title, setTitle] = useState(row.sample.title);
  const dirty = useRef(onDirty);
  dirty.current = onDirty;
  const prepare = useCallback((value?: EvalCaseDefinition) => {
    setDefinition(value);
    dirty.current(true);
  }, []);
  const resource = useMemo(
    () => ({ ...row.resource, name: row.resource_name }),
    [row.resource, row.resource_name],
  );
  const target = useMemo(
    () => ({ id: row.target_id, name: row.target_name }),
    [row.target_id, row.target_name],
  );
  const initial = useRef(row.prepared_definition);
  return (
    <div className={styles.editor}>
      <label>{label("caseName")}</label>
      <Input
        aria-label={label("caseName")}
        value={title}
        maxLength={255}
        onChange={(e) => {
          setTitle(e.target.value);
          onDirty(true);
        }}
      />
      <EvalDefinitionOnlyFields
        networkId={networkId}
        resource={resource}
        rule={rule}
        target={target}
        reason={row.execution_reason}
        initialDefinition={initial.current}
        onPrepared={prepare}
      />
      <Space className={styles.toolbar}>
        <Button
          type="primary"
          disabled={!definition || !title.trim()}
          onClick={() => {
            if (!definition) return;
            onChange({
              ...row.sample,
              definition_only: true,
              title: title.trim(),
              question: String(definition.input_spec.question),
              arguments: definition.input_spec.arguments as Record<string, unknown>,
              expected: definition.expected_spec,
              assertions: definition.assertions,
              source_kind: definition.expected_source.kind,
              evidence_refs: definition.expected_source.evidence_refs,
            });
            onDirty(false);
          }}
        >
          {label("applyConfiguration")}
        </Button>
        <Button onClick={onCopy}>{label("newSample")}</Button>
      </Space>
    </div>
  );
}

export function EvalRuleApplicationDrawer({
  title,
  networkId,
  rules,
  seed,
  onClose,
  onSaved,
  onOpenCase,
}: Props) {
  const { t } = useEvalTranslation();
  const { message } = useEvalFeedback();
  const label = useCallback(
    (key: string, options?: Record<string, unknown>) =>
      t(`knowledgeNetwork.eval.ruleApplication.${key}`, options),
    [t],
  );
  const [step, setStep] = useState(0);
  const [ruleIds, setRuleIds] = useState(seed.ruleIds);
  const [targets, setTargets] = useState(seed.targets);
  const [resources, setResources] = useState<Record<string, EvalCaseResource>>(() =>
    Object.fromEntries(
      (seed.resources ?? []).map((r) => [
        resourceKey(r),
        { ...r, name: evalReferenceLabel("unnamedResource") },
      ]),
    ),
  );
  const [resourcePage, setResourcePage] = useState(1);
  const [resourceQuery, setResourceQuery] = useState("");
  const [options, setOptions] = useState<EvalCaseResource[]>([]);
  const [resourceTotal, setResourceTotal] = useState(0);
  const [busy, setBusy] = useState(false);
  const [loadingResources, setLoadingResources] = useState(false);
  const [resourceReadWarnings, setResourceReadWarnings] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [preview, setPreview] = useState<RuleApplicationPreview>();
  const [configs, setConfigs] = useState<Record<string, RuleApplicationSample>>({});
  const [selected, setSelected] = useState<Record<string, RuleApplicationSample>>({});
  const [expanded, setExpanded] = useState<Key[]>([]);
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  // Ant Table can retain collapsed editors. Their asynchronous preparation is
  // not an unsaved user edit and must not block a freshly validated preview.
  const hasDirty = expanded.some((key) => dirty[String(key)] === true);
  const [saved, setSaved] = useState<RuleApplicationSavedItem[]>([]);
  const [saveAttempted, setSaveAttempted] = useState(false);
  const [saveRows, setSaveRows] = useState<RuleApplicationRow[]>();
  const targetRefs = useRef<Record<string, { resource_key: string; rule_id: string }>>({});
  const requestSerial = useRef(0);
  const previewRows = useRef<Record<string, RuleApplicationRow>>({});
  const matchingKinds = [
    ...new Set(
      rules
        .filter((r) => ruleIds.includes(r.id))
        .map((r) => (r.kind === "objectProperty" ? "objectType" : r.kind)),
    ),
  ];
  const kind = matchingKinds.length === 1 ? matchingKinds[0] : "";
  const resourceLoadError = label("loadError");
  useEffect(() => {
    let active = true;
    setLoadingResources(true);
    setResourceReadWarnings([]);
    const timer = setTimeout(() => {
      void listEvalCaseResourcesPage(networkId, kind, resourceQuery, resourcePage, 10, true)
        .then((result) => {
          if (active) {
            setOptions(result.entries);
            setResourceTotal(result.total);
            setResourceReadWarnings([
              ...new Set((result.read_issues ?? []).map((issue) => issue.reason)),
            ]);
          }
        })
        .catch(() => {
          if (active) setError(resourceLoadError);
        })
        .finally(() => {
          if (active) setLoadingResources(false);
        });
    }, 200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [networkId, kind, resourceQuery, resourcePage, resourceLoadError]);
  useEffect(
    () => () => {
      requestSerial.current++;
    },
    [],
  );
  const resetSaveResults = () => {
    setSaved([]);
    setSaveAttempted(false);
    setSaveRows(undefined);
    setError("");
  };
  const reconcileSamples = (
    nextResources: Record<string, EvalCaseResource>,
    nextRules: string[],
  ) => {
    requestSerial.current++;
    setBusy(false);
    const retain = (samples: Record<string, RuleApplicationSample>) =>
      Object.fromEntries(
        Object.entries(samples).filter(([, sample]) => {
          const target = targetRefs.current[sample.target_key];
          return target && nextResources[target.resource_key] && nextRules.includes(target.rule_id);
        }),
      );
    setConfigs(retain);
    setSelected(retain);
    resetSaveResults();
  };
  const changeResources = (nextResources: Record<string, EvalCaseResource>) => {
    reconcileSamples(nextResources, ruleIds);
    setTargets(
      (previous) =>
        previous && [
          ...previous.filter((target) => nextResources[target.resource_key]),
          ...Object.keys(nextResources)
            .filter((key) => !resources[key])
            .flatMap((key) => ruleIds.map((rule_id) => ({ resource_key: key, rule_id }))),
        ],
    );
    setResources(nextResources);
  };
  const request = (onlySelected: boolean, targetPage = 1) => ({
    resources: Object.values(resources).map(({ kind, id }) => ({ kind, id })),
    rule_ids: ruleIds,
    targets,
    samples: Object.values(onlySelected ? selected : configs),
    page: targetPage,
    limit: onlySelected ? 50 : 10,
    q: onlySelected ? undefined : query,
    only_samples: onlySelected,
  });
  const loadPreview = async (targetPage = 1) => {
    const serial = ++requestSerial.current;
    setBusy(true);
    setError("");
    try {
      const result = await previewRuleApplication(networkId, request(false, targetPage));
      if (serial !== requestSerial.current) return;
      for (const row of result.entries) {
        previewRows.current[row.target_key] = row;
        targetRefs.current[row.target_key] = {
          resource_key: resourceKey(row.resource),
          rule_id: row.rule_id,
        };
      }
      setPreview(result);
      setStep(1);
      setPage(targetPage);
      setExpanded([]);
      setDirty({});
      resetSaveResults();
    } catch (cause) {
      if (serial === requestSerial.current)
        setError(
          axios.isAxiosError(cause) && cause.response?.status === 409
            ? label("changed")
            : label("previewError"),
        );
    } finally {
      if (serial === requestSerial.current) setBusy(false);
    }
  };
  const updateSample = (
    row: RuleApplicationRow,
    sample: RuleApplicationSample,
    prepared?: EvalCaseDefinition,
  ) => {
    setConfigs((old) => ({ ...old, [row.key]: sample }));
    setSelected((old) => ({ ...old, [row.key]: sample }));
    setPreview((old) =>
      old
        ? {
            ...old,
            entries: old.entries.map((r) =>
              r.key === row.key
                ? {
                    ...r,
                    sample,
                    configuration: prepared ? "complete" : "incomplete",
                    missing: prepared ? [] : [label("needsValidation")],
                    ...(prepared
                      ? {
                          prepared_definition: prepared,
                          ready_for_save: true,
                          execution:
                            prepared.execution_spec.runner === "unbound" ? "unsupported" : "ready",
                          execution_reason: "",
                        }
                      : {}),
                  }
                : r,
            ),
          }
        : old,
    );
    message.success(label("configurationApplied"));
  };
  const save = async () => {
    if (busy || hasDirty) return;
    const previousResults = new Map(saved.map((item) => [item.key, item]));
    const samples = Object.entries(selected)
      .filter(([key]) => {
        const previous = previousResults.get(key);
        return !previous || ["failed", "pending", "unconfirmed"].includes(previous.status);
      })
      .map(([, sample]) => sample);
    if (!samples.length) return;
    setBusy(true);
    setError("");
    setSaveAttempted(true);
    setSaveRows(
      Object.values(selected).flatMap((sample) => {
        const row = previewRows.current[sample.target_key];
        return row ? [{ ...row, key: `${sample.target_key}:${sample.sample_id}`, sample }] : [];
      }),
    );
    let savedAny = false;
    try {
      const payload = { ...request(true), samples };
      // Configuration was already previewed. Save validates the same frozen
      // checksums server-side, without a second full resource preflight here.
      const mergeReceipts = (receipts: RuleApplicationSavedItem[]) => {
        savedAny ||= receipts.some((item) => item.status === "created" || item.status === "reused");
        setSaved((previous) => {
          const merged = new Map(previous.map((item) => [item.key, item]));
          for (const item of receipts) merged.set(item.key, item);
          return [...merged.values()];
        });
      };
      const result = await saveRuleApplication(networkId, payload, mergeReceipts);
      mergeReceipts(result);
    } catch (cause) {
      setError(
        axios.isAxiosError(cause) && cause.response?.status === 409
          ? label("changed")
          : label("saveError"),
      );
    } finally {
      if (savedAny) onSaved();
      setBusy(false);
    }
  };
  const rows = saveRows ?? preview?.entries ?? [];
  const unsupportedSelected = rows.some(
    (row) => selected[row.key] && row.execution !== "ready" && !selected[row.key].definition_only,
  );
  const showingResults = Boolean(saveRows);
  const selectedCount = Object.keys(selected).length;
  const results = new Map(saved.map((item) => [item.key, item]));
  const successful = saved.filter(
    (item) => selected[item.key] && (item.status === "created" || item.status === "reused"),
  );
  const allSaved = selectedCount > 0 && successful.length === selectedCount;
  const retryableCount = Object.keys(selected).filter((key) => {
    const result = results.get(key);
    return !result || ["failed", "pending", "unconfirmed"].includes(result.status);
  }).length;
  const returnToConfiguration = () => {
    resetSaveResults();
    void loadPreview(page);
  };
  return (
    <Drawer
      title={title ?? label("title")}
      open
      width="min(1120px, 96vw)"
      onClose={busy ? undefined : onClose}
      maskClosable={!busy}
      footer={
        <div className={styles.footer}>
          <Button
            disabled={busy || step === 0 || hasDirty}
            style={
              saveAttempted && retryableCount === 0 && !allSaved
                ? { visibility: "hidden" }
                : undefined
            }
            onClick={() => {
              if (saveAttempted) returnToConfiguration();
              else {
                setStep(0);
                resetSaveResults();
              }
            }}
          >
            {label(saveAttempted ? "modify" : "previous")}
          </Button>
          <Space>
            {!allSaved && (
              <Button disabled={busy} onClick={onClose}>
                {label("close")}
              </Button>
            )}
            {step === 0 ? (
              <Button
                type="primary"
                loading={busy}
                disabled={!Object.keys(resources).length || !ruleIds.length}
                onClick={() => void loadPreview()}
              >
                {label("next")}
              </Button>
            ) : allSaved ? (
              <Button type="primary" onClick={onClose}>
                {label("done")}
              </Button>
            ) : saveAttempted && retryableCount === 0 ? (
              <Button type="primary" onClick={returnToConfiguration}>
                {label("modify")}
              </Button>
            ) : (
              <Button
                type="primary"
                loading={busy}
                disabled={!selectedCount || selectedCount > 50 || hasDirty || unsupportedSelected}
                onClick={() => void save()}
              >
                {saveAttempted ? label("retry") : label("save")}
              </Button>
            )}
          </Space>
        </div>
      }
    >
      <Steps
        className={styles.steps}
        size="small"
        current={step}
        items={[{ title: label("selectScope") }, { title: label("configureAndSave") }]}
      />
      {error && <Alert type="error" showIcon message={error} />}
      {step === 1 && unsupportedSelected && !showingResults && (
        <Alert
          type="warning"
          showIcon
          message={t("knowledgeNetwork.eval.definitionOnly.selectedPending")}
        />
      )}
      {step === 0 && resourceReadWarnings.length > 0 && (
        <Alert type="warning" showIcon message={resourceReadWarnings.join("；")} />
      )}
      {step === 1 && saved.length > 0 && (
        <Alert
          type={allSaved ? "success" : "warning"}
          showIcon
          message={label(allSaved ? "savedSummary" : "partialSummary", {
            created: saved.filter((item) => item.status === "created").length,
            reused: saved.filter((item) => item.status === "reused").length,
            remaining: selectedCount - successful.length,
            failed: saved.filter((item) => ["failed", "invalid", "conflict"].includes(item.status))
              .length,
            pending: saved.filter((item) => ["pending", "unconfirmed"].includes(item.status))
              .length,
          })}
          description={allSaved ? label("reusedHelp") : label("partialHelp")}
        />
      )}
      {step === 0 ? (
        <>
          <div className={styles.field}>
            <label>{label("rules")}</label>
            <Select
              aria-label={label("rules")}
              showSearch
              optionFilterProp="label"
              mode="multiple"
              disabled={busy}
              style={{ width: "100%" }}
              value={ruleIds}
              onChange={(ids) => {
                const kinds = new Set<string>(
                  rules
                    .filter((rule) => ids.includes(rule.id))
                    .map((rule) => (rule.kind === "objectProperty" ? "objectType" : rule.kind)),
                );
                const nextResources = Object.fromEntries(
                  Object.entries(resources).filter(([, resource]) => kinds.has(resource.kind)),
                );
                setRuleIds(ids);
                setResources(nextResources);
                setTargets(undefined);
                setResourcePage(1);
                reconcileSamples(nextResources, ids);
              }}
              options={rules.filter((r) => r.enabled).map((r) => ({ value: r.id, label: r.title }))}
            />
          </div>
          <div className={styles.toolbar}>
            <Input.Search
              aria-label={label("resourceSearch")}
              placeholder={label("resourceSearch")}
              value={resourceQuery}
              onChange={(e) => {
                setResourceQuery(e.target.value);
                setResourcePage(1);
              }}
            />
            <span>{label("selectedResources", { count: Object.keys(resources).length })}</span>
          </div>
          <Table<EvalCaseResource>
            scroll={{ x: 600 }}
            rowKey={resourceKey}
            loading={loadingResources}
            dataSource={options}
            pagination={false}
            rowSelection={{
              preserveSelectedRowKeys: true,
              selectedRowKeys: Object.keys(resources),
              onSelect: (r, checked) => {
                const next = { ...resources };
                if (checked) next[resourceKey(r)] = r;
                else delete next[resourceKey(r)];
                changeResources(next);
              },
              onSelectAll: (checked, _all, changed) => {
                const next = { ...resources };
                for (const r of changed) {
                  if (checked) next[resourceKey(r)] = r;
                  else delete next[resourceKey(r)];
                }
                changeResources(next);
              },
              getCheckboxProps: (r) => ({
                disabled:
                  busy || (!resources[resourceKey(r)] && Object.keys(resources).length >= 200),
              }),
            }}
            columns={[
              { title: label("resource"), dataIndex: "name", ellipsis: true },
              {
                title: label("resourceType"),
                width: 160,
                render: (_, r) => t(`knowledgeNetwork.eval.templateUi.kinds.${r.kind}`),
              },
            ]}
          />
          <TablePaginationBar
            current={resourcePage}
            pageSize={10}
            total={resourceTotal}
            showSizeChanger={false}
            onChange={setResourcePage}
          />
        </>
      ) : (
        <>
          <div className={styles.summary}>
            <Tag>{label("selectedSamples", { count: selectedCount })}</Tag>
            <Tag>{label("draftOnly")}</Tag>
          </div>
          {step === 1 && !showingResults && (
            <div className={styles.toolbar}>
              <Input.Search
                aria-label={label("targetSearch")}
                placeholder={label("targetSearch")}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onSearch={() => {
                  if (!hasDirty) void loadPreview(1);
                }}
              />
              <Button loading={busy} disabled={hasDirty} onClick={() => void loadPreview(page)}>
                {label("refreshPreview")}
              </Button>
            </div>
          )}
          <Table<RuleApplicationRow>
            rowKey="key"
            loading={busy}
            dataSource={rows}
            pagination={false}
            scroll={{ x: 1100 }}
            rowSelection={
              !showingResults
                ? {
                    preserveSelectedRowKeys: true,
                    selectedRowKeys: Object.keys(selected),
                    onSelect: (row, checked) =>
                      setSelected((old) => {
                        const next = { ...old };
                        if (checked) next[row.key] = configs[row.key] ?? row.sample;
                        else delete next[row.key];
                        return next;
                      }),
                    onSelectAll: (checked, _all, changed) =>
                      setSelected((old) => {
                        const next = { ...old };
                        for (const row of changed) {
                          if (checked) next[row.key] = configs[row.key] ?? row.sample;
                          else delete next[row.key];
                        }
                        return next;
                      }),
                    getCheckboxProps: (row) => ({
                      disabled:
                        busy ||
                        (row.match !== "applicable" &&
                          !(
                            row.match === "not_applicable" &&
                            (!row.check || row.sample.definition_only)
                          )) ||
                        (!selected[row.key] && selectedCount >= 50),
                    }),
                  }
                : undefined
            }
            expandable={
              !showingResults
                ? {
                    expandedRowKeys: expanded,
                    onExpandedRowsChange: (keys) => {
                      if (!hasDirty) setExpanded([...keys]);
                    },
                    rowExpandable: (row) =>
                      (row.match === "applicable" || row.match === "not_applicable") &&
                      (Boolean(selected[row.key]) || selectedCount < 50),
                    expandedRowRender: (row) => (
                      <SampleEditor
                        networkId={networkId}
                        rule={rules.find((rule) => rule.id === row.rule_id)}
                        key={row.key + row.rule_checksum}
                        row={row}
                        onDirty={(value) => setDirty((old) => ({ ...old, [row.key]: value }))}
                        onChange={(sample, prepared) => updateSample(row, sample, prepared)}
                        onCopy={() => {
                          if (
                            hasDirty ||
                            selectedCount >= 50 ||
                            Object.keys(configs).length >= 200
                          ) {
                            message.warning(label("sampleLimit"));
                            return;
                          }
                          const sample = {
                            ...(configs[row.key] ?? row.sample),
                            sample_id: crypto.randomUUID(),
                            title: `${row.sample.title} · ${label("sample")}`,
                          };
                          setConfigs((old) => ({
                            ...old,
                            [row.key]: old[row.key] ?? row.sample,
                            [`${sample.target_key}:${sample.sample_id}`]: sample,
                          }));
                          setSelected((old) => ({
                            ...old,
                            [`${sample.target_key}:${sample.sample_id}`]: sample,
                          }));
                          message.success(label("sampleAdded"));
                        }}
                      />
                    ),
                  }
                : undefined
            }
            columns={[
              { title: label("target"), dataIndex: "target_name", width: 180, ellipsis: true },
              {
                title: label("rule"),
                width: 180,
                render: (_, row) => row.rule_title,
              },
              {
                title: label("configuration"),
                width: 220,
                render: (_, row) => (
                  <>
                    <Tag color={row.configuration === "complete" ? "success" : undefined}>
                      {row.match !== "applicable" ? label(row.match) : label(row.configuration)}
                    </Tag>
                    <div>
                      {row.match !== "applicable" ? row.match_reason : row.missing.join("；")}
                    </div>
                  </>
                ),
              },
              {
                title: label("existing"),
                width: 150,
                render: (_, row) => {
                  const result = results.get(row.key);
                  return result ? (
                    <>
                      <Tag
                        color={
                          result.status === "created" || result.status === "reused"
                            ? "success"
                            : "warning"
                        }
                      >
                        {label(result.status)}
                      </Tag>
                      {result.reason && <div>{result.reason}</div>}
                      {result.case_id && (
                        <Button type="link" onClick={() => onOpenCase(result.case_id!)}>
                          {label("details")}
                        </Button>
                      )}
                    </>
                  ) : row.existing_case_id ? (
                    <>
                      <Tag color={row.existing_status === "conflict" ? "warning" : undefined}>
                        {label(
                          row.existing_status === "conflict"
                            ? "existingChanged"
                            : "existingEquivalent",
                        )}
                      </Tag>
                      {row.existing_reason && <div>{row.existing_reason}</div>}
                      <Button type="link" onClick={() => onOpenCase(row.existing_case_id!)}>
                        {label("details")}
                      </Button>
                    </>
                  ) : (
                    "—"
                  );
                },
              },
            ]}
          />
          {step === 1 && !showingResults && (
            <TablePaginationBar
              current={page}
              pageSize={10}
              total={preview?.total ?? 0}
              showSizeChanger={false}
              onChange={(value) => {
                if (!hasDirty) void loadPreview(value);
              }}
            />
          )}
        </>
      )}
    </Drawer>
  );
}
