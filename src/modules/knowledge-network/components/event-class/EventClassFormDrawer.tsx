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
  TimePicker,
  Typography,
} from "antd";
import dayjs from "dayjs";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { AppButton } from "@/framework/ui/common/AppButton";
import {
  DEFAULT_EVENT_SCHEDULE,
  DEFAULT_EVENT_TIMEZONE,
  MIN_CHECK_MINUTES,
  cronFromSchedule,
  scheduleFromCron,
  timezoneOptions,
  type EventScheduleDraft,
} from "@/modules/knowledge-network/components/event-class/event-schedule";
import {
  createKnEventType,
  eventClassIdOf,
  listKnEventRuleTools,
  updateKnEventType,
} from "@/modules/knowledge-network/services/event-type.service";
import { listKnowledgeNetworkObjectTypes } from "@/modules/knowledge-network/services/object-type.service";
import type {
  KnEventRuleTool,
  KnEventRuleToolOption,
  KnEventRuleToolParameter,
  KnEventSource,
  KnEventType,
} from "@/modules/knowledge-network/types/event-type";

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
  mergeHours?: number;
  name: string;
  ruleTool?: string;
  severity?: string;
  source: KnEventSource;
  subject?: string;
};

/** A parameter of the rule tool as the form edits it. */
type ParameterDraft = { mode: "fixed" | "checkDate"; value?: unknown };

