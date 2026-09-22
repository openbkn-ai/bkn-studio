/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Tag } from "antd";
import type { ReactNode } from "react";

import styles from "./LightStatusTag.module.css";

export type LightStatusTone = "error" | "info" | "neutral" | "success" | "warning";

type LightStatusTagProps = {
  children: ReactNode;
  className?: string;
  tone: LightStatusTone;
};

/** Consistent light-background status label for Vega views. */
export function LightStatusTag({ children, className, tone }: LightStatusTagProps) {
  return (
    <Tag className={[styles.tag, styles[tone], className].filter(Boolean).join(" ")}>
      {children}
    </Tag>
  );
}
