/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { CloseOutlined } from "@ant-design/icons";
import { Alert, Input } from "antd";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { AppButton } from "@/framework/ui/common/AppButton";
import {
  ASK_HISTORY_TURNS,
  ASK_MAX_LENGTH,
  AskError,
  askDraftItem,
} from "@/modules/bkn-project/services/ask.service";
import type {
  AskDropped,
  AskKind,
  AskRevision,
  DraftObjectTypeSave,
  DraftRelationTypeSave,
} from "@/modules/bkn-project/types/draft";

import styles from "./AskAiSidebar.module.css";

const PREFIX = "bknProject.model.ask";

/** Why Ask AI did not answer, as the page says it; any other is said as `other`. */
const ERRORS = new Set([
  "InvalidQuestion",
  "NotReady",
  "ItemNotFound",
  "AskUnavailable",
  "AskTimeout",
]);
/** Why a proposed change was not adopted, as the page says it; any other is said as `other`. */
const DROPPED = new Set([
  "unchanged",
  "unknown_property",
  "unknown_end",
  "type_mismatch",
  "too_long",
  "invalid_name",
  "duplicate",
]);

/** What a proposed change was to, as the page names it; any other is named as `other`. */
const FIELDS = new Set(["name", "comment", "primary_keys", "display_key", "property", "ends"]);

/** A change as the person sees it before adopting it: what it changes, from what to what. */
export type RevisionPreview = { after: string; before: string; label: string };

type Turn = {
  answer: string;
  /** The changes adopted, by their place in `revisions`. */
  adopted: number[];
  dropped: AskDropped[];
  /** Why it stopped, said as the page says it; null while it answers and once it has. */
  failure: string | null;
  /** How each change read against the editor when the answer came, kept as it was then. */
  previews: RevisionPreview[];
  question: string;
  revisions: AskRevision[];
  state: "answering" | "answered" | "failed";
};

/**
 * Ask AI beside an editor: questions about what is being edited, unsaved changes included, with
 * the questions before them. Its answers propose changes, each shown from what it is now to what
 * it would be; adopting one only changes the editor, and saving writes it. Nothing is kept:
 * closing the editor forgets the conversation.
 */
