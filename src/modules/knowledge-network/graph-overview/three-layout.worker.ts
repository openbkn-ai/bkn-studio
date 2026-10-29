/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/*
 * The 3D overview's force layout, off the main thread: with tens of thousands of points one tick
 * takes tens of milliseconds, which would stall rotating and clicking.
 */

import {
  forceCenter,
  forceLink,
  forceManyBody,
  forceSimulation,
  type SimLink,
  type SimNode,
  type Simulation,
} from "d3-force-3d";

export type LayoutRequest =
  { type: "start"; positions: Float32Array; links: Uint32Array } | { type: "stop" };
export type LayoutReply = { type: "tick"; positions: Float32Array } | { type: "end" };

/*
 * Short lines and moderate repulsion. The springs keep d3's default strength, 1 / the smaller
 * end's degree: a leaf sits tight against its hub, while hubs pull on each other only weakly.
 * No pull towards the middle: it presses everything into one solid ball.
 */
const LINK_DISTANCE = 15;
const CHARGE = -30;
/** Positions go back at most this often; ticks in between are not drawn. */
const POST_MS = 33;

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<LayoutRequest>) => void) | null;
  postMessage(message: LayoutReply, transfer?: Transferable[]): void;
};

let simulation: Simulation | null = null;
let nodes: SimNode[] = [];
let timer: ReturnType<typeof setTimeout> | undefined;

function post() {
  const positions = new Float32Array(nodes.length * 3);
  nodes.forEach((node, i) => {
    positions[i * 3] = node.x ?? 0;
    positions[i * 3 + 1] = node.y ?? 0;
    positions[i * 3 + 2] = node.z ?? 0;
  });
  scope.postMessage({ type: "tick", positions }, [positions.buffer]);
}

function halt() {
  clearTimeout(timer);
  simulation?.stop();
  simulation = null;
}

function run() {
  const current = simulation;
  if (!current) return;
  const until = performance.now() + POST_MS;
  while (performance.now() < until && current.alpha() > current.alphaMin()) current.tick();
  post();
  if (current.alpha() <= current.alphaMin()) {
    halt();
    scope.postMessage({ type: "end" });
    return;
  }
  timer = setTimeout(run, 0);
}

scope.onmessage = (event) => {
  const message = event.data;
  halt();
  if (message.type === "stop") return;
  const { positions, links } = message;
  nodes = Array.from({ length: positions.length / 3 }, (_, i) => ({
    x: positions[i * 3],
    y: positions[i * 3 + 1],
    z: positions[i * 3 + 2],
  }));
  const pairs: SimLink[] = [];
  for (let l = 0; l < links.length; l += 2) pairs.push({ source: links[l], target: links[l + 1] });
  simulation = forceSimulation(nodes, 3)
    .alphaDecay(0.015)
    .force("link", forceLink(pairs).distance(LINK_DISTANCE))
    .force("charge", forceManyBody().strength(CHARGE).theta(0.9))
    .force("center", forceCenter(0, 0, 0))
    .stop();
  run();
};
