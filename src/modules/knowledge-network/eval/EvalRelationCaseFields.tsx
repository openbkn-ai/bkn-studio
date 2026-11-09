/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { evalScalarText } from "./eval-scalar-text";

import {
  Alert,
  Button,
  Collapse,
  Descriptions,
  Input,
  InputNumber,
  Select,
  Space,
  Spin,
  Typography,
} from "antd";
import { useEffect, useRef, useState } from "react";
import {
  getCaseTargetSchema,
  listRelationCheckInstances,
  type RelationCheckForm,
  type RelationCheckInput,
  type RelationEndpoint,
} from "./case-form.service";
import type { EvalCaseDefinition, EvalCaseResource } from "./m0-run.service";
import {
  previewRuleApplication,
  type RuleApplicationRow,
  type RuleApplicationSample,
} from "./rule-application.service";
import { transformPrecisionSafeJSONRequest } from "@/framework/request/precision-safe-json";
import { useEvalTranslation } from "./useEvalTranslation";
import { getRuntimeConfig } from "@/framework/runtime/config";
import styles from "./EvalCaseEditorDrawer.module.css";

const cardinalityLabelKeys: Partial<Record<string, string>> = {
  one_to_one: "oneToOne",
  one_to_many: "oneToMany",
  many_to_one: "manyToOne",
  many_to_many: "manyToMany",
};

function InstanceSelect({
  networkId,
  endpoint,
  value,
  onChange,
  label,
}: {
  networkId: string;
  endpoint: RelationEndpoint;
  value?: Record<string, unknown>;
  onChange: (value?: Record<string, unknown>) => void;
  label: string;
}) {
  const { t } = useEvalTranslation();
  const text = (key: string) => t(`knowledgeNetwork.eval.relationChecks.${key}`);
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [cursor, setCursor] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const generation = useRef(0);
  useEffect(() => {
    let active = true;
    const requestGeneration = ++generation.current;
    setRows([]);
    setCursor(undefined);
    setError(false);
    setBusy(true);
    const timer = window.setTimeout(
      () => {
        void listRelationCheckInstances(networkId, endpoint, query)
          .then((page) => {
            if (active) {
              setRows(page.rows);
              setCursor(page.nextCursor);
            }
          })
          .catch(() => {
            if (active) setError(true);
          })
          .finally(() => {
            if (active) setBusy(false);
          });
      },
      query ? 250 : 0,
    );
    return () => {
      window.clearTimeout(timer);
      active = false;
      generation.current = requestGeneration + 1;
    };
  }, [networkId, endpoint, query, retry]);
  const loadMore = async () => {
    if (!cursor || busy) return;
    const scope = generation.current;
    setBusy(true);
    setError(false);
    try {
      const page = await listRelationCheckInstances(networkId, endpoint, query, cursor);
      if (scope === generation.current) {
        setRows((old) => [...old, ...page.rows]);
        setCursor(page.nextCursor);
      }
    } catch {
      if (scope === generation.current) setError(true);
    } finally {
      if (scope === generation.current) setBusy(false);
    }
  };
  const options = [
    ...new Map(
      rows.flatMap((row) => {
        const identity =
          row._instance_identity && typeof row._instance_identity === "object"
            ? (row._instance_identity as Record<string, unknown>)
            : Object.fromEntries(endpoint.primary_keys.map((key) => [key, row[key]]));
        if (
          endpoint.primary_keys.some((key) => identity[key] === undefined || identity[key] === null)
        )
          return [];
        const value = transformPrecisionSafeJSONRequest(identity);
        const name = row._display ?? row.name ?? row.title;
        return [
          [
            value,
            {
              value,
              label:
                name === undefined || name === null ? value : `${evalScalarText(name)} · ${value}`,
              identity,
            },
          ] as const,
        ];
      }),
    ).values(),
  ];
  const selected = value ? transformPrecisionSafeJSONRequest(value) : undefined;
  if (selected && !options.some((o) => o.value === selected))
    options.unshift({ value: selected, label: selected, identity: value! });
  return (
    <div>
      <div className={styles.fieldLabel}>{label} *</div>
      <Select
        aria-label={label}
        style={{ width: "100%" }}
        showSearch
        allowClear
        filterOption={false}
        onSearch={setQuery}
        loading={busy}
        value={selected}
        placeholder={text("instancePlaceholder")}
        options={options}
        onChange={(key) => onChange(options.find((option) => option.value === key)?.identity)}
        popupRender={(menu) => (
          <>
            {menu}
            {cursor && (
              <Button
                type="text"
                block
                loading={busy}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => void loadMore()}
              >
                {text("loadMore")}
              </Button>
            )}
          </>
        )}
      />
      {error && (
        <Alert
          type="error"
          message={text("instanceError")}
          action={<Button onClick={() => setRetry((n) => n + 1)}>{text("retry")}</Button>}
        />
      )}
    </div>
  );
}

