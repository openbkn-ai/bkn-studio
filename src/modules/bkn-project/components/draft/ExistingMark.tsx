/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useTranslation } from "react-i18next";

import styles from "./ExistingMark.module.css";

/** The blue dot that marks what the network already has. */
export function ExistingMark() {
  const { t } = useTranslation();
  const label = t("bknProject.model.existing.mark");
  return <span aria-label={label} className={styles.dot} role="img" title={label} />;
}
