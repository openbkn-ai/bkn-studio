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
import { projectErrorCode } from "@/modules/bkn-project/services/publish.service";
import { getSwitchPlan, switchConsumers } from "@/modules/bkn-project/services/release.service";
import type { SwitchPlan } from "@/modules/bkn-project/types/release";

import styles from "./Release.module.css";

const PREFIX = "bknProject.release.switch";

/**
 * Shows what switching consumers to a release moves, then switches them once the owner agrees:
 * the schedules running on the version in use move to the release and run as the owner.
 */
export function SwitchConsumersDialog({
  baseNetworkId,
  onCancel,
  onSwitched,
  projectId,
  toNetworkId,
  toVersion,
  versionOf,
}: {
  /** The network the lineage started from, before any release. */
  baseNetworkId: string;
  onCancel: () => void;
  onSwitched: () => void;
  projectId: string;
  toNetworkId: string;
  toVersion: string;
  /** The version a network of the lineage was released as; none for the lineage's first network. */
  versionOf: (networkId: string) => string | undefined;
}) {
  const { t } = useTranslation();
  const { message } = useAppServices();
  const [plan, setPlan] = useState<SwitchPlan | null>(null);
  const [failed, setFailed] = useState(false);
  const [switching, setSwitching] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      setPlan(await getSwitchPlan(projectId, toNetworkId));
    } catch (error) {
      if (projectErrorCode(error) === "Lineage.AlreadyInUse") {
        message.info(t(`${PREFIX}.alreadyInUse`, { version: toVersion }));
        onSwitched();
        return;
      }
      setFailed(true);
    }
  }, [message, onSwitched, projectId, t, toNetworkId, toVersion]);

  useEffect(() => {
    void load();
  }, [load]);

  const confirm = async () => {
    setSwitching(true);
    try {
      await switchConsumers(projectId, toNetworkId);
      message.success(t(`${PREFIX}.done`, { version: toVersion }));
      onSwitched();
    } catch (error) {
      const code = projectErrorCode(error);
      message.error(
        t(
          `${PREFIX}.${
            code === "Lineage.AlreadyInUse"
              ? "alreadyInUseError"
              : code === "Release.NotOwner"
                ? "notOwner"
                : "failed"
          }`,
          { version: toVersion },
        ),
      );
    } finally {
      setSwitching(false);
    }
  };

  const fromVersion = plan ? versionOf(plan.fromNetworkId) : undefined;
  // Only the lineage's own network is "the original"; a release not read yet is said as in use.
  const from = fromVersion
    ? t(`${PREFIX}.fromTo`, { from: fromVersion, to: toVersion })
    : plan?.fromNetworkId === baseNetworkId
      ? t(`${PREFIX}.fromFirst`, { to: toVersion })
      : t(`${PREFIX}.fromInUse`, { to: toVersion });
  return (
    <Modal
      cancelText={t("common.cancel")}
      confirmLoading={switching}
      destroyOnHidden
      okButtonProps={{ disabled: !plan }}
      okText={t(`${PREFIX}.confirm`)}
      onCancel={onCancel}
      onOk={() => void confirm()}
      open
      title={t(`${PREFIX}.title`, { version: toVersion })}
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
          <p>{from}</p>
          {plan.schedules.length ? (
            <div className={styles.stack}>
              <span className={styles.label}>
                {t(`${PREFIX}.schedules`, { count: plan.schedules.length, version: toVersion })}
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
          <p className={styles.muted}>{t(`${PREFIX}.others`)}</p>
        </div>
      )}
    </Modal>
  );
}
