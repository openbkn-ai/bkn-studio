/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Input, Modal, Spin } from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { MarkdownText } from "@/framework/ui/common/MarkdownText";
import { AppButton } from "@/framework/ui/common/AppButton";
import type {
  CypherResultShape,
  FunctionParameterDef,
} from "@/modules/execution-factory/types/function-input";
import {
  cypherFunctionMessage,
  parseCypherFunctionAnswer,
  type CypherFunctionAiTexts,
  type CypherFunctionSuggestion,
} from "@/modules/execution-factory/utils/cypher-function-ai";
import {
  CypherAgentError,
  generateCypher,
  type CypherAgentTexts,
} from "@/modules/knowledge-network/cypher/cypher-ai";
import type { AgentTokenProvider } from "@/modules/knowledge-network/services/agent-chat.service";
import { cancelExecution } from "@/modules/knowledge-network/services/bkn-agent-execution.service";

import styles from "./CypherFunctionSettings.module.css";

type Outcome = { suggestion: CypherFunctionSuggestion; answer: string };

const key = (name: string) => `executionFactory.cypherFunction.ai.${name}`;

/**
 * Writes a Cypher function's statement from a description, with the BKN Agent the data query
 * page uses. The request states the function's contract: `$name` parameters tried with real
 * sample values, and the rows the chosen shape returns. Applying it replaces the statement.
 */
export function CypherFunctionAiModal({
  base,
  inputs,
  knId,
  onApply,
  onClose,
  open,
  shape,
  tokenProvider,
}: {
  base: string;
  /** The network the statement queries; generation needs one. */
  knId: string;
  shape: CypherResultShape;
  inputs: readonly FunctionParameterDef[];
  tokenProvider: AgentTokenProvider;
  open: boolean;
  onClose: () => void;
  onApply: (suggestion: CypherFunctionSuggestion) => void;
}) {
  const { t } = useTranslation();
  const [description, setDescription] = useState("");
  const [running, setRunning] = useState(false);
  const [tools, setTools] = useState<string[]>([]);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const run = useRef<{ controller: AbortController; runId: string } | null>(null);

  const agentTexts = useMemo<CypherAgentTexts>(
    () => ({
      notReady: t("knowledgeNetwork.cypherQuery.agent.notReady"),
      forbidden: t("knowledgeNetwork.cypherQuery.agent.forbidden"),
      busy: t("knowledgeNetwork.cypherQuery.agent.busy"),
      timeout: t("knowledgeNetwork.cypherQuery.agent.timeout"),
      failed: t("knowledgeNetwork.cypherQuery.agent.failed"),
      network: t("knowledgeNetwork.cypherQuery.agent.network"),
    }),
    [t],
  );
  const messageTexts = useMemo<CypherFunctionAiTexts>(
    () => ({
      request: t(key("message.request")),
      contract: t(key("message.contract")),
      parameters: t(key("message.parameters")),
      trial: t(key("message.trial")),
      shapeValue: t(key("message.shapeValue")),
      shapeTable: t(key("message.shapeTable")),
      answer: t(key("message.answer")),
      existing: t(key("message.existing")),
    }),
    [t],
  );

  /** Stops a generation still running, here and on the server. */
  const stop = () => {
    const current = run.current;
    run.current = null;
    if (!current) return;
    current.controller.abort();
    if (current.runId) {
      void cancelExecution({ base, tokenProvider, runId: current.runId }).catch(() => undefined);
    }
  };

  useEffect(() => stop, []); // eslint-disable-line react-hooks/exhaustive-deps -- unmount only

  const close = () => {
    stop();
    setRunning(false);
    onClose();
  };

  const generate = async () => {
    if (!description.trim() || !knId) return;
    stop();
    const controller = new AbortController();
    const current = { controller, runId: "" };
    run.current = current;
    setRunning(true);
    setTools([]);
    setOutcome(null);
    setError(null);
    try {
      const generated = await generateCypher(
        {
          base,
          tokenProvider,
          knId,
          message: cypherFunctionMessage({ description, shape, inputs, texts: messageTexts }),
          signal: controller.signal,
          onRun: (runId) => {
            current.runId = runId;
          },
          onTool: (name) => setTools((list) => [...list, name]),
        },
        agentTexts,
      );
      if (run.current !== current) return;
      setOutcome({
        suggestion: parseCypherFunctionAnswer(generated.answer),
        answer: generated.answer,
      });
    } catch (caught) {
      if (controller.signal.aborted || run.current !== current) return;
      setError(
        caught instanceof CypherAgentError || caught instanceof Error
          ? caught.message
          : String(caught),
      );
    } finally {
      if (run.current === current) {
        run.current = null;
        setRunning(false);
      }
    }
  };

  const suggestion = outcome?.suggestion;
  const suggested = suggestion ? Object.entries(suggestion.parameters) : [];

  return (
    <Modal
      destroyOnHidden
      footer={null}
      onCancel={close}
      open={open}
      title={t(key("title"))}
      width={760}
    >
      <div className={styles.aiBody}>
        {!knId ? <Alert message={t(key("needNetwork"))} showIcon type="info" /> : null}
        <label className={styles.aiField}>
          <span className={styles.label}>{t(key("description"))}</span>
          <Input.TextArea
            aria-label={t(key("description"))}
            disabled={running}
            onChange={(event) => setDescription(event.target.value)}
            placeholder={t(key("placeholder"))}
            rows={3}
            value={description}
          />
        </label>
        <p className={styles.aiHint}>
          {t(shape === "value" ? key("shapeValueHint") : key("shapeTableHint"))}
        </p>
        {running ? (
          <div className={styles.aiWorking}>
            <Spin size="small" />
            <span>
              {tools.length > 0
                ? t(key("workingTool"), { name: tools[tools.length - 1] })
                : t(key("working"))}
            </span>
          </div>
        ) : null}
        {error ? <Alert message={error} showIcon type="error" /> : null}
        {outcome && !suggestion?.query ? (
          <>
            <Alert message={t(key("noQuery"))} showIcon type="warning" />
            <MarkdownText text={outcome.answer} />
          </>
        ) : null}
        {suggestion?.query ? (
          <>
            <span className={styles.label}>{t(key("result"))}</span>
            <pre aria-label={t(key("result"))} className={styles.aiQuery}>
              {suggestion.query}
            </pre>
            {suggested.length > 0 ? (
              <>
                <span className={styles.label}>{t(key("parameters"))}</span>
                <ul className={styles.aiParameters}>
                  {suggested.map(([name, item]) => (
                    <li key={name}>
                      <code>${name}</code>
                      {item.type ? ` (${item.type})` : ""}
                      {item.description ? ` · ${item.description}` : ""}
                      {item.example !== undefined
                        ? ` · ${t(key("example"))} ${JSON.stringify(item.example)}`
                        : ""}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </>
        ) : null}
        <div className={styles.aiActions}>
          <AppButton onClick={close}>{t("common.cancel")}</AppButton>
          <AppButton
            disabled={!knId || !description.trim()}
            loading={running}
            onClick={() => void generate()}
            type={suggestion?.query ? "default" : "primary"}
          >
            {t(suggestion?.query ? key("regenerate") : key("generate"))}
          </AppButton>
          {suggestion?.query ? (
            <AppButton
              onClick={() => {
                onApply(suggestion);
                close();
              }}
              type="primary"
            >
              {t(key("apply"))}
            </AppButton>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
