/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { CloseOutlined, ThunderboltOutlined } from "@ant-design/icons";
import { Button, Checkbox, Space } from "antd";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import {
  AskError,
  ASK_HISTORY_TURNS,
  askDraftItem,
} from "@/modules/bkn-project/services/ask.service";
import type {
  AskDropped,
  AskKind,
  AskRevision,
  AskTurn,
  DraftObjectTypeSave,
  DraftRelationTypeSave,
} from "@/modules/bkn-project/types/draft";
import { AiPromptComposer } from "@/modules/knowledge-network/components/shared/AiPromptComposer";
import {
  listObjectMetricAnswerModels,
  type ObjectMetricAnswerModel,
} from "@/modules/knowledge-network/services/object-metric-models.service";

import styles from "./AskAiSidebar.module.css";

const PREFIX = "bknProject.model.ask";
/** How many examples are offered before the first question. */
const EXAMPLES = 3;

/** Why Ask AI did not answer, as the page says it; any other is said as `other`. */
const ERRORS = new Set(["NotReady", "ItemNotFound", "AskUnavailable", "AskTimeout"]);
/** What a proposed change was to, as the page names it; any other is named as `other`. */
const FIELDS = new Set(["name", "comment", "primary_keys", "display_key", "property", "ends"]);
/** Why a proposed change was not used, as the page says it; any other is said as `other`. */
const DROPPED = new Set([
  "unchanged",
  "unknown_property",
  "unknown_end",
  "type_mismatch",
  "too_long",
  "invalid_name",
  "duplicate",
]);

/** A change as the person sees it before applying it: what it changes, from what to what. */
export type RevisionPreview = { after: string; before: string; label: string };

/** Takes back what was applied; false when the editor changed since, and nothing was. */
export type UndoApply = () => boolean;

type Message = {
  content: string;
  id: number;
  /** A question that stopped, asked again from its message. */
  retry?: string;
  role: "assistant" | "user";
  tone?: "error";
};

type Proposal = {
  dropped: AskDropped[];
  /** How each change read against the editor when the answer came, kept as it was then. */
  previews: RevisionPreview[];
  revisions: AskRevision[];
  /** The changes to apply, by their place in `revisions`; all of them at first. */
  selected: number[];
};

/**
 * Ask AI beside an editor, as a conversation like the knowledge network's object metric
 * designer: a question about what is being edited, unsaved changes included, gets an answer and
 * the changes it proposes, each from what it is now to what it would be. Chosen changes go into
 * the editor only when applied, can be taken back, and are written only by saving. Closing the
 * editor forgets the conversation.
 */
