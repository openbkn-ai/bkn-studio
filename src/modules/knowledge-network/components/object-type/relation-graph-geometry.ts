/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

const RELATION_LABEL_HEIGHT = 28;
const PARALLEL_LABEL_GAP = 12;
// The spacing parallel relations had before labels were measured.
const MIN_PARALLEL_LABEL_STEP = 35;

/**
 * How far each of the relations between the same two nodes bends, so that their labels, which sit
 * halfway to the bend, stay on their own curves without covering each other. A label takes its
 * width across a vertical edge and its height across a horizontal one.
 */
export function parallelRelationOffsets(labelWidths: number[], unitX: number, unitY: number) {
  const across = labelWidths.map(
    (width) => width * Math.abs(unitY) + RELATION_LABEL_HEIGHT * Math.abs(unitX),
  );
  const centers: number[] = [];
  across.forEach((extent, index) => {
    centers.push(
      index === 0
        ? 0
        : centers[index - 1] +
            Math.max(
              MIN_PARALLEL_LABEL_STEP,
              (across[index - 1] + extent) / 2 + PARALLEL_LABEL_GAP,
            ),
    );
  });
  const middle = centers.length ? (centers[0] + centers[centers.length - 1]) / 2 : 0;
  // The label is halfway between the straight line and the control point.
  return centers.map((center) => (center - middle) * 2);
}
