/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { PropsWithChildren } from "react";

import styles from "./TableSurface.module.css";

type TableSurfaceProps = PropsWithChildren<{
  className?: string;
}>;

export function TableSurface({ children, className }: TableSurfaceProps) {
  return (
    <div className={[styles.surface, className].filter(Boolean).join(" ")}>
      {children}
    </div>
  );
}
