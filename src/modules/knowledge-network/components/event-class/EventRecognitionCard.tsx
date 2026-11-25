/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Tooltip, Typography } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { AppButton } from "@/framework/ui/common/AppButton";
import { getTool } from "@/modules/execution-factory/services/tool.service";
import { describeSchedule } from "@/modules/knowledge-network/components/event-class/event-schedule";
import {
  checkKnEventType,
  describeKnEventError,
  listKnEventRuleChecks,
} from "@/modules/knowledge-network/services/event-type.service";
import { formatTimestamp } from "@/modules/knowledge-network/services/shared/runtime";
import type { KnEventRuleCheck, KnEventType } from "@/modules/knowledge-network/types/event-type";

import styles from "./EventRecognitionCard.module.css";

type EventRecognitionCardProps = {
  /** The user may change the event type here: network `modify`, on the draft of a versioned network. */
  canModify: boolean;
  /** The user may read the network's data, which the last check needs. */
  canQueryData: boolean;
  eventType: KnEventType;
  networkId: string;
  onEdit: () => void;
  onOpenSubject?: (objectTypeId: string) => void;
  /** Shows the class's events, one per object a check hit. */
  onShowEvents?: () => void;
  subjectName?: string;
};

const PREFIX = "knowledgeNetwork.eventClasses.recognition";

function isCheckTime(value: unknown) {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { check_time?: unknown }).check_time === "date"
  );
}

