/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert } from "antd";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { AppButton } from "@/framework/ui/common/AppButton";
import { LightStatusTag } from "@/framework/ui/common/LightStatusTag";
import { Section } from "@/modules/bkn-project/components/release/ReleaseSection";
import { ReleaseReviewDialog } from "@/modules/bkn-project/components/release/ReleaseReviewDialog";
import { SwitchConsumersDialog } from "@/modules/bkn-project/components/release/SwitchConsumersDialog";
import type { ProjectStatus } from "@/modules/bkn-project/types/publish";

import styles from "./Release.module.css";

const PREFIX = "bknProject.release.publish";

/** Stages that wait on the data check before a release can be reviewed. */
const WAITING = new Set(["checking", "check_not_started", "check_needs_attention"]);

/**
 * Publishing the confirmation as a new version, then switching consumers to it. What may be done
 * comes from the status: a review once the check passed, a switch once published.
 */
export function ReleasePublish({
  canPublish,
  onChanged,
  projectId,
  status,
  versionOf,
}: {
  /** The owner of an unarchived project. */
  canPublish: boolean;
  /** Something was published or switched: the page reads the status and versions again. */
  onChanged: () => void;
  projectId: string;
  status: ProjectStatus;
  versionOf: (networkId: string) => string | undefined;
}) {
  const { t } = useTranslation();
  const [reviewing, setReviewing] = useState(false);
  const [switching, setSwitching] = useState(false);
  const review = status.nextActions.find((action) => action.action === "review_release");
  const switchAction = status.nextActions.find((action) => action.action === "switch_consumers");
  const release = status.release;

  return (
    <Section
      actions={
        review ? (
          <AppButton onClick={() => setReviewing(true)} type="primary">
            {t(`${PREFIX}.${canPublish ? "open" : "openReadOnly"}`, {
              version: review.suggestedVersion,
            })}
          </AppButton>
        ) : null
      }
      description={t(`${PREFIX}.description`)}
      title={t(`${PREFIX}.title`)}
    >
      {release ? (
        <div className={styles.row}>
          <LightStatusTag tone="success">
            {t(`${PREFIX}.publishedTag`, { version: release.version })}
          </LightStatusTag>
          {release.inUse ? (
            <span className={styles.muted}>
              {t(`${PREFIX}.inUse`, { version: release.version })}
            </span>
          ) : null}
        </div>
      ) : null}
      {release && !release.inUse && switchAction ? (
        <Alert
          action={
            switchAction.allowed ? (
              <AppButton onClick={() => setSwitching(true)} size="small" type="primary">
                {t(`${PREFIX}.switch`)}
              </AppButton>
            ) : null
          }
          description={switchAction.allowed ? undefined : t(`${PREFIX}.switchOwnerOnly`)}
          message={t(`${PREFIX}.notInUse`, { version: release.version })}
          showIcon
          type="warning"
        />
      ) : null}
      {review ? (
        <p className={styles.muted}>
          {t(`${PREFIX}.${release ? "readyAgain" : "ready"}`, { version: review.suggestedVersion })}
        </p>
      ) : release ? null : (
        <p className={styles.muted}>
          {t(`${PREFIX}.${WAITING.has(status.stage) ? "waitCheck" : "waitConfirm"}`)}
        </p>
      )}
      {reviewing && review ? (
        <ReleaseReviewDialog
          canPublish={canPublish}
          onCancel={() => setReviewing(false)}
          onPublished={() => {
            setReviewing(false);
            onChanged();
          }}
          projectId={projectId}
          suggestedVersion={review.suggestedVersion ?? ""}
        />
      ) : null}
      {switching && release ? (
        <SwitchConsumersDialog
          onCancel={() => setSwitching(false)}
          onSwitched={() => {
            setSwitching(false);
            onChanged();
          }}
          projectId={projectId}
          toNetworkId={release.networkId}
          toVersion={release.version}
          versionOf={versionOf}
        />
      ) : null}
    </Section>
  );
}