const CODE_PATTERN = /^[a-z0-9][a-z0-9_.-]{0,63}$/;
const SEVERITIES = ["P1", "P2", "P3", "P4"];
const TOOL_KEY_SEPARATOR = "\u0000";

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
  const [subjects, setSubjects] = useState<Array<{ label: string; value: string }>>([]);
  const [subjectsLoading, setSubjectsLoading] = useState(false);
  const [tools, setTools] = useState<KnEventRuleToolOption[]>([]);
  const [toolsLoading, setToolsLoading] = useState(false);
  const [parameters, setParameters] = useState<Record<string, ParameterDraft>>({});
  const [schedule, setSchedule] = useState<EventScheduleDraft>(DEFAULT_EVENT_SCHEDULE);
  const [timezone, setTimezone] = useState(DEFAULT_EVENT_TIMEZONE);
  const [submitting, setSubmitting] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const zones = useMemo(() => timezoneOptions(), []);

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    form.setFieldsValue({
      code: eventType?.code ?? "",
      mergeHours: eventType?.merge_hours ?? 0,
      name: eventType?.name ?? "",
      ruleTool: eventType?.rule_tool
        ? toolKey(eventType.rule_tool.box_id, eventType.rule_tool.tool_id)
        : undefined,
      severity: eventType?.severity || undefined,
      source: eventType?.source ?? "rule",
      subject: eventType?.subject || initialSubject || undefined,
    });
    setParameters(parameterDrafts(eventType?.rule_tool?.parameters));
    setSchedule(
      eventType?.check_schedule
        ? scheduleFromCron(eventType.check_schedule.cron)
        : DEFAULT_EVENT_SCHEDULE,
    );
    setTimezone(eventType?.check_schedule?.timezone || DEFAULT_EVENT_TIMEZONE);
    setProblem(null);
  }, [eventType, form, initialSubject, open]);

  useEffect(() => {
    if (!open || !networkId) return;
    let cancelled = false;
    setSubjectsLoading(true);
    void listKnowledgeNetworkObjectTypes(networkId, { skipErrorToast: true })
      .then((items) => {
        if (cancelled) return;
        setSubjects(
          items
            .filter((item) => !eventClassIds.has(item.id))
            .map((item) => ({ label: item.name || item.id, value: item.id })),
        );
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
    if (!open || !networkId || source !== "rule") return;
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
  }, [networkId, open, source]);

  const selectedTool = useMemo(
    () => tools.find((tool) => toolKey(tool.boxId, tool.toolId) === ruleToolKey),
    [ruleToolKey, tools],
  );

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
    const saved = eventType?.rule_tool;
    // A saved tool that is no longer offered (disabled, box withdrawn) stays readable.
    if (
      saved &&
      !tools.some((tool) => tool.boxId === saved.box_id && tool.toolId === saved.tool_id)
    ) {
      groups.set(`saved:${saved.box_id}`, {
        label: t("knowledgeNetwork.eventClasses.form.ruleToolUnavailableGroup"),
        options: [
          {
            label: `${saved.box_id} / ${saved.tool_id}`,
            value: toolKey(saved.box_id, saved.tool_id),
          },
        ],
      });
    }
    return [...groups.values()];
  }, [eventType?.rule_tool, t, tools]);

  const updateParameter = (name: string, next: ParameterDraft) =>
    setParameters((current) => ({ ...current, [name]: next }));

  /** The arguments to send, or a problem to show. */
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

  const buildSchedule = (): { cron: string } | { problem: string } => {
    const cron = cronFromSchedule(schedule);
    if (cron.split(/\s+/).length !== 5) {
      return { problem: t("knowledgeNetwork.eventClasses.form.cronInvalid") };
    }
    return { cron };
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
    let ruleTool: KnEventRuleTool | null = null;
    let cron = "";
    if (isRule) {
      const built = buildRuleTool();
      if ("problem" in built) {
        setProblem(built.problem);
        return;
      }
      ruleTool = built.ruleTool;
      if (ruleTool) {
        const checked = buildSchedule();
        if ("problem" in checked) {
          setProblem(checked.problem);
          return;
        }
        cron = checked.cron;
      }
    }
    const shared = {
      check_schedule: ruleTool ? { cron, timezone } : null,
      merge_hours: isRule ? (eventType?.merge_hours ?? 0) : (values.mergeHours ?? 0),
      name: values.name.trim(),
      rule: eventType?.rule ?? {},
      rule_tool: ruleTool,
      rule_version: eventType?.rule_version,
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
      const trial = saved.trial;
      if (!saved.object_type_id) {
        // An event module from before event classes saves the type and makes no class.
        void message.warning(t("knowledgeNetwork.eventClasses.savedWithoutClass"));
      } else if (trial && typeof trial.hits === "number") {
        void message.success(
          t(
            trial.limited
              ? "knowledgeNetwork.eventClasses.form.savedWithLimitedTrial"
              : "knowledgeNetwork.eventClasses.form.savedWithTrial",
            { count: trial.hits },
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

  const scheduleTime = (time: string) => dayjs(`2000-01-01T${time}`);
  const scheduleEditor = (
    <Space direction="vertical" size={8} className={styles.block}>
      <Space wrap>
        <Select
          aria-label={t("knowledgeNetwork.eventClasses.form.scheduleKind")}
          className={styles.scheduleKind}
          onChange={(kind: EventScheduleDraft["kind"]) => {
            const cron = cronFromSchedule(schedule);
            setSchedule(
              kind === "minutes"
                ? { kind, every: 15 }
                : kind === "hours"
                  ? { kind, every: 1 }
                  : kind === "daily"
                    ? { kind, time: "08:00" }
                    : kind === "weekly"
                      ? { kind, time: "08:00", weekday: 1 }
                      : { kind, cron },
            );
          }}
          options={(["minutes", "hours", "daily", "weekly", "cron"] as const).map((kind) => ({
            label: t(`knowledgeNetwork.eventClasses.schedule.kinds.${kind}`),
            value: kind,
          }))}
          value={schedule.kind}
        />
        {schedule.kind === "minutes" ? (
          <InputNumber
            addonAfter={t("knowledgeNetwork.eventClasses.schedule.minutesUnit")}
            aria-label={t("knowledgeNetwork.eventClasses.schedule.kinds.minutes")}
            max={59}
            min={MIN_CHECK_MINUTES}
            onChange={(value) =>
              setSchedule({ kind: "minutes", every: Math.max(MIN_CHECK_MINUTES, value ?? 15) })
            }
            precision={0}
            value={schedule.every}
          />
        ) : null}
        {schedule.kind === "hours" ? (
          <InputNumber
            addonAfter={t("knowledgeNetwork.eventClasses.schedule.hoursUnit")}
            aria-label={t("knowledgeNetwork.eventClasses.schedule.kinds.hours")}
            max={23}
            min={1}
            onChange={(value) => setSchedule({ kind: "hours", every: Math.max(1, value ?? 1) })}
            precision={0}
            value={schedule.every}
          />
        ) : null}
        {schedule.kind === "weekly" ? (
          <Select
            aria-label={t("knowledgeNetwork.eventClasses.schedule.weekday")}
            className={styles.weekday}
            onChange={(weekday: number) => setSchedule({ ...schedule, weekday })}
            options={[1, 2, 3, 4, 5, 6, 0].map((day) => ({
              label: t(`knowledgeNetwork.eventClasses.schedule.weekdays.${day}`),
              value: day,
            }))}
            value={schedule.weekday}
          />
        ) : null}
        {schedule.kind === "daily" || schedule.kind === "weekly" ? (
          <TimePicker
            allowClear={false}
            aria-label={t("knowledgeNetwork.eventClasses.schedule.time")}
            format="HH:mm"
            minuteStep={5}
            onChange={(value) => {
              if (!value) return;
              setSchedule({ ...schedule, time: value.format("HH:mm") });
            }}
            value={scheduleTime(schedule.time)}
          />
        ) : null}
        {schedule.kind === "cron" ? (
          <Input
            aria-label={t("knowledgeNetwork.eventClasses.schedule.kinds.cron")}
            className={styles.cron}
            onChange={(event) => setSchedule({ kind: "cron", cron: event.target.value })}
            placeholder="0 8 * * *"
            value={schedule.cron}
          />
        ) : null}
      </Space>
      <Select
        aria-label={t("knowledgeNetwork.eventClasses.schedule.timezone")}
        className={styles.timezone}
        onChange={(value: string) => setTimezone(value)}
        options={zones.map((zone) => ({ label: zone, value: zone }))}
        showSearch
        value={timezone}
      />
    </Space>
  );

  const footer = (
    <div className={styles.footer}>
      <AppButton onClick={onClose}>{t("common.cancel")}</AppButton>
      <AppButton loading={submitting} onClick={() => void handleSubmit()} type="primary">
        {t("common.save")}
      </AppButton>
    </div>
  );

  const codeValue = Form.useWatch("code", form) ?? "";
  const legacyRuleWithoutTool = editing && eventType?.source === "rule" && !eventType.rule_tool;

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
      width={600}
    >
      <Space direction="vertical" size={12} className={styles.block}>
        {versioned ? (
          <Alert
            message={t("knowledgeNetwork.eventClasses.form.versionedHint")}
            showIcon
            type="info"
          />
        ) : null}
        {legacyRuleWithoutTool ? (
          <Alert
            message={t("knowledgeNetwork.eventClasses.form.legacyRuleHint")}
            showIcon
            type="warning"
          />
        ) : null}
        {problem ? <Alert message={problem} showIcon type="error" /> : null}
      </Space>
      <Form<FormValues> colon={false} form={form} layout="vertical" className={styles.form}>
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
          extra={
            codeValue && CODE_PATTERN.test(codeValue)
              ? t("knowledgeNetwork.eventClasses.form.codeClassId", {
                  id: eventClassIdOf(codeValue),
                })
              : t("knowledgeNetwork.eventClasses.form.codeHint")
          }
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
            source === "rule"
              ? t("knowledgeNetwork.eventClasses.form.subjectRuleHint")
              : t("knowledgeNetwork.eventClasses.form.subjectHint")
          }
          label={t("knowledgeNetwork.eventClasses.form.subject")}
          name="subject"
          rules={[
            {
              message: t("knowledgeNetwork.eventClasses.form.subjectRequired"),
              required: source === "rule",
            },
          ]}
        >
          <Select
            allowClear
            loading={subjectsLoading}
            optionFilterProp="label"
            options={subjects}
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
            <Form.Item
              extra={t("knowledgeNetwork.eventClasses.form.ruleToolHint")}
              label={t("knowledgeNetwork.eventClasses.form.ruleTool")}
              name="ruleTool"
              rules={[
                {
                  message: t("knowledgeNetwork.eventClasses.form.ruleToolRequired"),
                  // A type the applications checked keeps working without one until it is moved over.
                  required: !legacyRuleWithoutTool,
                },
              ]}
            >
              <Select
                allowClear={legacyRuleWithoutTool}
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
                <div className={styles.parameters}>
                  {selectedTool.parameters.map(renderParameter)}
                </div>
              </Form.Item>
            ) : null}
            {ruleToolKey ? (
              <Form.Item
                extra={t("knowledgeNetwork.eventClasses.form.scheduleHint")}
                label={t("knowledgeNetwork.eventClasses.form.schedule")}
              >
                {scheduleEditor}
              </Form.Item>
            ) : null}
          </>
        )}
      </Form>
    </Drawer>
  );
}
