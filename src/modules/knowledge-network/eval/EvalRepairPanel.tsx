/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { resultUiText } from "./result-ui-text";

import { Alert, Button, Space, Spin, Table, Tooltip, Typography } from "antd";
import { useCallback, useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { useAppServices } from "@/framework/context/use-app-services";
import type { AiConversationMessage } from "../components/shared/AiConversationPanel";
import { readableEvalText, repairReadableReferences } from "./eval-readable-references";
import { runEvalAssistant } from "./eval-case-designer.service";
import {
  applyEvalRepair,
  loadEvalRepairSession,
  validateEvalRepairProposal,
  verifyEvalRepairCases,
  type EvalRepairProposal,
  type EvalRepairRequest,
  type EvalRepairSession,
} from "./eval-repair.service";
import {
  createM1Run,
  getM0Run,
  getM1RunCapabilities,
  previewM1RunSelection,
  type M0Run,
} from "./m0-run.service";
import { useEvalFeedback } from "./useEvalFeedback";
import { useEvalTranslation } from "./useEvalTranslation";

export type EvalRepairController = { submit: (prompt: string) => void; stop: () => void };
export type EvalRepairConversationView = {
  messages: AiConversationMessage[];
  thinking: boolean;
  locked: boolean;
};
type Props = {
  networkId: string;
  request: EvalRepairRequest;
  onUpdated: () => void;
  onInspectRun: (run: M0Run) => void;
  controllerRef?: Ref<EvalRepairController>;
  onViewChange?: (view: EvalRepairConversationView) => void;
};
type Phase =
  "analyzing" | "ready" | "applying" | "retesting" | "unknown" | "error" | "retestFailed";

export function EvalRepairPanel({
  networkId,
  request,
  onUpdated,
  onInspectRun,
  controllerRef,
  onViewChange,
}: Props) {
  const { t } = useEvalTranslation();
  const text = (key: string, values?: Record<string, unknown>) =>
    t(`knowledgeNetwork.eval.repair.${key}`, values);
  const translation = useRef(t);
  useEffect(() => {
    translation.current = t;
  }, [t]);
  // Locale changes must not restart a repair that is already in progress.
  const analysisText = useCallback(
    (key: string, values?: Record<string, unknown>) =>
      translation.current(`knowledgeNetwork.eval.repair.${key}`, values),
    [],
  );
  const { runtimeConfig } = useAppServices();
  const { modal } = useEvalFeedback();
  const [session, setSession] = useState<EvalRepairSession>();
  const [plan, setPlan] = useState<EvalRepairProposal>();
  const [phase, setPhase] = useState<Phase>("analyzing");
  const phaseRef = useRef<Phase>("analyzing");
  const updatePhase = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);
  const [thinking, setThinking] = useState(false);
  const thinkingRef = useRef(false);
  const [messages, setMessages] = useState<AiConversationMessage[]>([]);
  const analysisAbort = useRef<AbortController | undefined>(undefined);
  const threadId = useRef<string | undefined>(undefined);
  const currentPlan = useRef<EvalRepairProposal | undefined>(undefined);
  const instructions = useRef<string[]>([]);
  const planRevision = useRef(0);
  const sequence = useRef(0);
  const [error, setError] = useState("");
  const [run, setRun] = useState<M0Run>();
  const currentRun = useRef<M0Run | undefined>(undefined);
  const alive = useRef(true);
  const submitted = useRef(false);
  const runRequestId = useRef(crypto.randomUUID());
  const confirm = useRef<ReturnType<typeof modal.confirm> | undefined>(undefined);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      analysisAbort.current?.abort();
      confirm.current?.destroy();
    };
  }, []);
  const appendMessage = useCallback(
    (role: "user" | "assistant", content: string, error = false) => {
      setMessages((previous) => [
        ...previous,
        {
          id: `${request.id}-${++sequence.current}`,
          role,
          content,
          ...(error ? { tone: "error" as const } : {}),
        },
      ]);
    },
    [request.id],
  );
  const analyze = useCallback(
    async (input: string, followup = true) => {
      const prompt = input.trim();
      if (
        !prompt ||
        thinkingRef.current ||
        phaseRef.current === "applying" ||
        (phaseRef.current === "retesting" &&
          !["completed", "failed", "cancelled"].includes(
            currentRun.current?.execution_status ?? "",
          ))
      )
        return;
      confirm.current?.destroy();
      planRevision.current++;
      const previousPlan = currentPlan.current;
      if (!submitted.current) {
        setPlan(undefined);
        updatePhase("analyzing");
      }
      setError("");
      appendMessage("user", prompt);
      if (instructions.current.join("\n").length + prompt.length > 8000) {
        setError(analysisText("conversationLimit"));
        if (!submitted.current) updatePhase("error");
        return;
      }
      instructions.current.push(prompt);
      thinkingRef.current = true;
      setThinking(true);
      const controller = new AbortController();
      analysisAbort.current = controller;
      try {
        const loaded = await loadEvalRepairSession(networkId, request, controller.signal);
        if (controller.signal.aborted) return;
        if (!submitted.current) setSession(loaded);
        const params = {
          base: window.location.origin,
          tokenProvider: {
            getToken: () => runtimeConfig.auth.tokenManager.getAccessToken() ?? "",
            refresh: () => runtimeConfig.auth.tokenManager.refreshAccessToken(),
          },
          knId: networkId,
          goal: prompt,
          resources: [],
          rules: [],
          workspace: {
            activeSection: "repair",
            repairContext: loaded.context,
            repairPlan: previousPlan,
            repairInstructions: [...instructions.current],
            repairExecution: submitted.current
              ? {
                  status: phaseRef.current,
                  runId: currentRun.current?.id,
                  executionStatus: currentRun.current?.execution_status,
                  qualityOutcome: currentRun.current?.quality_outcome,
                }
              : undefined,
          },
          ...(threadId.current ? { threadId: threadId.current } : {}),
          signal: controller.signal,
        };
        let response = await runEvalAssistant(params);
        if (controller.signal.aborted) return;
        if (submitted.current) {
          threadId.current = response.threadId;
          appendMessage(
            "assistant",
            readableEvalText(
              response.answer,
              repairReadableReferences(loaded.context, currentRun.current?.id),
            ),
          );
          return;
        }
        let checked: EvalRepairProposal;
        try {
          checked = validateEvalRepairProposal(response.repair, loaded);
        } catch {
          response = await runEvalAssistant({
            ...params,
            ...(response.threadId ? { threadId: response.threadId } : {}),
            goal: resultUiText("repairRetry", { prompt }),
          });
          if (controller.signal.aborted) return;
          checked = validateEvalRepairProposal(response.repair, loaded);
        }
        threadId.current = response.threadId;
        currentPlan.current = checked;
        setPlan(checked);
        updatePhase("ready");
        appendMessage(
          "assistant",
          readableEvalText(
            checked.answer ?? (followup ? response.answer : analysisText("planReady")),
            repairReadableReferences(loaded.context),
          ),
        );
      } catch (cause) {
        if (controller.signal.aborted) return;
        const detail =
          cause instanceof Error && cause.message.startsWith("EVAL_REPAIR_")
            ? analysisText(cause.message)
            : analysisText("analysisFailed");
        setError(detail);
        appendMessage("assistant", detail, true);
        if (!submitted.current) updatePhase("error");
      } finally {
        if (analysisAbort.current === controller) {
          analysisAbort.current = undefined;
          thinkingRef.current = false;
          if (alive.current) setThinking(false);
        }
      }
    },
    [networkId, request, runtimeConfig.auth.tokenManager, analysisText, appendMessage, updatePhase],
  );
  const stop = useCallback(() => {
    if (!thinkingRef.current) return;
    analysisAbort.current?.abort();
    analysisAbort.current = undefined;
    thinkingRef.current = false;
    setThinking(false);
    if (!submitted.current) updatePhase("ready");
    appendMessage("assistant", analysisText(submitted.current ? "stoppedAfterApply" : "stopped"));
  }, [analysisText, appendMessage, updatePhase]);
  useImperativeHandle(
    controllerRef,
    () => ({
      submit: (prompt) => {
        void analyze(prompt);
      },
      stop,
    }),
    [analyze, stop],
  );
  useEffect(() => {
    setMessages([]);
    instructions.current = [];
    threadId.current = undefined;
    void analyze(analysisText("goal", { name: request.target.name }), false);
    return () => {
      analysisAbort.current?.abort();
      thinkingRef.current = false;
    };
  }, [analyze, analysisText, request.target.name]);
  const locked =
    phase === "applying" ||
    (phase === "retesting" &&
      !["completed", "failed", "cancelled"].includes(run?.execution_status ?? ""));
  useEffect(() => {
    onViewChange?.({ messages, thinking, locked });
  }, [messages, thinking, locked, onViewChange]);

  const originalScope = () => ({
    kind: "cases" as const,
    case_ids: session!.context.failures.map((c) => c.caseId),
  });
  const preflight = async () => {
    if (!session || !(await getM1RunCapabilities(networkId)))
      throw new Error("EVAL_REPAIR_RETEST_UNAVAILABLE");
    const preview = await previewM1RunSelection(networkId, originalScope());
    await verifyEvalRepairCases(networkId, session);
    if (preview.case_count !== session.context.failures.length)
      throw new Error("EVAL_REPAIR_STALE");
  };
  const retest = async () => {
    try {
      if (alive.current) updatePhase("retesting");
      await preflight();
      const created = await createM1Run(networkId, originalScope(), runRequestId.current);
      if (!alive.current) return;
      currentRun.current = created;
      setRun(created);
      onUpdated();
    } catch {
      if (alive.current) {
        updatePhase("retestFailed");
        setError(text("retestFailed"));
      }
    }
  };
  const apply = () => {
    if (
      !session ||
      !plan?.changes.length ||
      phase !== "ready" ||
      thinkingRef.current ||
      submitted.current
    )
      return;
    const approvedRevision = planRevision.current;
    const submitRepair = async () => {
      try {
        await preflight();
      } catch {
        if (alive.current) {
          updatePhase("ready");
          setError(text("EVAL_REPAIR_RETEST_UNAVAILABLE"));
        }
        return;
      }
      if (!alive.current || approvedRevision !== planRevision.current) return;
      submitted.current = true;
      try {
        await applyEvalRepair(networkId, session, plan);
      } catch (cause) {
        if (alive.current) {
          if (cause instanceof Error && cause.message.startsWith("EVAL_REPAIR_")) {
            updatePhase("error");
            submitted.current = false;
          } else updatePhase("unknown");
          setError(
            cause instanceof Error && cause.message.startsWith("EVAL_REPAIR_")
              ? text(cause.message)
              : text("applyUnknown"),
          );
        }
        return;
      }
      if (alive.current) onUpdated();
      await retest();
    };
    confirm.current = modal.confirm({
      title: text("confirmTitle", { name: request.target.name }),
      content: (
        <>
          <p>{text("confirmHelp")}</p>
          {plan.changes.map((c) => (
            <p key={c.field}>
              {c.field}: {c.before} → {c.after}
            </p>
          ))}
          {plan.manual_steps.length > 0 && <p>{text("partialHelp")}</p>}
        </>
      ),
      okText: text("confirmApply"),
      cancelText: text("cancel"),
      onOk: () => {
        if (
          !alive.current ||
          submitted.current ||
          phaseRef.current !== "ready" ||
          thinkingRef.current ||
          approvedRevision !== planRevision.current
        )
          return;
        updatePhase("applying");
        setError("");
        confirm.current = undefined;
        // Return immediately so Ant Design closes the confirmation once.
        // Progress and failures remain visible in the assistant.
        void submitRepair();
      },
    });
  };
  const runId = run?.id;
  const terminal = run && ["completed", "failed", "cancelled"].includes(run.execution_status);
  useEffect(() => {
    if (!runId || terminal) return;
    let active = true;
    const timer = window.setInterval(() => {
      void getM0Run(networkId, runId)
        .then((current) => {
          if (!active) return;
          currentRun.current = current;
          setRun(current);
          if (["completed", "failed", "cancelled"].includes(current.execution_status)) onUpdated();
        })
        .catch(() => {
          /* Keep the persisted Run link available when polling fails. */
        });
    }, 2500);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [networkId, runId, terminal, onUpdated]);
  const readable = (value: string) =>
    session ? readableEvalText(value, repairReadableReferences(session.context, run?.id)) : value;
  return (
    <Space direction="vertical" size={12} style={{ width: "100%" }} aria-label={text("title")}>
      <Typography.Text strong>{text("target", { name: request.target.name })}</Typography.Text>
      {!onViewChange && thinking && (
        <Spin tip={text("analyzing")}>
          <div style={{ height: 64 }} />
        </Spin>
      )}
      {!onViewChange &&
        messages.map((message) => (
          <Typography.Paragraph
            key={message.id}
            type={message.tone === "error" ? "danger" : undefined}
          >
            {message.content}
          </Typography.Paragraph>
        ))}
      {error && (
        <Alert
          type="error"
          showIcon
          message={error}
          action={
            phase === "error" ? (
              <Button
                onClick={() =>
                  void analyze(
                    instructions.current.at(-1) ??
                      analysisText("goal", { name: request.target.name }),
                  )
                }
              >
                {text("retry")}
              </Button>
            ) : undefined
          }
        />
      )}
      {session?.context.analysisOnlyReason && (
        <Alert
          type="info"
          showIcon
          message={text(`analysisOnly_${session.context.analysisOnlyReason}`)}
        />
      )}
      {session && !session.context.complete && (
        <Alert type="warning" showIcon message={text("incomplete")} />
      )}
      {plan && (
        <>
          <Typography.Paragraph>{readable(plan.summary)}</Typography.Paragraph>
          {plan.changes.length > 0 && (
            <Table
              size="small"
              rowKey="field"
              pagination={false}
              scroll={{ x: 420 }}
              dataSource={plan.changes}
              columns={[
                { title: text("field"), dataIndex: "field", width: 120, ellipsis: true },
                { title: text("before"), dataIndex: "before", width: 80 },
                { title: text("after"), dataIndex: "after", width: 80 },
                {
                  title: text("reason"),
                  dataIndex: "reason",
                  width: 180,
                  ellipsis: true,
                  render: (value: string) => (
                    <Tooltip title={readable(value)}>
                      <span>{readable(value)}</span>
                    </Tooltip>
                  ),
                },
              ]}
            />
          )}
          {plan.manual_steps.length > 0 && (
            <Alert
              type="warning"
              showIcon
              message={text("manual")}
              description={
                <ul>
                  {plan.manual_steps.map((s, i) => (
                    <li key={i}>{readable(s)}</li>
                  ))}
                </ul>
              }
            />
          )}
          {phase === "ready" && !thinking && !submitted.current && plan.changes.length > 0 && (
            <Button type="primary" onClick={apply}>
              {text("apply")}
            </Button>
          )}
          {["applying", "retesting"].includes(phase) && !run && (
            <Space role="status">
              <Spin size="small" />
              <Typography.Text>{text(phase)}</Typography.Text>
            </Space>
          )}
          {phase === "retestFailed" && (
            <Button onClick={() => void retest()}>{text("retryRetest")}</Button>
          )}
        </>
      )}
      {run && (
        <Alert
          showIcon
          type={
            terminal && run.execution_status === "completed" && run.quality_outcome === "pass"
              ? "success"
              : "info"
          }
          message={text(
            !terminal
              ? "running"
              : run.execution_status === "completed" && run.quality_outcome === "pass"
                ? "verified"
                : "notResolved",
          )}
          action={<Button onClick={() => onInspectRun(run)}>{text("viewRun")}</Button>}
        />
      )}
    </Space>
  );
}
