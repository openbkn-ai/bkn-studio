/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Tooltip } from "antd";
import { useRef, useState } from "react";

import styles from "./ClampedText.module.css";

/**
 * Text kept to two lines in a table cell, such as a long description an existing object type
 * brings from the network: the rest shows on hover, and only when something was cut.
 */
export function ClampedText({ className, text }: { className?: string; text: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [clamped, setClamped] = useState(false);
  return (
    <Tooltip placement="topLeft" title={clamped ? text : undefined}>
      <span
        className={className ? `${styles.clamp} ${className}` : styles.clamp}
        data-testid="clamped-text"
        onMouseEnter={() => {
          const element = ref.current;
          setClamped(Boolean(element && element.scrollHeight > element.clientHeight + 1));
        }}
        ref={ref}
      >
        {text}
      </span>
    </Tooltip>
  );
}
