/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Tooltip, type TooltipProps } from "antd";
import { useRef, useState } from "react";

import { MarkdownText } from "@/framework/ui/common/MarkdownText";

import styles from "./ClampedText.module.css";

/**
 * A hover for a long description or reason, styled like the knowledge network cards' description
 * hover: a wide, light surface in the current theme that scrolls when the text is very long.
 */
export function DescriptionTooltip({ classNames, ...props }: TooltipProps) {
  return <Tooltip {...props} classNames={{ ...classNames, root: styles.descriptionTooltip }} />;
}

/**
 * Text kept to two lines in a table cell, such as a long description an existing object type
 * brings from the network: the rest shows on hover, and only when something was cut.
 */
export function ClampedText({ className, text }: { className?: string; text: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [clamped, setClamped] = useState(false);
  return (
    <DescriptionTooltip
      placement="topLeft"
      title={clamped ? <MarkdownText text={text} /> : undefined}
    >
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
    </DescriptionTooltip>
  );
}
