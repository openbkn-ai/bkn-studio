/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useTranslation } from "react-i18next";

import { LightStatusTag } from "@/framework/ui/common/LightStatusTag";
import { namedWithoutUnderstanding } from "@/modules/bkn-project/components/model/understanding";
import { UNDERSTANDING_STATUS_TONE } from "@/modules/bkn-project/components/publish/messages";
import type { UnderstandingTable } from "@/modules/bkn-project/types/publish";

/**
 * A table's semantic understanding as the modeling page and the catalog tab both show it: its
 * newest task, or, without one, whether it has a business name already.
 */
export function UnderstandingTag({ table }: { table: UnderstandingTable }) {
  const { t } = useTranslation();
  if (namedWithoutUnderstanding(table)) {
    return (
      <LightStatusTag tone="success">
        {t(
          table.networkObjectTypes.length
            ? "bknProject.understand.status.network"
            : "bknProject.understand.status.described",
        )}
      </LightStatusTag>
    );
  }
  return (
    <LightStatusTag tone={UNDERSTANDING_STATUS_TONE[table.status] ?? "neutral"}>
      {table.status === "completed" && !table.applied
        ? t("bknProject.understand.progress.notApplied")
        : t(`bknProject.understand.status.${table.status}`)}
    </LightStatusTag>
  );
}
