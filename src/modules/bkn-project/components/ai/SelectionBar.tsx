/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useTranslation } from "react-i18next";

import { AppButton } from "@/framework/ui/common/AppButton";

import styles from "./RequirementAsk.module.css";

/** Above a list: how many items are ticked, and bringing them into the AI assistant. */
export function SelectionBar({ count, onBring }: { count: number; onBring: () => void }) {
  const { t } = useTranslation();
  if (!count) {
    return null;
  }
  return (
    <span className={styles.selectionBar}>
      <span>{t("bknProject.ask.select.selected", { count })}</span>
      <AppButton onClick={onBring} size="small" type="primary">
        {t("bknProject.ask.select.bring")}
      </AppButton>
    </span>
  );
}
