/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/*
 * Instances with no relation have nothing to hold them: a force layout pushes them out until they
 * pile against its bounds. They are laid out apart instead, as a band of rows under the connected
 * part, one run per object type so each type reads as a block of its colour.
 */

export type Bounds = { minX: number; minY: number; maxX: number; maxY: number };

/** Bounds of the points at `indices`, or null when none has a finite position. */
export function boundsOf(positions: ArrayLike<number>, indices: Iterable<number>): Bounds | null {
  let [minX, minY, maxX, maxY] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const i of indices) {
    const x = positions[i * 2];
    const y = positions[i * 2 + 1];
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  return Number.isFinite(minX) ? { minX, minY, maxX, maxY } : null;
}

/**
 * Positions for the isolated points, flat `[x0, y0, x1, y1, …]` in the order of `indices` after
 * grouping by type: rows as wide as the connected part, starting a gap below it (`yDown: true`
 * means larger y is further down, as in screen space). Each type starts on a fresh row.
 */
export function isolatedBand(
  indices: readonly number[],
  typeOf: (index: number) => string,
  above: Bounds,
  spacing: number,
  options: { yDown: boolean },
): { order: number[]; positions: Float32Array } {
  const byType = new Map<string, number[]>();
  for (const i of indices) {
    const otId = typeOf(i);
    const list = byType.get(otId) ?? [];
    list.push(i);
    byType.set(otId, list);
  }
  const width = Math.max(spacing * 20, above.maxX - above.minX);
  const perRow = Math.max(1, Math.floor(width / spacing));
  const direction = options.yDown ? 1 : -1;
  const start = options.yDown ? above.maxY : above.minY;
  const order: number[] = [];
  const positions = new Float32Array(indices.length * 2);
  let row = 2; // a gap of two rows between the connected part and the band
  let k = 0;
  for (const list of byType.values()) {
    list.forEach((index, n) => {
      const column = n % perRow;
      if (n > 0 && column === 0) row += 1;
      order.push(index);
      positions[k * 2] = above.minX + column * spacing;
      positions[k * 2 + 1] = start + direction * row * spacing;
      k += 1;
    });
    row += 2; // a blank row between types
  }
  return { order, positions };
}
