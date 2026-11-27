/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  EditOutlined,
  PlusOutlined,
  QuestionCircleOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Card,
  Col,
  Drawer,
  Flex,
  Form,
  Input,
  InputNumber,
  Radio,
  Row,
  Select,
  Space,
  Switch,
  Tabs,
  Tooltip,
  Typography,
} from "antd";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { buildAppPath } from "@/app/router/app-paths";
import { useAppServices } from "@/framework/context/use-app-services";
import { extractRequestErrorDetails } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { ActionTypeConditionEditor } from "@/modules/knowledge-network/components/action-type/ActionTypeConditionEditor";
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
  describeKnEventError,
  listKnEventHandlingCandidates,
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
  KnEventHandlingCandidate,
  KnEventHandlingInput,
  KnEventHandlingMode,
  KnEventHandlingParameter,
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
  handlingAction?: string;
  handlingMode?: KnEventHandlingMode;
  handlingNote?: string;
  /** Values for the inputs of the handling action, by the input's name. */
  handlingParameters?: Record<string, HandlingParameterDraft>;
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

/** An input of the handling action as the form edits it. */
type HandlingParameterDraft = {
  from?: KnEventHandlingParameter["value_from"];
  value?: boolean | number | string | null;
};

/** The code is the ID of the event class, an object type. */
const CODE_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const SEVERITIES = ["P1", "P2", "P3", "P4"];
const TOOL_KEY_SEPARATOR = "\u0000";
/**
 * What a rule is written as. A Cypher query is written as a function of the network, which can be
 * tried and reused there; a rule saved as a plain query is still shown, read-only.
 */
const BASES: readonly RuleBasis[] = ["condition", "function"];
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

/** The types of action type parameters that take a number. */
const NUMERIC_INPUT_TYPES = new Set([
  "decimal",
  "double",
  "float",
  "integer",
  "long",
  "number",
  "short",
]);

function isBlankValue(value: unknown) {
  return value === undefined || value === null || (typeof value === "string" && !value.trim());
}

function handlingDrafts(
  parameters: Record<string, KnEventHandlingParameter> | undefined,
): Record<string, HandlingParameterDraft> {
  return Object.fromEntries(
    Object.entries(parameters ?? {}).map(([name, parameter]) => [
      name,
      {
        from: parameter.value_from,
        value:
          parameter.value === null ||
          typeof parameter.value === "boolean" ||
          typeof parameter.value === "number" ||
          typeof parameter.value === "string"
            ? parameter.value
            : JSON.stringify(parameter.value),
      },
    ]),
  );
}

