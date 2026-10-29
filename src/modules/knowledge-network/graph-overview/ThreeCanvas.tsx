/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Fog,
  LineBasicMaterial,
  LineSegments,
  PerspectiveCamera,
  Points,
  Scene,
  ShaderMaterial,
  Vector3,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

import styles from "./GraphOverviewPage.module.css";
import type { OverviewCanvasHandle, OverviewCanvasProps } from "./OverviewCanvas";
import type { LayoutReply, LayoutRequest } from "./three-layout.worker";

/*
 * The overview in three dimensions. All points are one draw call and all lines another, so tens of
 * thousands of each stay smooth; the force layout runs in a worker. Names are painted on a 2D
 * canvas laid over the scene, as on the GPU 2D canvas.
 */

/** How long the layout runs on its own before it stops; the toolbar can run it again. */
const LAYOUT_RUN_MS = 20_000;
/** Highlighted points beyond which their lines are drawn lighter. */
const MANY_LINES = 60;
/** Highlighted points up to which each line is labelled with its relation's name. */
const NAMED_LINES = 24;
/** Highlighted points up to which every one of them is named; beyond, names make room. */
const NAMED_POINTS = 12;
/** Outside a selection only hubs are named. */
const LABEL_MIN_DEGREE = 20;
/** Names drawn at most at once outside a selection. */
const MAX_LABELS = 120;
/** A press that moves less than this, in pixels, is a click rather than a rotation. */
const CLICK_SLOP = 4;
/** Camera moves, in milliseconds. */
const MOVE_MS = 500;
/** Line opacity outside a selection: in depth, lines pile up into a fog when drawn solid. */
const LINE_OPACITY = { light: 0.22, dark: 0.3 };
/** Fog from this share of the camera's distance to the target to this one: far lines fade. */
const FOG_NEAR = 0.6;
const FOG_FAR = 2.2;

const THEME = {
  light: {
    background: "#f6f8fb",
    // Darker than the 2D canvases: drawn see-through and fogged, a light grey vanishes on white.
    edge: "#7d8696",
    edgeStrong: "#4a5160",
    edgeMany: "#a3abb8",
    dim: "#e2e6ec",
    label: "#333333",
    halo: "rgba(246, 248, 251, 0.9)",
    hoverBg: "#ffffff",
    hoverBorder: "rgba(0, 0, 0, 0.12)",
  },
  dark: {
    background: "#111318",
    edge: "#2b303a",
    edgeStrong: "#c9ced8",
    edgeMany: "#5c6372",
    dim: "#2a2e37",
    label: "rgba(255, 255, 255, 0.92)",
    halo: "rgba(17, 19, 24, 0.85)",
    hoverBg: "#23262d",
    hoverBorder: "rgba(255, 255, 255, 0.18)",
  },
};

const FONT = "12px Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

function hash01(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100_000) / 100_000;
}

/**
 * Point diameter in CSS pixels at the reference distance, growing with the square root of the
 * degree so a hub of thousands stands out from one of twenty.
 */
function sizeFor(degree: number): number {
  return Math.min(16, 2.5 + 0.3 * Math.sqrt(Math.max(0, degree - 1)));
}

/**
 * How strongly size follows distance: 1 is true perspective, 0 none. Below 1, moving closer
 * spreads points apart faster than it grows them, so a dense cluster opens up instead of merging.
 */
const PERSPECTIVE = 0.4;

/** On-screen size, in CSS pixels, of a point of `size` at `depth` from the camera. */
function screenSize(size: number, depth: number, reference: number): number {
  return Math.min(48, Math.max(1.5, size * (reference / Math.max(depth, 1e-3)) ** PERSPECTIVE));
}

