/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { caseUiText } from "./case-ui-text";
import { EvalRuleCheckFields } from "./EvalRuleCheckFields";
import { validateRuleCheck } from "./rule-check-model";

import { EvalPaginatedTable as Table } from "./EvalPaginatedTable";
import { EllipsisOutlined } from "@ant-design/icons";
import {
  Alert,
  Button,
  Checkbox,
  Descriptions,
  Drawer,
  Dropdown,
  Input,
  Select,
  Space,
  Switch,
  Tag,
  Typography,
} from "antd";
import type { TableColumnsType } from "antd";
import { Fragment, useEffect, useMemo, useState } from "react";

import { resourceKindGroups, rulePreset } from "./eval-template-rules";
import {
  previewEvalRuleMatches,
  saveEvalTemplateConfig,
  type EvalTemplateConfig,
  type EvalRuleMatchPreview,
} from "./m0-run.service";
import type { EvalRuleKind, EvalTemplateRule } from "./types";
import { useEvalTranslation } from "./useEvalTranslation";
import { useEvalFeedback } from "./useEvalFeedback";
import styles from "./EvalWorkspaceScene.module.css";
import type { RuleApplicationSeed } from "./rule-application.service";
import { definitionText } from "./eval-definition-view";

type Props = {
  networkId: string;
  config: EvalTemplateConfig;
  canManage: boolean;
  onChanged: (config: EvalTemplateConfig) => void;
  onApply?: (seed: RuleApplicationSeed) => void;
};

const applicabilityFieldLabel = (): Record<string, string> => ({
  id: caseUiText("resourceId"),
  "data_source.id": caseUiText("dataSourceId"),
  primary_keys: caseUiText("primaryKey"),
  display_key: caseUiText("displayKey"),
  data_properties: caseUiText("dataProperties"),
  "data_properties.name": caseUiText("propertyName"),
  "data_properties.type": caseUiText("propertyType"),
  "data_properties.required": caseUiText("propertyRequiredDeclaration"),
  source_object_type_id: caseUiText("sourceObjectType"),
  target_object_type_id: caseUiText("targetObjectType"),
  type: caseUiText("relationType"),
  mapping_rules: caseUiText("joinKeyMappings"),
  cardinality: caseUiText("relationCardinality"),
  "constraints.required": caseUiText("requiredRelationEndpoints"),
  "constraints.characteristics": caseUiText("relationCharacteristics"),
  reverse_name: caseUiText("reverseName"),
  verification: caseUiText("verificationStatus"),
  fallback_for: caseUiText("fallbackRelation"),
  "definition.result_semantics.value.physical_type": caseUiText("metricResultType"),
  "definition.result_semantics.statistical_grain": caseUiText("statisticalGrain"),
  "definition.specification.kind": caseUiText("calculationDefinitionType"),
  object_type_id: caseUiText("boundObjectType"),
  action_type: caseUiText("actionType"),
  "action_source.type": caseUiText("capabilitySourceType"),
  parameters: caseUiText("parameters"),
  condition: caseUiText("preconditions"),
  impact_contracts: caseUiText("impactContracts"),
  affect: caseUiText("writeTargets"),
  capability_id: caseUiText("capabilityBindingId"),
});
const fieldOption = (value: string) => ({
  value,
  label: applicabilityFieldLabel()[value] ?? value,
});
const scalarApplicabilityFields = new Set([
  "id",
  "data_source.id",
  "display_key",
  "source_object_type_id",
  "target_object_type_id",
  "type",
  "cardinality",
  "reverse_name",
  "object_type_id",
  "action_type",
  "action_source.type",
  "definition.result_semantics.value.physical_type",
  "definition.specification.kind",
  "data_properties.name",
  "data_properties.type",
  "data_properties.required",
  "capability_id",
]);
const applicabilityFieldOptions = (): Record<EvalRuleKind, { value: string; label: string }[]> => ({
  objectType: ["id", "data_source.id", "primary_keys", "display_key", "data_properties"].map(
    fieldOption,
  ),
  objectProperty: [
    "id",
    "data_source.id",
    "primary_keys",
    "display_key",
    "data_properties",
    "data_properties.name",
    "data_properties.type",
    "data_properties.required",
  ].map(fieldOption),
  relationType: [
    "id",
    "source_object_type_id",
    "target_object_type_id",
    "type",
    "mapping_rules",
    "cardinality",
    "constraints.required",
    "constraints.characteristics",
    "reverse_name",
    "verification",
    "fallback_for",
  ].map(fieldOption),
  metric: [
    "id",
    "definition.result_semantics.value.physical_type",
    "definition.result_semantics.statistical_grain",
    "definition.specification.kind",
  ].map(fieldOption),
  action: [
    "id",
    "object_type_id",
    "action_type",
    "action_source.type",
    "parameters",
    "condition",
    "impact_contracts",
    "affect",
  ].map(fieldOption),
  function: ["id", "capability_id"].map(fieldOption),
  api: ["id", "capability_id"].map(fieldOption),
  mcp: ["id", "capability_id"].map(fieldOption),
  skill: ["id", "capability_id"].map(fieldOption),
});

