/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/**
 * 对比模式的参与方状态。
 *
 * 三种模式（仅基础数据 / 业务知识网络 / PTC 代码模式）任选两个做两两对比，或三个
 * 同问。此前是「左右两栏 + 一个 PTC 开关」，只能表达其中两组，且 PTC 开关同时改
 * 变工具面与知识网络接入两个变量，得不出关于代码模式本身的结论。
 */

/** 参与对比的模式。solo 不在内——单栏不是对照组。 */
export type ComparePaneId = "base" | "kn" | "ptc";

/** 规范顺序：能力从弱到强。栏位与报告列一律按此排，换选不让已有列跳位。 */
export const COMPARE_PANE_IDS: readonly ComparePaneId[] = ["base", "kn", "ptc"];

/** 发送目标：all = 所有参与方同问，否则只补发某一侧。 */
export type CompareTarget = "all" | ComparePaneId;

export type CompareState = {
  on: boolean;
  sides: ComparePaneId[];
  target: CompareTarget;
};

/** 少于两侧就不是对比，UI 上禁止取消到只剩一个。 */
export const MIN_SIDES = 2;

const DEFAULT_SIDES: ComparePaneId[] = ["base", "kn"];

function isPaneId(value: unknown): value is ComparePaneId {
  return typeof value === "string" && (COMPARE_PANE_IDS as readonly string[]).includes(value);
}

/** 去重并按规范顺序排列。 */
export function orderSides(ids: readonly unknown[]): ComparePaneId[] {
  return COMPARE_PANE_IDS.filter((id) => ids.includes(id));
}

/**
 * 从持久化值还原，并迁移旧结构。
 *
 * 旧结构是 `{on, target: "both" | "base" | "kn"}`，参与方隐含为基础数据 + 业务知识
 * 网络，PTC 侧另由一个独立开关表达。迁移时把那个开关读进来，保证用户刷新后看到
 * 的还是切走前的那一组，而不是被静默换回默认组。
 */
export function normalizeCompareState(
  parsed: unknown,
  legacy: { ptcOn?: boolean } = {},
): CompareState {
  const raw = (parsed ?? {}) as Record<string, unknown>;
  const savedSides = Array.isArray(raw.sides) ? orderSides(raw.sides) : [];
  const sides =
    savedSides.length >= MIN_SIDES
      ? savedSides
      : legacy.ptcOn
        ? (["kn", "ptc"] as ComparePaneId[])
        : [...DEFAULT_SIDES];

  // 旧值 "both" 等于现在的 "all"；指向未参与一侧的目标一律退回全部同问，
  // 否则会出现选中的目标没有对应栏位、发送按钮点了没反应。
  const savedTarget = raw.target === "both" ? "all" : raw.target;
  const target: CompareTarget = isPaneId(savedTarget) && sides.includes(savedTarget) ? savedTarget : "all";

  return { on: raw.on === true, sides, target };
}

/** 当前该渲染哪些栏：全部同问时是所有参与方，否则只有被补发的那一侧。 */
export function visibleSides(state: CompareState): ComparePaneId[] {
  return state.target === "all" ? state.sides : [state.target];
}

/** 勾选/取消一个参与方；剩两个时拒绝再取消。 */
export function toggleSide(state: CompareState, id: ComparePaneId): CompareState {
  const on = state.sides.includes(id);
  if (on && state.sides.length <= MIN_SIDES) return state;
  const sides = on ? state.sides.filter((s) => s !== id) : orderSides([...state.sides, id]);
  // 取消掉的正是当前发送目标时退回全部同问，避免目标悬空。
  const target = state.target !== "all" && !sides.includes(state.target) ? "all" : state.target;
  return { ...state, sides, target };
}
