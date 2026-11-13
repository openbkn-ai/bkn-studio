/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { CloseOutlined, ThunderboltOutlined } from "@ant-design/icons";
import { Alert, Button, Tag } from "antd";
import dayjs from "dayjs";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { AppButton } from "@/framework/ui/common/AppButton";
import { InNetworkDot } from "@/modules/bkn-project/components/kinetic/KineticNeedPanel";
import {
  type AskNames,
  changedItem,
  proposalView,
} from "@/modules/bkn-project/components/ai/proposals";
import { ProposalCard, ProposalsBar } from "@/modules/bkn-project/components/ai/ProposalCard";
import {
  requirementErrorText,
  runningWork,
} from "@/modules/bkn-project/components/requirements/requirementMessages";
import {
  ASK_MAX_REFS,
  ASK_POLL_MS,
  askInConversation,
  decideProposals,
  deleteConversation,
  getConversation,
  listConversations,
  startConversation,
} from "@/modules/bkn-project/services/conversations.service";
import { projectErrorCode } from "@/modules/bkn-project/services/publish.service";
import {
  getRequirements,
  POLL_FAILURE_LIMIT,
} from "@/modules/bkn-project/services/requirements.service";
import type {
  AskConversation,
  AskItemKind,
  AskPage,
  AskRef,
  AskTurn,
} from "@/modules/bkn-project/types/conversations";
import type { Requirements } from "@/modules/bkn-project/types/requirements";
import { AiPromptComposer } from "@/modules/knowledge-network/components/shared/AiPromptComposer";

import sidebar from "./AskAiSidebar.module.css";
import styles from "./RequirementAsk.module.css";

const PREFIX = "bknProject.ask.panel";
/** How many examples are offered before the first question. */
const EXAMPLES = 3;
/** Why a turn was not answered, as the panel words it; any other reads as `other`. */
const TURN_ERRORS = new Set([
  "agent_timeout",
  "agent_failed",
  "agent_unavailable",
  "agent_rejected",
  "output_invalid",
  "interrupted",
]);

/** Which decision is being written: one proposal, or all of a turn's. */
type Deciding = { all: boolean; index: number; turnId: string } | null;

/**
 * Ask AI beside kinetic modeling or business scenarios: a conversation kept in the project for
 * the page, answered in the background. Each answer comes with changes AI proposes; each is adopted
 * or declined on its own, or all of an answer's at once, and adopting writes it into the list at
 * once. Earlier conversations can be picked up again or deleted whole.
 */
