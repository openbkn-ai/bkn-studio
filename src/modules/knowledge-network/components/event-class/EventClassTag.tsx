/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Tag, Tooltip } from "antd";
import { useTranslation } from "react-i18next";

type EventClassTagProps = {
  /** The platform writes it (an event type's class), rather than a table someone bound. */
  managed?: boolean;
};

/** Marks an object type whose objects are events. */
export function EventClassTag({ managed = true }: EventClassTagProps) {
  const { t } = useTranslation();
  return (
    <Tooltip
      title={
        managed
          ? t("knowledgeNetwork.eventClasses.tagManagedHint")
          : t("knowledgeNetwork.eventClasses.tagDeclaredHint")
      }
    >
      <Tag bordered={false} color="purple" data-testid="event-class-tag">
        {t("knowledgeNetwork.eventClasses.tag")}
      </Tag>
    </Tooltip>
  );
}
