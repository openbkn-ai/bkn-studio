/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { evalScalarText } from "./eval-scalar-text";

import { Collapse, Descriptions, Typography } from "antd";
import BigNumber from "bignumber.js";
import JSONBig from "json-bigint";
import { transformPrecisionSafeJSONRequest } from "@/framework/request/precision-safe-json";
import { useEvalTranslation } from "./useEvalTranslation";
import executionStyles from "./EvalExecutionDetails.module.css";

const preciseJSON = JSONBig();
const sensitiveKey =
  /authorization|cookie|password|passwd|secret|credential|token|api.?key|private.?key/i;
function redact(value: unknown, depth = 0): unknown {
  if (depth > 24) return "[truncated]";
  if (typeof value === "string")
    return value
      .replace(
        /-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?-----END [^-]*PRIVATE KEY-----/g,
        "[REDACTED PRIVATE KEY]",
      )
      .replace(/(?:authorization|cookie|set-cookie|x-api-key)\s*:[^\r\n]+/gi, "[REDACTED HEADER]")
      .replace(/bearer\s+[a-z0-9._~+/=-]+/gi, "[REDACTED]")
      .replace(/(?:password|passwd|token|secret|api[_-]?key)\s*[=:]\s*[^\s,;&"']+/gi, "[REDACTED]")
      .replace(/(https?:\/\/)[^/\s:@]+:[^/\s@]+@/g, "$1[REDACTED]@");
  if (BigNumber.isBigNumber(value)) return value;
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        sensitiveKey.test(key) ? "[REDACTED]" : redact(item, depth + 1),
      ]),
    );
  return value;
}

/** Shared display for frozen execution materials. */
export function EvalEvidenceContent({ id, content }: { id: string; content: unknown }) {
  const { t, i18n } = useEvalTranslation();
  const text = (key: string) => t(`knowledgeNetwork.eval.materialsUi.${key}`);
  const safe = redact(content);
  const json = preciseJSON.stringify(safe ?? null, null, 2);
  const raw = <pre className={executionStyles.evidence}>{json}</pre>;
  if (id !== "run" || !safe || typeof safe !== "object" || Array.isArray(safe)) return raw;
  const info = safe as Record<string, unknown>;
  const value = (key: string, item: unknown) => {
    if (item === undefined || item === null || item === "") return text("unrecorded");
    const states: Record<string, string> = {
      queued: "queued",
      running: "running",
      completed: "completed",
      failed: "executionFailed",
      cancelled: "cancelled",
      pass: "passed",
      fail: "notPassed",
      inconclusive: "inconclusive",
      review_required: "humanJudgment",
    };
    if (
      ["execution_status", "quality_outcome"].includes(key) &&
      typeof item === "string" &&
      states[item]
    )
      return t(`knowledgeNetwork.eval.terms.${states[item]}`);
    if (
      key === "assessment_scope" &&
      typeof item === "string" &&
      ["runtime", "declaration", "mixed"].includes(item)
    )
      return text(item);
    if (
      key === "runner_type" &&
      typeof item === "string" &&
      ["per_case", "external_agent"].includes(item)
    )
      return text(item);
    if (
      ["created_at", "started_at", "finished_at"].includes(key) &&
      typeof item === "string" &&
      !Number.isNaN(new Date(item).getTime())
    )
      return new Intl.DateTimeFormat(i18n?.language, {
        dateStyle: "short",
        timeStyle: "medium",
      }).format(new Date(item));
    return typeof item === "object"
      ? transformPrecisionSafeJSONRequest(item)
      : evalScalarText(item);
  };
  return (
    <>
      <Descriptions className={executionStyles.metadata} bordered size="small" column={1}>
        {Object.entries(info).map(([key, item]) => (
          <Descriptions.Item
            key={key}
            label={t(`knowledgeNetwork.eval.materialsUi.fields.${key}`, { defaultValue: key })}
          >
            <Typography.Text style={{ overflowWrap: "anywhere" }}>
              {value(key, item)}
            </Typography.Text>
          </Descriptions.Item>
        ))}
      </Descriptions>
      <Collapse size="small" items={[{ key: "raw", label: text("raw"), children: raw }]} />
    </>
  );
}
