/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/** The part of d3-force-3d (which ships no types) the 3D layout uses. */
declare module "d3-force-3d" {
  export type SimNode = {
    index?: number;
    x?: number;
    y?: number;
    z?: number;
    vx?: number;
    vy?: number;
    vz?: number;
    fx?: number | null;
    fy?: number | null;
    fz?: number | null;
  };
  export type SimLink = { source: number | SimNode; target: number | SimNode };

  export interface Force {
    (alpha: number): void;
  }
  export interface Simulation {
    tick(iterations?: number): Simulation;
    stop(): Simulation;
    alpha(): number;
    alpha(value: number): Simulation;
    alphaMin(): number;
    alphaMin(value: number): Simulation;
    alphaDecay(value: number): Simulation;
    velocityDecay(value: number): Simulation;
    force(name: string, force: Force | null): Simulation;
  }
  export interface LinkForce extends Force {
    distance(value: number): LinkForce;
    strength(value: number | ((link: SimLink) => number)): LinkForce;
    iterations(value: number): LinkForce;
  }
  export interface ManyBodyForce extends Force {
    strength(value: number): ManyBodyForce;
    theta(value: number): ManyBodyForce;
    distanceMax(value: number): ManyBodyForce;
  }
  export interface PositionForce extends Force {
    strength(value: number): PositionForce;
  }

  export function forceSimulation(nodes: SimNode[], dimensions?: number): Simulation;
  export function forceLink(links: SimLink[]): LinkForce;
  export function forceManyBody(): ManyBodyForce;
  export function forceCenter(x?: number, y?: number, z?: number): Force;
  export function forceX(x?: number): PositionForce;
  export function forceY(y?: number): PositionForce;
  export function forceZ(z?: number): PositionForce;
}
