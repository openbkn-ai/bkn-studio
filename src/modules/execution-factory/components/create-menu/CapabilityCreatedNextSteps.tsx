/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useTranslation } from "react-i18next";

import { AppButton } from "@/framework/ui/common/AppButton";

import styles from "./CapabilityCreatedNextSteps.module.css";

type CapabilityCreatedNextStepsProps = {
  onClose: () => void;
  onCompleteContract?: () => void;
  onDebug?: () => void;
  onViewToolset: () => void;
  toolName?: string;
  toolboxName?: string;
};

export function CapabilityCreatedNextSteps({
  onClose,
  onCompleteContract,
  onDebug,
  onViewToolset,
  toolName,
  toolboxName,
}: CapabilityCreatedNextStepsProps) {
  const { t } = useTranslation();

  return (
    <section className={styles.panel} data-testid="capability-created-next-steps">
      <div className={styles.title}>
        {t("executionFactory.createdNextStepsTitle", {
          defaultValue: "HTTP API 已添加到工具集",
        })}
      </div>
      <p className={styles.description}>
        {t("executionFactory.createdNextStepsDescription", {
          defaultValue:
            "建议下一步先调试验证，或进入工具编辑页补充工具说明与使用规则。也可以直接进入工具集继续管理。",
        })}
      </p>
      <div className={styles.meta}>
        <div className={styles.metaItem}>
          <div className={styles.metaLabel}>
            {t("executionFactory.createdNextStepsTool", {
              defaultValue: "工具",
            })}
          </div>
          <div className={styles.metaValue}>{toolName || "-"}</div>
        </div>
        <div className={styles.metaItem}>
          <div className={styles.metaLabel}>
            {t("executionFactory.createdNextStepsToolbox", {
              defaultValue: "工具集",
            })}
          </div>
          <div className={styles.metaValue}>{toolboxName || "-"}</div>
        </div>
      </div>
      <div className={styles.actions}>
        <AppButton onClick={onViewToolset} type="primary">
          {t("executionFactory.createdNextStepsViewToolset", {
            defaultValue: "查看工具集",
          })}
        </AppButton>
        {onDebug ? (
          <AppButton onClick={onDebug}>
            {t("executionFactory.createdNextStepsDebug", {
              defaultValue: "去调试",
            })}
          </AppButton>
        ) : null}
        {onCompleteContract ? (
          <AppButton onClick={onCompleteContract}>
            {t("executionFactory.createdNextStepsEditTool", {
              defaultValue: "编辑工具信息",
            })}
          </AppButton>
        ) : null}
        <AppButton onClick={onClose}>
          {t("common.close", {
            defaultValue: "关闭",
          })}
        </AppButton>
      </div>
    </section>
  );
}