export function AskAiSidebar({
  itemId,
  kind,
  onApply,
  onClose,
  preview,
  projectId,
  subtitle,
  working,
}: {
  itemId: string;
  kind: AskKind;
  /** Puts the changes into the editor; replies how to take them back. */
  onApply: (revisions: AskRevision[]) => UndoApply;
  onClose: () => void;
  /** How a change reads against the editor as it is now. */
  preview: (revision: AskRevision) => RevisionPreview;
  projectId: string;
  /** What is being edited, under the title. */
  subtitle: string;
  /** What the editor holds now, saved or not. */
  working: () => DraftObjectTypeSave | DraftRelationTypeSave;
}) {
  const { t } = useTranslation();
  const { message } = useAppServices();
  const [messages, setMessages] = useState<Message[]>([]);
  const [written, setWritten] = useState("");
  const [generating, setGenerating] = useState(false);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [undo, setUndo] = useState<{ take: UndoApply } | null>(null);
  const [promptRequest, setPromptRequest] = useState<{ revision: number; value: string }>();
  const [models, setModels] = useState<ObjectMetricAnswerModel[]>([]);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [modelsUnavailable, setModelsUnavailable] = useState(false);
  const [modelId, setModelId] = useState<string>();
  const turns = useRef<AskTurn[]>([]);
  const nextId = useRef(0);
  const asking = useRef<AbortController | null>(null);
  // An answer is read against the editor as it is when it comes, not as it was when asked.
  const previewNow = useRef(preview);
  useEffect(() => {
    previewNow.current = preview;
  });

  useEffect(() => {
    let alive = true;
    listObjectMetricAnswerModels()
      .then((list) => {
        if (alive) setModels(list);
      })
      .catch(() => {
        if (alive) setModelsUnavailable(true);
      })
      .finally(() => {
        if (alive) setModelsLoading(false);
      });
    return () => {
      alive = false;
      // Closing the editor stops an answer still being written.
      asking.current?.abort();
    };
  }, []);

  const say = (content: Omit<Message, "id">) =>
    setMessages((current) => [...current, { ...content, id: nextId.current++ }]);

  const ask = async (question: string, again = false) => {
    if (!again) {
      say({ content: question, role: "user" });
    }
    setGenerating(true);
    setProposal(null);
    setUndo(null);
    setWritten("");
    let text = "";
    const controller = new AbortController();
    asking.current = controller;
    const request = {
      history: turns.current.slice(-ASK_HISTORY_TURNS),
      itemId,
      modelId,
      onText: (piece: string) => {
        text += piece;
        setWritten(text);
      },
      projectId,
      question,
      signal: controller.signal,
    };
    try {
      const reply = await (kind === "object_types"
        ? askDraftItem({ ...request, kind, working: working() as DraftObjectTypeSave })
        : askDraftItem({ ...request, kind, working: working() as DraftRelationTypeSave }));
      const answer = reply.answer || text;
      turns.current = [...turns.current, { answer, question }];
      say({ content: answer, role: "assistant" });
      if (reply.revisions.length || reply.dropped.length) {
        setProposal({
          dropped: reply.dropped,
          previews: reply.revisions.map((revision) => previewNow.current(revision)),
          revisions: reply.revisions,
          selected: reply.revisions.map((_, index) => index),
        });
      }
    } catch (error) {
      // What was written stays; a question that stopped can be asked again.
      if (text) {
        say({ content: text, role: "assistant" });
      }
      if (!controller.signal.aborted) {
        const code = error instanceof AskError ? error.code : "other";
        say({
          content: t(`${PREFIX}.error.${ERRORS.has(code) ? code : "other"}`),
          retry: question,
          role: "assistant",
          tone: "error",
        });
      }
    } finally {
      setWritten("");
      setGenerating(false);
    }
  };

  const restart = () => {
    turns.current = [];
    setMessages([]);
    setProposal(null);
    setUndo(null);
  };

  const apply = () => {
    if (proposal) {
      setUndo({ take: onApply(proposal.selected.map((index) => proposal.revisions[index])) });
      setProposal(null);
    }
  };

  const takeBack = () => {
    if (undo?.take()) {
      message.success(t(`${PREFIX}.undone`));
    } else {
      message.warning(t(`${PREFIX}.undoStale`));
    }
    setUndo(null);
  };

  const droppedText = (item: AskDropped) =>
    t(`${PREFIX}.dropped.item`, {
      field: t(`${PREFIX}.field.${FIELDS.has(item.field) ? item.field : "other"}`),
      reason: t(`${PREFIX}.dropped.reason.${DROPPED.has(item.reason) ? item.reason : "other"}`),
    });

  const empty = !messages.length && !generating;
  return (
    <aside aria-label={t(`${PREFIX}.title`)} className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.title}>
          <span aria-hidden="true" className={styles.titleIcon}>
            <ThunderboltOutlined />
          </span>
          <div>
            <strong>{t(`${PREFIX}.title`)}</strong>
            <span>{subtitle}</span>
          </div>
        </div>
        <div className={styles.actions}>
          {messages.length ? (
            <Button disabled={generating} onClick={restart} size="small" type="text">
              {t(`${PREFIX}.newConversation`)}
            </Button>
          ) : null}
          <Button
            aria-label={t(`${PREFIX}.close`)}
            icon={<CloseOutlined />}
            onClick={onClose}
            type="text"
          />
        </div>
      </div>
      <div className={`${styles.content} ${empty ? styles.contentEmpty : ""}`}>
        {empty ? (
          <p className={styles.intro}>{t(`${PREFIX}.intro.${kind}`)}</p>
        ) : (
          <div aria-live="polite" className={styles.conversation}>
            {messages.map((item) => (
              <div
                className={`${styles.message} ${
                  item.role === "user" ? styles.messageUser : styles.messageAssistant
                } ${item.tone === "error" ? styles.messageError : ""}`}
                key={item.id}
              >
                {item.content}
                {item.retry && !generating ? (
                  <Button
                    className={styles.retry}
                    onClick={() => void ask(item.retry ?? "", true)}
                    size="small"
                    type="link"
                  >
                    {t(`${PREFIX}.retry`)}
                  </Button>
                ) : null}
              </div>
            ))}
            {generating ? (
              <div className={`${styles.message} ${styles.messageAssistant}`}>
                {written || (
                  <>
                    <span className={styles.thinking}>
                      <i />
                      <i />
                      <i />
                    </span>
                    {t(`${PREFIX}.asking`)}
                  </>
                )}
              </div>
            ) : null}
          </div>
        )}
        {proposal && !generating ? (
          <div className={styles.proposal}>
            {proposal.revisions.length ? (
              <>
                <strong>{t(`${PREFIX}.proposalTitle`)}</strong>
                <p>{t(`${PREFIX}.proposalHint`)}</p>
                {proposal.revisions.map((revision, index) => {
                  const shown = proposal.previews[index];
                  return (
                    <Checkbox
                      checked={proposal.selected.includes(index)}
                      key={index}
                      onChange={(event) =>
                        setProposal({
                          ...proposal,
                          selected: event.target.checked
                            ? [...proposal.selected, index].sort((a, b) => a - b)
                            : proposal.selected.filter((item) => item !== index),
                        })
                      }
                    >
                      <span className={styles.proposalField}>{shown.label}</span>
                      <span className={styles.proposalDiff}>
                        <span className={styles.proposalValue} title={shown.before}>
                          {t(`${PREFIX}.before`, {
                            value: shown.before || t(`${PREFIX}.empty`),
                          })}
                        </span>
                        <span className={styles.proposalValue} title={shown.after}>
                          {t(`${PREFIX}.after`, { value: shown.after || t(`${PREFIX}.empty`) })}
                        </span>
                      </span>
                      {revision.reason ? (
                        <span className={styles.proposalReason}>{revision.reason}</span>
                      ) : null}
                    </Checkbox>
                  );
                })}
              </>
            ) : null}
            {proposal.dropped.length ? (
              <div className={styles.dropped}>
                <span>{t(`${PREFIX}.dropped.title`, { count: proposal.dropped.length })}</span>
                <ul>
                  {proposal.dropped.map((item, index) => (
                    <li key={index}>{droppedText(item)}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {proposal.revisions.length ? (
              <Space>
                <Button disabled={!proposal.selected.length} onClick={apply} type="primary">
                  {t(`${PREFIX}.apply`)}
                </Button>
                <Button onClick={() => setProposal(null)}>{t(`${PREFIX}.reject`)}</Button>
              </Space>
            ) : null}
          </div>
        ) : null}
        {undo && !proposal && !generating ? (
          <div className={styles.undo}>
            <span>{t(`${PREFIX}.applied`)}</span>
            <Button onClick={takeBack} size="small">
              {t(`${PREFIX}.undo`)}
            </Button>
          </div>
        ) : null}
        {messages.length ? null : (
          <div className={styles.examples}>
            <span>{t(`${PREFIX}.examplesTitle`)}</span>
            {Array.from({ length: EXAMPLES }, (_, index) => {
              const example = t(`${PREFIX}.examples.${kind}.${index}`);
              return (
                <button
                  key={index}
                  onClick={() =>
                    setPromptRequest((current) => ({
                      revision: (current?.revision ?? 0) + 1,
                      value: example,
                    }))
                  }
                  type="button"
                >
                  {example}
                </button>
              );
            })}
          </div>
        )}
      </div>
      <div className={styles.composer}>
        <AiPromptComposer
          checking={false}
          generating={generating}
          inputLabel={t(`${PREFIX}.question`)}
          modelId={modelId}
          models={models}
          modelsLoading={modelsLoading}
          modelsUnavailable={modelsUnavailable}
          // One conversation keeps one model, as the object metric designer does.
          modelSelectionLocked={messages.length > 0}
          onModelChange={setModelId}
          onStop={() => asking.current?.abort()}
          onSubmit={(question) => void ask(question)}
          placeholder={t(`${PREFIX}.placeholder.${kind}`)}
          promptRequest={promptRequest}
          sendLabel={t(`${PREFIX}.submit`)}
        />
      </div>
    </aside>
  );
}
