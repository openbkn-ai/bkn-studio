/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { CheckOutlined } from "@ant-design/icons";
import { Alert, Progress } from "antd";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { AppButton } from "@/framework/ui/common/AppButton";
import { LightStatusTag } from "@/framework/ui/common/LightStatusTag";
import {
  passedCount,
  regressionStatusText,
  versionName,
  versionNameIn,
} from "@/modules/bkn-project/components/release/releaseMessages";
import { Section } from "@/modules/bkn-project/components/release/ReleaseSection";
import { ReleasePublishDialog } from "@/modules/bkn-project/components/release/ReleasePublishDialog";
import { ReleaseReviewDialog } from "@/modules/bkn-project/components/release/ReleaseReviewDialog";
import { RollbackDialog } from "@/modules/bkn-project/components/release/RollbackDialog";
import { getRegression, REGRESSION_POLL_MS } from "@/modules/bkn-project/services/release.service";
import type { ProjectStatus } from "@/modules/bkn-project/types/publish";
import type { ProjectVersions, Regression } from "@/modules/bkn-project/types/release";
import { useAccountDirectory } from "@/modules/knowledge-network/hooks/useAccountDirectory";

import styles from "./Release.module.css";

const PREFIX = "bknProject.release.publish";
const STEPS = ["review", "prepare", "publish"] as const;

/** Stages that wait on the data check before a release can be reviewed. */
const WAITING = new Set(["checking", "check_not_started", "check_needs_attention"]);

/** Regressions that leave nothing for the owner to accept before publishing. */
const SETTLED = new Set(["running", "passed", "no_questions"]);

const formatTime = (value: number) => dayjs(value).format("YYYY/MM/DD HH:mm");

/** The three steps of publishing, the done ones ticked. */
function Steps({ current }: { current: number }) {
  const { t } = useTranslation();
  return (
    <ol className={styles.steps}>
      {STEPS.map((step, index) => (
        <li
          aria-current={index === current ? "step" : undefined}
          className={[
            styles.step,
            index < current ? styles.stepDone : index === current ? styles.stepCurrent : "",
          ].join(" ")}
          key={step}
        >
          <span className={styles.stepNumber}>
            {index < current ? <CheckOutlined /> : index + 1}
          </span>
          {t(`${PREFIX}.steps.${step}`)}
        </li>
      ))}
    </ol>
  );
}

/**
 * Publishing the confirmation as a new version of the project's network: the confirmed content is
 * reviewed, written into the network where the scenario questions are asked of it, then
 * published. Consumers use the new version at once; there is nothing to switch.
 */
