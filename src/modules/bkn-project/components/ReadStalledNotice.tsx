/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert } from "antd";
import { useTranslation } from "react-i18next";

import { AppButton } from "@/framework/ui/common/AppButton";

/** Said once reading a background run's progress kept failing: what shows may be out of date. */
export function ReadStalledNotice({ onRefresh }: { onRefresh: () => void }) {
  const { t } = useTranslation();
  return (
    <Alert
      action={
        <AppButton onClick={onRefresh} size="small">
          {t("common.refresh")}
        </AppButton>
      }
      message={t("bknProject.readStalled")}
      showIcon
      type="warning"
    />
  );
}