function formatArgument(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

/**
 * How an event type is recognised, shown on its event class: where its events come from, the rule
 * tool and schedule of a rule type, who the checks run as, and the last check.
 */
export function EventRecognitionCard({
  canModify,
  canQueryData,
  eventType,
  networkId,
  onEdit,
  onOpenSubject,
  onShowEvents,
  subjectName,
}: EventRecognitionCardProps) {
  const { t } = useTranslation();
  const { message } = useAppServices();
  const [toolName, setToolName] = useState<string>();
  const [lastCheck, setLastCheck] = useState<KnEventRuleCheck | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkTick, setCheckTick] = useState(0);
  const ruleTool = eventType.rule_tool;
  const isRule = eventType.source === "rule";

  useEffect(() => {
    if (!ruleTool) {
      setToolName(undefined);
      return;
    }
    let cancelled = false;
    void getTool(ruleTool.box_id, ruleTool.tool_id)
      .then((tool) => {
        if (!cancelled) setToolName(tool.name);
      })
      .catch(() => {
        if (!cancelled) setToolName(undefined);
      });
    return () => {
      cancelled = true;
    };
  }, [ruleTool]);

  useEffect(() => {
    if (!isRule || !canQueryData) {
      setLastCheck(null);
      return;
    }
    let cancelled = false;
    void listKnEventRuleChecks(networkId)
      .then((checks) => {
        if (!cancelled)
          setLastCheck(checks.find((item) => item.event_type === eventType.code) ?? null);
      })
      .catch(() => {
        if (!cancelled) setLastCheck(null);
      });
    return () => {
      cancelled = true;
    };
  }, [canQueryData, checkTick, eventType.code, isRule, networkId]);

  const checkNow = async () => {
    setChecking(true);
    try {
      // The platform runs the schedule in the background: the answer is that it started.
      await checkKnEventType(networkId, eventType.code);
      void message.success(t(`${PREFIX}.checkStarted`));
      setCheckTick((current) => current + 1);
    } catch (error) {
      void message.error(describeKnEventError(error));
    } finally {
      setChecking(false);
    }
  };

  const parameters = Object.entries(ruleTool?.parameters ?? {});
  const field = (label: string, value: React.ReactNode) => (
    <div className={styles.field}>
      <dt className={styles.label}>{label}</dt>
      <dd className={styles.value}>{value}</dd>
    </div>
  );
  const placeholder = <span className={styles.placeholder}>--</span>;

  return (
    <section className={styles.card} aria-label={t(`${PREFIX}.title`)}>
      <div className={styles.header}>
        <h3 className={styles.title}>{t(`${PREFIX}.title`)}</h3>
        {canModify ? (
          <div className={styles.actions}>
            {isRule && eventType.recognition_action_id ? (
              <AppButton loading={checking} onClick={() => void checkNow()} size="small">
                {t(`${PREFIX}.checkNow`)}
              </AppButton>
            ) : null}
            <AppButton onClick={onEdit} size="small" type="primary">
              {t(`${PREFIX}.edit`)}
            </AppButton>
          </div>
        ) : null}
      </div>
      <p className={styles.note}>{t(`${PREFIX}.managedNote`)}</p>
      {isRule && !eventType.recognition_action_id ? (
        <Alert message={t(`${PREFIX}.noRuleTool`)} showIcon type="warning" />
      ) : null}
      <dl className={styles.fields}>
        {field(t(`${PREFIX}.code`), <code className={styles.code}>{eventType.code}</code>)}
        {field(
          t(`${PREFIX}.source`),
          t(`knowledgeNetwork.eventClasses.source.${eventType.source}`),
        )}
        {field(
          t(`${PREFIX}.subject`),
          eventType.subject ? (
            onOpenSubject ? (
              <button
                className={styles.link}
                onClick={() => onOpenSubject(eventType.subject ?? "")}
                type="button"
              >
                {subjectName || eventType.subject}
              </button>
            ) : (
              subjectName || eventType.subject
            )
          ) : (
            placeholder
          ),
        )}
        {field(t(`${PREFIX}.severity`), eventType.severity || placeholder)}
        {eventType.source === "report"
          ? field(
              t(`${PREFIX}.mergeHours`),
              eventType.merge_hours
                ? t(`${PREFIX}.mergeHoursValue`, { count: eventType.merge_hours })
                : t(`${PREFIX}.mergeOff`),
            )
          : null}
        {isRule && eventType.recognition_action_id ? (
          <>
            {field(
              t(`${PREFIX}.basis`),
              t(`${PREFIX}.bases.${eventType.recognition_basis ?? "condition"}`),
            )}
            {ruleTool
              ? field(
                  t(`${PREFIX}.ruleTool`),
                  <Tooltip title={`${ruleTool.box_id} / ${ruleTool.tool_id}`}>
                    <span>{toolName || ruleTool.tool_id}</span>
                  </Tooltip>,
                )
              : null}
            {ruleTool
              ? field(
                  t(`${PREFIX}.parameters`),
                  parameters.length ? (
                    <ul className={styles.list}>
                      {parameters.map(([name, value]) => (
                        <li key={name}>
                          <code className={styles.code}>{name}</code>{" "}
                          {isCheckTime(value) ? t(`${PREFIX}.checkDate`) : formatArgument(value)}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    placeholder
                  ),
                )
              : null}
            {field(
              t(`${PREFIX}.schedule`),
              eventType.check_schedule
                ? describeSchedule(
                    eventType.check_schedule.cron,
                    t,
                    eventType.check_schedule.timezone,
                  )
                : placeholder,
            )}
            {field(
              t(`${PREFIX}.subjectAccount`),
              eventType.check_subject?.name || eventType.check_subject?.id || placeholder,
            )}
            {field(
              t(`${PREFIX}.nextCheck`),
              eventType.next_check_at ? formatTimestamp(eventType.next_check_at) : placeholder,
            )}
          </>
        ) : null}
        {isRule && canQueryData
          ? field(
              t(`${PREFIX}.lastCheck`),
              lastCheck ? (
                <span>
                  {lastCheck.time ? `${formatTimestamp(lastCheck.time)} · ` : ""}
                  {lastCheck.status === "ok" ? (
                    onShowEvents && (lastCheck.hits ?? 0) > 0 ? (
                      <Typography.Link onClick={onShowEvents}>
                        {t(`${PREFIX}.lastCheckOk`, { count: lastCheck.hits ?? 0 })}
                      </Typography.Link>
                    ) : (
                      t(`${PREFIX}.lastCheckOk`, { count: lastCheck.hits ?? 0 })
                    )
                  ) : (
                    t(`${PREFIX}.lastCheckUnknown`, {
                      message: lastCheck.message || t(`${PREFIX}.noMessage`),
                    })
                  )}
                </span>
              ) : (
                t(`${PREFIX}.neverChecked`)
              ),
            )
          : null}
      </dl>
    </section>
  );
}
