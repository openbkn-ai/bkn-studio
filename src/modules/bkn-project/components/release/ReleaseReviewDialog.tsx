/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { CheckCircleFilled, CloseCircleFilled, ExclamationCircleFilled } from "@ant-design/icons";
import { Alert, Checkbox, Input, Modal, Spin } from "antd";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { AppButton } from "@/framework/ui/common/AppButton";
import { LightStatusTag } from "@/framework/ui/common/LightStatusTag";
import {
  acceptText,
  capabilityReasonText,
  checkReasonText,
  checkTitle,
  publishErrorText,
  refusalText,
} from "@/modules/bkn-project/components/release/releaseMessages";
import { projectErrorCode } from "@/modules/bkn-project/services/publish.service";
import {
  commitDrift,
  getReleaseReview,
  publishRelease,
  syncBranch,
} from "@/modules/bkn-project/services/release.service";
import type {
  ReleaseCheck,
  ReleaseItem,
  ReleaseQuestion,
  ReleaseReview,
} from "@/modules/bkn-project/types/release";

import styles from "./Release.module.css";

const PREFIX = "bknProject.release.publish";
const VERSION = /^\d+\.\d+\.\d+$/;

/**
 * Reviews what publishing the project as a version would bring, then publishes it. The owner
 * accepts what did not pass and may be accepted; publishing sends the review's signature, so a
 * review the draft or the live version moved past is read again, never published.
 */
