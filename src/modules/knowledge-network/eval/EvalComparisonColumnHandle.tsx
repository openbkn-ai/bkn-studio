/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useRef, useState } from "react";
import { useEvalTranslation } from "./useEvalTranslation";
import styles from "./EvalMultiRunPanel.module.css";

const minimumPixels = [100, 180, 180, 160];

/** Adjust two adjacent columns without changing the table's overall width. */
export function EvalComparisonColumnHandle({
  index,
  widths,
  onChange,
  onReset,
  label,
}: {
  index: number;
  widths: number[];
  onChange: (widths: number[]) => void;
  onReset: () => void;
  label: string;
}) {
  const { t } = useEvalTranslation();
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ id: number; x: number; tableWidth: number; widths: number[] } | null>(null);
  const constrain = (next: number, values: number[], width: number) => {
    const pair = values[index] + values[index + 1];
    // Small layouts keep proportional bounds; narrow screens use the stacked comparison layout.
    const minimum = Math.min((minimumPixels[index] / width) * 100, pair * 0.35);
    const maximum = pair - Math.min((minimumPixels[index + 1] / width) * 100, pair * 0.35);
    const left = Math.max(minimum, Math.min(maximum, next));
    return values.map((value, position) =>
      position === index ? left : position === index + 1 ? pair - left : value,
    );
  };
  const end = () => {
    drag.current = null;
    setDragging(false);
  };
  return (
    <span
      className={styles.comparisonResizeHandle}
      data-dragging={dragging || undefined}
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={Math.round(widths[index])}
      aria-valuemin={0}
      aria-valuemax={Math.round(widths[index] + widths[index + 1])}
      aria-valuetext={`${Math.round(widths[index])}%`}
      title={t("knowledgeNetwork.eval.resultValueUi.resizeHint")}
      tabIndex={0}
      onDoubleClick={onReset}
      onKeyDown={(event) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const tableWidth =
          event.currentTarget.closest("table")?.getBoundingClientRect().width || 1000;
        const next =
          event.key === "Home"
            ? 0
            : event.key === "End"
              ? 100
              : widths[index] + (event.key === "ArrowRight" ? 2 : -2);
        onChange(constrain(next, widths, tableWidth));
      }}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        const tableWidth = event.currentTarget.closest("table")?.getBoundingClientRect().width;
        if (!tableWidth) return;
        event.preventDefault();
        drag.current = { id: event.pointerId, x: event.clientX, tableWidth, widths: [...widths] };
        event.currentTarget.setPointerCapture(event.pointerId);
        setDragging(true);
      }}
      onPointerMove={(event) => {
        const initial = drag.current;
        if (!initial || initial.id !== event.pointerId) return;
        onChange(
          constrain(
            initial.widths[index] + ((event.clientX - initial.x) / initial.tableWidth) * 100,
            initial.widths,
            initial.tableWidth,
          ),
        );
      }}
      onPointerUp={(event) => {
        if (drag.current?.id !== event.pointerId) return;
        end();
        if (event.currentTarget.hasPointerCapture(event.pointerId))
          event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onPointerCancel={end}
      onLostPointerCapture={end}
    />
  );
}
