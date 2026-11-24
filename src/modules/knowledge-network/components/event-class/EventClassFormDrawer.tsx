/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  Alert,
  Drawer,
  Form,
  Input,
  InputNumber,
  Radio,
  Select,
  Space,
  Switch,
  Tabs,
  Typography,
} from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { extractRequestErrorDetails } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { ActionTypeConditionEditor } from "@/modules/knowledge-network/components/action-type/ActionTypeConditionEditor";
import { EventCypherRuleEditor } from "@/modules/knowledge-network/components/event-class/EventCypherRuleEditor";
import {
  buildCypherRule,
  cypherDraftFromRule,
  type CypherRuleDraft,
} from "@/modules/knowledge-network/components/event-class/event-cypher-rule";
import {
  EventRuleTrial,
  type EventRuleTrialState,
} from "@/modules/knowledge-network/components/event-class/EventRuleTrial";
import { EventScheduleEditor } from "@/modules/knowledge-network/components/event-class/EventScheduleEditor";
import {
  DEFAULT_EVENT_SCHEDULE,
  DEFAULT_EVENT_TIMEZONE,
  cronFromSchedule,
  scheduleFromCron,
  type EventScheduleDraft,
} from "@/modules/knowledge-network/components/event-class/event-schedule";
import type { RelationTypePropertyOption } from "@/modules/knowledge-network/components/relation-type/RelationTypePropertySelect";
import {
  createKnEventType,
  listKnEventRuleTools,
  trialKnEventRule,
  updateKnEventType,
} from "@/modules/knowledge-network/services/event-type.service";
import {
  getKnowledgeNetworkObjectTypeDetail,
  listKnowledgeNetworkObjectTypes,
} from "@/modules/knowledge-network/services/object-type.service";
import type {
  ActionTypeCondition,
  ActionTypeConditionValueFrom,
} from "@/modules/knowledge-network/types/action-type";
import type {
  KnEventRule,
  KnEventRuleTool,
  KnEventRuleToolOption,
  KnEventRuleToolParameter,
  KnEventSource,
  KnEventType,
} from "@/modules/knowledge-network/types/event-type";
import type { KnowledgeNetworkObjectTypeRecord } from "@/modules/knowledge-network/types/knowledge-network";
import {
  isLogicalOperation,
  promoteLegacyActionCondition,
  validateActionCondition,
} from "@/modules/knowledge-network/utils/action-type-condition";

import styles from "./EventClassFormDrawer.module.css";

type EventClassFormDrawerProps = {
  /** Object types that are themselves event classes; an event class is not about one. */
  eventClassIds: ReadonlySet<string>;
  /** The type to edit; absent to create one. */
  eventType?: KnEventType;
  /** The object type a new event class is about, when it is created from that object type. */
  initialSubject?: string;
  networkId: string;
  onClose: () => void;
  onSaved: (saved: KnEventType) => void;
  open: boolean;
  /** The network has versions: the class is written into the draft. */
  versioned: boolean;
};

type FormValues = {
  code: string;
  handlingNote?: string;
  mergeHours?: number;
  name: string;
  ruleTool?: string;
  severity?: string;
  source: KnEventSource;
  subject?: string;
};

/** What the form edits a rule as. */
type RuleBasis = KnEventRule["basis"];

/** A parameter of the rule tool as the form edits it. */
type ParameterDraft = { mode: "fixed" | "checkDate"; value?: unknown };

/** The code is the ID of the event class, an object type. */
const CODE_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const SEVERITIES = ["P1", "P2", "P3", "P4"];
const TOOL_KEY_SEPARATOR = "\u0000";
const BASES: readonly RuleBasis[] = ["condition", "cypher", "function"];
/** What a recognition action's condition compares with: it has no runtime input. */
const CONDITION_VALUE_SOURCES: readonly ActionTypeConditionValueFrom[] = [
  "const",
  "property",
  "check_time",
  "check_date",
];

function toolKey(boxId: string, toolId: string) {
  return `${boxId}${TOOL_KEY_SEPARATOR}${toolId}`;
}

function isCheckTime(value: unknown) {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { check_time?: unknown }).check_time === "date"
  );
}

function isNumberType(type: string | undefined) {
  return type === "number" || type === "integer";
}

/** Only a text parameter can take the day of the check. */
function takesCheckDate(parameter: KnEventRuleToolParameter) {
  return !parameter.type || parameter.type === "string";
}

