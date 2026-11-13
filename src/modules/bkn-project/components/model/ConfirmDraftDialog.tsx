/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Checkbox, Modal, Tooltip } from "antd";
import dayjs from "dayjs";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { AppButton } from "@/framework/ui/common/AppButton";
import {
  blockedText,
  pendingBecauseText,
  refusalText,
} from "@/modules/bkn-project/components/publish/messages";
import { editDraftItem, getDraft } from "@/modules/bkn-project/services/draft.service";
import {
  confirmDraft,
  getProjectPending,
  getProjectStatus,
  projectErrorCode,
  projectErrorDetails,
} from "@/modules/bkn-project/services/publish.service";
import type { Draft } from "@/modules/bkn-project/types/draft";
import type { PendingItem, ProjectStatus } from "@/modules/bkn-project/types/publish";

const formatTime = (value: number) => dayjs(value).format("YYYY/MM/DD HH:mm");

import styles from "../ProjectModel.module.css";

/** What a confirmation writes: adopted object types, and adopted relation types between them. */
function adoptedCounts(draft: Draft) {
  const objects = new Set(
    draft.items.objectTypes.filter((item) => item.adopted).map((item) => item.id),
  );
  // What the network already has stays as it is: only what the draft adds is written.
  const relations = draft.items.relationTypes.filter(
    (item) =>
      item.adopted && !item.existing && objects.has(item.source) && objects.has(item.target),
  ).length;
  return {
    objects: draft.items.objectTypes.filter((item) => item.adopted && !item.existing).length,
    relations,
  };
}

/** Adopted knowledge-base objects the draft adds, and whether anything else would be confirmed. */
function documentsOf(draft: Draft) {
  const documents = draft.items.objectTypes.filter(
    (item) => item.adopted && !item.existing && item.document,
  );
  const tables = new Set(
    draft.items.objectTypes.filter((item) => item.adopted && !item.document).map((item) => item.id),
  );
  const tablesLeft =
    draft.items.objectTypes.some((item) => item.adopted && !item.existing && !item.document) ||
    draft.items.relationTypes.some(
      (item) =>
        item.adopted && !item.existing && tables.has(item.source) && tables.has(item.target),
    );
  return { documents, tablesLeft };
}

/**
 * The button that confirms a ready draft, and the dialog that does it. Whether it may be sent and
 * what it has to accept come from the project's status; bkn-project decides, the page follows.
 */
