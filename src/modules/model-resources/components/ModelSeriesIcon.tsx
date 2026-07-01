/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import styles from "./ModelSeriesIcon.module.css";

type ModelSeriesIconProps = {
  modelName: string;
  modelSeries?: string;
};

export function ModelSeriesIcon({ modelName, modelSeries }: ModelSeriesIconProps) {
  const label = (modelSeries || modelName || "?").slice(0, 1).toUpperCase();

  return (
    <span aria-hidden className={styles.icon}>
      {label}
    </span>
  );
}
