/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/**
 * Concentric rings for nodes that carry no useful hierarchy.
 *
 * The library's circular layout only ever draws one ring, and its concentric layout groups by
 * degree, so a star's several hundred leaves all share a degree and land on that same single
 * ring: thousands of pixels across with an empty middle. This fills rings from the inside out,
 * each holding as many nodes as fit at the given spacing, which keeps the whole set inside a
 * disc roughly the square root of the node count across.
 */
export type RingPoint = { x: number; y: number };

export const RING_NODE_SPACING = 72;

/** Positions `count` nodes on concentric rings spaced `spacing` apart, innermost ring first. */
export function ringPositions(count: number, spacing: number = RING_NODE_SPACING): RingPoint[] {
  const points: RingPoint[] = [];
  if (count <= 0) return points;
  if (count === 1) return [{ x: 0, y: 0 }];
  let placed = 0;
  let ring = 1;
  while (placed < count) {
    const radius = ring * spacing;
    // How many nodes fit on this ring at the given spacing, and never more than what is left.
    const capacity = Math.max(1, Math.floor((2 * Math.PI * radius) / spacing));
    const take = Math.min(capacity, count - placed);
    // A partly filled outermost ring spreads over the full circle rather than bunching up.
    const step = (2 * Math.PI) / take;
    for (let index = 0; index < take; index += 1) {
      const angle = index * step;
      points.push({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
    }
    placed += take;
    ring += 1;
  }
  return points;
}

/** Diameter of the disc `count` nodes occupy, for deciding when one ring is still enough. */
export function ringsDiameter(count: number, spacing: number = RING_NODE_SPACING): number {
  const points = ringPositions(count, spacing);
  const radius = points.reduce((max, point) => Math.max(max, Math.hypot(point.x, point.y)), 0);
  return radius * 2 + spacing;
}
