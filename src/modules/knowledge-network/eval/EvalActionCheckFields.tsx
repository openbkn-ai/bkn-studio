/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License. See LICENSE for the full text.
 */

import { Alert, InputNumber, Select, Space } from "antd";
import { useEffect, useRef, useState } from "react";
import {
  parsePrecisionPreservingJSON,
  transformPrecisionSafeJSONRequest,
} from "@/framework/request/precision-safe-json";
import type { CaseTargetSchema } from "./case-form.service";
import { EvalCaseArguments } from "./EvalCaseArguments";
import { EvalResourceArguments } from "./EvalResourceArguments";
import { defaultActionCheck } from "./action-check-model";
import { EvalFieldLabel } from "./EvalFieldLabel";
import { useEvalTranslation } from "./useEvalTranslation";

export function EvalActionCheckFields({
  networkId,
  contract,
  binding,
  value,
  onChange,
}: {
  networkId: string;
  contract: CaseTargetSchema;
  binding: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const { t } = useEvalTranslation();
  const text = (key: string) => t(`knowledgeNetwork.eval.actionChecks.${key}`);
  const readParts = (raw: string) => {
    try {
      const parsed = parsePrecisionPreservingJSON(raw) as Record<string, unknown>;
      return {
        action_input: transformPrecisionSafeJSONRequest(parsed?.action_input ?? {}),
        check: transformPrecisionSafeJSONRequest(parsed?.check ?? defaultActionCheck(binding)),
      };
    } catch {
      return {
        action_input: "{}",
        check: transformPrecisionSafeJSONRequest(defaultActionCheck(binding)),
      };
    }
  };
  const [parts, setParts] = useState(() => readParts(value));
  const lastEmitted = useRef<string | undefined>(undefined);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const emitParts = (next: typeof parts) => {
    setParts(next);
    const raw = `{"action_input":${next.action_input},"check":${next.check}}`;
    lastEmitted.current = raw;
    onChangeRef.current(raw);
  };
  useEffect(() => {
    if (value === lastEmitted.current) return;
    try {
      const parsed = parsePrecisionPreservingJSON(value) as Record<string, unknown>;
      const next = readParts(value);
      setParts(next);
      if (!Object.hasOwn(parsed ?? {}, "action_input") || !Object.hasOwn(parsed ?? {}, "check"))
        emitParts(next);
    } catch {
      /* Keep incomplete JSON and the other editor's values. */
    }
    // The fields are reset by the resource/check key; only external value changes synchronize editors.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  let check = defaultActionCheck(binding);
  try {
    const parsed = parsePrecisionPreservingJSON(parts.check);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
      check = parsed as Record<string, unknown>;
  } catch {
    /* Keep the editable text. */
  }
  const config = contract.action_checks?.[binding];
  const changeRaw = (name: "action_input" | "check", raw: string) =>
    emitParts({ ...parts, [name]: raw });
  const change = (part: { check: Record<string, unknown> }) =>
    changeRaw("check", transformPrecisionSafeJSONRequest(part.check));
  if (!config) return <Alert type="warning" showIcon message={text("unavailable")} />;
  const inspection =
    ["precondition", "target"].includes(binding) ||
    (binding === "authorization" && check.phase === "submission") ||
    (binding === "failure" && check.phase === "admission");
  const negativeTarget =
    (binding === "target" && check.expected_decision === "rejected") ||
    (binding === "failure" && check.phase === "admission");
  const decisionOptions = [
    { value: "accepted", label: text("accepted") },
    { value: "rejected", label: text("rejected") },
  ];
  return (
    <Space direction="vertical" size={12} style={{ width: "100%" }}>
      {!inspection && (
        <Alert
          type="warning"
          showIcon
          message={text(binding === "duplicate" ? "duplicateHelp" : "executionHelp")}
        />
      )}
      {["precondition", "target", "authorization"].includes(binding) && (
        <div>
          <EvalFieldLabel required>{text("decision")}</EvalFieldLabel>
          <Select
            aria-label={text("decision")}
            style={{ width: 240 }}
            value={check.expected_decision as string}
            options={decisionOptions}
            onChange={(expected_decision) => change({ check: { ...check, expected_decision } })}
          />
        </div>
      )}
      {binding === "authorization" && (
        <div>
          <EvalFieldLabel required>{text("authorizationPhase")}</EvalFieldLabel>
          <Select
            aria-label={text("authorizationPhase")}
            style={{ width: 240 }}
            value={check.phase as string}
            options={[
              { value: "submission", label: text("submission") },
              { value: "invocation", label: text("invocation") },
            ]}
            onChange={(phase) => change({ check: { ...check, phase } })}
          />
        </div>
      )}
      {binding === "failure" && (
        <>
          <div>
            <EvalFieldLabel required>{text("failurePhase")}</EvalFieldLabel>
            <Select
              aria-label={text("failurePhase")}
              style={{ width: 240 }}
              value={check.phase as string}
              options={[
                { value: "source", label: text("source") },
                { value: "admission", label: text("admission") },
              ]}
              onChange={(phase) => change({ check: { phase, scenario: "failure" } })}
            />
          </div>
          {check.phase === "source" && (
            <div>
              <EvalFieldLabel required>{text("scenario")}</EvalFieldLabel>
              <Select
                aria-label={text("scenario")}
                style={{ width: 240 }}
                value={check.scenario as string}
                options={[
                  { value: "failure", label: text("failure") },
                  { value: "cancellation", label: text("cancellation") },
                ]}
                onChange={(scenario) => {
                  const next: Record<string, unknown> = { ...check, scenario };
                  if (scenario !== "cancellation") delete next.cancel_after_ms;
                  change({ check: next });
                }}
              />
            </div>
          )}
          {check.scenario === "cancellation" && (
            <div>
              <EvalFieldLabel>{text("cancelAfter")}</EvalFieldLabel>
              <InputNumber
                aria-label={text("cancelAfter")}
                min={0}
                max={5000}
                value={(check.cancel_after_ms as number) ?? 0}
                onChange={(cancel_after_ms) =>
                  change({ check: { ...check, cancel_after_ms: cancel_after_ms ?? 0 } })
                }
              />
            </div>
          )}
        </>
      )}
      <EvalFieldLabel
        hint={
          inspection || negativeTarget || binding === "outcome_scope" ? (
            <>
              {inspection && <div>{text("inspectionHelp")}</div>}
              {negativeTarget && <div>{text("negativeInputHelp")}</div>}
              {binding === "outcome_scope" && <div>{text("effectsHelp")}</div>}
            </>
          ) : undefined
        }
      >
        {text("actionInput")}
      </EvalFieldLabel>
      {negativeTarget ? (
        <EvalCaseArguments
          schema={contract.input}
          value={parts.action_input}
          onChange={(raw) => changeRaw("action_input", raw)}
        />
      ) : (
        <EvalResourceArguments
          networkId={networkId}
          kind="action"
          contract={contract}
          value={parts.action_input}
          onChange={(raw) => changeRaw("action_input", raw)}
        />
      )}
      {binding === "outcome_scope" && (
        <>
          <EvalCaseArguments
            value={parts.check}
            schema={config}
            onChange={(raw) => changeRaw("check", raw)}
          />
        </>
      )}
    </Space>
  );
}
