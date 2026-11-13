/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { AppButton } from "@/framework/ui/common/AppButton";
import { LightStatusTag } from "@/framework/ui/common/LightStatusTag";

import styles from "./ProposalCard.module.css";

const PREFIX = "bknProject.ask.proposal";

/** Where a proposal stands: waiting for the person, adopted or declined. */
export type ProposalStatus = "" | "adopted" | "declined";

/**
 * One change AI proposes, as a card: what it does, to what, from what to what, and why, with
 * 不采纳 / 采纳 while it waits and what was decided after. Nothing is taken back here.
 */
export function ProposalCard({
  after,
  before,
  busy,
  detail,
  disabled,
  label,
  onAdopt,
  onDecline,
  op,
  reason,
  status,
}: {
  after?: ReactNode;
  before?: string;
  /** This card's decision is being written. */
  busy?: boolean;
  detail?: string;
  /** Another decision is being written, or deciding is not open to the person. */
  disabled?: boolean;
  label: string;
  onAdopt?: () => void;
  onDecline?: () => void;
  /** What kind of change it is, as a tag: add, modify, merge… */
  op?: string;
  reason?: string;
  status: ProposalStatus;
}) {
  const { t } = useTranslation();
  return (
    <div
      className={`${styles.card} ${status ? styles.decided : ""} ${
        status === "declined" ? styles.declined : ""
      }`}
    >
      <div className={styles.head}>
        {op ? <span className={styles.op}>{op}</span> : null}
        <span className={styles.label}>{label}</span>
      </div>
      {detail ? <div className={styles.detail}>{detail}</div> : null}
      {before || after ? (
        <div className={styles.diff}>
          {before ? (
            <>
              <span className={styles.diffKey}>{t(`${PREFIX}.before`)}</span>
              <span>{before}</span>
            </>
          ) : null}
          {after ? (
            <>
              <span className={styles.diffKey}>{t(`${PREFIX}.after`)}</span>
              <span>{after}</span>
            </>
          ) : null}
        </div>
      ) : null}
      {reason ? <div className={styles.reason}>{reason}</div> : null}
      <div className={styles.actions}>
        {status === "adopted" ? (
          <LightStatusTag tone="success">{t(`${PREFIX}.adoptedTag`)}</LightStatusTag>
        ) : status === "declined" ? (
          <LightStatusTag tone="neutral">{t(`${PREFIX}.declinedTag`)}</LightStatusTag>
        ) : onAdopt ? (
          <>
            <AppButton
              aria-label={t(`${PREFIX}.declineItem`, { name: label })}
              disabled={disabled || busy}
              onClick={onDecline}
              size="small"
            >
              {t(`${PREFIX}.decline`)}
            </AppButton>
            <AppButton
              aria-label={t(`${PREFIX}.adoptItem`, { name: label })}
              disabled={disabled}
              loading={busy}
              onClick={onAdopt}
              size="small"
              type="primary"
            >
              {t(`${PREFIX}.adopt`)}
            </AppButton>
          </>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Under an answer's proposals: how many still wait, and adopting all of them at once when more
 * than one does.
 */
export function ProposalsBar({
  busy,
  disabled,
  onAdoptAll,
  pending,
}: {
  busy?: boolean;
  disabled?: boolean;
  onAdoptAll?: () => void;
  pending: number;
}) {
  const { t } = useTranslation();
  return (
    <div className={styles.bar}>
      <span>{pending ? t(`${PREFIX}.pending`, { count: pending }) : t(`${PREFIX}.allDone`)}</span>
      {pending > 1 && onAdoptAll ? (
        <AppButton
          disabled={disabled}
          loading={busy}
          onClick={onAdoptAll}
          size="small"
          type="primary"
        >
          {t(`${PREFIX}.adoptAll`, { count: pending })}
        </AppButton>
      ) : null}
    </div>
  );
}
