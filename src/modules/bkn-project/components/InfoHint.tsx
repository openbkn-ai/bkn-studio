/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { InfoCircleOutlined } from "@ant-design/icons";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { DescriptionTooltip } from "./ClampedText";
import styles from "./InfoHint.module.css";

/**
 * How something is counted or why it works as it does, shown when hovering an ⓘ beside the
 * heading it explains rather than in a box of its own.
 */
export function InfoHint({ text }: { text: ReactNode }) {
  const { t } = useTranslation();
  return (
    <DescriptionTooltip placement="topLeft" title={text}>
      <InfoCircleOutlined
        aria-label={t("bknProject.notices.about")}
        className={styles.icon}
        role="img"
        tabIndex={0}
      />
    </DescriptionTooltip>
  );
}