function parameterDrafts(parameters: Record<string, unknown> | undefined) {
  return Object.fromEntries(
    Object.entries(parameters ?? {}).map(([name, value]): [string, ParameterDraft] => [
      name,
      isCheckTime(value) ? { mode: "checkDate" } : { mode: "fixed", value },
    ]),
  );
}

function isEmptyValue(value: unknown) {
  return value === undefined || value === null || (typeof value === "string" && !value.trim());
}

/** The rule a saved type has, also when only its rule tool is known. */
function savedRuleOf(eventType: KnEventType | undefined): KnEventRule | null {
  if (eventType?.rule) return eventType.rule;
  return eventType?.rule_tool ? { basis: "function", tool: eventType.rule_tool } : null;
}

/** A comparison row with only some of its parts chosen. */
function hasIncompleteRow(condition: ActionTypeCondition | null | undefined): boolean {
  if (!condition) return false;
  if (isLogicalOperation(condition.operation)) {
    return (condition.subConditions ?? []).some(hasIncompleteRow);
  }
  return Boolean(condition.field) !== Boolean(condition.operation);
}

export function EventClassFormDrawer({
  eventClassIds,
  eventType,
  initialSubject,
  networkId,
  onClose,
  onSaved,
  open,
  versioned,
}: EventClassFormDrawerProps) {
  const { t } = useTranslation();
  const { message } = useAppServices();
  const [form] = Form.useForm<FormValues>();
  const editing = Boolean(eventType);
  const source = Form.useWatch("source", form) ?? eventType?.source ?? "rule";
  const ruleToolKey = Form.useWatch("ruleTool", form);
  const watchedSubject = Form.useWatch("subject", form);
  const watchedCode = Form.useWatch("code", form);
  const watchedName = Form.useWatch("name", form);
  const [subjects, setSubjects] = useState<KnowledgeNetworkObjectTypeRecord[]>([]);
  const [subjectsLoading, setSubjectsLoading] = useState(false);
  const [propertyOptions, setPropertyOptions] = useState<RelationTypePropertyOption[]>([]);
  const [tools, setTools] = useState<KnEventRuleToolOption[]>([]);
  const [toolsLoading, setToolsLoading] = useState(false);
  const [basis, setBasis] = useState<RuleBasis>("condition");
  const [condition, setCondition] = useState<ActionTypeCondition | null>(null);
  const [cypher, setCypher] = useState<CypherRuleDraft>(() => cypherDraftFromRule(undefined));
  const [parameters, setParameters] = useState<Record<string, ParameterDraft>>({});
  const [schedule, setSchedule] = useState<EventScheduleDraft>(DEFAULT_EVENT_SCHEDULE);
  const [timezone, setTimezone] = useState(DEFAULT_EVENT_TIMEZONE);
  const [submitting, setSubmitting] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [trial, setTrial] = useState<Omit<EventRuleTrialState, "stale">>({ running: false });
  const [trialSignature, setTrialSignature] = useState<string>();
  const trialRequest = useRef(0);

  useEffect(() => {
    if (!open) return;
    const savedRule = savedRuleOf(eventType);
    form.resetFields();
    form.setFieldsValue({
      code: eventType?.code ?? "",
      handlingNote: eventType?.handling_note ?? "",
      mergeHours: eventType?.merge_hours ?? 0,
      name: eventType?.name ?? "",
      ruleTool:
        savedRule?.basis === "function"
          ? toolKey(savedRule.tool.box_id, savedRule.tool.tool_id)
          : undefined,
      severity: eventType?.severity || undefined,
      source: eventType?.source ?? "rule",
      subject: eventType?.subject || initialSubject || undefined,
    });
    // An existing class opens on what its rule selects by; a new one on a condition.
    setBasis(savedRule?.basis ?? "condition");
    setCondition(savedRule?.basis === "condition" ? savedRule.condition : null);
    setCypher(cypherDraftFromRule(savedRule?.basis === "cypher" ? savedRule.cypher : undefined));
    setParameters(
      parameterDrafts(savedRule?.basis === "function" ? savedRule.tool.parameters : {}),
    );
    setSchedule(
      eventType?.check_schedule
        ? scheduleFromCron(eventType.check_schedule.cron)
        : DEFAULT_EVENT_SCHEDULE,
    );
    setTimezone(eventType?.check_schedule?.timezone || DEFAULT_EVENT_TIMEZONE);
    setProblem(null);
    trialRequest.current += 1;
    setTrial({ running: false });
    setTrialSignature(undefined);
  }, [eventType, form, initialSubject, open]);

  useEffect(() => {
    if (!open || !networkId) return;
    let cancelled = false;
    setSubjectsLoading(true);
    void listKnowledgeNetworkObjectTypes(networkId, { skipErrorToast: true })
      .then((items) => {
        if (!cancelled) setSubjects(items.filter((item) => !eventClassIds.has(item.id)));
      })
      .catch(() => {
        if (!cancelled) setSubjects([]);
      })
      .finally(() => {
        if (!cancelled) setSubjectsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [eventClassIds, networkId, open]);

  useEffect(() => {
    if (!open || !networkId || source !== "rule" || basis !== "function") return;
    let cancelled = false;
    setToolsLoading(true);
    void listKnEventRuleTools(networkId)
      .then((items) => {
        if (!cancelled) setTools(items);
      })
      .catch(() => {
        if (!cancelled) setTools([]);
      })
      .finally(() => {
        if (!cancelled) setToolsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [basis, networkId, open, source]);

  // A condition compares the subject's properties.
  useEffect(() => {
    if (!open || !networkId || source !== "rule" || !watchedSubject) {
      setPropertyOptions([]);
      return;
    }
    let cancelled = false;
    void getKnowledgeNetworkObjectTypeDetail(networkId, watchedSubject)
      .then((detail) => {
        if (cancelled) return;
        setPropertyOptions(
          detail?.dataProperties.map((item) => ({
            comment: item.comment,
            displayName: item.displayName || item.name,
            label: item.displayName || item.name,
            name: item.name,
            type: item.type,
            value: item.name,
          })) ?? [],
        );
      })
      .catch(() => {
        if (!cancelled) setPropertyOptions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [networkId, open, source, watchedSubject]);

  // A condition on another object type's properties means nothing for a new subject.
  useEffect(() => {
    if (condition?.objectTypeId && watchedSubject && condition.objectTypeId !== watchedSubject) {
      setCondition(null);
    }
  }, [condition?.objectTypeId, watchedSubject]);

  const selectedTool = useMemo(
    () => tools.find((tool) => toolKey(tool.boxId, tool.toolId) === ruleToolKey),
    [ruleToolKey, tools],
  );

  const savedRule = savedRuleOf(eventType);
  const savedTool = savedRule?.basis === "function" ? savedRule.tool : undefined;
  const toolOptions = useMemo(() => {
    const groups = new Map<
      string,
      { label: string; options: Array<{ label: string; value: string }> }
    >();
    tools.forEach((tool) => {
      const group = groups.get(tool.boxId) ?? { label: tool.boxName, options: [] };
      group.options.push({ label: tool.toolName, value: toolKey(tool.boxId, tool.toolId) });
      groups.set(tool.boxId, group);
    });
    // A saved tool that is no longer offered (disabled, box withdrawn) stays readable.
    if (
      savedTool &&
      !tools.some((tool) => tool.boxId === savedTool.box_id && tool.toolId === savedTool.tool_id)
    ) {
      groups.set(`saved:${savedTool.box_id}`, {
        label: t("knowledgeNetwork.eventClasses.form.ruleToolUnavailableGroup"),
        options: [
          {
            label: `${savedTool.box_id} / ${savedTool.tool_id}`,
            value: toolKey(savedTool.box_id, savedTool.tool_id),
          },
        ],
      });
    }
    return [...groups.values()];
  }, [savedTool, t, tools]);

  const updateParameter = (name: string, next: ParameterDraft) =>
    setParameters((current) => ({ ...current, [name]: next }));

  // A rule class without a recognition action: nothing checks it until a rule is set.
  const legacyRuleWithoutAction =
    editing && eventType?.source === "rule" && !eventType.recognition_action_id;
  // A recognition action that selects by a metric: the form does not edit it, and keeps it
  // unless a rule is set here.
  const metricBasis =
    editing &&
    Boolean(eventType?.recognition_action_id) &&
    eventType?.recognition_basis === "metric";
  const ruleRequired = !legacyRuleWithoutAction && !metricBasis;
  // The backend refuses to move the subject of a class while its recognition action is bound to it.
  const subjectLocked = editing && Boolean(eventType?.recognition_action_id);

  /** The rule tool and its arguments to send, or a problem to show. */
  const buildRuleTool = (): { ruleTool: KnEventRuleTool | null } | { problem: string } => {
    if (!ruleToolKey) return { ruleTool: null };
    const [boxId, toolId] = ruleToolKey.split(TOOL_KEY_SEPARATOR);
    // A tool not offered any more keeps the arguments it was saved with.
    const declared = selectedTool?.parameters;
    const names = declared ? declared.map((item) => item.name) : Object.keys(parameters);
    const args: Record<string, unknown> = {};
    for (const name of names) {
      const draft = parameters[name] ?? { mode: "fixed" };
      const declaration = declared?.find((item) => item.name === name);
      if (draft.mode === "checkDate") {
        args[name] = { check_time: "date" };
        continue;
      }
      if (isEmptyValue(draft.value)) {
        if (declaration?.required) {
          return { problem: t("knowledgeNetwork.eventClasses.form.parameterRequired", { name }) };
        }
        continue;
      }
      args[name] = draft.value;
    }
    return { ruleTool: { box_id: boxId, parameters: args, tool_id: toolId } };
  };

  /** The rule on the chosen tab, none when that tab is empty, or a problem to show. */
  const buildRule = (): { rule: KnEventRule | null } | { problem: string } => {
    if (basis === "condition") {
      if (hasIncompleteRow(condition)) {
        return { problem: t("knowledgeNetwork.eventClasses.form.conditionIncomplete") };
      }
      const normalized = promoteLegacyActionCondition(condition);
      if (!normalized || !(normalized.field || normalized.subConditions?.length)) {
        return { rule: null };
      }
      const invalid = validateActionCondition(normalized, propertyOptions, []);
      if (invalid) return { problem: t(invalid) };
      return { rule: { basis: "condition", condition: normalized } };
    }
    if (basis === "cypher") {
      const built = buildCypherRule(cypher, t);
      if ("problem" in built) return built;
      return { rule: built.cypher ? { basis: "cypher", cypher: built.cypher } : null };
    }
    const built = buildRuleTool();
    if ("problem" in built) return built;
    return { rule: built.ruleTool ? { basis: "function", tool: built.ruleTool } : null };
  };

  const buildSchedule = (): { cron: string } | { problem: string } => {
    const cron = cronFromSchedule(schedule);
    if (cron.split(/\s+/).length !== 5) {
      return { problem: t("knowledgeNetwork.eventClasses.form.cronInvalid") };
    }
    return { cron };
  };

  // What the trial result depends on: the rule, its subject and the time zone of check_time.
  const ruleSignature = JSON.stringify({
    basis,
    condition: basis === "condition" ? condition : undefined,
    cypher:
      basis === "cypher"
        ? {
            parameters: cypher.parameters.map(({ name, value, value_from }) => ({
              name,
              value,
              value_from,
            })),
            query: cypher.query,
          }
        : undefined,
    parameters: basis === "function" ? parameters : undefined,
    ruleToolKey: basis === "function" ? ruleToolKey : undefined,
    subject: watchedSubject,
    timezone,
  });

  const runTrial = async () => {
    const subject = form.getFieldValue("subject") as string | undefined;
    if (!subject) {
      setTrial({ error: t("knowledgeNetwork.eventClasses.form.subjectRequired"), running: false });
      return;
    }
    const built = buildRule();
    if ("problem" in built) {
      setTrial({ error: built.problem, running: false });
      return;
    }
    if (!built.rule) {
      setTrial({ error: t("knowledgeNetwork.eventClasses.form.ruleRequired"), running: false });
      return;
    }
    const checked = buildSchedule();
    if ("problem" in checked) {
      setTrial({ error: checked.problem, running: false });
      return;
    }
    const request = ++trialRequest.current;
    const signature = ruleSignature;
    setTrial((current) => ({ result: current.result, running: true }));
    try {
      const result = await trialKnEventRule(
        networkId,
        {
          check_schedule: { cron: checked.cron, timezone },
          code: (watchedCode ?? "").trim() || eventType?.code || "",
          name: (watchedName ?? "").trim() || eventType?.name || "",
          rule: built.rule,
          subject,
        },
        { versioned },
      );
      if (request !== trialRequest.current) return;
      setTrial({ result, running: false });
      setTrialSignature(signature);
    } catch (error) {
      if (request !== trialRequest.current) return;
      // A rule the platform cannot run is told in the details of its refusal.
      const details = extractRequestErrorDetails(error);
      setTrial({
        error: t("knowledgeNetwork.eventClasses.form.trialFailed", {
          message: details.details || details.description,
        }),
        running: false,
      });
    }
  };

  const handleSubmit = async () => {
    setProblem(null);
    let values: FormValues;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }
    const isRule = values.source === "rule";
    let rule: KnEventRule | null = null;
    let cron = "";
    if (isRule) {
      const built = buildRule();
      if ("problem" in built) {
        setProblem(built.problem);
        return;
      }
      rule = built.rule;
      if (!rule && ruleRequired) {
        setProblem(t("knowledgeNetwork.eventClasses.form.ruleRequired"));
        return;
      }
      if (rule) {
        const checked = buildSchedule();
        if ("problem" in checked) {
          setProblem(checked.problem);
          return;
        }
        cron = checked.cron;
      }
    }
    const shared = {
      check_schedule: rule ? { cron, timezone } : null,
      handling_note: values.handlingNote?.trim() ?? "",
      merge_hours: isRule ? (eventType?.merge_hours ?? 0) : (values.mergeHours ?? 0),
      name: values.name.trim(),
      rule,
      severity: values.severity ?? "",
      subject: values.subject ?? "",
    };
    setSubmitting(true);
    try {
      const saved = eventType
        ? await updateKnEventType(networkId, eventType.code, shared)
        : await createKnEventType(networkId, {
            ...shared,
            code: values.code.trim(),
            source: values.source,
          });
      const savedTrial = saved.trial;
      if (savedTrial && typeof savedTrial.hits === "number") {
        void message.success(
          t(
            savedTrial.limited
              ? "knowledgeNetwork.eventClasses.form.savedWithLimitedTrial"
              : "knowledgeNetwork.eventClasses.form.savedWithTrial",
            { count: savedTrial.hits },
          ),
        );
      } else {
        void message.success(t("common.success"));
      }
      onSaved(saved);
    } catch {
      // The request layer has shown the refusal; the drawer stays open to fix it.
    } finally {
      setSubmitting(false);
    }
  };

  const renderParameter = (parameter: KnEventRuleToolParameter) => {
    const draft = parameters[parameter.name] ?? { mode: "fixed" };
    const valueControl = isNumberType(parameter.type) ? (
      <InputNumber
        aria-label={parameter.name}
        className={styles.parameterValue}
        onChange={(value) => updateParameter(parameter.name, { mode: "fixed", value })}
        value={typeof draft.value === "number" ? draft.value : null}
      />
    ) : parameter.type === "boolean" ? (
      <Switch
        aria-label={parameter.name}
        checked={draft.value === true}
        onChange={(value) => updateParameter(parameter.name, { mode: "fixed", value })}
      />
    ) : (
      <Input
        aria-label={parameter.name}
        className={styles.parameterValue}
        onChange={(event) =>
          updateParameter(parameter.name, { mode: "fixed", value: event.target.value })
        }
        value={typeof draft.value === "string" ? draft.value : ""}
      />
    );
    return (
      <div className={styles.parameterRow} key={parameter.name}>
        <div className={styles.parameterName}>
          <Typography.Text code>{parameter.name}</Typography.Text>
          {parameter.type ? (
            <Typography.Text type="secondary">{parameter.type}</Typography.Text>
          ) : null}
          {parameter.required ? (
            <Typography.Text type="danger">
              {t("knowledgeNetwork.eventClasses.form.parameterRequiredMark")}
            </Typography.Text>
          ) : null}
        </div>
        {parameter.description ? (
          <Typography.Text className={styles.parameterHint} type="secondary">
            {parameter.description}
          </Typography.Text>
        ) : null}
        <Space wrap>
          {takesCheckDate(parameter) ? (
            <Select
              aria-label={t("knowledgeNetwork.eventClasses.form.parameterMode")}
              className={styles.parameterMode}
              onChange={(mode: ParameterDraft["mode"]) =>
                updateParameter(parameter.name, { mode, value: draft.value })
              }
              options={[
                { label: t("knowledgeNetwork.eventClasses.form.parameterFixed"), value: "fixed" },
                {
                  label: t("knowledgeNetwork.eventClasses.form.parameterCheckDate"),
                  value: "checkDate",
                },
              ]}
              value={draft.mode}
            />
          ) : null}
          {draft.mode === "fixed" ? valueControl : null}
        </Space>
      </div>
    );
  };

  const subjectRecord = subjects.filter((item) => item.id === watchedSubject);

  const renderRuleEditor = () => {
    if (basis === "condition") {
      return watchedSubject ? (
        <Space direction="vertical" size={8} className={styles.block}>
          <ActionTypeConditionEditor
            boundObjectTypeId={watchedSubject}
            hideObjectTypeSelect
            objectTypes={subjectRecord}
            onChange={(next) => setCondition(next ?? null)}
            propertyOptions={propertyOptions}
            value={condition}
            valueSources={CONDITION_VALUE_SOURCES}
          />
          <Typography.Text className={styles.parameterHint} type="secondary">
            {t("knowledgeNetwork.eventClasses.form.conditionHint")}
          </Typography.Text>
        </Space>
      ) : (
        <Typography.Text type="secondary">
          {t("knowledgeNetwork.eventClasses.form.conditionSubjectFirst")}
        </Typography.Text>
      );
    }
    if (basis === "cypher") {
      return <EventCypherRuleEditor onChange={setCypher} value={cypher} />;
    }
    return (
      <>
        <Form.Item
          extra={t("knowledgeNetwork.eventClasses.form.ruleToolHint")}
          label={t("knowledgeNetwork.eventClasses.form.ruleTool")}
          name="ruleTool"
          rules={[
            {
              message: t("knowledgeNetwork.eventClasses.form.ruleToolRequired"),
              required: ruleRequired,
            },
          ]}
        >
          <Select
            allowClear={!ruleRequired}
            loading={toolsLoading}
            notFoundContent={
              toolsLoading ? undefined : t("knowledgeNetwork.eventClasses.form.ruleToolEmpty")
            }
            optionFilterProp="label"
            options={toolOptions}
            placeholder={t("knowledgeNetwork.eventClasses.form.ruleToolPlaceholder")}
            showSearch
          />
        </Form.Item>
        {ruleToolKey && selectedTool && selectedTool.parameters.length > 0 ? (
          <Form.Item label={t("knowledgeNetwork.eventClasses.form.parameters")}>
            <div className={styles.parameters}>{selectedTool.parameters.map(renderParameter)}</div>
          </Form.Item>
        ) : null}
      </>
    );
  };

  const footer = (
    <div className={styles.footer}>
      <AppButton onClick={onClose}>{t("common.cancel")}</AppButton>
      <AppButton loading={submitting} onClick={() => void handleSubmit()} type="primary">
        {t("common.save")}
      </AppButton>
    </div>
  );

  const sectionTitle = (key: string) => (
    <Typography.Title className={styles.sectionTitle} level={5}>
      {t(`knowledgeNetwork.eventClasses.form.${key}`)}
    </Typography.Title>
  );

  return (
    <Drawer
      destroyOnHidden
      footer={footer}
      maskClosable={false}
      onClose={onClose}
      open={open}
      title={
        editing
          ? t("knowledgeNetwork.eventClasses.form.editTitle")
          : t("knowledgeNetwork.eventClasses.form.createTitle")
      }
      width={680}
    >
      <Space direction="vertical" size={12} className={styles.block}>
        {versioned ? (
          <Alert
            message={t("knowledgeNetwork.eventClasses.form.versionedHint")}
            showIcon
            type="info"
          />
        ) : null}
        {legacyRuleWithoutAction ? (
          <Alert
            message={t("knowledgeNetwork.eventClasses.form.legacyRuleHint")}
            showIcon
            type="warning"
          />
        ) : null}
        {metricBasis ? (
          <Alert
            message={t("knowledgeNetwork.eventClasses.form.metricBasisHint")}
            showIcon
            type="info"
          />
        ) : null}
        {problem ? <Alert message={problem} showIcon type="error" /> : null}
      </Space>
      <Form<FormValues> colon={false} form={form} layout="vertical" className={styles.form}>
        {sectionTitle("sectionBasics")}
        <Form.Item
          label={t("knowledgeNetwork.eventClasses.form.name")}
          name="name"
          rules={[
            {
              message: t("knowledgeNetwork.eventClasses.form.nameRequired"),
              required: true,
              whitespace: true,
            },
            { max: 128 },
          ]}
        >
          <Input
            maxLength={128}
            placeholder={t("knowledgeNetwork.eventClasses.form.namePlaceholder")}
          />
        </Form.Item>
        <Form.Item
          extra={t("knowledgeNetwork.eventClasses.form.codeHint")}
          label={t("knowledgeNetwork.eventClasses.form.code")}
          name="code"
          rules={[
            { message: t("knowledgeNetwork.eventClasses.form.codeRequired"), required: true },
            { message: t("knowledgeNetwork.eventClasses.form.codeInvalid"), pattern: CODE_PATTERN },
          ]}
        >
          <Input disabled={editing} maxLength={64} placeholder="order_overdue" />
        </Form.Item>
        <Form.Item
          extra={t("knowledgeNetwork.eventClasses.form.sourceHint")}
          label={t("knowledgeNetwork.eventClasses.form.source")}
          name="source"
        >
          <Radio.Group
            disabled={editing}
            options={[
              { label: t("knowledgeNetwork.eventClasses.source.rule"), value: "rule" },
              { label: t("knowledgeNetwork.eventClasses.source.report"), value: "report" },
            ]}
          />
        </Form.Item>
        <Form.Item
          extra={
            subjectLocked
              ? t("knowledgeNetwork.eventClasses.form.subjectLockedHint")
              : source === "rule"
                ? t("knowledgeNetwork.eventClasses.form.subjectRuleHint")
                : t("knowledgeNetwork.eventClasses.form.subjectHint")
          }
          label={t("knowledgeNetwork.eventClasses.form.subject")}
          name="subject"
          rules={[
            {
              message: t("knowledgeNetwork.eventClasses.form.subjectRequired"),
              required: true,
            },
          ]}
        >
          <Select
            disabled={subjectLocked}
            loading={subjectsLoading}
            optionFilterProp="label"
            options={subjects.map((item) => ({ label: item.name || item.id, value: item.id }))}
            placeholder={t("knowledgeNetwork.eventClasses.form.subjectPlaceholder")}
            showSearch
          />
        </Form.Item>
        <Form.Item label={t("knowledgeNetwork.eventClasses.form.severity")} name="severity">
          <Select
            allowClear
            options={SEVERITIES.map((value) => ({ label: value, value }))}
            placeholder={t("knowledgeNetwork.eventClasses.form.severityPlaceholder")}
          />
        </Form.Item>
        {source === "report" ? (
          <Form.Item
            extra={t("knowledgeNetwork.eventClasses.form.mergeHoursHint")}
            label={t("knowledgeNetwork.eventClasses.form.mergeHours")}
            name="mergeHours"
          >
            <InputNumber
              addonAfter={t("knowledgeNetwork.eventClasses.schedule.hoursUnit")}
              min={0}
            />
          </Form.Item>
        ) : (
          <>
            {sectionTitle("sectionRule")}
            <Form.Item
              extra={t("knowledgeNetwork.eventClasses.form.scheduleHint")}
              label={t("knowledgeNetwork.eventClasses.form.schedule")}
            >
              <EventScheduleEditor
                onChange={setSchedule}
                onTimezoneChange={setTimezone}
                schedule={schedule}
                timezone={timezone}
              />
            </Form.Item>
            <Form.Item label={t("knowledgeNetwork.eventClasses.form.when")}>
              <Tabs
                activeKey={basis}
                items={BASES.map((key) => ({
                  key,
                  label: t(`knowledgeNetwork.eventClasses.form.basisTabs.${key}`),
                }))}
                onChange={(key) => setBasis(key as RuleBasis)}
                size="small"
              />
              {renderRuleEditor()}
            </Form.Item>
            <Form.Item>
              <EventRuleTrial
                onTry={() => void runTrial()}
                state={{
                  ...trial,
                  stale: Boolean(trial.result) && trialSignature !== ruleSignature,
                }}
              />
            </Form.Item>
          </>
        )}
        {sectionTitle("sectionHandling")}
        <Form.Item label={t("knowledgeNetwork.eventClasses.form.then")} name="handlingNote">
          <Input.TextArea
            autoSize={{ maxRows: 6, minRows: 2 }}
            maxLength={500}
            placeholder={t("knowledgeNetwork.eventClasses.form.handlingNotePlaceholder")}
            showCount
          />
        </Form.Item>
      </Form>
    </Drawer>
  );
}