export function EvalRelationCaseFields({
  networkId,
  resource,
  contract: providedContract,
  initialDefinition,
  onPrepared,
  onSamplePrepared,
  applicationRuleId,
  lockedCheck,
}: {
  networkId: string;
  resource: EvalCaseResource;
  contract: RelationCheckForm;
  applicationRuleId?: string;
  lockedCheck?: string;
  initialDefinition?: EvalCaseDefinition;
  onPrepared: (definition?: EvalCaseDefinition) => void;
  onSamplePrepared?: (sample: RuleApplicationSample) => void;
}) {
  const { t } = useEvalTranslation();
  const text = (key: string) => t(`knowledgeNetwork.eval.relationChecks.${key}`);
  const [contract, setContract] = useState(providedContract);
  const [reloading, setReloading] = useState(false);
  const [contractError, setContractError] = useState(false);
  const reloadActive = useRef(true);
  useEffect(() => {
    setContract(providedContract);
    setContractError(false);
  }, [providedContract]);
  useEffect(() => {
    reloadActive.current = true;
    return () => {
      reloadActive.current = false;
    };
  }, []);
  const initial = initialDefinition?.input_spec.arguments as
    { relation_check?: RelationCheckInput } | undefined;
  const [input, setInput] = useState<RelationCheckInput>(initial?.relation_check ?? { rule: "" });
  const initialExpected = initialDefinition?.expected_spec.related;
  const [expected, setExpected] = useState<boolean | undefined>(
    typeof initialExpected === "boolean" ? initialExpected : undefined,
  );
  const [reference, setReference] = useState(
    String(initialDefinition?.expected_source.evidence_refs?.join("\n") ?? ""),
  );
  const [base, setBase] = useState<RuleApplicationRow>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const pair = ["relation-result", "relation-direction", "relation-characteristics"].includes(
    input.rule,
  );
  const sampled = [
    "relation-cardinality",
    "relation-required",
    "relation-integrity",
    "relation-property-values",
  ].includes(input.rule);
  const request = {
    resources: [{ kind: resource.kind, id: resource.id }],
    rule_ids: [applicationRuleId ?? input.rule],
    page: 1,
    limit: 1,
  };
  useEffect(() => {
    let active = true;
    setBase(undefined);
    onPrepared(undefined);
    setError("");
    if (!input.rule || reloading || contractError) {
      setBusy(false);
      return;
    }
    setBusy(true);
    previewRuleApplication(networkId, request)
      .then((preview) => {
        if (active) setBase(preview.entries[0]);
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
    // Configuration changes are submitted by the second, debounced preview.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    networkId,
    resource.kind,
    resource.id,
    input.rule,
    applicationRuleId,
    retry,
    onPrepared,
    reloading,
    contractError,
  ]);
  useEffect(() => {
    let active = true;
    onPrepared(undefined);
    if (
      !base ||
      base.match !== "applicable" ||
      reloading ||
      contractError ||
      !contract.checks.some((check) => check.id === input.rule && check.applicable)
    )
      return;
    if (
      pair &&
      (!input.source ||
        !input.target ||
        expected === undefined ||
        !reference.trim() ||
        (input.characteristic === "transitive" && !input.via))
    )
      return;
    if (sampled && (!input.limit || input.limit < 1 || input.limit > 1000)) return;
    setBusy(true);
    setError("");
    const timer = window.setTimeout(() => {
      void previewRuleApplication(networkId, {
        ...request,
        samples: [
          {
            ...base.sample,
            arguments: { relation_check: input },
            scope: { mode: "invocation" },
            ...(pair
              ? {
                  expected:
                    input.rule === "relation-direction"
                      ? { related: expected, reverse_related: expected }
                      : { related: expected },
                  source_kind: "business_expert" as const,
                  evidence_refs: reference
                    .trim()
                    .split("\n")
                    .map((s) => s.trim())
                    .filter(Boolean),
                }
              : {}),
          },
        ],
      })
        .then((preview) => {
          if (!active) return;
          const row = preview.entries[0];
          if (row?.ready_for_save && row.prepared_definition) {
            onPrepared(row.prepared_definition);
            onSamplePrepared?.(row.sample);
          } else
            setError(
              row?.missing.join("；") || row?.save_error || row?.match_reason || text("incomplete"),
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
      setBusy(false);
    };
    // Request identity is derived from the complete typed configuration.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    networkId,
    base,
    input,
    expected,
    reference,
    retry,
    onPrepared,
    reloading,
    contractError,
    contract,
    onSamplePrepared,
  ]);
  const changeRule = (rule: string) => {
    const end =
      (rule === "relation-cardinality" && contract.cardinality === "one_to_many") ||
      (rule === "relation-required" && !contract.required.includes("source"))
        ? "target"
        : "source";
    setInput({
      rule,
      ...([
        "relation-cardinality",
        "relation-required",
        "relation-integrity",
        "relation-property-values",
      ].includes(rule)
        ? { limit: 100 }
        : {}),
      ...(["relation-cardinality", "relation-required"].includes(rule) ? { end } : {}),
      ...(rule === "relation-characteristics"
        ? { characteristic: contract.characteristics[0] }
        : {}),
    });
    setExpected(undefined);
    setReference("");
    onPrepared(undefined);
  };
  const selectedRule = contract.checks.find((check) => check.id === input.rule);
  const fieldsApplicable = selectedRule?.applicable !== false;
  const unavailable = contract.checks.filter((check) => !check.applicable);
  const editPath = `${getRuntimeConfig().router.basename.replace(/\/$/, "")}/knowledge-network/workspace/${encodeURIComponent(networkId)}/relation-types/${encodeURIComponent(resource.id)}/edit`;
  const reload = async () => {
    onPrepared(undefined);
    setBase(undefined);
    setReloading(true);
    setContractError(false);
    setError("");
    try {
      const next = await getCaseTargetSchema(resource, networkId);
      if (!reloadActive.current) return;
      if (!next.relation) throw Error("relation contract unavailable");
      setContract(next.relation);
      setRetry((n) => n + 1);
    } catch {
      if (reloadActive.current) {
        setContractError(true);
        setError(text("previewError"));
      }
    } finally {
      if (reloadActive.current) setReloading(false);
    }
  };

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <Typography.Text>
        {text("direction")}：{contract.source.name} → {contract.target.name} · {text(contract.type)}
      </Typography.Text>
      <div style={{ minWidth: 0, overflowWrap: "anywhere" }}>
        <Space wrap style={{ justifyContent: "space-between", width: "100%" }}>
          <Typography.Text strong>{text("declared")}</Typography.Text>
          <Space>
            <Typography.Link href={editPath} target="_blank" rel="noopener noreferrer">
              {text("configure")}
            </Typography.Link>
            <Button type="link" size="small" loading={reloading} onClick={() => void reload()}>
              {text("refreshContract")}
            </Button>
          </Space>
        </Space>
        {contract.cardinality ||
        contract.required.length ||
        contract.characteristics.length ||
        contract.properties.length ? (
          <Descriptions
            size="small"
            column={1}
            items={[
              {
                key: "cardinality",
                label: text("countLimit"),
                children: text(cardinalityLabelKeys[contract.cardinality ?? ""] ?? "notDeclared"),
              },
              {
                key: "required",
                label: text("requiredAssociation"),
                children: contract.required.length
                  ? contract.required
                      .map(
                        (end) =>
                          `${text(end === "source" ? "sourceEnd" : "targetEnd")} · ${contract[end as "source" | "target"].name}`,
                      )
                      .join("、")
                  : text("notDeclared"),
              },
              {
                key: "features",
                label: text("characteristic"),
                children: contract.characteristics.length
                  ? contract.characteristics.map((c) => text(c)).join("、")
                  : text("notDeclared"),
              },
              {
                key: "properties",
                label: text("property"),
                children: (
                  <Typography.Paragraph style={{ margin: 0 }} ellipsis={{ rows: 2, tooltip: true }}>
                    {contract.properties.map((p) => p.name).join("、")}
                  </Typography.Paragraph>
                ),
              },
            ].filter((item) =>
              item.key === "cardinality"
                ? !!contract.cardinality
                : item.key === "required"
                  ? !!contract.required.length
                  : item.key === "features"
                    ? !!contract.characteristics.length
                    : !!contract.properties.length,
            )}
          />
        ) : (
          <Typography.Text type="secondary">{text("noExtraDeclarations")}</Typography.Text>
        )}
      </div>
      <div>
        <div className={styles.fieldLabel}>{text("check")} *</div>
        <Select
          aria-label={text("check")}
          disabled={!!lockedCheck}
          style={{ width: "100%" }}
          value={input.rule || undefined}
          placeholder={text("chooseCheck")}
          options={contract.checks
            .filter((check) => check.applicable || check.id === input.rule)
            .map((check) => ({
              value: check.id,
              label: check.title,
              disabled: !check.applicable,
              title: check.reason,
            }))}
          onChange={changeRule}
        />
      </div>
      {!!unavailable.length && (
        <Collapse
          size="small"
          items={[
            {
              key: "unavailable",
              label: t("knowledgeNetwork.eval.relationChecks.inapplicable", {
                count: unavailable.length,
              }),
              children: (
                <Space direction="vertical" style={{ width: "100%" }}>
                  <Typography.Text type="secondary">{text("inapplicableHelp")}</Typography.Text>
                  {unavailable.map((check) => (
                    <div key={check.id}>
                      <Typography.Text strong>{check.title}</Typography.Text>
                      <div>
                        <Typography.Text type="secondary">{check.reason}</Typography.Text>
                      </div>
                    </div>
                  ))}
                </Space>
              ),
            },
          ]}
        />
      )}
      {selectedRule && !selectedRule.applicable && (
        <Alert type="warning" message={selectedRule.reason} />
      )}
      {fieldsApplicable && input.rule === "relation-characteristics" && (
        <div>
          <div className={styles.fieldLabel}>{text("characteristic")} *</div>
          <Select
            aria-label={text("characteristic")}
            style={{ width: "100%" }}
            value={input.characteristic}
            options={contract.characteristics.map((v) => ({ value: v, label: text(v) }))}
            onChange={(value) =>
              setInput((old) => ({ ...old, characteristic: value, via: undefined }))
            }
          />
          <Typography.Text type="secondary">{text("featureHelp")}</Typography.Text>
        </div>
      )}
      {pair && fieldsApplicable && (
        <>
          <div className={styles.criteriaValues}>
            <InstanceSelect
              networkId={networkId}
              endpoint={contract.source}
              value={input.source}
              label={`${text("source")} · ${contract.source.name}`}
              onChange={(source) => setInput((old) => ({ ...old, source }))}
            />
            <InstanceSelect
              networkId={networkId}
              endpoint={contract.target}
              value={input.target}
              label={`${text("target")} · ${contract.target.name}`}
              onChange={(target) => setInput((old) => ({ ...old, target }))}
            />
          </div>
          {input.characteristic === "transitive" && (
            <InstanceSelect
              networkId={networkId}
              endpoint={contract.source}
              value={input.via}
              label={text("via")}
              onChange={(via) => setInput((old) => ({ ...old, via }))}
            />
          )}
          <div>
            <div className={styles.fieldLabel}>{text("expected")} *</div>
            <Select
              aria-label={text("expected")}
              style={{ width: "100%" }}
              value={expected === undefined ? undefined : expected ? "yes" : "no"}
              placeholder={text("expectedHelp")}
              options={[
                { value: "yes", label: text("positive") },
                { value: "no", label: text("negative") },
              ]}
              onChange={(value) => setExpected(value === "yes")}
            />
          </div>
          <Typography.Text type="secondary">
            {text(input.rule === "relation-direction" ? "directionHelp" : "pairHelp")}
          </Typography.Text>
          <div>
            <div className={styles.fieldLabel}>{text("reference")} *</div>
            <Input.TextArea
              aria-label={text("reference")}
              rows={2}
              maxLength={2000}
              value={reference}
              placeholder={text("referencePlaceholder")}
              onChange={(e) => setReference(e.target.value)}
            />
            <Typography.Text type="secondary">{text("referenceHelp")}</Typography.Text>
          </div>
        </>
      )}
      {sampled && fieldsApplicable && (
        <div className={styles.criteriaValues}>
          {["relation-cardinality", "relation-required"].includes(input.rule) && (
            <div>
              <div className={styles.fieldLabel}>{text("checkEnd")} *</div>
              <Select
                aria-label={text("checkEnd")}
                style={{ width: "100%" }}
                value={input.end}
                options={["source", "target"]
                  .filter((end) =>
                    input.rule === "relation-required"
                      ? contract.required.includes(end)
                      : contract.cardinality === "one_to_one" ||
                        (contract.cardinality === "many_to_one"
                          ? end === "source"
                          : end === "target"),
                  )
                  .map((end) => ({
                    value: end,
                    label: `${text(end === "source" ? "sourceEnd" : "targetEnd")} · ${contract[end as "source" | "target"].name}`,
                  }))}
                onChange={(end) => setInput((old) => ({ ...old, end }))}
              />
            </div>
          )}
          <div>
            <div className={styles.fieldLabel}>{text("limit")} *</div>
            <InputNumber
              aria-label={text("limit")}
              style={{ width: "100%" }}
              min={1}
              max={1000}
              precision={0}
              value={input.limit}
              onChange={(limit) => setInput((old) => ({ ...old, limit: limit ?? undefined }))}
            />
          </div>
        </div>
      )}
      {sampled && fieldsApplicable && (
        <Typography.Text type="secondary">{text("sampleHelp")}</Typography.Text>
      )}
      {fieldsApplicable && input.rule === "relation-property-values" && (
        <div>
          <div className={styles.fieldLabel}>{text("property")}</div>
          <Select
            aria-label={text("property")}
            style={{ width: "100%" }}
            value={input.property ?? ""}
            options={[
              { value: "", label: text("allProperties") },
              ...contract.properties.map((p) => ({ value: p.name, label: p.name })),
            ]}
            onChange={(property) =>
              setInput((old) => ({ ...old, property: property || undefined }))
            }
          />
        </div>
      )}
      {fieldsApplicable && input.rule && !pair && (
        <div>
          <Typography.Text strong>{text("standard")}</Typography.Text>
          <Typography.Paragraph>
            {text(
              input.rule === "relation-query"
                ? "queryStandard"
                : input.rule === "relation-definition"
                  ? "definitionStandard"
                  : "fixedStandard",
            )}
          </Typography.Paragraph>
        </div>
      )}
      {base && base.match !== "applicable" && (
        <Alert type="warning" message={base.match_reason || text("incomplete")} />
      )}
      {busy && <Spin size="small" tip={text("preparing")} />}
      {error && (
        <Alert
          type="error"
          showIcon
          message={error}
          action={
            <Button size="small" onClick={() => setRetry((n) => n + 1)}>
              {text("retry")}
            </Button>
          }
        />
      )}
    </Space>
  );
}
