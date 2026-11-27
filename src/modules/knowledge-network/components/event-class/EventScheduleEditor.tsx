/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Col, Input, InputNumber, Row, Select, TimePicker } from "antd";
import dayjs from "dayjs";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import {
  MIN_CHECK_MINUTES,
  cronFromSchedule,
  timezoneOptions,
  type EventScheduleDraft,
} from "@/modules/knowledge-network/components/event-class/event-schedule";

import styles from "./EventClassFormDrawer.module.css";

type EventScheduleEditorProps = {
  onChange: (schedule: EventScheduleDraft) => void;
  onTimezoneChange: (timezone: string) => void;
  schedule: EventScheduleDraft;
  timezone: string;
};

const scheduleTime = (time: string) => dayjs(`2000-01-01T${time}`);

/** When a recognition rule is checked: a frequency, a time of day or a cron expression, in a time zone. */
export function EventScheduleEditor({
  onChange,
  onTimezoneChange,
  schedule,
  timezone,
}: EventScheduleEditorProps) {
  const { t } = useTranslation();
  const zones = useMemo(() => timezoneOptions(), []);

  return (
    <Row align="middle" gutter={[8, 8]}>
      <Col flex="0 1 160px">
        <Select
          aria-label={t("knowledgeNetwork.eventClasses.form.scheduleKind")}
          style={{ width: "100%" }}
          onChange={(kind: EventScheduleDraft["kind"]) => {
            const cron = cronFromSchedule(schedule);
            onChange(
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
      </Col>
      {schedule.kind === "minutes" ? (
        <Col flex="0 1 106px">
          <InputNumber
            style={{ width: "100%" }}
            suffix={t("knowledgeNetwork.eventClasses.schedule.minutesUnit")}
            aria-label={t("knowledgeNetwork.eventClasses.schedule.kinds.minutes")}
            max={59}
            min={MIN_CHECK_MINUTES}
            onChange={(value) =>
              onChange({ kind: "minutes", every: Math.max(MIN_CHECK_MINUTES, value ?? 15) })
            }
            precision={0}
            value={schedule.every}
          />
        </Col>
      ) : null}
      {schedule.kind === "hours" ? (
        <Col flex="0 1 106px">
          <InputNumber
            style={{ width: "100%" }}
            suffix={t("knowledgeNetwork.eventClasses.schedule.hoursUnit")}
            aria-label={t("knowledgeNetwork.eventClasses.schedule.kinds.hours")}
            max={23}
            min={1}
            onChange={(value) => onChange({ kind: "hours", every: Math.max(1, value ?? 1) })}
            precision={0}
            value={schedule.every}
          />
        </Col>
      ) : null}
      {schedule.kind === "weekly" ? (
        <Col flex="0 1 106px">
          <Select
            aria-label={t("knowledgeNetwork.eventClasses.schedule.weekday")}
            style={{ width: "100%" }}
            onChange={(weekday: number) => onChange({ ...schedule, weekday })}
            options={[1, 2, 3, 4, 5, 6, 0].map((day) => ({
              label: t(`knowledgeNetwork.eventClasses.schedule.weekdays.${day}`),
              value: day,
            }))}
            value={schedule.weekday}
          />
        </Col>
      ) : null}
      {schedule.kind === "daily" || schedule.kind === "weekly" ? (
        <Col flex="0 1 106px">
          <TimePicker
            allowClear={false}
            style={{ width: "100%" }}
            aria-label={t("knowledgeNetwork.eventClasses.schedule.time")}
            format="HH:mm"
            minuteStep={5}
            onChange={(value) => {
              if (!value) return;
              onChange({ ...schedule, time: value.format("HH:mm") });
            }}
            value={scheduleTime(schedule.time)}
          />
        </Col>
      ) : null}
      {schedule.kind === "cron" ? (
        <Col flex="0 1 190px">
          <Input
            aria-label={t("knowledgeNetwork.eventClasses.schedule.kinds.cron")}
            className={styles.cron}
            onChange={(event) => onChange({ kind: "cron", cron: event.target.value })}
            placeholder="0 8 * * *"
            value={schedule.cron}
          />
        </Col>
      ) : null}
      <Col flex="0 1 220px">
        <Select
          aria-label={t("knowledgeNetwork.eventClasses.schedule.timezone")}
          style={{ width: "100%" }}
          onChange={onTimezoneChange}
          options={zones.map((zone) => ({ label: zone, value: zone }))}
          showSearch
          value={timezone}
        />
      </Col>
    </Row>
  );
}
