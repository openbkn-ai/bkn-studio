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
import { Questions } from "@/modules/bkn-project/components/release/ReleaseReviewDialog";
import { projectErrorCode } from "@/modules/bkn-project/services/publish.service";
import { getRollbackPlan, rollBack } from "@/modules/bkn-project/services/release.service";
import type { RollbackNetwork, RollbackPlan } from "@/modules/bkn-project/types/release";

import styles from "./Release.module.css";

const PREFIX = "bknProject.release.rollback";

const REFUSALS = new Set(["NoPrevious", "NotProjectRelease"]);
const CONSUMERS = new Set(["agents", "mcp", "workshop", "eval"]);
const ERRORS = new Set(["NotOwner", "ProjectArchived"]);

const codeName = (code: string) => code.slice(code.lastIndexOf(".") + 1);

/**
 * Rolls consumers back to the network before the one in use, once the owner has read what it
 * does: the schedules that move back, the consumers their owners switch, and the scenario
 * questions it changes. It only switches; no data or definitions are rewritten.
 */
export function RollbackDialog({
  canRollBack,
  onCancel,
  onRolledBack,
  projectId,
}: {
  canRollBack: boolean;
  onCancel: () => void;
  onRolledBack: () => void;
  projectId: string;
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
      setPlan(await getRollbackPlan(projectId));
    } catch {
      setFailed(true);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const version = (item: RollbackNetwork) => `v${item.version}`;
  // The network before the first release has no version: its own wording names it.
  const toBase = (item: RollbackNetwork | null) => Boolean(item && (item.base || !item.version));

  const confirm = async () => {
    if (!plan) {
      return;
    }
    setRolling(true);
    try {
      await rollBack(projectId, plan.signature);
      message.success(
        toBase(plan.to)
          ? t(`${PREFIX}.doneBase`)
          : t(`${PREFIX}.done`, { to: plan.to ? version(plan.to) : "" }),
      );
      onRolledBack();
    } catch (error) {
      const code = projectErrorCode(error) ?? "";
      if (code === "Rollback.PlanOutdated") {
        // What was read no longer stands: read it again for the owner to confirm anew.
        message.warning(t(`${PREFIX}.outdated`));
        void load();
      } else {
        const name = codeName(code);
        message.error(
          REFUSALS.has(name)
            ? t(`${PREFIX}.refusal.${name}`)
            : t(`${PREFIX}.error.${ERRORS.has(name) ? name : "other"}`),
        );
      }
    } finally {
      setRolling(false);
    }
  };

  const refused = Boolean(plan?.refusals.length) || !plan?.to;
  const consumers = plan?.consumers.filter((kind) => CONSUMERS.has(kind)) ?? [];
  return (
    <Modal
      cancelText={t("common.cancel")}
      confirmLoading={rolling}
      destroyOnHidden
      okButtonProps={{ danger: true, disabled: !plan || refused || !canRollBack }}
      okText={t(`${PREFIX}.confirm`)}
      onCancel={onCancel}
      onOk={() => void confirm()}
      open
      title={t(`${PREFIX}.title`)}
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
                  const name = codeName(code);
                  return t(`${PREFIX}.refusal.${REFUSALS.has(name) ? name : "other"}`);
                })
                .join(t("bknProject.sentenceSeparator"))}
              showIcon
              type="error"
            />
          ) : null}
          {plan.to ? (
            <p>
              {toBase(plan.to)
                ? t(`${PREFIX}.fromToBase`, { from: version(plan.from) })
                : t(`${PREFIX}.fromTo`, { from: version(plan.from), to: version(plan.to) })}
            </p>
          ) : null}
          <p className={styles.muted}>{t(`${PREFIX}.onlySwitches`)}</p>
          {plan.schedules.length ? (
            <div className={styles.stack}>
              <span className={styles.label}>
                {t(`${PREFIX}.${toBase(plan.to) ? "schedulesBase" : "schedules"}`, {
                  count: plan.schedules.length,
                  from: version(plan.from),
                  to: plan.to ? version(plan.to) : "",
                })}
              </span>
              <ul className={styles.list}>
                {plan.schedules.map((schedule) => (
                  <li className={styles.listItem} key={schedule.id}>
                    {schedule.name}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className={styles.muted}>{t(`${PREFIX}.noSchedules`)}</p>
          )}
          {consumers.length ? (
            <p className={styles.muted}>
              {t(`${PREFIX}.consumers`, {
                kinds: consumers
                  .map((kind) => t(`${PREFIX}.consumer.${kind}`))
                  .join(t("bknProject.listSeparator")),
              })}
            </p>
          ) : null}
          {plan.questions.total ? (
            <div className={styles.stack}>
              <Questions list={plan.questions.unanswerable} title={t(`${PREFIX}.unanswerable`)} />
              <Questions list={plan.questions.affected} title={t(`${PREFIX}.affected`)} />
              <Questions list={plan.questions.answerableNew} title={t(`${PREFIX}.answerableNew`)} />
            </div>
          ) : null}
          {canRollBack ? null : <p className={styles.muted}>{t(`${PREFIX}.ownerOnly`)}</p>}
        </div>
      )}
    </Modal>
  );
}
