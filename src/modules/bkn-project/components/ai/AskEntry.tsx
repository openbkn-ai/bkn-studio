/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Tooltip } from "antd";
import { useTranslation } from "react-i18next";

import { AppButton } from "@/framework/ui/common/AppButton";

import styles from "./RequirementAsk.module.css";

/**
 * The Ask AI button of kinetic modeling and business scenarios. It is always there: before the
 * concept model is confirmed it cannot be used, says why, and leads to confirming it.
 */
export function AskEntry({
  asking,
  modelConfirmed,
  onGoToModel,
  onToggle,
  selected,
}: {
  asking: boolean;
  /** null while unread. */
  modelConfirmed: boolean | null;
  onGoToModel: () => void;
  onToggle: () => void;
  /** How many items are ticked to ask about. */
  selected: number;
}) {
  const { t } = useTranslation();
  const label = selected
    ? t("bknProject.ask.button.selected", { count: selected })
    : t("bknProject.ask.button.label");
  if (!modelConfirmed) {
    return (
      <span className={styles.entry}>
        <Tooltip
          title={modelConfirmed === null ? undefined : t("bknProject.ask.button.needsModel")}
        >
          <span>
            <AppButton disabled type="primary">
              {label}
            </AppButton>
          </span>
        </Tooltip>
        {modelConfirmed === null ? null : (
          <AppButton onClick={onGoToModel} size="small" type="link">
            {t("bknProject.ask.button.confirmModel")}
          </AppButton>
        )}
      </span>
    );
  }
  return (
    <AppButton aria-pressed={asking} onClick={onToggle} type={asking ? "default" : "primary"}>
      {label}
    </AppButton>
  );
}
