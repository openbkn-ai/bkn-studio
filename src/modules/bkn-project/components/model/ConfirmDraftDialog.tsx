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
import {
  confirmDraft,
  getProjectPending,
  getProjectStatus,
  projectErrorCode,
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
  const relations = draft.items.relationTypes.filter(
    (item) => item.adopted && objects.has(item.source) && objects.has(item.target),
  ).length;
  return { objects: objects.size, relations };
}

/**
 * The button that confirms a ready draft, and the dialog that does it. Whether it may be sent and
 * what it has to accept come from the project's status; bkn-project decides, the page follows.
 */
export function ConfirmDraft({
  draft,
  onConfirmed,
  onShowPending,
  onStale,
  projectId,
}: {
  draft: Draft;
  onConfirmed: () => void;
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
  const [sending, setSending] = useState(false);

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

  const loadPending = useCallback(async () => {
    setPendingFailed(false);
    try {
      const pending = await getProjectPending(projectId);
      setUndecided(pending.items.filter((item) => !item.blocking));
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
      <AppButton onClick={onConfirmed} type="link">
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
    setUndecided(null);
    setOpen(true);
  };

  const send = async () => {
    setSending(true);
    try {
      await confirmDraft(projectId, {
        ...(needsPartial ? { acceptPartial } : {}),
        ...(needsUndecided ? { acceptUndecided } : {}),
        updateTime: draft.updateTime,
      });
      setOpen(false);
      message.success(t("bknProject.confirm.done"));
      onConfirmed();
    } catch (error) {
      const code = projectErrorCode(error);
      if (code === "Draft.UndecidedNotAccepted" || code === "Draft.PartialNotAccepted") {
        // Something new waits since the status was read: show it, and ask again.
        message.warning(refusalText(t, error));
        await loadStatus();
      } else if (code === "Draft.HasPending") {
        setOpen(false);
        message.warning(refusalText(t, error));
        onShowPending();
      } else if (code === "Draft.Stale") {
        setOpen(false);
        message.warning(refusalText(t, error));
        onStale();
      } else {
        message.error(refusalText(t, error, "bknProject.confirm.failed", names));
      }
    } finally {
      setSending(false);
    }
  };

  const counts = adoptedCounts(draft);
  const ready =
    (!needsUndecided || (acceptUndecided && undecided !== null)) &&
    (!needsPartial || acceptPartial);
  const unreadable = draft.items.unreadable;

  return (
    <>
      <AppButton onClick={start} type="primary">
        {label}
      </AppButton>
      <Modal
        cancelText={t("common.cancel")}
        confirmLoading={sending}
        okButtonProps={{ disabled: !ready }}
        okText={t("bknProject.confirm.dialog.ok")}
        onCancel={() => setOpen(false)}
        onOk={() => void send()}
        open={open}
        title={t("bknProject.confirm.dialog.title")}
      >
        <div className={styles.page}>
          <span>{t("bknProject.confirm.dialog.summary", counts)}</span>
          {status.confirmation ? (
            <span className={styles.summary}>{t("bknProject.confirm.dialog.replaces")}</span>
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
                    <li className={styles.confirmItem} key={`${item.kind}/${item.itemId}`}>
                      <span>{item.name}</span>
                      <span className={styles.confirmMeta}>
                        <span>
                          {t(`bknProject.confirm.kind.${item.kind}`, { defaultValue: "" })}
                        </span>
                        <span>{pendingBecauseText(t, item.because)}</span>
                      </span>
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
          <span className={styles.summary}>{t("bknProject.confirm.dialog.after")}</span>
        </div>
      </Modal>
    </>
  );
}
