/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useEffect, useRef, useState, type RefObject } from "react";

import { useEvalTranslation } from "./useEvalTranslation";
import styles from "./EvalWorkspaceScene.module.css";

type Props = { containerRef: RefObject<HTMLDivElement | null> };

/** Keep resize updates local so dragging does not rerender the workspace tables or chat. */
export function EvalAssistantResizeHandle({ containerRef }: Props) {
  const { t } = useEvalTranslation();
  const defaultWidth = () => Math.min(520, Math.max(380, window.innerWidth * 0.34));
  const [availableWidth, setAvailableWidth] = useState(window.innerWidth);
  const [preferredWidth, setPreferredWidth] = useState(
    () =>
      Number.parseFloat(
        containerRef.current?.style.getPropertyValue("--eval-assistant-width") ?? "",
      ) || defaultWidth(),
  );
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ pointerId: number; startX: number; startWidth: number } | null>(null);
  const min = Math.min(360, Math.floor(availableWidth * 0.6));
  const max = Math.max(min, Math.min(960, availableWidth - 328));
  const clamp = (value: number) => Math.round(Math.min(max, Math.max(min, value)));
  const width = clamp(preferredWidth);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const measure = () =>
      setAvailableWidth(container.getBoundingClientRect().width || window.innerWidth);
    measure();
    const observer =
      typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(measure);
    observer?.observe(container);
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
      container.removeAttribute("data-assistant-resizing");
    };
  }, [containerRef]);

  useEffect(() => {
    const container = containerRef.current;
    container?.style.setProperty("--eval-assistant-width", `${width}px`);
    container?.toggleAttribute("data-assistant-resizing", dragging);
  }, [containerRef, dragging, width]);

  return (
    <div
      className={styles.assistantResizeHandle}
      role="separator"
      aria-label={t("knowledgeNetwork.eval.assistantUi.resize")}
      aria-orientation="vertical"
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={width}
      tabIndex={0}
      onDoubleClick={() => setPreferredWidth(defaultWidth())}
      onKeyDown={(event) => {
        const sizes: Record<string, number> = {
          ArrowLeft: width + 24,
          ArrowRight: width - 24,
          Home: min,
          End: max,
        };
        const next = sizes[event.key];
        if (next === undefined) return;
        event.preventDefault();
        setPreferredWidth(clamp(next));
      }}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        drag.current = { pointerId: event.pointerId, startX: event.clientX, startWidth: width };
        event.currentTarget.setPointerCapture(event.pointerId);
        setDragging(true);
      }}
      onPointerMove={(event) => {
        if (drag.current?.pointerId !== event.pointerId) return;
        setPreferredWidth(clamp(drag.current.startWidth + drag.current.startX - event.clientX));
      }}
      onPointerUp={(event) => {
        if (drag.current?.pointerId !== event.pointerId) return;
        drag.current = null;
        setDragging(false);
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      }}
      onPointerCancel={() => {
        drag.current = null;
        setDragging(false);
      }}
      onLostPointerCapture={() => {
        drag.current = null;
        setDragging(false);
      }}
    />
  );
}