export function RequirementAskPanel({
  names,
  onClose,
  onDecided,
  onRemoveRef,
  onSent,
  onStale,
  page,
  projectId,
  refs,
  subtitle,
  updateTime,
}: {
  /** Names items proposals refer to by id. */
  names: AskNames;
  onClose: () => void;
  /** Adopting wrote these changes: the specification after, and the items changed. */
  onDecided: (
    requirements: Requirements | null,
    changed: { id: string; kind: AskItemKind }[],
  ) => void;
  onRemoveRef: (ref: AskRef) => void;
  /** A question went with the items ticked: the page clears them. */
  onSent: () => void;
  /** The list changed since it was read: the page reads it again. */
  onStale: () => void;
  page: AskPage;
  projectId: string;
  /** The list items ticked on the page, sent with the next question. */
  refs: AskRef[];
  subtitle: string;
  /** The specification's, as the page read it; adopting is sent with it. */
  updateTime: number | undefined;
}) {
  const { t } = useTranslation();
  const { message, modal } = useAppServices();
  // null while loading; the page's conversations, the one changed last first.
  const [conversations, setConversations] = useState<AskConversation[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [history, setHistory] = useState(false);
  const [sending, setSending] = useState(false);
  const [deciding, setDeciding] = useState<Deciding>(null);
  const [pollFailures, setPollFailures] = useState(0);
  const [promptRequest, setPromptRequest] = useState<{ revision: number; value: string }>();
  const content = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoadFailed(false);
    try {
      const list = await listConversations(projectId, page);
      setConversations(list);
      // The last conversation is picked up where it was left.
      setCurrentId((current) => current ?? list[0]?.id ?? null);
    } catch {
      setLoadFailed(true);
    }
  }, [page, projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const current = conversations?.find((item) => item.id === currentId) ?? null;
  const last = current?.turns[current.turns.length - 1];
  const waiting = last?.status === "pending";

  /** Puts a conversation as read in the list, first, as the one changed last. */
  const put = useCallback((conversation: AskConversation) => {
    setConversations((list) => [
      conversation,
      ...(list ?? []).filter((item) => item.id !== conversation.id),
    ]);
  }, []);

  // While its last question waits for the answer, the conversation is read again every while.
  const pollStalled = pollFailures >= POLL_FAILURE_LIMIT;
  useEffect(() => {
    if (!current || !waiting || pollStalled) {
      return undefined;
    }
    let active = true;
    const timer = window.setTimeout(() => {
      getConversation(projectId, current.id)
        .then((next) => {
          if (active) {
            setPollFailures(0);
            put(next);
          }
        })
        .catch(() => active && setPollFailures((count) => count + 1));
    }, ASK_POLL_MS);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [current, pollStalled, projectId, put, waiting]);

  // The newest of the conversation stays in view.
  const turnsShown = current?.turns.length ?? 0;
  const lastStatus = last?.status;
  useEffect(() => {
    const box = content.current;
    if (box && !history) {
      box.scrollTop = box.scrollHeight;
    }
  }, [history, turnsShown, lastStatus, currentId]);

  const ask = async (question: string, with_: AskRef[], again = false) => {
    if (with_.length > ASK_MAX_REFS) {
      message.warning(t(`${PREFIX}.tooManyRefs`, { count: ASK_MAX_REFS }));
      setPromptRequest((request) => ({ revision: (request?.revision ?? 0) + 1, value: question }));
      return;
    }
    setSending(true);
    try {
      const next = current
        ? await askInConversation(projectId, current.id, question, with_)
        : await startConversation(projectId, page, question, with_);
      put(next);
      setCurrentId(next.id);
      setPollFailures(0);
      if (!again) {
        onSent();
      }
    } catch (error) {
      const code = projectErrorCode(error);
      message.error(
        code === "Requirement.AskPending"
          ? t(`${PREFIX}.askPending`)
          : code === "Requirement.InvalidItem"
            ? t(`${PREFIX}.refGone`)
            : code === "Requirement.NotFound"
              ? t(`${PREFIX}.noSpec.${page}`)
              : requirementErrorText(t, code),
      );
      // The question is given back to ask again.
      if (!again) {
        setPromptRequest((request) => ({
          revision: (request?.revision ?? 0) + 1,
          value: question,
        }));
      }
    } finally {
      setSending(false);
    }
  };

  const decide = async (turn: AskTurn, adopt: number[], decline: number[], all = false) => {
    if (!current || updateTime === undefined || deciding) {
      return;
    }
    setDeciding({ all, index: adopt[0] ?? decline[0] ?? -1, turnId: turn.id });
    try {
      const reply = await decideProposals(projectId, current.id, turn.id, {
        adopt,
        decline,
        updateTime,
      });
      put(reply.conversation);
      const adopted = reply.conversation.turns.find((item) => item.id === turn.id);
      onDecided(
        reply.requirements,
        adopt
          .map((index) => adopted?.proposals[index])
          .map((proposal) => (proposal ? changedItem(proposal) : null))
          .filter((item): item is { id: string; kind: AskItemKind } => item !== null),
      );
      if (adopt.length === 1) {
        message.success(
          t(`${PREFIX}.adopted`, {
            name: proposalView(t, names, turn.proposals[adopt[0]]).label,
          }),
        );
      } else if (adopt.length > 1) {
        message.success(t(`${PREFIX}.adoptedAll`, { count: adopt.length }));
      }
    } catch (error) {
      const code = projectErrorCode(error);
      if (code === "Requirement.ProposalChanged") {
        message.warning(t(`${PREFIX}.proposalChanged`));
      } else if (code === "Requirement.Stale") {
        message.warning(t(`${PREFIX}.stale`));
        onStale();
      } else if (code === "Requirement.Drafting") {
        // The work holding the requirements may be another page's, such as extracting concepts.
        const work = runningWork(await getRequirements(projectId).catch(() => null));
        message.warning(t(`${PREFIX}.drafting.${work ?? page}`));
      } else {
        message.error(requirementErrorText(t, code));
      }
    } finally {
      setDeciding(null);
    }
  };

  const remove = (conversation: AskConversation) =>
    void modal.confirm({
      cancelText: t("common.cancel"),
      content: t(`${PREFIX}.deleteContent`, {
        count: conversation.turns.length,
        title: conversation.title,
      }),
      okButtonProps: { danger: true },
      okText: t(`${PREFIX}.delete`),
      onOk: async () => {
        try {
          await deleteConversation(projectId, conversation.id);
        } catch (error) {
          message.error(requirementErrorText(t, projectErrorCode(error)));
          return;
        }
        setConversations((list) => (list ?? []).filter((item) => item.id !== conversation.id));
        if (conversation.id === currentId) {
          setCurrentId(null);
        }
        message.success(t(`${PREFIX}.deleted`));
      },
      title: t(`${PREFIX}.deleteTitle`),
    });

  const startNew = () => {
    setCurrentId(null);
    setHistory(false);
  };

  const pick = (id: string) => {
    setCurrentId(id);
    setHistory(false);
    setPollFailures(0);
  };

  const turnError = (code: string) =>
    t(`${PREFIX}.turnError.${TURN_ERRORS.has(code) ? code : "other"}`);

  const busy = sending || waiting;
  const empty = !current?.turns.length;
  const renderTurn = (turn: AskTurn, isLast: boolean) => {
    const open = turn.proposals
      .map((proposal, index) => (proposal.status ? -1 : index))
      .filter((index) => index >= 0);
    const answered = turn.status === "ready";
    return (
      <div className={styles.turn} key={turn.id}>
        <div className={`${sidebar.message} ${sidebar.messageUser}`}>
          {turn.refs.length ? (
            <div className={styles.refs}>
              {turn.refs.map((ref) => (
                <span className={styles.chip} key={`${ref.kind}-${ref.id}`}>
                  {ref.name}
                </span>
              ))}
            </div>
          ) : null}
          {turn.question}
        </div>
        {turn.status === "pending" ? (
          <div className={`${sidebar.message} ${sidebar.messageAssistant}`}>
            <span className={sidebar.thinking}>
              <i />
              <i />
              <i />
            </span>
            {t(`${PREFIX}.thinking`)}
          </div>
        ) : turn.status === "failed" ? (
          <div className={`${sidebar.message} ${sidebar.messageAssistant} ${sidebar.messageError}`}>
            {turnError(turn.error)}
            {/* Only the last question that failed is asked again: later ones built on it. */}
            {isLast && !busy ? (
              <Button
                className={sidebar.retry}
                onClick={() => void ask(turn.question, turn.refs, true)}
                size="small"
                type="link"
              >
                {t(`${PREFIX}.retry`)}
              </Button>
            ) : null}
          </div>
        ) : (
          <div className={`${sidebar.message} ${sidebar.messageAssistant}`}>
            {turn.answer ||
              t(`${PREFIX}.${turn.proposals.length ? "onlySuggestions" : "noAnswer"}`)}
          </div>
        )}
        {answered
          ? turn.proposals.map((proposal, index) => {
              const view = proposalView(t, names, proposal);
              const mine = deciding?.turnId === turn.id;
              return (
                <ProposalCard
                  after={
                    view.after ? (
                      view.afterInNetwork ? (
                        <span className={styles.inNetwork}>
                          <InNetworkDot />
                          {view.after}
                        </span>
                      ) : (
                        view.after
                      )
                    ) : undefined
                  }
                  before={view.before}
                  busy={mine && !deciding.all && deciding.index === index}
                  detail={view.detail}
                  disabled={deciding !== null || updateTime === undefined}
                  key={index}
                  label={view.label}
                  onAdopt={() => void decide(turn, [index], [])}
                  onDecline={() => void decide(turn, [], [index])}
                  op={view.op}
                  reason={proposal.reason}
                  status={proposal.status}
                />
              );
            })
          : null}
        {answered && turn.dropped ? (
          <p className={styles.note}>{t(`${PREFIX}.dropped`, { count: turn.dropped })}</p>
        ) : null}
        {answered && (turn.proposals.length > 1 || open.length) ? (
          <ProposalsBar
            busy={deciding?.turnId === turn.id && deciding.all}
            disabled={deciding !== null || updateTime === undefined}
            onAdoptAll={() => void decide(turn, open, [], true)}
            pending={open.length}
          />
        ) : null}
      </div>
    );
  };

  return (
    <aside aria-label={t(`${PREFIX}.title`)} className={`${sidebar.panel} ${styles.panel}`}>
      <div className={sidebar.header}>
        <div className={sidebar.title}>
          <span aria-hidden="true" className={sidebar.titleIcon}>
            <ThunderboltOutlined />
          </span>
          <div>
            <strong>{t(`${PREFIX}.title`)}</strong>
            <span>{subtitle}</span>
          </div>
        </div>
        <div className={sidebar.actions}>
          <Button
            aria-label={t(`${PREFIX}.close`)}
            icon={<CloseOutlined />}
            onClick={onClose}
            type="text"
          />
        </div>
      </div>
      {/* The conversations kept for the page, and a new one, under the title. */}
      <div className={styles.toolbar}>
        <Button onClick={() => setHistory(!history)} size="small">
          {history
            ? t(`${PREFIX}.backToChat`)
            : t(`${PREFIX}.history`, { count: conversations?.length ?? 0 })}
        </Button>
        <Button disabled={sending} onClick={startNew} size="small">
          {t(`${PREFIX}.newConversation`)}
        </Button>
      </div>
      <div className={`${sidebar.content} ${empty ? sidebar.contentEmpty : ""}`} ref={content}>
        {loadFailed ? (
          <Alert
            action={
              <AppButton onClick={() => void load()} size="small">
                {t("common.retry")}
              </AppButton>
            }
            message={t(`${PREFIX}.loadFailed`)}
            showIcon
            type="error"
          />
        ) : null}
        {history ? (
          <>
            <p className={styles.note}>{t(`${PREFIX}.historyHint`)}</p>
            {conversations?.length ? (
              <ul className={styles.history}>
                {conversations.map((conversation) => (
                  <li
                    className={`${styles.historyItem} ${
                      conversation.id === currentId ? styles.historyCurrent : ""
                    }`}
                    key={conversation.id}
                  >
                    <button
                      className={styles.historyTitle}
                      onClick={() => pick(conversation.id)}
                      type="button"
                    >
                      <span>{conversation.title}</span>
                      <span className={styles.note}>
                        {t(`${PREFIX}.historyMeta`, {
                          count: conversation.turns.length,
                          time: dayjs(conversation.updateTime).format("YYYY/MM/DD HH:mm"),
                        })}
                        {conversation.id === currentId ? t(`${PREFIX}.historyCurrentMark`) : ""}
                      </span>
                    </button>
                    <AppButton
                      aria-label={t(`${PREFIX}.deleteItem`, { name: conversation.title })}
                      danger
                      onClick={() => remove(conversation)}
                      size="small"
                      type="text"
                    >
                      {t(`${PREFIX}.delete`)}
                    </AppButton>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.note}>{t(`${PREFIX}.historyNone`)}</p>
            )}
          </>
        ) : (
          <>
            {empty ? (
              <p className={sidebar.intro}>{t(`${PREFIX}.intro.${page}`)}</p>
            ) : (
              <div aria-live="polite" className={styles.conversation}>
                {current?.turns.map((turn, index) =>
                  renderTurn(turn, index === current.turns.length - 1),
                )}
                {waiting && pollStalled ? (
                  <Alert
                    action={
                      <AppButton onClick={() => setPollFailures(0)} size="small">
                        {t("common.retry")}
                      </AppButton>
                    }
                    message={t(`${PREFIX}.pollStalled`)}
                    showIcon
                    type="warning"
                  />
                ) : null}
              </div>
            )}
            {empty ? (
              <div className={sidebar.examples}>
                <span>{t(`${PREFIX}.examplesTitle`)}</span>
                {Array.from({ length: EXAMPLES }, (_, index) => {
                  const example = t(`${PREFIX}.examples.${page}.${index}`);
                  return (
                    <button
                      key={index}
                      onClick={() =>
                        setPromptRequest((request) => ({
                          revision: (request?.revision ?? 0) + 1,
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
            ) : null}
          </>
        )}
      </div>
      {history ? null : (
        <div className={sidebar.composer}>
          {refs.length ? (
            <div className={styles.refs}>
              <span className={styles.note}>{t(`${PREFIX}.refs`)}</span>
              {refs.map((ref) => (
                <Tag
                  className={styles.refTag}
                  closable
                  closeIcon={<CloseOutlined aria-label={t(`${PREFIX}.removeRef`)} />}
                  key={`${ref.kind}-${ref.id}`}
                  onClose={(event) => {
                    event.preventDefault();
                    onRemoveRef(ref);
                  }}
                >
                  {ref.name}
                </Tag>
              ))}
            </div>
          ) : null}
          <AiPromptComposer
            // Nothing is asked while an answer is awaited or a decision written.
            checking={busy || deciding !== null}
            generating={false}
            inputLabel={t(`${PREFIX}.question`)}
            onStop={() => undefined}
            onSubmit={(question) => void ask(question, refs)}
            placeholder={t(`${PREFIX}.placeholder.${page}`)}
            promptRequest={promptRequest}
            sendLabel={t(`${PREFIX}.submit`)}
            stopLabel={t(`${PREFIX}.submit`)}
          />
          <p className={styles.note}>{t(`${PREFIX}.carries`)}</p>
        </div>
      )}
    </aside>
  );
}