/** Round points; nearer ones look larger, by a damped perspective (see screenSize). */
const POINT_VERTEX = `
attribute float size;
attribute vec3 tint;
uniform float ratio;
uniform float reference;
varying vec3 vTint;
void main() {
  vTint = tint;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float px = size * pow(reference / max(-mv.z, 0.001), ${PERSPECTIVE.toFixed(2)});
  gl_PointSize = size > 0.0 ? clamp(px, 1.5, 48.0) * ratio : 0.0;
  gl_Position = projectionMatrix * mv;
}`;
const POINT_FRAGMENT = `
varying vec3 vTint;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  if (dot(c, c) > 0.25) discard;
  gl_FragColor = vec4(vTint, 1.0);
}`;

type Data = {
  ids: string[];
  index: Map<string, number>;
  otIds: string[];
  labels: string[];
  degree: Uint32Array;
  linkEnds: Uint32Array;
  linkRel: string[];
  neighbours: number[][];
  incident: number[][];
  /** Hubs, most connected first: the names shown outside a selection. */
  hubs: number[];
  positions: Float32Array;
  /** Per point: drawn size (0 when hidden). Per line: whether it is drawn. */
  sizes: Float32Array;
  linkShown: Uint8Array;
  /** Highlighted points named on the overlay, and the selected point's lines. */
  named: number[];
  namedLines: number[];
};

const EMPTY: Data = {
  ids: [],
  index: new Map(),
  otIds: [],
  labels: [],
  degree: new Uint32Array(0),
  linkEnds: new Uint32Array(0),
  linkRel: [],
  neighbours: [],
  incident: [],
  hubs: [],
  positions: new Float32Array(0),
  sizes: new Float32Array(0),
  linkShown: new Uint8Array(0),
  named: [],
  namedLines: [],
};

type Engine = {
  renderer: WebGLRenderer;
  scene: Scene;
  camera: PerspectiveCamera;
  controls: OrbitControls;
  points: Points<BufferGeometry, ShaderMaterial>;
  lines: LineSegments<BufferGeometry, LineBasicMaterial>;
};