export function AskAiSidebar({
  canAdopt,
  itemId,
  kind,
  onAdopt,
  onClose,
  preview,
  projectId,
  working,
}: {
  canAdopt: boolean;
  itemId: string;
  kind: AskKind;
  /** Puts the changes into the editor. */
  onAdopt: (revisions: AskRevision[]) => void;
  onClose: () => void;
  /** How a change reads against the editor as it is now. */
  preview: (revision: AskRevision) => RevisionPreview;
  projectId: string;
  /** What the editor holds now, saved or not. */
  working: () => DraftObjectTypeSave | DraftRelationTypeSave;
}) {
  const { t } = useTranslation();
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const asking = useRef<AbortController | null>(null);
  const end = useRef<HTMLDivElement>(null);
  // An answer is read against the editor as it is when it comes, not as it was when asked.
  const previewNow = useRef(preview);
  previewNow.current = preview;

  // Closing the editor stops an answer still being written.
  useEffect(() => () => asking.current?.abort(), []);
  useEffect(() => {
    end.current?.scrollIntoView?.({ block: "end" });
  }, [turns]);

  const answering = turns.some((turn) => turn.state === "answering");
  const update = (at: number, change: (turn: Turn) => Turn) =>
    setTurns((current) => current.map((turn, index) => (index === at ? change(turn) : turn)));

  /** Asks a question; one asked again after it stopped replaces the turn that stopped. */
  const ask = async (text: string, again?: number) => {
    const before = turns.slice(0, again ?? turns.length);
    const at = before.length;
    const history = before
      .filter((turn) => turn.state === "answered")
      .slice(-ASK_HISTORY_TURNS)
      .map((turn) => ({ answer: turn.answer, question: turn.question }));
    setTurns([
      ...before,
      {
        adopted: [],
        answer: "",
        dropped: [],
        failure: null,
        previews: [],
        question: text,
        revisions: [],
        state: "answering",
      },
    ]);
    const controller = new AbortController();
    asking.current = controller;
    const request = { history, itemId, projectId, question: text, signal: controller.signal };
    const onText = (piece: string) =>
      update(at, (turn) => ({ ...turn, answer: turn.answer + piece }));
    try {
      const reply = await (kind === "object_types"
        ? askDraftItem({
            ...request,
            kind,
            onText,
            working: working() as DraftObjectTypeSave,
          })
        : askDraftItem({
            ...request,
            kind,
            onText,
            working: working() as DraftRelationTypeSave,
          }));
      update(at, (turn) => ({
        ...turn,
        answer: reply.answer || turn.answer,
        dropped: reply.dropped,
        previews: reply.revisions.map((revision) => previewNow.current(revision)),
        revisions: reply.revisions,
        state: "answered",
      }));
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }
      const code = error instanceof AskError ? error.code : "other";
      // What was written stays; the question can be asked again.
      update(at, (turn) => ({
        ...turn,
        failure: t(`${PREFIX}.error.${ERRORS.has(code) ? code : "other"}`),
        state: "failed",
      }));
    }
  };

  const send = () => {
    const text = question.trim();
    if (!text || answering) {
      return;
    }
    setQuestion("");
    void ask(text);
  };

  const adopt = (at: number, which: number[]) => {
    const turn = turns[at];
    onAdopt(which.map((index) => turn.revisions[index]));
    update(at, (current) => ({ ...current, adopted: [...current.adopted, ...which] }));
  };

  const droppedText = (item: AskDropped) =>
    t(`${PREFIX}.dropped.item`, {
      field: t(`${PREFIX}.field.${FIELDS.has(item.field) ? item.field : "other"}`),
      reason: t(`${PREFIX}.dropped.reason.${DROPPED.has(item.reason) ? item.reason : "other"}`),
    });

  return (
    <aside aria-label={t(`${PREFIX}.title`)} className={styles.sidebar}>
      <header className={styles.header}>
        <span className={styles.title}>{t(`${PREFIX}.title`)}</span>
        <AppButton
          aria-label={t(`${PREFIX}.close`)}
          icon={<CloseOutlined />}
          onClick={onClose}
          size="small"
          type="text"
        />
      </header>
      <div className={styles.conversation}>
        {turns.length ? null : <p className={styles.hint}>{t(`${PREFIX}.hint.${kind}`)}</p>}
        {turns.map((turn, at) => {
          const waiting = turn.revisions
            .map((_, index) => index)
            .filter((index) => !turn.adopted.includes(index));
          return (
            <div className={styles.turn} key={at}>
              <p className={styles.question}>{turn.question}</p>
              {turn.answer ? <p className={styles.answer}>{turn.answer}</p> : null}
              {turn.state === "answering" ? (
                <p className={styles.muted}>{t(`${PREFIX}.asking`)}</p>
              ) : null}
              {turn.state === "failed" ? (
                <Alert
                  action={
                    answering ? undefined : (
                      <AppButton onClick={() => void ask(turn.question, at)} size="small">
                        {t(`${PREFIX}.retry`)}
                      </AppButton>
                    )
                  }
                  message={turn.failure}
                  showIcon
                  type="warning"
                />
              ) : null}
              {turn.revisions.length ? (
                <div className={styles.revisions}>
                  <div className={styles.revisionsHead}>
                    <span>{t(`${PREFIX}.revisions`, { count: turn.revisions.length })}</span>
                    {canAdopt && waiting.length > 1 ? (
                      <AppButton onClick={() => adopt(at, waiting)} size="small">
                        {t(`${PREFIX}.adoptAll`)}
                      </AppButton>
                    ) : null}
                  </div>
                  {turn.revisions.map((revision, index) => {
                    const shown = turn.previews[index];
                    const adopted = turn.adopted.includes(index);
                    return (
                      <div className={styles.revision} key={index}>
                        <div className={styles.revisionHead}>
                          <span className={styles.label}>{shown.label}</span>
                          {canAdopt ? (
                            <AppButton
                              disabled={adopted}
                              onClick={() => adopt(at, [index])}
                              size="small"
                              type={adopted ? "text" : "primary"}
                            >
                              {t(`${PREFIX}.${adopted ? "adopted" : "adopt"}`)}
                            </AppButton>
                          ) : null}
                        </div>
                        <div className={styles.diff}>
                          <span className={styles.before}>
                            {shown.before || t(`${PREFIX}.empty`)}
                          </span>
                          <span className={styles.arrow}>{t(`${PREFIX}.arrow`)}</span>
                          <span className={styles.after}>
                            {shown.after || t(`${PREFIX}.empty`)}
                          </span>
                        </div>
                        {revision.reason ? <p className={styles.muted}>{revision.reason}</p> : null}
                      </div>
                    );
                  })}
                </div>
              ) : null}
              {turn.dropped.length ? (
                <div className={styles.dropped}>
                  <span>{t(`${PREFIX}.dropped.title`, { count: turn.dropped.length })}</span>
                  <ul>
                    {turn.dropped.map((item, index) => (
                      <li key={index}>{droppedText(item)}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          );
        })}
        <div ref={end} />
      </div>
      <footer className={styles.footer}>
        <Input.TextArea
          aria-label={t(`${PREFIX}.question`)}
          autoSize={{ maxRows: 4, minRows: 2 }}
          maxLength={ASK_MAX_LENGTH}
          onChange={(event) => setQuestion(event.target.value)}
          onPressEnter={(event) => {
            if (!event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              send();
            }
          }}
          placeholder={t(`${PREFIX}.placeholder.${kind}`)}
          value={question}
        />
        <div className={styles.footerRow}>
          <span className={styles.muted}>{t(`${PREFIX}.notKept`)}</span>
          <AppButton
            disabled={!question.trim() || answering}
            loading={answering}
            onClick={send}
            type="primary"
          >
            {t(`${PREFIX}.submit`)}
          </AppButton>
        </div>
      </footer>
    </aside>
  );
}