/** The values the form gives the named inputs; inputs left blank are left out. */
function handlingParametersOf(
  names: readonly string[],
  drafts: Record<string, HandlingParameterDraft> | undefined,
): Record<string, KnEventHandlingParameter> | undefined {
  const parameters: Record<string, KnEventHandlingParameter> = {};
  for (const name of names) {
    const draft = drafts?.[name];
    if (!draft || isBlankValue(draft.value)) continue;
    parameters[name] = {
      value: typeof draft.value === "string" ? draft.value.trim() : draft.value,
      value_from: draft.from ?? "const",
    };
  }
  return Object.keys(parameters).length ? parameters : undefined;
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

/** A page of the studio, opened beside this one so the drawer keeps what is typed in it. */
function openInNewTab(path: string) {
  window.open(buildAppPath(path), "_blank", "noopener,noreferrer");
}

function FormCard({
  children,
  hint,
  title,
}: {
  children: ReactNode;
  hint?: string;
  title: string;
}) {
  return (
    <section aria-label={title} className={styles.card}>
      <Card size="small" styles={{ body: { padding: "16px 18px 2px" } }}>
        <Flex align="center" gap={4} style={{ marginBottom: 12 }} wrap>
          <Typography.Title level={3} style={{ fontSize: 15, lineHeight: "22px", margin: 0 }}>
            {title}
          </Typography.Title>
          {hint ? (
            <Tooltip title={hint} trigger={["hover", "focus"]}>
              <AppButton
                aria-label={hint}
                icon={<QuestionCircleOutlined aria-hidden className={styles.hintIcon} />}
                size="small"
                type="text"
              />
            </Tooltip>
          ) : null}
        </Flex>
        {children}
      </Card>
    </section>
  );
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
  const handlingActionId = Form.useWatch("handlingAction", form);
  const handlingMode = Form.useWatch("handlingMode", form);
  const handlingParameterDrafts = Form.useWatch("handlingParameters", form);
  const [handlingCandidates, setHandlingCandidates] = useState<KnEventHandlingCandidate[]>([]);
  const [handlingLoading, setHandlingLoading] = useState(false);
  const [subjects, setSubjects] = useState<KnowledgeNetworkObjectTypeRecord[]>([]);
  const [subjectsLoading, setSubjectsLoading] = useState(false);
  const [propertyOptions, setPropertyOptions] = useState<RelationTypePropertyOption[]>([]);
  const [tools, setTools] = useState<KnEventRuleToolOption[]>([]);
  const [toolsLoading, setToolsLoading] = useState(false);
  const [basis, setBasis] = useState<RuleBasis>("condition");
  const [condition, setCondition] = useState<ActionTypeCondition | null>(null);
  const [toolsTick, setToolsTick] = useState(0);
  const [parameters, setParameters] = useState<Record<string, ParameterDraft>>({});
  const [schedule, setSchedule] = useState<EventScheduleDraft>(DEFAULT_EVENT_SCHEDULE);
  const [timezone, setTimezone] = useState(DEFAULT_EVENT_TIMEZONE);
  // A fixed rate the stored schedule runs at that the editor cannot show; kept until edited.
  const [keptRate, setKeptRate] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [trial, setTrial] = useState<Omit<EventRuleTrialState, "stale">>({ running: false });
  const [trialSignature, setTrialSignature] = useState<string>();
  const trialRequest = useRef(0);
  const problemRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const savedRule = savedRuleOf(eventType);
    form.resetFields();
    form.setFieldsValue({
      code: eventType?.code ?? "",
      handlingAction: eventType?.handling_action?.action_type_id,
      handlingMode:
        eventType?.handling_action?.mode ??
        ((eventType?.source ?? "rule") === "rule" ? "auto" : "suggest"),
      handlingNote: eventType?.handling_note ?? "",
      handlingParameters: handlingDrafts(eventType?.handling_action?.parameters),
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
    setParameters(
      parameterDrafts(savedRule?.basis === "function" ? savedRule.tool.parameters : {}),
    );
    setSchedule(
      eventType?.check_schedule
        ? scheduleFromCron(eventType.check_schedule.cron)
        : DEFAULT_EVENT_SCHEDULE,
    );
    setTimezone(eventType?.check_schedule?.timezone || DEFAULT_EVENT_TIMEZONE);
    setKeptRate(eventType?.check_schedule?.rate || null);
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
  }, [basis, networkId, open, source, toolsTick]);

  // A handling action acts on the subject.
  useEffect(() => {
    if (!open || !networkId || !watchedSubject) {
      setHandlingCandidates([]);
      return;
    }
    let cancelled = false;
    setHandlingLoading(true);
    void listKnEventHandlingCandidates(networkId, watchedSubject)
      .then((items) => {
        if (!cancelled) setHandlingCandidates(items);
      })
      .catch(() => {
        if (!cancelled) setHandlingCandidates([]);
      })
      .finally(() => {
        if (!cancelled) setHandlingLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [networkId, open, watchedSubject]);

  // A reported event is not found by a check: nothing runs its handling action by itself.
  useEffect(() => {
    if (source === "report" && form.getFieldValue("handlingMode") === "auto") {
      form.setFieldValue("handlingMode", "suggest");
    }
  }, [form, source]);

  // A condition compares the subject's properties; an input of the handling action can take one.
  useEffect(() => {
    if (!open || !networkId || !watchedSubject) {
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
  }, [networkId, open, watchedSubject]);

  // A condition on another object type's properties means nothing for a new subject.
  useEffect(() => {
    if (condition?.objectTypeId && watchedSubject && condition.objectTypeId !== watchedSubject) {
      setCondition(null);
    }
  }, [condition?.objectTypeId, watchedSubject]);

  // The problem shows under the form, where the save was pressed; bring it into view.
  useEffect(() => {
    if (problem) problemRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [problem]);

  const selectedTool = useMemo(
    () => tools.find((tool) => toolKey(tool.boxId, tool.toolId) === ruleToolKey),
    [ruleToolKey, tools],
  );

  const savedRule = savedRuleOf(eventType);
  const savedTool = savedRule?.basis === "function" ? savedRule.tool : undefined;
  // A rule saved as a plain Cypher query is kept as it is unless another basis replaces it.
  const savedCypher = savedRule?.basis === "cypher" ? savedRule.cypher : undefined;
  const bases: readonly RuleBasis[] = savedCypher ? [...BASES, "cypher"] : BASES;
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
      return { rule: savedCypher ? { basis: "cypher", cypher: savedCypher } : null };
    }
    const built = buildRuleTool();
    if ("problem" in built) return built;
    return { rule: built.ruleTool ? { basis: "function", tool: built.ruleTool } : null };
  };

  const buildSchedule = (): { cron: string; rate?: string } | { problem: string } => {
    if (keptRate) return { cron: "", rate: keptRate };
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
    cypher: basis === "cypher" ? savedCypher : undefined,
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
          check_schedule: { ...checked, timezone },
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
    let checkSchedule: { cron: string; rate?: string } = { cron: "" };
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
        checkSchedule = checked;
      }
    }
    // Until the candidates are read, the inputs are the ones the class already gives.
    const chosenHandling = handlingCandidates.find((item) => item.id === values.handlingAction);
    const handlingInputNames = chosenHandling
      ? chosenHandling.inputs.map((input) => input.name)
      : values.handlingAction === eventType?.handling_action?.action_type_id
        ? Object.keys(eventType?.handling_action?.parameters ?? {})
        : [];
    const handlingParameters = handlingParametersOf(
      handlingInputNames,
      form.getFieldValue("handlingParameters") as
        Record<string, HandlingParameterDraft> | undefined,
    );
    const shared = {
      check_schedule: rule ? { ...checkSchedule, timezone } : null,
      handling_action: values.handlingAction
        ? {
            action_type_id: values.handlingAction,
            mode: isRule ? (values.handlingMode ?? "auto") : ("suggest" as const),
            ...(handlingParameters ? { parameters: handlingParameters } : {}),
          }
        : null,
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
    } catch (error) {
      // The drawer stays open to fix what the platform refused.
      setProblem(
        t("knowledgeNetwork.eventClasses.form.saveFailed", {
          message: describeKnEventError(error),
        }),
      );
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
  const F = "knowledgeNetwork.eventClasses.form";
  const chosenHandlingAction = handlingCandidates.find((item) => item.id === handlingActionId);
  // Run by itself, nobody is there to give an input: the class gives each one.
  const runsByItself = source === "rule" && handlingMode === "auto";

  const renderHandlingInput = (input: KnEventHandlingInput) => {
    const from = handlingParameterDrafts?.[input.name]?.from ?? "const";
    const valueLabel = t(`${F}.handlingParameterValue`, { name: input.name });
    const valueControl =
      from === "property" ? (
        <Select
          aria-label={valueLabel}
          className={styles.handlingValue}
          optionFilterProp="label"
          options={propertyOptions.map((option) => ({
            label: option.label === option.name ? option.name : `${option.label} (${option.name})`,
            value: option.name,
          }))}
          placeholder={t(`${F}.handlingParameterPropertyPlaceholder`)}
          showSearch
        />
      ) : input.type === "boolean" ? (
        <Select
          aria-label={valueLabel}
          className={styles.handlingValue}
          options={[
            { label: t(`${F}.handlingParameterTrue`), value: true },
            { label: t(`${F}.handlingParameterFalse`), value: false },
          ]}
          placeholder={t(`${F}.handlingParameterValuePlaceholder`)}
        />
      ) : input.type && NUMERIC_INPUT_TYPES.has(input.type) ? (
        <InputNumber
          aria-label={valueLabel}
          className={styles.handlingValue}
          placeholder={t(`${F}.handlingParameterValuePlaceholder`)}
        />
      ) : (
        <Input
          aria-label={valueLabel}
          className={styles.handlingValue}
          placeholder={t(`${F}.handlingParameterValuePlaceholder`)}
        />
      );
    return (
      <div className={styles.parameterRow} key={input.name}>
        <div className={styles.parameterName}>
          <Typography.Text code>{input.name}</Typography.Text>
          {input.type ? <Typography.Text type="secondary">{input.type}</Typography.Text> : null}
        </div>
        {input.comment ? (
          <Typography.Text className={styles.parameterHint} type="secondary">
            {input.comment}
          </Typography.Text>
        ) : null}
        <div className={styles.handlingInput}>
          <Form.Item initialValue="const" name={["handlingParameters", input.name, "from"]} noStyle>
            <Select
              aria-label={t(`${F}.handlingParameterFrom`, { name: input.name })}
              className={styles.handlingFrom}
              onChange={() =>
                form.setFieldValue(["handlingParameters", input.name, "value"], undefined)
              }
              options={[
                { label: t(`${F}.handlingParameterConst`), value: "const" },
                { label: t(`${F}.handlingParameterProperty`), value: "property" },
              ]}
            />
          </Form.Item>
          <Form.Item
            dependencies={["handlingMode", "source"]}
            name={["handlingParameters", input.name, "value"]}
            noStyle
            rules={[
              {
                validator: (_, value: unknown) =>
                  runsByItself && isBlankValue(value)
                    ? Promise.reject(
                        new Error(t(`${F}.handlingParameterRequired`, { name: input.name })),
                      )
                    : Promise.resolve(),
              },
            ]}
          >
            {valueControl}
          </Form.Item>
        </div>
      </div>
    );
  };

  const renderCypherReadOnly = () =>
    savedCypher ? (
      <Space direction="vertical" size={8} className={styles.block}>
        <Alert message={t(`${F}.cypherReadOnly`)} showIcon type="info" />
        <pre className={styles.cypherQuery}>{savedCypher.query}</pre>
        {Object.entries(savedCypher.parameters ?? {}).map(([name, parameter]) => (
          <Typography.Text key={name} type="secondary">
            <Typography.Text code>${name}</Typography.Text>{" "}
            {parameter.value_from === "check_time"
              ? t(`${F}.valueFromCheckTime`)
              : parameter.value_from === "check_date"
                ? t(`${F}.valueFromCheckDate`)
                : t(`${F}.parameterFixed`)}
            {parameter.value !== undefined && parameter.value !== null && parameter.value !== ""
              ? ` ${String(parameter.value as string | number | boolean)}`
              : ""}
          </Typography.Text>
        ))}
      </Space>
    ) : null;

  const renderFunctionEditor = () => {
    const [boxId, toolId] = ruleToolKey ? ruleToolKey.split(TOOL_KEY_SEPARATOR) : [];
    return (
      <>
        <Form.Item label={t(`${F}.ruleTool`)} required={ruleRequired}>
          <Row align="middle" gutter={[8, 8]}>
            <Col flex="1 1 260px">
              <Form.Item
                noStyle
                name="ruleTool"
                rules={[{ message: t(`${F}.ruleToolRequired`), required: ruleRequired }]}
              >
                <Select
                  allowClear={!ruleRequired}
                  aria-label={t(`${F}.ruleTool`)}
                  loading={toolsLoading}
                  notFoundContent={toolsLoading ? undefined : t(`${F}.ruleToolEmpty`)}
                  optionFilterProp="label"
                  options={toolOptions}
                  placeholder={t(`${F}.ruleToolPlaceholder`)}
                  showSearch
                  style={{ width: "100%" }}
                />
              </Form.Item>
            </Col>
            <Col>
              <Space size={8} wrap>
                <Tooltip title={t(`${F}.reloadFunctions`)}>
                  <AppButton
                    aria-label={t(`${F}.reloadFunctions`)}
                    icon={<ReloadOutlined />}
                    onClick={() => setToolsTick((current) => current + 1)}
                  />
                </Tooltip>
                {boxId && toolId ? (
                  <AppButton
                    icon={<EditOutlined />}
                    onClick={() =>
                      openInNewTab(
                        `/execution-factory/toolboxes/${encodeURIComponent(boxId)}/tools/${encodeURIComponent(toolId)}/edit`,
                      )
                    }
                  >
                    {t(`${F}.editFunction`)}
                  </AppButton>
                ) : null}
                <Tooltip title={t(`${F}.newFunctionHint`)}>
                  <AppButton
                    icon={<PlusOutlined />}
                    onClick={() =>
                      openInNewTab(
                        `/knowledge-network/workspace/${encodeURIComponent(networkId)}/experience/cypher`,
                      )
                    }
                  >
                    {t(`${F}.newFunction`)}
                  </AppButton>
                </Tooltip>
              </Space>
            </Col>
          </Row>
        </Form.Item>
        {ruleToolKey && selectedTool && selectedTool.parameters.length > 0 ? (
          <Form.Item label={t(`${F}.parameters`)}>
            <div className={styles.parameters}>{selectedTool.parameters.map(renderParameter)}</div>
          </Form.Item>
        ) : null}
      </>
    );
  };

  const renderRuleEditor = () => {
    if (basis === "cypher") return renderCypherReadOnly();
    if (basis === "function") return renderFunctionEditor();
    return watchedSubject ? (
      <ActionTypeConditionEditor
        boundObjectTypeId={watchedSubject}
        hideObjectTypeSelect
        objectTypes={subjectRecord}
        onChange={(next) => setCondition(next ?? null)}
        propertyOptions={propertyOptions}
        value={condition}
        valueSources={CONDITION_VALUE_SOURCES}
      />
    ) : (
      <Typography.Text type="secondary">{t(`${F}.conditionSubjectFirst`)}</Typography.Text>
    );
  };

  const footer = (
    <Flex gap={8} justify="flex-end">
      <AppButton onClick={onClose}>{t("common.cancel")}</AppButton>
      <AppButton loading={submitting} onClick={() => void handleSubmit()} type="primary">
        {t("common.save")}
      </AppButton>
    </Flex>
  );

  return (
    <Drawer
      destroyOnHidden
      footer={footer}
      maskClosable={false}
      onClose={onClose}
      open={open}
      title={editing ? t(`${F}.editTitle`) : t(`${F}.createTitle`)}
      width="min(800px, 100vw)"
    >
      <Form<FormValues>
        colon={false}
        form={form}
        layout="vertical"
        style={{ display: "flex", flexDirection: "column", gap: 16 }}
      >
        {versioned ? <Alert message={t(`${F}.versionedHint`)} showIcon type="info" /> : null}
        {legacyRuleWithoutAction ? (
          <Alert message={t(`${F}.legacyRuleHint`)} showIcon type="warning" />
        ) : null}
        {metricBasis ? <Alert message={t(`${F}.metricBasisHint`)} showIcon type="info" /> : null}
        <FormCard title={t(`${F}.sectionBasics`)}>
          <Row gutter={16}>
            <Col sm={12} xs={24}>
              <Form.Item
                label={t(`${F}.name`)}
                name="name"
                rules={[
                  { message: t(`${F}.nameRequired`), required: true, whitespace: true },
                  { max: 128 },
                ]}
              >
                <Input maxLength={128} placeholder={t(`${F}.namePlaceholder`)} />
              </Form.Item>
            </Col>
            <Col sm={12} xs={24}>
              <Form.Item
                label={t(`${F}.code`)}
                name="code"
                rules={[
                  { message: t(`${F}.codeRequired`), required: true },
                  { message: t(`${F}.codeInvalid`), pattern: CODE_PATTERN },
                ]}
                tooltip={t(`${F}.codeHint`)}
              >
                <Input disabled={editing} maxLength={64} placeholder="order_overdue" />
              </Form.Item>
            </Col>
            <Col sm={12} xs={24}>
              <Form.Item label={t(`${F}.source`)} name="source" tooltip={t(`${F}.sourceHint`)}>
                <Radio.Group
                  disabled={editing}
                  options={[
                    { label: t("knowledgeNetwork.eventClasses.source.rule"), value: "rule" },
                    { label: t("knowledgeNetwork.eventClasses.source.report"), value: "report" },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col sm={12} xs={24}>
              <Form.Item label={t(`${F}.severity`)} name="severity">
                <Select
                  allowClear
                  options={SEVERITIES.map((value) => ({ label: value, value }))}
                  placeholder={t(`${F}.severityPlaceholder`)}
                />
              </Form.Item>
            </Col>
            <Col sm={source === "report" ? 12 : 24} xs={24}>
              <Form.Item
                label={t(`${F}.subject`)}
                name="subject"
                rules={[{ message: t(`${F}.subjectRequired`), required: true }]}
                tooltip={
                  subjectLocked
                    ? t(`${F}.subjectLockedHint`)
                    : source === "rule"
                      ? t(`${F}.subjectRuleHint`)
                      : t(`${F}.subjectHint`)
                }
              >
                <Select
                  disabled={subjectLocked}
                  loading={subjectsLoading}
                  optionFilterProp="label"
                  options={subjects.map((item) => ({
                    label: item.name || item.id,
                    value: item.id,
                  }))}
                  placeholder={t(`${F}.subjectPlaceholder`)}
                  showSearch
                />
              </Form.Item>
            </Col>
            {source === "report" ? (
              <Col sm={12} xs={24}>
                <Form.Item
                  label={t(`${F}.mergeHours`)}
                  name="mergeHours"
                  tooltip={t(`${F}.mergeHoursHint`)}
                >
                  <InputNumber
                    className={styles.block}
                    min={0}
                    suffix={t("knowledgeNetwork.eventClasses.schedule.hoursUnit")}
                  />
                </Form.Item>
              </Col>
            ) : null}
          </Row>
        </FormCard>
        {source === "rule" ? (
          <FormCard hint={t(`${F}.whenHint`)} title={t(`${F}.sectionRule`)}>
            <Form.Item label={t(`${F}.schedule`)} tooltip={t(`${F}.scheduleHint`)}>
              {keptRate ? (
                <Alert
                  className={styles.keptRate}
                  message={t(`${F}.keptRate`, { rate: keptRate })}
                  showIcon
                  type="info"
                />
              ) : null}
              <EventScheduleEditor
                onChange={(next) => {
                  setSchedule(next);
                  setKeptRate(null);
                }}
                onTimezoneChange={setTimezone}
                schedule={schedule}
                timezone={timezone}
              />
            </Form.Item>
            <Tabs
              activeKey={basis}
              className={styles.ruleTabs}
              items={bases.map((key) => {
                const label = t(`${F}.basisTabs.${key}`);
                const hint =
                  key === "condition"
                    ? t(`${F}.conditionHint`)
                    : key === "function"
                      ? t(`${F}.ruleToolHint`)
                      : undefined;
                return {
                  key,
                  label: hint ? (
                    <Space size={6}>
                      {label}
                      <Tooltip title={hint}>
                        <QuestionCircleOutlined aria-hidden className={styles.hintIcon} />
                      </Tooltip>
                    </Space>
                  ) : (
                    label
                  ),
                };
              })}
              onChange={(key) => setBasis(key as RuleBasis)}
              size="small"
            />
            {renderRuleEditor()}
            <div className={styles.trial}>
              <EventRuleTrial
                onTry={() => void runTrial()}
                state={{
                  ...trial,
                  stale: Boolean(trial.result) && trialSignature !== ruleSignature,
                }}
              />
            </div>
          </FormCard>
        ) : null}
        <FormCard title={t(`${F}.sectionHandling`)}>
          <Row gutter={16}>
            <Col sm={handlingActionId ? 14 : 24} xs={24}>
              <Form.Item
                label={t(`${F}.handlingAction`)}
                name="handlingAction"
                tooltip={t(`${F}.handlingActionHint`)}
              >
                <Select
                  allowClear
                  aria-label={t(`${F}.handlingAction`)}
                  disabled={!watchedSubject}
                  loading={handlingLoading}
                  notFoundContent={handlingLoading ? undefined : t(`${F}.handlingActionEmpty`)}
                  optionFilterProp="searchText"
                  // The chosen action shows by its name; what it asks for is below.
                  optionLabelProp="searchText"
                  options={handlingCandidates.map((item) => ({
                    // Run by itself, an action that asks for input needs a value for each input.
                    label: item.inputs.length ? (
                      <span>
                        <span>{item.name}</span>{" "}
                        <Typography.Text type="secondary">
                          {t(`${F}.handlingActionInputs`, { count: item.inputs.length })}
                        </Typography.Text>
                      </span>
                    ) : (
                      item.name
                    ),
                    searchText: item.name,
                    value: item.id,
                  }))}
                  placeholder={t(`${F}.handlingActionPlaceholder`)}
                  showSearch
                />
              </Form.Item>
            </Col>
            {handlingActionId ? (
              <Col sm={10} xs={24}>
                <Form.Item
                  dependencies={["handlingAction"]}
                  label={t(`${F}.handlingMode`)}
                  name="handlingMode"
                  tooltip={t(
                    source === "rule" ? `${F}.handlingModeHint` : `${F}.handlingModeReportHint`,
                  )}
                >
                  <Radio.Group
                    optionType="button"
                    options={[
                      {
                        disabled: source !== "rule",
                        label: t(`${F}.handlingModeAuto`),
                        value: "auto",
                      },
                      { label: t(`${F}.handlingModeSuggest`), value: "suggest" },
                    ]}
                  />
                </Form.Item>
              </Col>
            ) : null}
          </Row>
          {chosenHandlingAction?.inputs.length ? (
            <Form.Item
              label={t(`${F}.handlingParameters`)}
              required={runsByItself}
              tooltip={t(`${F}.handlingParametersHint`)}
            >
              <div className={styles.parameters}>
                {chosenHandlingAction.inputs.map(renderHandlingInput)}
              </div>
            </Form.Item>
          ) : null}
          <Form.Item
            className={styles.lastField}
            label={t(`${F}.handlingNote`)}
            name="handlingNote"
          >
            <Input.TextArea
              aria-label={t(`${F}.handlingNote`)}
              autoSize={{ maxRows: 6, minRows: 2 }}
              maxLength={500}
              placeholder={t(`${F}.handlingNotePlaceholder`)}
              showCount
            />
          </Form.Item>
        </FormCard>
        {problem ? (
          <div ref={problemRef}>
            <Alert message={problem} showIcon type="error" />
          </div>
        ) : null}
      </Form>
    </Drawer>
  );
}
