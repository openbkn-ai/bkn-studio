/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { AppButton } from "@/framework/ui/common/AppButton";
import { LightStatusTag } from "@/framework/ui/common/LightStatusTag";
import {
  passedCount,
  regressionStatusText,
  regressionTone,
} from "@/modules/bkn-project/components/release/releaseMessages";
import { Section } from "@/modules/bkn-project/components/release/ReleaseSection";
import { ReleaseReviewDialog } from "@/modules/bkn-project/components/release/ReleaseReviewDialog";
import { SwitchConsumersDialog } from "@/modules/bkn-project/components/release/SwitchConsumersDialog";
import { getRegression } from "@/modules/bkn-project/services/release.service";
import type { ProjectStatus } from "@/modules/bkn-project/types/publish";
import type { Regression } from "@/modules/bkn-project/types/release";

import styles from "./Release.module.css";

const PREFIX = "bknProject.release.publish";

/** Stages that wait on the data check before a release can be reviewed. */
const WAITING = new Set(["checking", "check_not_started", "check_needs_attention"]);

/**
 * Publishing the confirmation as a new version, then switching consumers to it. What may be done
 * comes from the status: a review once the check passed, a switch once published.
 */
export function ReleasePublish({
  baseNetworkId,
  canPublish,
  onChanged,
  onOpenRegression,
  projectId,
  status,
  versionOf,
}: {
  /** The network the lineage started from, before any release. */
  baseNetworkId: string;
  /** The owner of an unarchived project. */
  canPublish: boolean;
  /** Something was published or switched: the page reads the status and versions again. */
  onChanged: () => void;
  /** Opens how the scenario questions did on the project's release. */
  onOpenRegression: () => void;
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

  // How the release's regression went, said beside it; a failed read only leaves it unsaid.
  const [regression, setRegression] = useState<Regression | null>(null);
  const releasedAs = release?.networkId;
  useEffect(() => {
    setRegression(null);
    if (!releasedAs) {
      return undefined;
    }
    let active = true;
    getRegression(projectId, releasedAs)
      .then((next) => active && setRegression(next))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [projectId, releasedAs]);

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
          {regression ? (
            <>
              <span className={styles.label}>{t(`${PREFIX}.regressionLabel`)}</span>
              <LightStatusTag tone={regressionTone(regression.status)}>
                {regressionStatusText(t, regression.status)}
              </LightStatusTag>
              {passedCount(regression).total ? (
                <span className={styles.muted}>
                  {t("bknProject.release.regression.summary", passedCount(regression))}
                </span>
              ) : null}
            </>
          ) : null}
          <AppButton onClick={onOpenRegression} size="small" type="link">
            {t(`${PREFIX}.viewRegression`)}
          </AppButton>
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
          baseNetworkId={baseNetworkId}
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