export function ReleasePublish({
  canPublish,
  onChanged,
  onGoToBuild,
  onGoToKinetic,
  onOpenRegression,
  projectId,
  status,
  versions,
}: {
  /** The owner of an unarchived project. */
  canPublish: boolean;
  /** Something was prepared, published or switched: the page reads status and versions again. */
  onChanged: () => void;
  /** Opens the build page, where indexes not ready yet are built. */
  onGoToBuild?: () => void;
  /** Opens kinetic modeling, where needs not implemented yet are implemented. */
  onGoToKinetic?: () => void;
  /** Opens how the scenario questions did on a release; `prepared` while it is not published. */
  onOpenRegression: (version: string, prepared: boolean) => void;
  projectId: string;
  status: ProjectStatus;
  /** null while the versions are read, or when they could not be. */
  versions: ProjectVersions | null;
}) {
  const { t } = useTranslation();
  const { runtimeConfig } = useAppServices();
  const directory = useAccountDirectory();
  const [reviewing, setReviewing] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [rollingBack, setRollingBack] = useState(false);
  // The network turned out the same as its running version when publishing.
  const [unchangedAs, setUnchangedAs] = useState<string | null>(null);
  const review = status.nextActions.find((action) => action.action === "review_release");
  const rollbackAction = status.nextActions.find((action) => action.action === "review_rollback");
  const release = status.release;
  // The network was switched back to another version than the project's newest release.
  const rolledBack = Boolean(release?.rolledBack);
  const prepared = versions?.prepared ?? null;
  const versioning = versions?.versioning;
  const entries = versions?.entries ?? [];
  const name = (knVersion: number) => versionNameIn(t, entries, knVersion);
  const running = versioning?.runningVersion ?? 0;
  const draftBase = versioning?.draft.baseVersion ?? 0;
  const outdated = Boolean(versioning?.draft.outdated);

  // How the regression of the prepared release, or of the published one, went.
  const regressionOf = prepared?.version ?? release?.version ?? "";
  const [regression, setRegression] = useState<Regression | null>(null);
  const [regressionReads, setRegressionReads] = useState(0);
  useEffect(() => {
    setRegression(null);
    if (!regressionOf) {
      return undefined;
    }
    let active = true;
    getRegression(projectId, regressionOf)
      .then((next) => active && setRegression(next))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [projectId, regressionOf]);
  // A regression starts right after preparing: read it again until it ends. Counts every read, so
  // a running regression is read again after a failed read too.
  const regressionRunning = regression?.status === "running";
  useEffect(() => {
    if (!regressionRunning || !regressionOf) {
      return undefined;
    }
    let active = true;
    const timer = window.setTimeout(() => {
      getRegression(projectId, regressionOf)
        .then((next) => active && setRegression(next))
        .catch(() => undefined)
        .finally(() => active && setRegressionReads((count) => count + 1));
    }, REGRESSION_POLL_MS);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [projectId, regressionOf, regressionReads, regressionRunning]);
  useEffect(() => setUnchangedAs(null), [prepared?.version]);

  // The name the reply carries, else the user list the caller may read.
  const who = (id: string, name = "") =>
    id === runtimeConfig.currentUser.id
      ? t(`${PREFIX}.you`)
      : name || (directory.get(id) ?? t(`${PREFIX}.someone`));

  const counts = regression ? passedCount(regression) : { passed: 0, total: 0 };
  const failedQuestions =
    regression && !SETTLED.has(regression.status) ? counts.total - counts.passed : 0;
  const regressionText = !regression
    ? t(`${PREFIX}.regressionNone`)
    : counts.total && regression.status !== "running"
      ? t(`${PREFIX}.regressionPassed`, counts)
      : regressionStatusText(t, regression.status);

  const regressionLine = (version: string, isPrepared: boolean) => (
    <span className={styles.row}>
      {regression && counts.total && regression.status !== "running" ? (
        <Progress
          className={styles.regressionBar}
          percent={Math.round((counts.passed / counts.total) * 100)}
          showInfo={false}
          size="small"
          status={counts.passed === counts.total ? "success" : "normal"}
        />
      ) : null}
      <span>{regressionText}</span>
      <AppButton onClick={() => onOpenRegression(version, isPrepared)} size="small" type="link">
        {t(`${PREFIX}.viewRegression`)}
      </AppButton>
    </span>
  );

  // The version this release builds on, said after its number.
  const versionLine = (version: string) =>
    draftBase
      ? t(`${PREFIX}.versionOn`, { base: name(draftBase), version })
      : t(`${PREFIX}.versionFirst`, { version });

  const reviewButton = review ? (
    <AppButton onClick={() => setReviewing(true)} type={prepared ? undefined : "primary"}>
      {canPublish
        ? t(`${PREFIX}.${prepared ? "prepareAgain" : rolledBack ? "publishAgain" : "open"}`)
        : t(`${PREFIX}.openReadOnly`)}
    </AppButton>
  ) : null;

  const title = (
    <span className={styles.row}>
      {t(`${PREFIX}.title`)}
      {running ? (
        <LightStatusTag tone="success">
          {t(`${PREFIX}.runningTag`, { version: name(running) })}
        </LightStatusTag>
      ) : null}
    </span>
  );
  const description = !versioning
    ? t(`${PREFIX}.description`)
    : !running
      ? t(`${PREFIX}.descriptionFirst`)
      : outdated
        ? t(`${PREFIX}.descriptionShort`)
        : t(`${PREFIX}.description`);

  return (
    <Section description={description} title={title}>
      {outdated && running ? (
        <Alert
          message={t(`${PREFIX}.outdated`, { base: name(draftBase), running: name(running) })}
          showIcon
          type="warning"
        />
      ) : null}
      {prepared ? (
        <>
          <Steps current={2} />
          <dl className={styles.keyValues}>
            <dt>{t(`${PREFIX}.fields.version`)}</dt>
            <dd>{versionLine(prepared.version)}</dd>
            <dt>{t(`${PREFIX}.fields.prepared`)}</dt>
            <dd>
              {t(`${PREFIX}.preparedBy`, {
                time: formatTime(prepared.updateTime),
                who: who(prepared.publisherId, prepared.publisherName),
              })}
            </dd>
            <dt>{t(`${PREFIX}.fields.regression`)}</dt>
            <dd>{regressionLine(prepared.version, true)}</dd>
          </dl>
          {unchangedAs ? (
            <Alert
              message={t(`${PREFIX}.nothingToPublish`, { version: name(running) })}
              showIcon
              type="info"
            />
          ) : failedQuestions ? (
            <Alert
              message={t(`${PREFIX}.regressionFailed`, { count: failedQuestions })}
              showIcon
              type="warning"
            />
          ) : null}
          <div className={styles.row}>
            {canPublish ? (
              <AppButton
                disabled={Boolean(unchangedAs)}
                onClick={() => setPublishing(true)}
                type="primary"
              >
                {t(`${PREFIX}.publishVersion`, { version: prepared.version })}
              </AppButton>
            ) : null}
            {reviewButton}
          </div>
        </>
      ) : review ? (
        <>
          {rolledBack && release?.running ? (
            <div className={styles.row}>
              <LightStatusTag tone="warning">
                {t(`${PREFIX}.rolledBack`, {
                  version: versionName(t, release.running.knVersion, release.running.label),
                })}
              </LightStatusTag>
            </div>
          ) : null}
          <Steps current={0} />
          <dl className={styles.keyValues}>
            <dt>{t(`${PREFIX}.fields.version`)}</dt>
            <dd>{versionLine(review.suggestedVersion ?? "")}</dd>
            {status.confirmation ? (
              <>
                <dt>{t(`${PREFIX}.fields.confirmed`)}</dt>
                <dd>{formatTime(status.confirmation.time)}</dd>
              </>
            ) : null}
          </dl>
          <div className={styles.row}>{reviewButton}</div>
        </>
      ) : release ? (
        <div className={styles.row}>
          <LightStatusTag tone="success">
            {t(`${PREFIX}.publishedTag`, { version: release.version })}
          </LightStatusTag>
          {regressionLine(release.version, false)}
          {rollbackAction && !rolledBack ? (
            <AppButton onClick={() => setRollingBack(true)} size="small" type="link">
              {t("bknProject.release.rollback.open")}
            </AppButton>
          ) : null}
        </div>
      ) : (
        <p className={styles.muted}>
          {t(`${PREFIX}.${WAITING.has(status.stage) ? "waitCheck" : "waitConfirm"}`)}
        </p>
      )}
      {reviewing && review ? (
        <ReleaseReviewDialog
          canPublish={canPublish}
          onCancel={() => setReviewing(false)}
          onGoToBuild={onGoToBuild}
          onGoToKinetic={onGoToKinetic}
          onPrepared={() => {
            setReviewing(false);
            onChanged();
          }}
          projectId={projectId}
          suggestedVersion={prepared?.version ?? review.suggestedVersion ?? ""}
        />
      ) : null}
      {publishing && prepared ? (
        <ReleasePublishDialog
          baseName={draftBase ? name(draftBase) : ""}
          failedQuestions={failedQuestions}
          onCancel={() => setPublishing(false)}
          onNothingToPublish={() => {
            setPublishing(false);
            setUnchangedAs(prepared.version);
          }}
          onPublished={() => {
            setPublishing(false);
            onChanged();
          }}
          outdated={outdated}
          outdatedName={name(draftBase)}
          projectId={projectId}
          // The community edition keeps the running and the previous version only.
          purgedName={
            versioning && !versioning.fullHistory && versioning.previousVersion
              ? name(versioning.previousVersion)
              : ""
          }
          regressionText={regressionText}
          runningName={name(running)}
          version={prepared.version}
        />
      ) : null}
      {rollingBack ? (
        <RollbackDialog
          canRollBack={canPublish}
          onCancel={() => setRollingBack(false)}
          onRolledBack={() => {
            setRollingBack(false);
            onChanged();
          }}
          projectId={projectId}
          rollback
        />
      ) : null}
    </Section>
  );
}