export const ThreeCanvas = forwardRef<OverviewCanvasHandle, OverviewCanvasProps>(
  function ThreeCanvas(props, ref) {
    const { nodes, edges, colorOf, hiddenTypes, selectedId, picked, dark, settled } = props;
    const containerRef = useRef<HTMLDivElement | null>(null);
    const labelsRef = useRef<HTMLCanvasElement | null>(null);
    const engineRef = useRef<Engine | null>(null);
    const dataRef = useRef<Data>(EMPTY);
    const propsRef = useRef(props);
    propsRef.current = props;
    const dirtyRef = useRef(true);
    const hoveredRef = useRef<number | null>(null);
    const workerRef = useRef<Worker | null>(null);
    const stopTimerRef = useRef<number | undefined>(undefined);
    const layoutStartedRef = useRef(false);
    const frameFirstRef = useRef(false);
    /** While the layout spreads the points, the camera backs off with them until the user steers. */
    const followRef = useRef(false);
    /** Camera distance at which points show at their given pixel size. */
    const referenceRef = useRef(1000);
    /** A camera move in progress: from, to and when it started. */
    const moveRef = useRef<{
      fromPos: Vector3;
      toPos: Vector3;
      fromTarget: Vector3;
      toTarget: Vector3;
      start: number;
    } | null>(null);

    /* ------------------------------ geometry upload ------------------------------ */

    /** Copies point positions into both buffers; hidden lines collapse onto one end. */
    const uploadPositions = () => {
      const engine = engineRef.current;
      if (!engine) return;
      const data = dataRef.current;
      const pointAttr = engine.points.geometry.getAttribute("position") as BufferAttribute;
      (pointAttr.array as Float32Array).set(data.positions);
      pointAttr.needsUpdate = true;
      const lineAttr = engine.lines.geometry.getAttribute("position") as BufferAttribute;
      const out = lineAttr.array as Float32Array;
      const p = data.positions;
      for (let l = 0; l < data.linkShown.length; l += 1) {
        const a = data.linkEnds[l * 2] * 3;
        const b = (data.linkShown[l] ? data.linkEnds[l * 2 + 1] : data.linkEnds[l * 2]) * 3;
        const o = l * 6;
        out[o] = p[a];
        out[o + 1] = p[a + 1];
        out[o + 2] = p[a + 2];
        out[o + 3] = p[b];
        out[o + 4] = p[b + 1];
        out[o + 5] = p[b + 2];
      }
      lineAttr.needsUpdate = true;
      engine.points.geometry.computeBoundingSphere();
      engine.lines.geometry.computeBoundingSphere();
      dirtyRef.current = true;
    };

    /* ------------------------------ labels ------------------------------ */

    const project = (index: number, width: number, height: number): [number, number] | null => {
      const engine = engineRef.current;
      if (!engine) return null;
      const p = dataRef.current.positions;
      const v = new Vector3(p[index * 3], p[index * 3 + 1], p[index * 3 + 2]).project(
        engine.camera,
      );
      if (v.z > 1 || v.z < -1) return null;
      return [((v.x + 1) / 2) * width, ((1 - v.y) / 2) * height];
    };

    const drawLabels = () => {
      const canvas = labelsRef.current;
      if (!canvas || !engineRef.current) return;
      const dpr = window.devicePixelRatio || 1;
      const { width, height } = canvas.getBoundingClientRect();
      if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
      }
      const context = canvas.getContext("2d");
      if (!context) return;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, width, height);
      const theme = propsRef.current.dark ? THEME.dark : THEME.light;
      const data = dataRef.current;
      context.font = FONT;
      context.textBaseline = "middle";
      const taken: [number, number, number, number][] = [];
      const fits = (x: number, y: number, w: number, h: number) =>
        !taken.some(([a, b, c, d]) => x < c && x + w > a && y < d && y + h > b);
      const label = (index: number, force: boolean): boolean => {
        const text = data.labels[index];
        if (!text || data.sizes[index] === 0) return false;
        const at = project(index, width, height);
        if (!at || at[0] < 0 || at[1] < 0 || at[0] > width || at[1] > height) return false;
        const w = context.measureText(text).width;
        const x = at[0] + 7;
        const y = at[1];
        if (!force && !fits(x - 2, y - 8, w + 4, 16)) return false;
        taken.push([x - 2, y - 8, x + w + 2, y + 8]);
        context.lineWidth = 3;
        context.strokeStyle = theme.halo;
        context.strokeText(text, x, y);
        context.fillStyle = theme.label;
        context.fillText(text, x, y);
        return true;
      };

      if (data.named.length > 0) {
        if (data.namedLines.length > 0) {
          context.font = FONT.replace("12px", "11px");
          context.textAlign = "center";
          for (const link of data.namedLines) {
            const a = project(data.linkEnds[link * 2], width, height);
            const b = project(data.linkEnds[link * 2 + 1], width, height);
            if (!a || !b) continue;
            const text = propsRef.current.relationName(data.linkRel[link]);
            context.save();
            context.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
            let angle = Math.atan2(b[1] - a[1], b[0] - a[0]);
            if (angle > Math.PI / 2 || angle < -Math.PI / 2) angle += Math.PI;
            context.rotate(angle);
            context.lineWidth = 3;
            context.strokeStyle = theme.halo;
            context.strokeText(text, 0, -6);
            context.fillStyle = theme.label;
            context.fillText(text, 0, -6);
            context.restore();
          }
          context.textAlign = "start";
          context.font = FONT;
        }
        for (const index of data.named) label(index, data.named.length <= NAMED_POINTS);
      } else {
        let count = 0;
        for (const index of data.hubs) {
          if (count >= MAX_LABELS) break;
          if (label(index, false)) count += 1;
        }
      }

      const hovered = hoveredRef.current;
      if (hovered !== null && hovered < data.ids.length) {
        const at = project(hovered, width, height);
        if (at) {
          const text = data.labels[hovered] ?? "";
          const w = context.measureText(text).width;
          context.fillStyle = theme.hoverBg;
          context.strokeStyle = theme.hoverBorder;
          context.beginPath();
          context.roundRect(at[0] + 8, at[1] - 11, w + 12, 22, 4);
          context.fill();
          context.stroke();
          context.fillStyle = theme.label;
          context.fillText(text, at[0] + 14, at[1] + 1);
        }
      }
    };

    /* ------------------------------ picking ------------------------------ */

    /** The drawn point under the pointer, the nearest to the camera among close ones. */
    const pick = (clientX: number, clientY: number): number | null => {
      const engine = engineRef.current;
      const container = containerRef.current;
      if (!engine || !container) return null;
      const rect = container.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      const data = dataRef.current;
      const camera = engine.camera;
      const reference = referenceRef.current;
      const v = new Vector3();
      let best: number | null = null;
      let bestDepth = Infinity;
      for (let i = 0; i < data.ids.length; i += 1) {
        const size = data.sizes[i];
        if (size === 0) continue;
        v.set(data.positions[i * 3], data.positions[i * 3 + 1], data.positions[i * 3 + 2]);
        const depth = v.distanceTo(camera.position);
        v.project(camera);
        if (v.z > 1 || v.z < -1) continue;
        const sx = ((v.x + 1) / 2) * rect.width;
        const sy = ((1 - v.y) / 2) * rect.height;
        const radius = Math.max(5, screenSize(size, depth, reference) / 2 + 2);
        const dx = sx - x;
        const dy = sy - y;
        if (dx * dx + dy * dy > radius * radius) continue;
        if (depth < bestDepth) {
          best = i;
          bestDepth = depth;
        }
      }
      return best;
    };

    /* ------------------------------ camera ------------------------------ */

    /** Moves the camera to frame a sphere, keeping the direction it looks from. */
    const frame = (centre: Vector3, radius: number, ms: number, whole = false) => {
      const engine = engineRef.current;
      if (!engine) return;
      const { camera, controls } = engine;
      const fov = (camera.fov * Math.PI) / 180;
      const distance = Math.max(radius, 20) / Math.sin(Math.min(fov, fov * camera.aspect) / 2);
      // Sizes are as given when the whole graph is in view; closer views grow them (damped).
      if (whole) {
        referenceRef.current = distance * 1.05;
        engine.points.material.uniforms.reference.value = referenceRef.current;
      }
      const direction = camera.position.clone().sub(controls.target).normalize();
      if (direction.lengthSq() === 0) direction.set(0, 0, 1);
      const toPos = centre.clone().add(direction.multiplyScalar(distance * 1.05));
      if (ms <= 0) {
        controls.target.copy(centre);
        camera.position.copy(toPos);
        controls.update();
        dirtyRef.current = true;
        return;
      }
      moveRef.current = {
        fromPos: camera.position.clone(),
        toPos,
        fromTarget: controls.target.clone(),
        toTarget: centre.clone(),
        start: performance.now(),
      };
    };

    /** Centre and radius of the given points; the dense part when `core` is set. */
    const sphereOf = (indices: Iterable<number>, core = false) => {
      const data = dataRef.current;
      const p = data.positions;
      const list = [...indices].filter((i) => data.sizes[i] > 0);
      if (list.length === 0) return null;
      const centre = new Vector3();
      for (const i of list) centre.add(new Vector3(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]));
      centre.divideScalar(list.length);
      const distances = list
        .map((i) => centre.distanceTo(new Vector3(p[i * 3], p[i * 3 + 1], p[i * 3 + 2])))
        .sort((a, b) => a - b);
      // Outliers stretch a plain bounding sphere; the dense part is what is worth looking at.
      const radius = core
        ? distances[Math.floor((distances.length - 1) * 0.98)]
        : distances[distances.length - 1];
      return { centre, radius };
    };

    /* ------------------------------ engine ------------------------------ */

    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;
      const renderer = new WebGLRenderer({ antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      container.appendChild(renderer.domElement);
      const scene = new Scene();
      const camera = new PerspectiveCamera(50, 1, 1, 200_000);
      camera.position.set(0, 0, 1000);
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.12;
      controls.addEventListener("change", () => {
        dirtyRef.current = true;
      });

      const points = new Points(
        new BufferGeometry(),
        new ShaderMaterial({
          uniforms: { ratio: { value: 1 }, reference: { value: 1000 } },
          vertexShader: POINT_VERTEX,
          fragmentShader: POINT_FRAGMENT,
        }),
      );
      points.frustumCulled = false;
      const lines = new LineSegments(
        new BufferGeometry(),
        new LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false }),
      );
      lines.frustumCulled = false;
      // Points over lines. The lines are see-through, which three.js draws after anything opaque,
      // so the points join that pass and come last in it.
      points.material.transparent = true;
      lines.renderOrder = 0;
      points.renderOrder = 1;
      scene.add(lines);
      scene.add(points);
      scene.fog = new Fog(0x000000, 1, 2);
      engineRef.current = { renderer, scene, camera, controls, points, lines };

      const resize = () => {
        const { width, height } = container.getBoundingClientRect();
        if (width === 0 || height === 0) return;
        renderer.setSize(width, height);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        points.material.uniforms.ratio.value = renderer.getPixelRatio();
        dirtyRef.current = true;
      };
      resize();
      const observer = new ResizeObserver(resize);
      observer.observe(container);

      let frameId = 0;
      const loop = () => {
        frameId = window.requestAnimationFrame(loop);
        const move = moveRef.current;
        if (move) {
          const t = Math.min(1, (performance.now() - move.start) / MOVE_MS);
          const eased = 1 - (1 - t) ** 3;
          camera.position.lerpVectors(move.fromPos, move.toPos, eased);
          controls.target.lerpVectors(move.fromTarget, move.toTarget, eased);
          if (t >= 1) moveRef.current = null;
          dirtyRef.current = true;
        }
        controls.update();
        if (!dirtyRef.current) return;
        const distance = camera.position.distanceTo(controls.target);
        if (scene.fog instanceof Fog) {
          scene.fog.near = distance * FOG_NEAR;
          scene.fog.far = distance * FOG_FAR;
        }
        dirtyRef.current = false;
        renderer.render(scene, camera);
        drawLabels();
      };
      loop();

      return () => {
        window.cancelAnimationFrame(frameId);
        observer.disconnect();
        window.clearTimeout(stopTimerRef.current);
        if (workerRef.current) {
          workerRef.current.terminate();
          workerRef.current = null;
          propsRef.current.onLayoutRunning(false);
        }
        // A remount (hot reload in development) lays out again from the start.
        layoutStartedRef.current = false;
        controls.dispose();
        points.geometry.dispose();
        points.material.dispose();
        lines.geometry.dispose();
        lines.material.dispose();
        renderer.dispose();
        renderer.domElement.remove();
        engineRef.current = null;
      };
      // Built once; later changes go through the effects below.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /* ------------------------------ data ------------------------------ */

    useEffect(() => {
      const engine = engineRef.current;
      if (!engine) return;
      // New data restarts the layout from where the points are.
      stopLayout();
      const previous = dataRef.current;
      const ids = nodes.map((node) => node.id);
      const index = new Map(ids.map((id, i) => [id, i]));
      const typeOrder = [...new Set(nodes.map((node) => node.otId))];
      const typeIndex = new Map(typeOrder.map((otId, i) => [otId, i]));
      // Roughly the size the layout settles at, so the first view needs no zoom later.
      const extent = 14 * Math.cbrt(Math.max(1, ids.length));
      const positions = new Float32Array(ids.length * 3);
      nodes.forEach((node, i) => {
        const old = previous.index.get(node.id);
        if (old !== undefined) {
          positions.set(previous.positions.subarray(old * 3, old * 3 + 3), i * 3);
          return;
        }
        // Each object type starts around its own point of a sphere (a Fibonacci spiral).
        const k = typeIndex.get(node.otId) ?? 0;
        const n = Math.max(1, typeOrder.length);
        const yy = n === 1 ? 0 : 1 - (2 * (k + 0.5)) / n;
        const rr = Math.sqrt(1 - yy * yy);
        const phi = k * Math.PI * (3 - Math.sqrt(5));
        const ring = n === 1 ? 0 : extent * 0.5;
        const r = extent * 0.35 * Math.cbrt(hash01(node.id));
        const theta = 2 * Math.PI * hash01(`${node.id}#`);
        const cosPhi = 2 * hash01(`${node.id}@`) - 1;
        const sinPhi = Math.sqrt(1 - cosPhi * cosPhi);
        positions[i * 3] = ring * rr * Math.cos(phi) + r * sinPhi * Math.cos(theta);
        positions[i * 3 + 1] = ring * yy + r * sinPhi * Math.sin(theta);
        positions[i * 3 + 2] = ring * rr * Math.sin(phi) + r * cosPhi;
      });
      const kept = edges.filter((edge) => index.has(edge.source) && index.has(edge.target));
      const linkEnds = new Uint32Array(kept.length * 2);
      const degree = new Uint32Array(ids.length);
      const neighbours: number[][] = ids.map(() => []);
      const incident: number[][] = ids.map(() => []);
      kept.forEach((edge, i) => {
        const a = index.get(edge.source) ?? 0;
        const b = index.get(edge.target) ?? 0;
        linkEnds[i * 2] = a;
        linkEnds[i * 2 + 1] = b;
        degree[a] += 1;
        degree[b] += 1;
        neighbours[a].push(b);
        neighbours[b].push(a);
        incident[a].push(i);
        incident[b].push(i);
      });
      const hubs = ids
        .map((_, i) => i)
        .filter((i) => degree[i] > LABEL_MIN_DEGREE)
        .sort((a, b) => degree[b] - degree[a]);
      dataRef.current = {
        ids,
        index,
        otIds: nodes.map((node) => node.otId),
        labels: nodes.map((node) => node.display),
        degree,
        linkEnds,
        linkRel: kept.map((edge) => edge.relTypeId),
        neighbours,
        incident,
        hubs,
        positions,
        sizes: new Float32Array(ids.length),
        linkShown: new Uint8Array(kept.length),
        named: [],
        namedLines: [],
      };
      const pointGeometry = new BufferGeometry();
      pointGeometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
      pointGeometry.setAttribute("tint", new BufferAttribute(new Float32Array(ids.length * 3), 3));
      pointGeometry.setAttribute("size", new BufferAttribute(new Float32Array(ids.length), 1));
      engine.points.geometry.dispose();
      engine.points.geometry = pointGeometry;
      const lineGeometry = new BufferGeometry();
      lineGeometry.setAttribute(
        "position",
        new BufferAttribute(new Float32Array(kept.length * 6), 3),
      );
      lineGeometry.setAttribute("color", new BufferAttribute(new Float32Array(kept.length * 6), 3));
      engine.lines.geometry.dispose();
      engine.lines.geometry = lineGeometry;
      // The first points are framed once their sizes are known, in the highlight effect.
      if (previous.ids.length === 0 && ids.length > 0) frameFirstRef.current = true;
      // Colours, sizes and which lines show follow in the highlight effect.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [nodes, edges]);

    /* ------------------------------ colours and highlight ------------------------------ */

    useEffect(() => {
      const engine = engineRef.current;
      if (!engine) return;
      const theme = dark ? THEME.dark : THEME.light;
      const data = dataRef.current;
      const count = data.ids.length;
      const focus = new Set<number>();
      const selected = selectedId !== null ? data.index.get(selectedId) : undefined;
      if (selected !== undefined) {
        focus.add(selected);
        for (const n of data.neighbours[selected] ?? []) focus.add(n);
      } else {
        for (const id of picked) {
          const i = data.index.get(id);
          if (i !== undefined) focus.add(i);
        }
      }
      const focusing = focus.size > 0;
      const many = focus.size > MANY_LINES;
      const tintAttr = engine.points.geometry.getAttribute("tint") as BufferAttribute;
      const sizeAttr = engine.points.geometry.getAttribute("size") as BufferAttribute;
      const tints = tintAttr.array as Float32Array;
      const sizes = sizeAttr.array as Float32Array;
      const colour = new Color();
      const dim = new Color(theme.dim);
      const byType = new Map<string, Color>();
      for (let i = 0; i < count; i += 1) {
        const otId = data.otIds[i];
        if (hiddenTypes.has(otId)) {
          sizes[i] = 0;
          continue;
        }
        let c = byType.get(otId);
        if (!c) {
          c = new Color(colorOf(otId));
          byType.set(otId, c);
        }
        const lit = !focusing || focus.has(i);
        colour.copy(lit ? c : dim);
        tints[i * 3] = colour.r;
        tints[i * 3 + 1] = colour.g;
        tints[i * 3 + 2] = colour.b;
        sizes[i] = sizeFor(data.degree[i]) * (lit ? 1 : 0.5);
      }
      data.sizes = sizes;
      tintAttr.needsUpdate = true;
      sizeAttr.needsUpdate = true;
      const lineColours = (engine.lines.geometry.getAttribute("color") as BufferAttribute)
        .array as Float32Array;
      const base = new Color(theme.edge);
      const strong = new Color(many ? theme.edgeMany : theme.edgeStrong);
      const links = data.linkRel.length;
      for (let l = 0; l < links; l += 1) {
        const a = data.linkEnds[l * 2];
        const b = data.linkEnds[l * 2 + 1];
        let shown = !hiddenTypes.has(data.otIds[a]) && !hiddenTypes.has(data.otIds[b]);
        let c = base;
        if (shown && focusing) {
          shown =
            selected !== undefined
              ? a === selected || b === selected
              : focus.has(a) && focus.has(b);
          c = strong;
        }
        data.linkShown[l] = shown ? 1 : 0;
        lineColours.set([c.r, c.g, c.b, c.r, c.g, c.b], l * 6);
      }
      engine.lines.geometry.getAttribute("color").needsUpdate = true;
      engine.scene.background = new Color(theme.background);
      if (engine.scene.fog instanceof Fog) engine.scene.fog.color = new Color(theme.background);
      // A selection's lines are few: drawn solid. Otherwise faint, so the whole stays legible.
      engine.lines.material.opacity = focusing ? 1 : LINE_OPACITY[dark ? "dark" : "light"];
      data.named = focusing ? [...focus] : [];
      data.namedLines =
        selected !== undefined && focus.size <= NAMED_LINES ? (data.incident[selected] ?? []) : [];
      uploadPositions();
      if (frameFirstRef.current) {
        frameFirstRef.current = false;
        const sphere = sphereOf(data.ids.keys(), true);
        if (sphere) frame(sphere.centre, sphere.radius, 0, true);
      }
    }, [dark, hiddenTypes, selectedId, picked, colorOf, nodes, edges]);

    /* ------------------------------ layout ------------------------------ */

    const stopWorker = () => {
      window.clearTimeout(stopTimerRef.current);
      workerRef.current?.terminate();
      workerRef.current = null;
    };

    // Always reports the stop: the toolbar must not stay on "stop" when the worker is already gone.
    const stopLayout = () => {
      stopWorker();
      propsRef.current.onLayoutRunning(false);
    };

    const runLayout = () => {
      const data = dataRef.current;
      if (data.ids.length === 0) return;
      stopWorker();
      const worker = new Worker(new URL("./three-layout.worker.ts", import.meta.url), {
        type: "module",
      });
      workerRef.current = worker;
      worker.onerror = () => {
        if (workerRef.current === worker) stopLayout();
      };
      worker.onmessage = (event: MessageEvent<LayoutReply>) => {
        if (workerRef.current !== worker) return;
        const reply = event.data;
        if (reply.type === "end") {
          stopLayout();
          return;
        }
        if (reply.positions.length === dataRef.current.positions.length) {
          dataRef.current.positions = reply.positions;
          uploadPositions();
          if (followRef.current) {
            const sphere = sphereOf(dataRef.current.ids.keys(), true);
            if (sphere) frame(sphere.centre, sphere.radius, 0, true);
          }
        }
      };
      const request: LayoutRequest = {
        type: "start",
        positions: new Float32Array(data.positions),
        links: new Uint32Array(data.linkEnds),
      };
      worker.postMessage(request);
      propsRef.current.onLayoutRunning(true);
      stopTimerRef.current = window.setTimeout(stopLayout, LAYOUT_RUN_MS);
    };

    useEffect(() => {
      if (!settled) {
        layoutStartedRef.current = false;
        return;
      }
      if (layoutStartedRef.current) return;
      layoutStartedRef.current = true;
      followRef.current = true;
      runLayout();
      // runLayout reads everything through refs.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [settled]);

    useImperativeHandle(ref, () => ({
      fit() {
        followRef.current = false;
        const sphere = sphereOf(dataRef.current.ids.keys());
        if (sphere) frame(sphere.centre, sphere.radius, MOVE_MS, true);
      },
      focus(id) {
        followRef.current = false;
        const data = dataRef.current;
        const index = data.index.get(id);
        if (index === undefined) return;
        const sphere = sphereOf([index, ...(data.neighbours[index] ?? [])]);
        if (sphere) frame(sphere.centre, sphere.radius, MOVE_MS);
      },
      runLayout,
      stopLayout,
    }));

    /* ------------------------------ pointer ------------------------------ */

    const downRef = useRef<{ x: number; y: number } | null>(null);
    const hoverScheduledRef = useRef(false);

    const onPointerDown = (event: React.PointerEvent) => {
      followRef.current = false;
      downRef.current = { x: event.clientX, y: event.clientY };
    };
    const onPointerUp = (event: React.PointerEvent) => {
      const down = downRef.current;
      downRef.current = null;
      if (!down || event.button !== 0) return;
      if (Math.hypot(event.clientX - down.x, event.clientY - down.y) > CLICK_SLOP) return;
      const hit = pick(event.clientX, event.clientY);
      if (hit === null) propsRef.current.onStageClick();
      else propsRef.current.onNodeClick(dataRef.current.ids[hit]);
    };
    const onPointerMove = (event: React.PointerEvent) => {
      if (event.buttons !== 0 || hoverScheduledRef.current) return;
      hoverScheduledRef.current = true;
      const { clientX, clientY } = event;
      window.requestAnimationFrame(() => {
        hoverScheduledRef.current = false;
        const hit = pick(clientX, clientY);
        if (hit === hoveredRef.current) return;
        hoveredRef.current = hit;
        if (containerRef.current) containerRef.current.style.cursor = hit === null ? "" : "pointer";
        dirtyRef.current = true;
      });
    };
    const onPointerLeave = () => {
      if (hoveredRef.current === null) return;
      hoveredRef.current = null;
      dirtyRef.current = true;
    };

    return (
      <div className={styles.canvasWrap}>
        <div
          ref={containerRef}
          className={styles.canvas}
          data-testid="graph-overview-canvas"
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerMove={onPointerMove}
          onPointerLeave={onPointerLeave}
          onWheel={() => {
            followRef.current = false;
          }}
        />
        <canvas ref={labelsRef} className={styles.labels} />
      </div>
    );
  },
);
