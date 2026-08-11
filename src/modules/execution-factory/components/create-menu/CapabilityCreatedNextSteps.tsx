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
          defaultValue: "HTTP API added to toolset",
        })}
      </div>
      <p className={styles.description}>
        {t("executionFactory.createdNextStepsDescription", {
          defaultValue:
            "Next, debug the tool or edit its description and usage rules. You can also open the toolset to continue managing tools.",
        })}
      </p>
      <div className={styles.meta}>
        <div className={styles.metaItem}>
          <div className={styles.metaLabel}>
            {t("executionFactory.createdNextStepsTool", {
              defaultValue: "Tool",
            })}
          </div>
          <div className={styles.metaValue}>{toolName || "-"}</div>
        </div>
        <div className={styles.metaItem}>
          <div className={styles.metaLabel}>
            {t("executionFactory.createdNextStepsToolbox", {
              defaultValue: "Toolset",
            })}
          </div>
          <div className={styles.metaValue}>{toolboxName || "-"}</div>
        </div>
      </div>
      <div className={styles.actions}>
        <AppButton onClick={onViewToolset} type="primary">
          {t("executionFactory.createdNextStepsViewToolset", {
            defaultValue: "View toolset",
          })}
        </AppButton>
        {onDebug ? (
          <AppButton onClick={onDebug}>
            {t("executionFactory.createdNextStepsDebug", {
              defaultValue: "Debug",
            })}
          </AppButton>
        ) : null}
        {onCompleteContract ? (
          <AppButton onClick={onCompleteContract}>
            {t("executionFactory.createdNextStepsEditTool", {
              defaultValue: "Edit tool info",
            })}
          </AppButton>
        ) : null}
        <AppButton onClick={onClose}>
          {t("common.close", {
            defaultValue: "Close",
          })}
        </AppButton>
      </div>
    </section>
  );
}
