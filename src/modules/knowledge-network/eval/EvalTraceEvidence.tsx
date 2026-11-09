/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { evalScalarText } from "./eval-scalar-text";

import { QuestionCircleOutlined } from "@ant-design/icons";
import { Alert, Button, Collapse, Descriptions, Empty, Spin, Tag, Tooltip, Typography } from "antd";
import { useCallback, useEffect, useRef, useState } from "react";
import { EvalEvidenceContent } from "./EvalEvidenceContent";
import { getM0Evidence, getM0OperationAttempt, type M0CaseDetail } from "./m0-run.service";
import { useEvalTranslation } from "./useEvalTranslation";
import styles from "./EvalExecutionDetails.module.css";

type Kind = "operation" | "receipt" | "interaction";
type RecordValue = Record<string, unknown>;
type Entry = {
  record?: RecordValue;
  fact?: RecordValue;
  error?: boolean;
  attemptError?: boolean;
  done: boolean;
};
const object = (value: unknown): RecordValue | undefined =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as RecordValue) : undefined;
const fields: Record<Kind, string[]> = {
  operation: [
    "tool_name",
    "attempt_status",
    "status",
    "attempt",
    "retryable",
    "created_at",
    "updated_at",
  ],
  receipt: [
    "receipt_status",
    "evidence_durability",
    "required",
    "attempt",
    "issued_at",
    "terminal_at",
  ],
  interaction: ["execution_status", "evidence_status", "created_at", "terminal_at"],
};
export function EvalTraceEvidence(props: { detail: M0CaseDetail; active: boolean }) {
  const detail = props.detail;
  return (
    <TraceEvidenceRecords
      key={`${detail.id}:${detail.result_revision ?? ""}:${JSON.stringify(detail.evidence_refs)}`}
      {...props}
    />
  );
}
function TraceEvidenceRecords({ detail, active }: { detail: M0CaseDetail; active: boolean }) {
  const { t, i18n } = useEvalTranslation();
  const text = (key: string) => t(`knowledgeNetwork.eval.executionUi.${key}`);
  const refs = {
    operation: detail.evidence_refs?.operation_id,
    receipt: detail.evidence_refs?.receipt_id,
    interaction: detail.evidence_refs?.interaction_id,
  };
  const first = refs.operation
    ? "operation"
    : refs.receipt
      ? "receipt"
      : refs.interaction
        ? "interaction"
        : undefined;
  const [selected, setSelected] = useState<Kind | undefined>(first);
  const cache = useRef<Partial<Record<Kind, Entry>>>({});
  const [entries, setEntries] = useState<Partial<Record<Kind, Entry>>>({});
  const [loading, setLoading] = useState<Kind>();
  const serial = useRef(0);
  const load = useCallback(async (kind: Kind, id: string) => {
    const request = ++serial.current;
    setLoading(kind);
    let entry: Entry = { done: true };
    try {
      const record = object(await getM0Evidence(kind, id));
      if (request !== serial.current) return;
      if (!record || (record[`${kind}_id`] !== undefined && record[`${kind}_id`] !== id))
        throw new Error("Evidence identity mismatch");
      entry = { record, done: true };
      if (
        kind === "operation" &&
        record.operation_id === id &&
        typeof record.attempt === "number" &&
        Number.isInteger(record.attempt) &&
        record.attempt > 0
      ) {
        try {
          const fact = object(await getM0OperationAttempt(id, record.attempt));
          if (request !== serial.current) return;
          if (!fact || fact.operation_id !== id || fact.attempt !== record.attempt)
            throw new Error("Call fact identity mismatch");
          entry.fact = fact;
        } catch {
          entry.attemptError = true;
        }
      }
    } catch {
      entry = { error: true, done: true };
    }
    if (request !== serial.current) return;
    cache.current[kind] = entry;
    setEntries({ ...cache.current });
    setLoading(undefined);
  }, []);
  const invalidateRequest = useCallback(() => {
    serial.current++;
  }, []);
  const selectedId = selected ? refs[selected] : undefined;
  useEffect(() => {
    if (active && selected && selectedId && !cache.current[selected]?.done)
      void load(selected, selectedId);
    return invalidateRequest;
  }, [active, selected, selectedId, load, invalidateRequest]);
  const state = detail.observation?.evidence_status;
  const badge =
    state === "complete"
      ? "traceComplete"
      : state === "partial"
        ? "tracePartial"
        : state === "unavailable"
          ? "traceUnavailable"
          : "traceUnrecorded";
  const field = (name: string, value: unknown) => {
    if (name.endsWith("_at") && typeof value === "string" && !Number.isNaN(Date.parse(value)))
      return new Intl.DateTimeFormat(i18n.language, {
        dateStyle: "short",
        timeStyle: "medium",
      }).format(new Date(value));
    if (typeof value === "boolean") return text(value ? "yes" : "no");
    if (
      typeof value === "string" &&
      [
        "completed",
        "running",
        "failed",
        "cancelled",
        "active",
        "assembling",
        "complete",
        "partial",
        "unavailable",
        "durable",
        "ephemeral",
        "pending",
        "ready",
      ].includes(value)
    )
      return t(`knowledgeNetwork.eval.resultUi.traceStates.${value}`, { defaultValue: value });
    return typeof value === "string" || typeof value === "number" ? String(value) : "—";
  };
  const toolName = (value: unknown) => {
    if (typeof value !== "string") return text("unrecorded");
    return value === detail.target_snapshot?.capability?.capability_id
      ? detail.target_snapshot.capability.name || value
      : value;
  };
  const payload = (label: string, value: unknown) => {
    const envelope = object(value);
    if (!envelope)
      return (
        <section>
          <Typography.Title level={5} className={styles.payloadTitle}>
            {text(label)}
          </Typography.Title>
          <Typography.Text type="secondary">{text("unrecorded")}</Typography.Text>
        </section>
      );
    return (
      <section>
        <Typography.Title level={5} className={styles.payloadTitle}>
          {text(label)}
        </Typography.Title>
        {envelope.mode === "inline" && Object.hasOwn(envelope, "inline") ? (
          <EvalEvidenceContent id={label} content={envelope.inline} />
        ) : (
          <Typography.Paragraph type="secondary">
            {text(envelope.mode === "referenced" ? "payloadReferenced" : "payloadOmitted")}
            {envelope.omitted_reason ? `（${evalScalarText(envelope.omitted_reason)}）` : ""}
          </Typography.Paragraph>
        )}
      </section>
    );
  };
  return (
    <section className={styles.trace} aria-label={t("knowledgeNetwork.eval.terms.evidence")}>
      <div className={styles.heading}>
        <Typography.Title level={5}>{t("knowledgeNetwork.eval.terms.evidence")}</Typography.Title>
        <Tooltip title={text("traceHelp")} trigger={["hover", "focus"]}>
          <QuestionCircleOutlined
            tabIndex={0}
            className={styles.helpIcon}
            aria-label={text("traceHelpLabel")}
          />
        </Tooltip>
        <Tag color={state === "complete" ? "success" : state ? "warning" : undefined}>
          {text(badge)}
        </Tag>
      </div>
      {first ? (
        <Collapse
          accordion
          activeKey={selected ? [selected] : []}
          onChange={(keys) =>
            setSelected((Array.isArray(keys) ? keys[0] : keys) as Kind | undefined)
          }
          items={(["operation", "receipt", "interaction"] as const)
            .filter((kind) => refs[kind])
            .map((kind) => {
              const entry = entries[kind];
              const record = entry?.record;
              const status =
                record?.[
                  kind === "operation"
                    ? "attempt_status"
                    : kind === "receipt"
                      ? "receipt_status"
                      : "execution_status"
                ] ?? record?.status;
              return {
                key: kind,
                label: (
                  <span className={styles.recordLabel}>
                    <span>{text(kind)}</span>
                    {record && (
                      <span className={styles.recordMeta}>
                        {kind === "operation" ? `${toolName(record.tool_name)} · ` : ""}
                        {status ? field("status", status) : text("unrecorded")}
                        {kind === "receipt" && record.evidence_durability
                          ? ` · ${field("evidence_durability", record.evidence_durability)}`
                          : ""}
                      </span>
                    )}
                  </span>
                ),
                children:
                  loading === kind || !entry ? (
                    <Spin />
                  ) : entry.error ? (
                    <Alert
                      type="error"
                      showIcon
                      message={t("knowledgeNetwork.eval.resultUi.evidenceFailed")}
                      action={
                        <Button onClick={() => void load(kind, refs[kind]!)}>
                          {t("knowledgeNetwork.eval.resultUi.evidenceRetry")}
                        </Button>
                      }
                    />
                  ) : (
                    <div className={styles.recordBody}>
                      {record && kind !== "operation" && (
                        <Descriptions className={styles.metadata} size="small" bordered column={1}>
                          {fields[kind]
                            .filter((key) => record[key] != null)
                            .map((key) => (
                              <Descriptions.Item
                                key={key}
                                label={t(`knowledgeNetwork.eval.resultUi.traceFields.${key}`, {
                                  defaultValue: key,
                                })}
                              >
                                {key === "tool_name"
                                  ? toolName(record[key])
                                  : field(key, record[key])}
                              </Descriptions.Item>
                            ))}
                        </Descriptions>
                      )}
                      {kind === "operation" &&
                        (entry.fact ? (
                          <>
                            {payload("input", entry.fact.input)}
                            {payload("output", entry.fact.output)}
                            {entry.fact.error != null && payload("error", entry.fact.error)}
                          </>
                        ) : entry.attemptError ? (
                          <Alert
                            type="warning"
                            showIcon
                            message={text("callDetailsFailed")}
                            action={
                              <Button onClick={() => void load(kind, refs[kind]!)}>
                                {t("knowledgeNetwork.eval.resultUi.evidenceRetry")}
                              </Button>
                            }
                          />
                        ) : (
                          <Typography.Paragraph type="secondary">
                            {text("callDetailsUnavailable")}
                          </Typography.Paragraph>
                        ))}
                      <Collapse
                        size="small"
                        items={[
                          {
                            key: "raw",
                            label: text("rawEvidence"),
                            children: (
                              <>
                                <EvalEvidenceContent id={kind} content={record} />
                                {entry.fact && (
                                  <EvalEvidenceContent id="callFact" content={entry.fact} />
                                )}
                              </>
                            ),
                          },
                        ]}
                      />
                    </div>
                  ),
              };
            })}
        />
      ) : (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={t("knowledgeNetwork.eval.resultUi.evidenceUnavailable")}
        />
      )}
    </section>
  );
}