export function ConfirmDraft({
  draft,
  onConfirmed,
  onViewConfirmation,
  onShowPending,
  onSendingChange,
  onStale,
  projectId,
}: {
  draft: Draft;
  /** The draft was confirmed just now: the project goes on to its next step. */
  onConfirmed: () => void;
  /** Shows what an earlier confirmation started: its data check and local indexes. */
  onViewConfirmation: () => void;
  /** Lets the model page follow preparation progress while confirmation runs. */
  onSendingChange?: (sending: boolean) => void;
  /** Shows the items that wait for a decision, which have to be settled first. */
  onShowPending: () => void;
  /** Reloads a draft someone changed since it was read. */
  onStale: () => void;
  projectId: string;
}) {
  const { t } = useTranslation();
  const { message } = useAppServices();
  const [status, setStatus] = useState<ProjectStatus | null>(null);
  const [statusFailed, setStatusFailed] = useState(false);
  // Only the newest read counts: edits in a row send reads that may answer out of order.
  const latestRead = useRef(0);
  const [open, setOpen] = useState(false);
  const [undecided, setUndecided] = useState<PendingItem[] | null>(null);
  const [pendingFailed, setPendingFailed] = useState(false);
  const [acceptUndecided, setAcceptUndecided] = useState(false);
  const [acceptPartial, setAcceptPartial] = useState(false);
  const [acceptConflicts, setAcceptConflicts] = useState(false);
  /**
   * Requirement conflicts a refused confirmation named. The status may not say yet that confirming
   * has to accept them, so a refusal is enough to ask; null until one is refused.
   */
  const [refusedConflicts, setRefusedConflicts] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  /** Why the knowledge-base objects could not be made ready, as the refusal said; null otherwise. */
  const [documentsProblem, setDocumentsProblem] = useState<string | null>(null);

  // Read again whenever the draft changes, as each edit can change what confirming needs.
  // A failed read keeps what was read before, so an open dialog stays as it was.
  const loadStatus = useCallback(async () => {
    const read = ++latestRead.current;
    try {
      const next = await getProjectStatus(projectId);
      if (read === latestRead.current) {
        setStatus(next);
        setStatusFailed(false);
      }
    } catch {
      if (read === latestRead.current) {
        setStatusFailed(true);
      }
    }
  }, [projectId]);
  useEffect(() => {
    void loadStatus();
  }, [loadStatus, draft.updateTime]);

  const action = status?.nextActions.find((item) => item.action === "confirm_draft");
  const needsUndecided = Boolean(action?.accepts.includes("undecided_items"));
  const needsPartial = Boolean(action?.accepts.includes("partial_draft"));
  const needsConflicts =
    Boolean(action?.accepts.includes("unresolved_conflicts")) || refusedConflicts !== null;
  // The status counts them beside the undecided items; a refusal names them.
  const conflicts = refusedConflicts ?? status?.unresolvedConflicts ?? 0;

  const loadPending = useCallback(async () => {
    setPendingFailed(false);
    try {
      const pending = await getProjectPending(projectId);
      // An object type without an update field is suggested, not undecided: confirming skips it.
      setUndecided(
        pending.items.filter((item) => !item.blocking && item.reason !== "needs_update_field"),
      );
    } catch {
      setUndecided(null);
      setPendingFailed(true);
    }
  }, [projectId]);
  useEffect(() => {
    if (open && needsUndecided) {
      void loadPending();
    }
  }, [open, needsUndecided, loadPending]);

  const names = useMemo(
    () =>
      Object.fromEntries(
        [...draft.items.objectTypes, ...draft.items.relationTypes, ...draft.items.valueTypes].map(
          (item) => [item.id, item.name],
        ),
      ),
    [draft],
  );

  if (!status) {
    // Without the status the page cannot tell whether the draft may be confirmed: it says so.
    return statusFailed ? (
      <>
        <Tooltip title={t("bknProject.release.loadFailed")}>
          <span>
            <AppButton disabled type="primary">
              {t("bknProject.confirm.button")}
            </AppButton>
          </span>
        </Tooltip>
        <AppButton onClick={() => void loadStatus()} type="link">
          {t("common.retry")}
        </AppButton>
      </>
    ) : null;
  }
  if (!action) {
    // A draft confirmed as it is: say so, and lead to what the confirmation started.
    return status.confirmation?.current ? (
      <AppButton onClick={onViewConfirmation} type="link">
        {t("bknProject.release.confirmed", { time: formatTime(status.confirmation.time) })}
      </AppButton>
    ) : null;
  }

  const label = t(
    status.stale.includes("confirmation_outdated")
      ? "bknProject.confirm.buttonAgain"
      : "bknProject.confirm.button",
  );
  if (!action.allowed) {
    return (
      <Tooltip title={blockedText(t, action.reason, status.blockers)}>
        <span>
          <AppButton disabled type="primary">
            {label}
          </AppButton>
        </span>
      </Tooltip>
    );
  }

  const start = () => {
    setAcceptUndecided(false);
    setAcceptPartial(false);
    setAcceptConflicts(false);
    // A refusal counts for the confirmation it refused; a new one asks from the status first.
    setRefusedConflicts(null);
    setUndecided(null);
    setDocumentsProblem(null);
    setOpen(true);
  };

  const flags = () => ({
    ...(needsPartial ? { acceptPartial } : {}),
    ...(needsUndecided ? { acceptUndecided } : {}),
    ...(needsConflicts ? { acceptUnresolvedConflicts: acceptConflicts } : {}),
  });

  /**
   * Confirms what the tables make while the knowledge base is not ready: its objects are left out
   * with the reason noted, so they can be adopted again once it is.
   */
  const confirmTablesFirst = async () => {
    setSending(true);
    onSendingChange?.(true);
    try {
      const fresh = await getDraft(projectId);
      if (!fresh) {
        throw new Error("draft gone");
      }
      const { documents } = documentsOf(fresh);
      let updateTime = fresh.updateTime;
      for (const item of documents) {
        updateTime = (
          await editDraftItem(projectId, "object_types", item.id, updateTime, {
            adopted: false,
            reason: t("bknProject.confirm.dialog.documentsDeferReason"),
          })
        ).updateTime;
      }
      await confirmDraft(projectId, { ...flags(), updateTime });
      setOpen(false);
      message.success(
        t("bknProject.confirm.dialog.documentsDeferred", { count: documents.length }),
      );
      onConfirmed();
    } catch (error) {
      message.error(refusalText(t, error, "bknProject.confirm.failed", names));
      onStale();
    } finally {
      setSending(false);
      onSendingChange?.(false);
    }
  };

  const send = async () => {
    setSending(true);
    onSendingChange?.(true);
    try {
      await confirmDraft(projectId, { ...flags(), updateTime: draft.updateTime });
      setOpen(false);
      message.success(t("bknProject.confirm.done"));
      onConfirmed();
    } catch (error) {
      const code = projectErrorCode(error);
      if (code === "Draft.ConflictsNotAccepted") {
        // Conflicts between requirement documents wait for a ruling: ask the owner to accept them.
        const details = projectErrorDetails(error);
        setRefusedConflicts(Array.isArray(details) ? details.length : 0);
        message.warning(t("bknProject.errors.Draft.ConflictsNotAccepted"));
        await loadStatus();
      } else if (code === "Draft.UndecidedNotAccepted" || code === "Draft.PartialNotAccepted") {
        // Something new waits since the status was read: show it, and ask again.
        message.warning(refusalText(t, error));
        await loadStatus();
      } else if (code === "Draft.HasPending") {
        setOpen(false);
        message.warning(refusalText(t, error));
        onShowPending();
      } else if (code === "Draft.DocumentDataNotReady" || code === "Draft.DocumentDataItemFailed") {
        // The dialog stays: it says which item stopped and why, and offers the tables first.
        setDocumentsProblem(refusalText(t, error));
        onStale();
      } else if (code === "Draft.Stale") {
        setOpen(false);
        message.warning(refusalText(t, error));
        onStale();
      } else {
        message.error(refusalText(t, error, "bknProject.confirm.failed", names));
      }
    } finally {
      setSending(false);
      onSendingChange?.(false);
    }
  };

  const counts = adoptedCounts(draft);
  const { documents, tablesLeft } = documentsOf(draft);
  const canDefer = documents.length > 0 && tablesLeft;
  const ready =
    (!needsUndecided || (acceptUndecided && undecided !== null)) &&
    (!needsPartial || acceptPartial) &&
    (!needsConflicts || acceptConflicts);
  const unreadable = draft.items.unreadable;
  // Why confirming waits, beside the button that cannot be pressed yet.
  const waitingFor = ready
    ? null
    : needsUndecided && !acceptUndecided && undecided !== null
      ? t("bknProject.confirm.dialog.waitingUndecided")
      : (needsPartial && !acceptPartial) || (needsConflicts && !acceptConflicts)
        ? t("bknProject.confirm.dialog.waitingAccept")
        : null;

  return (
    <>
      <AppButton onClick={start} type="primary">
        {label}
      </AppButton>
      <Modal
        cancelText={t("common.cancel")}
        confirmLoading={sending}
        footer={(_, { CancelBtn, OkBtn }) => (
          <div className={styles.confirmFooter}>
            {waitingFor ? <span className={styles.confirmWaiting}>{waitingFor}</span> : null}
            <CancelBtn />
            <OkBtn />
          </div>
        )}
        okButtonProps={{ disabled: !ready }}
        okText={t("bknProject.confirm.dialog.ok")}
        onCancel={() => setOpen(false)}
        onOk={() => void send()}
        open={open}
        title={t("bknProject.confirm.dialog.title")}
      >
        <div className={styles.page}>
          {documentsProblem ? (
            <Alert
              action={
                canDefer ? (
                  <AppButton
                    disabled={sending}
                    onClick={() => void confirmTablesFirst()}
                    size="small"
                  >
                    {t("bknProject.confirm.dialog.documentsNotReadyAction")}
                  </AppButton>
                ) : undefined
              }
              description={
                canDefer
                  ? t("bknProject.confirm.dialog.documentsNotReadyHelp", {
                      count: documents.length,
                    })
                  : undefined
              }
              message={documentsProblem}
              showIcon
              type="warning"
            />
          ) : null}
          <span>{t("bknProject.confirm.dialog.summary", counts)}</span>
          {status.confirmation ? (
            <span className={styles.summary}>{t("bknProject.confirm.dialog.replaces")}</span>
          ) : null}
          {/* A reminder, never a block: what nobody confirmed goes as it is adopted now. */}
          {status.unreviewed > 0 ? (
            <Alert
              message={t("bknProject.model.candidates.unreviewed", { count: status.unreviewed })}
              showIcon
              type="warning"
            />
          ) : null}
          {needsUndecided ? (
            pendingFailed ? (
              <Alert
                action={
                  <AppButton onClick={() => void loadPending()} size="small">
                    {t("common.retry")}
                  </AppButton>
                }
                message={t("bknProject.confirm.dialog.loadFailed")}
                showIcon
                type="warning"
              />
            ) : undecided ? (
              <div>
                <div>
                  {t("bknProject.confirm.dialog.undecidedTitle", { count: undecided.length })}
                </div>
                <ul className={styles.confirmList}>
                  {undecided.map((item) => (
                    <li
                      aria-label={t("bknProject.confirm.dialog.undecidedItem", {
                        because: pendingBecauseText(t, item.because),
                        name: item.name,
                      })}
                      className={styles.confirmItem}
                      key={`${item.kind}/${item.itemId}`}
                    >
                      <span>{item.name}</span>
                      <span className={styles.confirmMeta}>
                        <span>
                          {t(`bknProject.confirm.kind.${item.kind}`, { defaultValue: "" })}
                        </span>
                        <span>{pendingBecauseText(t, item.because)}</span>
                      </span>
                      {item.neededBy.length ? (
                        <span className={styles.confirmNeeded}>
                          {t("bknProject.confirm.dialog.neededBy")}
                          {item.neededBy.map((question) => (
                            <span key={question.id}>{question.text}</span>
                          ))}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
                <Checkbox
                  checked={acceptUndecided}
                  onChange={(event) => setAcceptUndecided(event.target.checked)}
                >
                  {t("bknProject.confirm.dialog.undecidedAccept")}
                </Checkbox>
              </div>
            ) : null
          ) : null}
          {needsPartial ? (
            <div>
              <div>{t("bknProject.confirm.dialog.partialTitle", { count: unreadable.length })}</div>
              <ul className={styles.confirmList}>
                {unreadable.map((table) => (
                  <li className={styles.confirmItem} key={table.resourceId}>
                    {table.name}
                  </li>
                ))}
              </ul>
              <Checkbox
                checked={acceptPartial}
                onChange={(event) => setAcceptPartial(event.target.checked)}
              >
                {t("bknProject.confirm.dialog.partialAccept")}
              </Checkbox>
            </div>
          ) : null}
          {needsConflicts ? (
            <Checkbox
              checked={acceptConflicts}
              onChange={(event) => setAcceptConflicts(event.target.checked)}
            >
              {conflicts
                ? t("bknProject.confirm.dialog.conflictsAccept", { count: conflicts })
                : t("bknProject.confirm.dialog.conflictsAcceptUncounted")}
            </Checkbox>
          ) : null}
          <span className={styles.summary}>{t("bknProject.confirm.dialog.after")}</span>
        </div>
      </Modal>
    </>
  );
}