export function ReleaseReviewDialog({
  canPublish,
  onCancel,
  onPublished,
  projectId,
  suggestedVersion,
}: {
  /** The owner of an unarchived project; others read the review. */
  canPublish: boolean;
  onCancel: () => void;
  onPublished: (version: string) => void;
  projectId: string;
  suggestedVersion: string;
}) {
  const { t } = useTranslation();
  const { message } = useAppServices();
  const [version, setVersion] = useState(suggestedVersion);
  const [reviewed, setReviewed] = useState(suggestedVersion);
  const [review, setReview] = useState<ReleaseReview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  // Only the newest read is shown: reading again for another version or after a move wins.
  const latest = useRef(0);

  const load = useCallback(
    async (of: string) => {
      const read = ++latest.current;
      setLoadError(null);
      setReview(null);
      try {
        const next = await getReleaseReview(projectId, of);
        if (read === latest.current) {
          setReview(next);
          setReviewed(of);
          // What was accepted stays accepted while it is still asked for.
          setAccepted((current) => current.filter((accept) => next.accepts.includes(accept)));
        }
      } catch (error) {
        if (read === latest.current) {
          setLoadError(
            projectErrorCode(error) === "Release.InvalidVersion"
              ? t(`${PREFIX}.versionInvalid`)
              : t(`${PREFIX}.loadFailed`),
          );
        }
      }
    },
    [projectId, t],
  );

  useEffect(() => {
    void load(suggestedVersion);
  }, [load, suggestedVersion]);

  const versionValid = VERSION.test(version.trim());
  const versionChanged = version.trim() !== reviewed;
  const ready =
    canPublish &&
    review !== null &&
    !review.blocked &&
    !versionChanged &&
    review.accepts.every((accept) => accepted.includes(accept));

  const publish = async () => {
    if (!review) {
      return;
    }
    setBusy(true);
    try {
      await publishRelease(projectId, {
        accepts: accepted,
        notes: notes.trim(),
        signature: review.signature,
        version: review.version,
      });
      message.success(t(`${PREFIX}.published`, { version: review.version }));
      onPublished(review.version);
    } catch (error) {
      const code = projectErrorCode(error);
      if (code === "Release.ReviewOutdated" || code === "Release.ChecksFailed") {
        // The draft, the branch or the live version moved since the review: read it again.
        message.warning(publishErrorText(t, code));
        void load(review.version);
      } else {
        message.error(publishErrorText(t, code));
      }
    } finally {
      setBusy(false);
    }
  };

  /** Brings the live version into the project, or commits what changed on it, then reviews again. */
  const settle = async (action: "commitDrift" | "sync") => {
    setBusy(true);
    try {
      await (action === "sync" ? syncBranch(projectId) : commitDrift(projectId));
      message.success(t(`${PREFIX}.${action}Done`));
      void load(reviewed);
    } catch (error) {
      message.error(publishErrorText(t, projectErrorCode(error)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      cancelText={t("common.cancel")}
      confirmLoading={busy}
      destroyOnHidden
      okButtonProps={{ disabled: !ready, hidden: !canPublish }}
      okText={t(`${PREFIX}.publishVersion`, { version: reviewed })}
      onCancel={onCancel}
      onOk={() => void publish()}
      open
      title={t(`${PREFIX}.dialogTitle`)}
      width={760}
    >
      <div className={styles.stack}>
        <div className={styles.row}>
          <label className={styles.label} htmlFor="release-version">
            {t(`${PREFIX}.version`)}
          </label>
          <Input
            className={styles.versionInput}
            id="release-version"
            onChange={(event) => setVersion(event.target.value)}
            onPressEnter={() => versionValid && void load(version.trim())}
            status={versionValid ? undefined : "error"}
            value={version}
          />
          {versionChanged ? (
            <AppButton
              disabled={!versionValid}
              onClick={() => void load(version.trim())}
              size="small"
            >
              {t(`${PREFIX}.reviewAgain`)}
            </AppButton>
          ) : null}
          {versionValid ? null : (
            <span className={styles.label}>{t(`${PREFIX}.versionFormat`)}</span>
          )}
        </div>
        {loadError ? (
          <Alert
            action={
              <AppButton onClick={() => void load(reviewed)} size="small">
                {t("common.retry")}
              </AppButton>
            }
            message={loadError}
            showIcon
            type="error"
          />
        ) : !review ? (
          <Spin />
        ) : (
          <ReviewBody
            accepted={accepted}
            busy={busy}
            canPublish={canPublish}
            notes={notes}
            onAccept={(accept, checked) =>
              setAccepted((current) =>
                checked ? [...current, accept] : current.filter((item) => item !== accept),
              )
            }
            onNotes={setNotes}
            onSettle={(action) => void settle(action)}
            review={review}
          />
        )}
      </div>
    </Modal>
  );
}

function ReviewBody({
  accepted,
  busy,
  canPublish,
  notes,
  onAccept,
  onNotes,
  onSettle,
  review,
}: {
  accepted: string[];
  busy: boolean;
  canPublish: boolean;
  notes: string;
  onAccept: (accept: string, checked: boolean) => void;
  onNotes: (notes: string) => void;
  onSettle: (action: "commitDrift" | "sync") => void;
  review: ReleaseReview;
}) {
  const { t } = useTranslation();
  const { changes, questions, release, risks } = review;
  const changed = changes.added.length + changes.changed.length + changes.removed.length;

  return (
    <>
      <p className={styles.muted}>
        {release.baseVersion
          ? t(`${PREFIX}.target`, { name: release.networkName, version: release.baseVersion })
          : t(`${PREFIX}.targetFirst`, { name: release.networkName })}
      </p>
      {review.refusals.length ? (
        <Alert
          message={review.refusals.map((code) => refusalText(t, code)).join(t(`${PREFIX}.join`))}
          showIcon
          type="error"
        />
      ) : null}

      <section className={styles.stack}>
        <h4 className={styles.blockTitle}>{t(`${PREFIX}.checksTitle`)}</h4>
        <ul className={styles.list}>
          {review.checks.map((check) => (
            <CheckRow
              accepted={check.accept ? accepted.includes(check.accept) : false}
              busy={busy}
              canPublish={canPublish}
              check={check}
              key={check.code}
              onAccept={onAccept}
              onSettle={onSettle}
            />
          ))}
        </ul>
      </section>

      <section className={styles.stack}>
        <h4 className={styles.blockTitle}>{t(`${PREFIX}.changesTitle`)}</h4>
        {changed || changes.other ? (
          <>
            <ItemNames items={changes.added} label={t(`${PREFIX}.added`)} />
            <ItemNames items={changes.changed} label={t(`${PREFIX}.changed`)} />
            <ItemNames items={changes.removed} label={t(`${PREFIX}.removed`)} />
            {changes.other ? (
              <p className={styles.muted}>
                {t(`${PREFIX}.otherChanges`, { count: changes.other })}
              </p>
            ) : null}
          </>
        ) : (
          <p className={styles.muted}>{t(`${PREFIX}.noChanges`)}</p>
        )}
      </section>

      <section className={styles.stack}>
        <h4 className={styles.blockTitle}>{t(`${PREFIX}.risksTitle`)}</h4>
        {risks.onlyAdditions ? (
          <p className={styles.muted}>{t(`${PREFIX}.onlyAdditions`)}</p>
        ) : (
          <ItemNames items={risks.existing} label={t(`${PREFIX}.existing`)} />
        )}
        {risks.orphans.map((orphan) => (
          <p className={styles.muted} key={orphan.id}>
            {t(`${PREFIX}.orphans`, { count: orphan.orphans, name: orphan.name || orphan.id })}
          </p>
        ))}
        {review.capabilities.length ? (
          <ul className={styles.list}>
            {review.capabilities.map((capability) => (
              <li className={styles.listItem} key={`${capability.kind}/${capability.id}`}>
                <span>
                  {capability.name}{" "}
                  <LightStatusTag tone={capability.copy ? "warning" : "neutral"}>
                    {t(`${PREFIX}.${capability.copy ? "copied" : "reused"}`)}
                  </LightStatusTag>
                </span>
                {capability.reasons.length ? (
                  <span className={styles.questionMeta}>
                    {capability.reasons
                      .map((reason) => capabilityReasonText(t, reason))
                      .join(t(`${PREFIX}.join`))}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {questions.total ? (
        <section className={styles.stack}>
          <h4 className={styles.blockTitle}>
            {t(`${PREFIX}.questionsTitle`, { count: questions.total })}
          </h4>
          <Questions list={questions.answerableNew} title={t(`${PREFIX}.answerableNew`)} />
          <Questions list={questions.affected} title={t(`${PREFIX}.affected`)} />
          <Questions list={questions.unanswerable} title={t(`${PREFIX}.unanswerable`)} />
          {questions.unjudged ? (
            <p className={styles.muted}>{t(`${PREFIX}.unjudged`, { count: questions.unjudged })}</p>
          ) : null}
        </section>
      ) : null}

      {canPublish ? (
        <section className={styles.stack}>
          <label className={styles.blockTitle} htmlFor="release-notes">
            {t(`${PREFIX}.notes`)}
          </label>
          <Input.TextArea
            autoSize={{ maxRows: 6, minRows: 2 }}
            id="release-notes"
            maxLength={2000}
            onChange={(event) => onNotes(event.target.value)}
            placeholder={t(`${PREFIX}.notesPlaceholder`)}
            value={notes}
          />
        </section>
      ) : null}
      <p className={styles.muted}>{t(`${PREFIX}.regressionHint`)}</p>
    </>
  );
}

function CheckRow({
  accepted,
  busy,
  canPublish,
  check,
  onAccept,
  onSettle,
}: {
  accepted: boolean;
  busy: boolean;
  canPublish: boolean;
  check: ReleaseCheck;
  onAccept: (accept: string, checked: boolean) => void;
  onSettle: (action: "commitDrift" | "sync") => void;
}) {
  const { t } = useTranslation();
  const icon = check.passed ? (
    <CheckCircleFilled className={styles.passed} />
  ) : check.accept ? (
    <ExclamationCircleFilled className={styles.acceptable} />
  ) : (
    <CloseCircleFilled className={styles.notPassed} />
  );
  // The live version moved, or was edited outside the project: the owner brings it in.
  const settle =
    check.reason === "branch_behind" ? "sync" : check.reason === "drift" ? "commitDrift" : null;
  return (
    <li className={styles.listItem}>
      <span className={styles.checkLine}>
        {icon}
        {checkTitle(t, check.code)}
      </span>
      {check.passed ? null : <p className={styles.detail}>{checkReasonText(t, check)}</p>}
      {check.accept ? (
        <Checkbox
          checked={accepted}
          className={styles.indent}
          disabled={!canPublish}
          onChange={(event) => onAccept(check.accept!, event.target.checked)}
        >
          {acceptText(t, check.accept)}
        </Checkbox>
      ) : null}
      {settle && canPublish ? (
        <span className={styles.indent}>
          <AppButton loading={busy} onClick={() => onSettle(settle)} size="small">
            {t(`${PREFIX}.${settle}`)}
          </AppButton>
        </span>
      ) : null}
    </li>
  );
}

function ItemNames({ items, label }: { items: ReleaseItem[]; label: string }) {
  const { t } = useTranslation();
  if (!items.length) {
    return null;
  }
  return (
    <div className={styles.row}>
      <span className={styles.label}>
        {t(`${PREFIX}.countedLabel`, { label, count: items.length })}
      </span>
      <span className={styles.names}>
        {items.map((item) => (
          <LightStatusTag key={`${item.kind}/${item.id}`} tone="neutral">
            {item.name || item.id}
          </LightStatusTag>
        ))}
      </span>
    </div>
  );
}

function Questions({ list, title }: { list: ReleaseQuestion[]; title: string }) {
  const { t } = useTranslation();
  if (!list.length) {
    return null;
  }
  return (
    <div className={styles.stack}>
      <span className={styles.label}>
        {t(`${PREFIX}.countedLabel`, { label: title, count: list.length })}
      </span>
      <ul className={styles.list}>
        {list.map((question) => (
          <li className={styles.listItem} key={question.id}>
            <span className={styles.question}>
              {question.text}
              {question.missing.length ? (
                <span className={styles.questionMeta}>
                  {t(`${PREFIX}.missing`, {
                    names: question.missing
                      .map((item) => item.name || item.id)
                      .join(t("bknProject.listSeparator")),
                  })}
                </span>
              ) : null}
              {question.unconnected.map((pair) => (
                <span className={styles.questionMeta} key={`${pair.from.id}-${pair.to.id}`}>
                  {t(`${PREFIX}.unconnected`, {
                    from: pair.from.name || pair.from.id,
                    to: pair.to.name || pair.to.id,
                  })}
                </span>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
