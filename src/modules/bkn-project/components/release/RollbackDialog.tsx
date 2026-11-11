/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Modal, Spin } from "antd";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { AppButton } from "@/framework/ui/common/AppButton";
import { versionName } from "@/modules/bkn-project/components/release/releaseMessages";
import { Questions } from "@/modules/bkn-project/components/release/ReleaseReviewDialog";
import { projectErrorCode } from "@/modules/bkn-project/services/publish.service";
import { getRollbackPlan, rollBack } from "@/modules/bkn-project/services/release.service";
import type { RollbackPlan, RollbackVersion } from "@/modules/bkn-project/types/release";

import styles from "./Release.module.css";

const PREFIX = "bknProject.release.rollback";

const REFUSALS = new Set([
  "NoPrevious",
  "NotProjectRelease",
  "EditionRestricted",
  "NotFound",
  "VersionPurged",
  "NotActivatable",
]);
const ERRORS = new Set(["NotOwner", "ProjectArchived", "BrokenReferences"]);

const codeName = (code: string) => code.slice(code.lastIndexOf(".") + 1);

/**
 * Switches the network's running version to an earlier one, once the owner has read what it
 * changes for the scenario questions. It takes effect at once for every consumer; the project's
 * content and the network's draft stay as they are.
 */
export function RollbackDialog({
  canRollBack,
  onCancel,
  onRolledBack,
  projectId,
  rollback,
  toVersion,
}: {
  canRollBack: boolean;
  onCancel: () => void;
  onRolledBack: () => void;
  projectId: string;
  /** Going back to the previous version, said as such; otherwise switching to another one. */
  rollback: boolean;
  /** The version to switch to; the previous version without it. */
  toVersion?: number;
}) {
  const { t } = useTranslation();
  const { message } = useAppServices();
  const [plan, setPlan] = useState<RollbackPlan | null>(null);
  const [failed, setFailed] = useState(false);
  const [rolling, setRolling] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    setPlan(null);
    try {
      setPlan(await getRollbackPlan(projectId, toVersion));
    } catch {
      setFailed(true);
    }
  }, [projectId, toVersion]);

  useEffect(() => {
    void load();
  }, [load]);

  const name = (version: RollbackVersion) => versionName(t, version.knVersion, version.label);

  const confirm = async () => {
    if (!plan?.to) {
      return;
    }
    setRolling(true);
    try {
      await rollBack(projectId, plan.signature, plan.to.knVersion);
      message.success(t(`${PREFIX}.done`, { version: name(plan.to) }));
      onRolledBack();
    } catch (error) {
      const code = projectErrorCode(error) ?? "";
      if (code === "Rollback.PlanOutdated") {
        // What was read no longer stands: read it again for the owner to confirm anew.
        message.warning(t(`${PREFIX}.outdated`));
        void load();
      } else {
        const known = codeName(code);
        message.error(
          REFUSALS.has(known)
            ? t(`${PREFIX}.refusal.${known}`)
            : t(`${PREFIX}.error.${ERRORS.has(known) ? known : "other"}`),
        );
      }
    } finally {
      setRolling(false);
    }
  };

  const refused = Boolean(plan?.refusals.length) || !plan?.to;
  const affected = plan
    ? plan.questions.unanswerable.length +
      plan.questions.affected.length +
      plan.questions.answerableNew.length
    : 0;
  return (
    <Modal
      cancelText={t("common.cancel")}
      confirmLoading={rolling}
      destroyOnHidden
      okButtonProps={{ disabled: !plan || refused || !canRollBack }}
      okText={t(`${PREFIX}.confirm`)}
      onCancel={onCancel}
      onOk={() => void confirm()}
      open
      title={
        plan?.to
          ? t(`${PREFIX}.${rollback ? "titleBack" : "titleSwitch"}`, { version: name(plan.to) })
          : t(`${PREFIX}.title`)
      }
      width={640}
    >
      {failed ? (
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
      ) : !plan ? (
        <Spin />
      ) : (
        <div className={styles.stack}>
          {plan.refusals.length ? (
            <Alert
              message={plan.refusals
                .map((code) => {
                  const known = codeName(code);
                  return t(`${PREFIX}.refusal.${REFUSALS.has(known) ? known : "other"}`);
                })
                .join(t("bknProject.sentenceSeparator"))}
              showIcon
              type="error"
            />
          ) : null}
          {plan.to ? (
            <>
              <p className={styles.muted}>
                {t(`${PREFIX}.effect`, { from: name(plan.from), to: name(plan.to) })}
              </p>
              <dl className={styles.keyValues}>
                <dt>{t(`${PREFIX}.running`)}</dt>
                <dd>{name(plan.from)}</dd>
                <dt>{t(`${PREFIX}.target`)}</dt>
                <dd>{name(plan.to)}</dd>
                <dt>{t(`${PREFIX}.questions`)}</dt>
                <dd>
                  {affected
                    ? t(`${PREFIX}.questionsCount`, { count: affected })
                    : t(`${PREFIX}.questionsNone`)}
                </dd>
              </dl>
              {affected ? (
                <div className={styles.stack}>
                  <Questions
                    list={plan.questions.unanswerable}
                    title={t(`${PREFIX}.unanswerable`)}
                  />
                  <Questions list={plan.questions.affected} title={t(`${PREFIX}.affected`)} />
                  <Questions
                    list={plan.questions.answerableNew}
                    title={t(`${PREFIX}.answerableNew`)}
                  />
                </div>
              ) : null}
              <Alert message={t(`${PREFIX}.projectStays`)} showIcon type="info" />
            </>
          ) : null}
          {canRollBack ? null : <p className={styles.muted}>{t(`${PREFIX}.ownerOnly`)}</p>}
        </div>
      )}
    </Modal>
  );
}