function isDeclarationPrecheck(rule: EvalTemplateRule): boolean {
  return (
    rule.builtinVersion === 3 &&
    [
      "relation-endpoint",
      "metric-contract",
      "action-contract",
      "action-precondition",
      "action-side-effect",
    ].includes(rule.id)
  );
}

function generationDetail(
  rule: EvalTemplateRule,
  support?: { status: string; reason: string },
): string {
  if (support) return support.reason;
  if (rule.origin === "custom") {
    return definitionText("customHelp");
  }
  if (isDeclarationPrecheck(rule)) {
    return caseUiText("verifyTheCurrentDeclarationDirectlyInTheGeneration");
  }
  return caseUiText("thisRuleRequiresCorrespondingInstancesOrIndependentSamples");
}

function validLocalApplicability(rule: EvalTemplateRule): boolean {
  const conditions = rule.applicability?.all;
  return (
    !!conditions &&
    conditions.length <= 5 &&
    conditions.every(
      (condition) =>
        !!condition.field &&
        (condition.operator !== "equals" ||
          (scalarApplicabilityFields.has(condition.field) &&
            !!condition.value?.trim() &&
            condition.value.length <= 128)),
    ) &&
    new Set(conditions.map((condition) => condition.field)).size === conditions.length
  );
}

export function EvalTemplatePanel({ networkId, config, canManage, onChanged, onApply }: Props) {
  const { message, modal } = useEvalFeedback();
  const { t } = useEvalTranslation();
  const label = (key: string, options?: Record<string, unknown>) =>
    t(`knowledgeNetwork.eval.templateUi.${key}`, options);
  const [kind, setKind] = useState<EvalRuleKind>("objectType");
  const [query, setQuery] = useState("");
  const [groupFilter, setGroupFilter] = useState<string>();
  const [presetFilter, setPresetFilter] = useState<"all" | "required" | "standard">("all");
  const [stateFilter, setStateFilter] = useState<"all" | "enabled" | "disabled">("all");
  const [rulePage, setRulePage] = useState(1);
  const [detail, setDetail] = useState<EvalTemplateRule | null>(null);
  const [rules, setRules] = useState(config.rules);
  const [editing, setEditing] = useState<EvalTemplateRule | null>(null);
  const [editorMode, setEditorMode] = useState<"create" | "copy" | "edit">("edit");
  const [busy, setBusy] = useState(false);
  const [matchLoading, setMatchLoading] = useState(false);
  const [matchPreview, setMatchPreview] = useState<{
    signature: string;
    result: EvalRuleMatchPreview;
  } | null>(null);
  useEffect(() => setRules(config.rules), [config]);
  const canEdit = canManage;
  const openRuleEditor = (mode: "create" | "copy" | "edit", rule: EvalTemplateRule) => {
    setEditorMode(mode);
    setMatchPreview(null);
    setEditing({ ...rule, check: rule.check ?? config.execution_support?.[rule.id]?.check });
  };
  const matchSignature = editing ? JSON.stringify([editing.kind, editing.applicability]) : "";
  const previewMatches = async () => {
    if (!editing?.applicability || !validLocalApplicability(editing) || matchLoading) return;
    const signature = matchSignature;
    setMatchLoading(true);
    try {
      const result = await previewEvalRuleMatches(networkId, editing.kind, editing.applicability);
      setMatchPreview({ signature, result });
    } catch {
      message.error(caseUiText("cannotPreviewMatchingResultsCheckResourceReadPermissions"));
    } finally {
      setMatchLoading(false);
    }
  };
  const groups = useMemo(
    () =>
      [
        ...new Set(
          rules
            .filter((rule) => rule.kind === kind)
            .map((rule) => rule.group)
            .filter(Boolean),
        ),
      ].sort((left, right) => left.localeCompare(right)),
    [rules, kind],
  );
  useEffect(() => {
    if (groupFilter && !groups.includes(groupFilter)) {
      setGroupFilter(undefined);
      setRulePage(1);
    }
  }, [groups, groupFilter]);
  const clearFilters = () => {
    setQuery("");
    setGroupFilter(undefined);
    setPresetFilter("all");
    setStateFilter("all");
    setRulePage(1);
  };
  const visible = useMemo(
    () =>
      rules.filter(
        (rule) =>
          rule.kind === kind &&
          (!groupFilter || rule.group === groupFilter) &&
          (presetFilter === "all" || rulePreset(rule) === presetFilter) &&
          (stateFilter === "all" || rule.enabled === (stateFilter === "enabled")) &&
          `${rule.title} ${rule.description} ${rule.appliesWhen} ${rule.group}`
            .toLocaleLowerCase()
            .includes(query.trim().toLocaleLowerCase()),
      ),
    [rules, kind, query, groupFilter, presetFilter, stateFilter],
  );
  const columns: TableColumnsType<EvalTemplateRule> = [
    {
      title: label("columns.rule"),
      key: "rule",
      width: 180,
      fixed: "left",
      render: (_, rule) => (
        <strong className={styles.templateRuleName} title={rule.title}>
          {rule.title}
        </strong>
      ),
    },
    {
      title: label("columns.actions"),
      key: "actions",
      width: 64,
      fixed: "left",
      align: "center",
      render: (_, rule) => (
        <Dropdown
          trigger={["click"]}
          menu={{
            items: [
              { key: "details", label: label("details"), onClick: () => setDetail(rule) },
              ...(canEdit && onApply
                ? [
                    {
                      key: "apply",
                      label: t("knowledgeNetwork.eval.ruleApplication.apply"),
                      disabled: !rule.enabled,
                      onClick: () => onApply({ ruleIds: [rule.id] }),
                    },
                  ]
                : []),
              ...(canEdit
                ? [
                    {
                      key: "edit",
                      label: caseUiText("edit"),
                      onClick: () => openRuleEditor("edit", { ...rule }),
                    },
                    {
                      key: "toggle",
                      label: rule.enabled
                        ? caseUiText("knowledgeNetwork.eval.templateUi.disabled")
                        : caseUiText("knowledgeNetwork.eval.templateUi.enabled"),
                      disabled: busy,
                      onClick: () =>
                        runAction(async () => {
                          await saveRules(
                            rules.map((item) =>
                              item.id === rule.id ? { ...item, enabled: !rule.enabled } : item,
                            ),
                          );
                          message.success(
                            rule.enabled
                              ? caseUiText("knowledgeNetwork.eval.ruleApplication.disabled")
                              : caseUiText("ruleEnabled"),
                          );
                        }),
                    },
                    {
                      key: "copy",
                      label: caseUiText("copy"),
                      onClick: () =>
                        openRuleEditor("copy", {
                          ...rule,
                          check: rule.check ?? config.execution_support?.[rule.id]?.check,
                          id: `custom-${crypto.randomUUID()}`,
                          origin: "custom" as const,
                          builtinVersion: undefined,
                          revision: 1,
                          title: caseUiText("copiedRuleName", { name: rule.title }),
                        }),
                    },
                    ...(rule.origin === "custom"
                      ? [
                          {
                            key: "delete",
                            label: caseUiText("knowledgeNetwork.eval.caseBatch.delete"),
                            danger: true,
                            onClick: () =>
                              modal.confirm({
                                title: caseUiText("deleteNamedRule", { name: rule.title }),
                                content: caseUiText(
                                  "confirmingSavesTheDeletionImmediatelyExistingCasesAnd",
                                ),
                                onOk: () =>
                                  runAction(async () => {
                                    await saveRules(rules.filter((item) => item.id !== rule.id));
                                    message.success(caseUiText("ruleDeleted"));
                                  }),
                              }),
                          },
                        ]
                      : []),
                  ]
                : []),
            ],
          }}
        >
          <Button
            type="text"
            size="small"
            icon={<EllipsisOutlined />}
            aria-label={`${rule.title} ${label("columns.actions")}`}
          />
        </Dropdown>
      ),
    },
    {
      title: label("columns.dimension"),
      key: "group",
      width: 140,
      render: (_, rule) => (
        <span className={styles.templateRuleGroup} title={rule.group}>
          {rule.group}
        </span>
      ),
    },
    {
      title: label("columns.check"),
      key: "check",
      width: 270,
      render: (_, rule) => (
        <span className={styles.templateRuleDescription} title={rule.description}>
          {rule.description}
        </span>
      ),
    },
    {
      title: label("columns.condition"),
      key: "condition",
      width: 220,
      render: (_, rule) => {
        const structured =
          rule.origin === "custom" && rule.applicability?.all.length
            ? rule.applicability.all
                .map((condition) =>
                  caseUiText("matchCondition", {
                    field: applicabilityFieldLabel()[condition.field] ?? condition.field,
                    comparison:
                      condition.operator === "exists"
                        ? caseUiText("exists")
                        : caseUiText("equalsValue", { value: condition.value }),
                  }),
                )
                .join(caseUiText("and"))
            : "";
        return (
          <span className={styles.templateRuleCondition} title={structured || rule.appliesWhen}>
            {structured || rule.appliesWhen}
          </span>
        );
      },
    },
    {
      title: label("columns.preset"),
      key: "preset",
      width: 110,
      render: (_, rule) => label(`presets.${rulePreset(rule)}`),
    },
    {
      title: label("columns.enabled"),
      key: "enabled",
      width: 90,
      render: (_, rule) => (
        <Tag color={rule.enabled ? "success" : "default"}>
          {label(rule.enabled ? "enabled" : "disabled")}
        </Tag>
      ),
    },
    {
      title: label("columns.source"),
      key: "source",
      width: 100,
      render: (_, rule) => label(`sources.${rule.origin === "custom" ? "custom" : "builtin"}`),
    },
  ];

  const saveRules = async (nextRules: EvalTemplateRule[]): Promise<EvalTemplateConfig> => {
    const saved = await saveEvalTemplateConfig(networkId, config, nextRules);
    setRules(saved.rules);
    onChanged(saved);
    return saved;
  };

  const runAction = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } catch {
      message.error(caseUiText("theOperationFailedTheRuleMayBeInvalid"));
    } finally {
      setBusy(false);
    }
  };

  const applyRule = () => {
    if (!editing || busy) return;
    if (
      editing.origin === "custom" &&
      [
        editing.title,
        editing.group,
        editing.description,
        editing.appliesWhen,
        editing.evidence,
      ].some((value) => !value.trim())
    ) {
      message.error(caseUiText("provideTheRuleNameTagsCheckContentScope"));
      return;
    }
    if (editing.origin === "custom" && !validLocalApplicability(editing)) {
      message.error(caseUiText("selectAllResourcesOfThisTypeOrConfigure"));
      return;
    }
    try {
      validateRuleCheck(editing.kind, editing.check, config.check_capabilities ?? []);
    } catch (error) {
      message.error(
        error instanceof Error ? error.message : caseUiText("checkTheExecutionConfiguration"),
      );
      return;
    }
    const nextRules = rules.some((item) => item.id === editing.id)
      ? rules.map((item) => (item.id === editing.id ? editing : item))
      : [...rules, editing];
    void runAction(async () => {
      await saveRules(nextRules);
      setKind(editing.kind);
      clearFilters();
      setEditing(null);
      message.success(editorMode === "edit" ? caseUiText("ruleSaved") : caseUiText("ruleCreated"));
    });
  };

  return (
    <div className={styles.templateWorkspace} data-testid="eval-template-panel">
      <div className={styles.templateContent}>
        <nav className={styles.templateNav} aria-label={label("ruleLibrary")}>
          <h3 className={styles.templateNavHeading}>
            {label("ruleLibrary")}
            <small
              className={styles.templateLibraryCount}
              title={label("ruleCount", { count: rules.length })}
            >
              （{rules.length}）
            </small>
          </h3>
          {resourceKindGroups.map(({ key, kinds }, index) => (
            <Fragment key={key}>
              <div
                className={`${styles.templateNavGroup} ${index === 0 ? styles.templateNavGroupFirst : ""}`}
              >
                {label(key)}
              </div>
              {kinds
                .flatMap((item) =>
                  item === "objectType" ? [item, "objectProperty" as const] : [item],
                )
                .map((item) => {
                  const count = rules.filter((rule) => rule.kind === item).length;
                  return (
                    <button
                      key={item}
                      type="button"
                      aria-current={kind === item ? "page" : undefined}
                      className={[
                        kind === item ? styles.templateNavActive : "",
                        item === "objectProperty" ? styles.templateNavNested : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onClick={() => {
                        setKind(item);
                        setQuery("");
                        setGroupFilter(undefined);
                        setRulePage(1);
                      }}
                    >
                      <span>{label(`kinds.${item}`)}</span>
                      <small title={label("ruleCount", { count })}>{count}</small>
                    </button>
                  );
                })}
            </Fragment>
          ))}
        </nav>
        <section className={styles.templateRules}>
          <div className={styles.templateRulesHeader}>
            <h3>{label(`kinds.${kind}`)}</h3>
            <div
              className={`${styles.listToolbarControls} ${styles.templateFilterControls}`}
              role="group"
              aria-label={label("filters.toolbar")}
            >
              <Input.Search
                allowClear
                aria-label={label("search")}
                placeholder={label("search")}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setRulePage(1);
                }}
              />
              <label>
                <span>{label("columns.dimension")}</span>
                <Select
                  className={styles.templateTagFilter}
                  aria-label={label("filters.tag")}
                  showSearch
                  optionFilterProp="label"
                  value={groupFilter ?? ""}
                  onChange={(value) => {
                    setGroupFilter(value || undefined);
                    setRulePage(1);
                  }}
                  options={[
                    { value: "", label: label("filters.allTags") },
                    ...groups.map((group) => ({ value: group, label: group })),
                  ]}
                />
              </label>
              <label>
                <span>{label("columns.preset")}</span>
                <Select
                  className={styles.templatePresetFilter}
                  aria-label={label("filters.preset")}
                  value={presetFilter}
                  onChange={(value) => {
                    setPresetFilter(value);
                    setRulePage(1);
                  }}
                  options={[
                    { value: "all", label: label("filters.allPresets") },
                    { value: "required", label: label("presets.required") },
                    { value: "standard", label: label("presets.standard") },
                  ]}
                />
              </label>
              <label>
                <span>{label("columns.enabled")}</span>
                <Select
                  className={styles.templateStateFilter}
                  aria-label={label("filters.state")}
                  value={stateFilter}
                  onChange={(value) => {
                    setStateFilter(value);
                    setRulePage(1);
                  }}
                  options={[
                    { value: "all", label: label("filters.allStates") },
                    { value: "enabled", label: label("enabled") },
                    { value: "disabled", label: label("disabled") },
                  ]}
                />
              </label>
              {canEdit && onApply && (
                <Button
                  disabled={!visible.some((rule) => rule.enabled)}
                  onClick={() =>
                    onApply({
                      ruleIds: visible.filter((rule) => rule.enabled).map((rule) => rule.id),
                    })
                  }
                >
                  {t("knowledgeNetwork.eval.ruleApplication.batchApply")}
                </Button>
              )}
              {canEdit && (
                <Button
                  type="primary"
                  onClick={() =>
                    openRuleEditor("create", {
                      id: `custom-${crypto.randomUUID()}`,
                      origin: "custom",
                      revision: 1,
                      kind,
                      group: "",
                      title: "",
                      description: "",
                      appliesWhen: "",
                      applicability: { all: [{ field: "", operator: "exists" }] },
                      generationMode: "manual",
                      evidence: "",
                      planDimensions: [],
                      preset: "standard",
                      enabled: true,
                    })
                  }
                >
                  {caseUiText("create")}
                </Button>
              )}
            </div>
          </div>
          <Table<EvalTemplateRule>
            className={styles.templateTable}
            size="small"
            rowKey="id"
            columns={columns}
            dataSource={visible}
            tableLayout="fixed"
            pagination={{
              current: rulePage,
              pageSize: 10,
              showSizeChanger: false,
              onChange: setRulePage,
            }}
            scroll={{ x: 1174 }}
            locale={{ emptyText: label("noRules") }}
          />
        </section>
      </div>
      <Drawer
        className={styles.templateRuleEditorDrawer}
        title={
          editorMode === "create"
            ? caseUiText("createCustomRule")
            : editorMode === "copy"
              ? caseUiText("copyRule")
              : editing?.origin === "builtin"
                ? caseUiText("adjustBuiltInRule")
                : caseUiText("editCustomRule")
        }
        width={560}
        open={!!editing}
        onClose={() => {
          if (!busy) setEditing(null);
        }}
        footer={
          editing && (
            <div className={styles.templateRuleEditorFooter}>
              <Button type="primary" loading={busy} onClick={applyRule}>
                {caseUiText("confirm")}
              </Button>
            </div>
          )
        }
      >
        {editing && (
          <Space direction="vertical" size="middle" style={{ width: "100%" }}>
            <label>
              {caseUiText("knowledgeNetwork.eval.templateUi.columns.rule")}
              <Input
                aria-label={caseUiText("knowledgeNetwork.eval.templateUi.columns.rule")}
                value={editing.title}
                disabled={editing.origin === "builtin"}
                onChange={(event) => setEditing({ ...editing, title: event.target.value })}
              />
            </label>
            <label>
              {caseUiText("knowledgeNetwork.eval.templateUi.resourceType")}
              <Select
                aria-label={caseUiText("knowledgeNetwork.eval.templateUi.resourceType")}
                value={editing.kind}
                disabled={editing.origin === "builtin"}
                style={{ width: "100%" }}
                options={resourceKindGroups
                  .flatMap((group) =>
                    group.kinds.flatMap((item) =>
                      item === "objectType" ? [item, "objectProperty" as const] : [item],
                    ),
                  )
                  .map((item) => ({ value: item, label: label(`kinds.${item}`) }))}
                onChange={(value) =>
                  setEditing({
                    ...editing,
                    kind: value,
                    check: undefined,
                    applicability: { all: [{ field: "", operator: "exists" }] },
                  })
                }
              />
            </label>
            <label>
              {caseUiText("knowledgeNetwork.eval.templateUi.columns.dimension")}
              <Input
                aria-label={caseUiText("knowledgeNetwork.eval.templateUi.columns.dimension")}
                value={editing.group}
                disabled={editing.origin === "builtin"}
                onChange={(event) => setEditing({ ...editing, group: event.target.value })}
              />
            </label>
            <label>
              {caseUiText("knowledgeNetwork.eval.templateUi.columns.check")}
              <Input.TextArea
                rows={3}
                aria-label={caseUiText("knowledgeNetwork.eval.templateUi.columns.check")}
                value={editing.description}
                disabled={editing.origin === "builtin"}
                onChange={(event) => setEditing({ ...editing, description: event.target.value })}
              />
            </label>
            <EvalRuleCheckFields
              key={editing.id + editing.kind}
              kind={editing.kind}
              value={editing.check}
              capabilities={config.check_capabilities ?? []}
              disabled={editing.origin === "builtin"}
              onChange={(check) => setEditing({ ...editing, check })}
            />
            <label>
              {caseUiText("knowledgeNetwork.eval.templateUi.columns.condition")}
              <Input.TextArea
                rows={2}
                aria-label={caseUiText("knowledgeNetwork.eval.templateUi.columns.condition")}
                value={editing.appliesWhen}
                disabled={editing.origin === "builtin"}
                placeholder={caseUiText("describeWhichResourcesThisRuleAppliesToAutomatic")}
                onChange={(event) => setEditing({ ...editing, appliesWhen: event.target.value })}
              />
            </label>
            {editing.origin === "custom" && (
              <div className={styles.templateApplicability}>
                <Typography.Text strong>
                  {caseUiText("automaticMatchingConditionsAllRequired")}
                </Typography.Text>
                <Typography.Paragraph type="secondary">
                  {caseUiText("onlyResourceDeclarationsAreReadExistsMeansThat")}
                </Typography.Paragraph>
                <Alert
                  type="info"
                  showIcon
                  message={caseUiText("matchingConditionsSelectResourcesForTheRuleThe")}
                />
                <Checkbox
                  checked={editing.applicability?.all.length === 0}
                  onChange={(event) =>
                    setEditing({
                      ...editing,
                      appliesWhen:
                        event.target.checked && !editing.appliesWhen.trim()
                          ? caseUiText("knowledgeNetwork.eval.definitionUi.allResources")
                          : editing.appliesWhen,
                      applicability: {
                        all: event.target.checked ? [] : [{ field: "", operator: "exists" }],
                      },
                    })
                  }
                  className={styles.templateApplicabilityAll}
                >
                  {caseUiText("applyToAllResourcesOfThisType")}
                </Checkbox>
                {editing.applicability?.all.length !== 0 && (
                  <div className={styles.templateApplicabilityConditions}>
                    {(editing.applicability?.all ?? []).map((condition, index) => (
                      <div
                        key={index}
                        className={`${styles.templateApplicabilityRow} ${condition.operator === "equals" ? styles.templateApplicabilityRowWithValue : ""}`}
                      >
                        <Select
                          aria-label={caseUiText("conditionFieldLabel", { position: index + 1 })}
                          value={condition.field || undefined}
                          placeholder={caseUiText("selectADeclarationField")}
                          options={applicabilityFieldOptions()[editing.kind]}
                          onChange={(field) =>
                            setEditing({
                              ...editing,
                              applicability: {
                                all: (editing.applicability?.all ?? []).map((item, position) =>
                                  position === index
                                    ? {
                                        ...item,
                                        field,
                                        ...(scalarApplicabilityFields.has(field)
                                          ? {}
                                          : { operator: "exists", value: undefined }),
                                      }
                                    : item,
                                ),
                              },
                            })
                          }
                        />
                        <Select
                          aria-label={caseUiText("conditionComparisonLabel", {
                            position: index + 1,
                          })}
                          value={condition.operator}
                          options={
                            scalarApplicabilityFields.has(condition.field)
                              ? [
                                  { value: "exists", label: caseUiText("exists") },
                                  { value: "equals", label: caseUiText("equals") },
                                ]
                              : [{ value: "exists", label: caseUiText("exists") }]
                          }
                          onChange={(operator) =>
                            setEditing({
                              ...editing,
                              applicability: {
                                all: (editing.applicability?.all ?? []).map((item, position) =>
                                  position === index
                                    ? {
                                        field: item.field,
                                        operator,
                                        ...(operator === "equals"
                                          ? { value: item.value ?? "" }
                                          : {}),
                                      }
                                    : item,
                                ),
                              },
                            })
                          }
                        />
                        {condition.operator === "equals" && (
                          <Input
                            aria-label={caseUiText("conditionValueLabel", { position: index + 1 })}
                            value={condition.value ?? ""}
                            onChange={(event) =>
                              setEditing({
                                ...editing,
                                applicability: {
                                  all: (editing.applicability?.all ?? []).map((item, position) =>
                                    position === index
                                      ? { ...item, value: event.target.value }
                                      : item,
                                  ),
                                },
                              })
                            }
                          />
                        )}
                        <Button
                          disabled={(editing.applicability?.all.length ?? 0) <= 1}
                          onClick={() =>
                            setEditing({
                              ...editing,
                              applicability: {
                                all: (editing.applicability?.all ?? []).filter(
                                  (_, position) => position !== index,
                                ),
                              },
                            })
                          }
                        >
                          {caseUiText("knowledgeNetwork.eval.caseEditor.remove")}
                        </Button>
                      </div>
                    ))}
                    <Button
                      disabled={(editing.applicability?.all.length ?? 0) >= 5}
                      onClick={() => {
                        const used = new Set(editing.applicability?.all.map((item) => item.field));
                        const next = applicabilityFieldOptions()[editing.kind].find(
                          (item) => !used.has(item.value),
                        );
                        if (next)
                          setEditing({
                            ...editing,
                            applicability: {
                              all: [
                                ...(editing.applicability?.all ?? []),
                                { field: next.value, operator: "exists" },
                              ],
                            },
                          });
                      }}
                    >
                      {caseUiText("addCondition")}
                    </Button>
                  </div>
                )}
                <div>
                  <Button
                    loading={matchLoading}
                    disabled={!validLocalApplicability(editing)}
                    onClick={() => void previewMatches()}
                  >
                    {caseUiText("previewMatchingResources")}
                  </Button>
                </div>
                {matchPreview?.signature === matchSignature && (
                  <Alert
                    type="info"
                    showIcon
                    style={{ marginTop: 8 }}
                    message={caseUiText("matchingPreviewSummary", {
                      scanned: matchPreview.result.scanned_resources,
                      resources: matchPreview.result.total_resources,
                      matched: matchPreview.result.matched_targets,
                      targets: matchPreview.result.total_targets,
                      kind: caseUiText(
                        editing.kind === "objectProperty"
                          ? "matchingProperties"
                          : "matchingResources",
                      ),
                    })}
                    description={
                      <>
                        {matchPreview.result.total_resources >
                          matchPreview.result.scanned_resources && (
                          <div>{caseUiText("onlyTheFirst100ResourcesArePreviewedMatch")}</div>
                        )}
                        {matchPreview.result.unreadable > 0 && (
                          <div>
                            {caseUiText("unreadableTargetDeclarations", {
                              count: matchPreview.result.unreadable,
                            })}
                          </div>
                        )}
                        {matchPreview.result.examples.length > 0 && (
                          <div>
                            {caseUiText("matchingExamples")}
                            {matchPreview.result.examples.join("、")}
                          </div>
                        )}
                      </>
                    }
                  />
                )}
              </div>
            )}
            <label>
              {caseUiText("knowledgeNetwork.eval.templateUi.evidence")}
              <Input.TextArea
                aria-label={caseUiText("knowledgeNetwork.eval.templateUi.evidence")}
                rows={2}
                value={editing.evidence}
                disabled={editing.origin === "builtin"}
                placeholder={caseUiText("forExampleAnObjectDeclarationSnapshotInstanceQuery")}
                onChange={(event) => setEditing({ ...editing, evidence: event.target.value })}
              />
              <Typography.Text type="secondary">
                {caseUiText("describeTheMaterialsNeededToVerifyTheCriteria")}
              </Typography.Text>
            </label>
            <label>
              {label("columns.preset")}
              <Select
                value={rulePreset(editing)}
                style={{ width: "100%" }}
                options={[
                  {
                    value: "required",
                    label: caseUiText("knowledgeNetwork.eval.templateUi.presets.required"),
                  },
                  {
                    value: "standard",
                    label: caseUiText("knowledgeNetwork.eval.templateUi.presets.standard"),
                  },
                ]}
                onChange={(value) => setEditing({ ...editing, preset: value })}
              />
            </label>
            <div className={styles.templateRuleEditorEnableSetting}>
              <span>{caseUiText("knowledgeNetwork.eval.templateUi.enabled")}</span>
              <Switch
                aria-label={caseUiText("enableRule")}
                checked={editing.enabled}
                onChange={(enabled) => setEditing({ ...editing, enabled })}
              />
            </div>
          </Space>
        )}
      </Drawer>
      <Drawer
        title={detail?.title}
        width="min(600px, 96vw)"
        open={!!detail}
        onClose={() => setDetail(null)}
      >
        {detail && (
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <Descriptions className={styles.detailDescriptions} bordered column={1} size="small">
              <Descriptions.Item label={label("resourceType")}>
                {label(`kinds.${detail.kind}`)}
              </Descriptions.Item>
              <Descriptions.Item label={label("columns.dimension")}>
                {detail.group}
              </Descriptions.Item>
              <Descriptions.Item label={label("columns.preset")}>
                {label(`presets.${rulePreset(detail)}`)}
              </Descriptions.Item>
              <Descriptions.Item label={label("columns.enabled")}>
                {label(detail.enabled ? "enabled" : "disabled")}
              </Descriptions.Item>
              <Descriptions.Item label={label("columns.check")}>
                {detail.description}
              </Descriptions.Item>
              <Descriptions.Item label={label("columns.condition")}>
                {detail.appliesWhen}
              </Descriptions.Item>
              {detail.origin === "custom" && (
                <Descriptions.Item label={caseUiText("automaticMatchingConditions")}>
                  {detail.applicability?.all.length === 0
                    ? definitionText("allResources")
                    : detail.applicability?.all
                        .map((condition) =>
                          caseUiText("matchCondition", {
                            field: applicabilityFieldLabel()[condition.field] ?? condition.field,
                            comparison:
                              condition.operator === "exists"
                                ? caseUiText("exists")
                                : caseUiText("equalsValue", { value: condition.value }),
                          }),
                        )
                        .join(caseUiText("and")) || definitionText("unconfigured")}
                </Descriptions.Item>
              )}
              <Descriptions.Item label={label("evidence")}>{detail.evidence}</Descriptions.Item>
              {config.execution_support?.[detail.id] && (
                <Descriptions.Item label={label("executionSupport")}>
                  <Tag
                    color={
                      config.execution_support[detail.id].status === "supported"
                        ? "success"
                        : "default"
                    }
                  >
                    {label(
                      config.execution_support[detail.id].status === "supported"
                        ? "executionSupported"
                        : "executionUnsupported",
                    )}
                  </Tag>
                </Descriptions.Item>
              )}
            </Descriptions>
            <Alert
              type="info"
              showIcon
              message={definitionText("capabilityHelp")}
              description={generationDetail(detail, config.execution_support?.[detail.id])}
            />
          </Space>
        )}
      </Drawer>
    </div>
  );
}
