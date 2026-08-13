/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { normalizeCompareState, orderSides, toggleSide, visibleSides } from "./compare-state";

describe("normalizeCompareState", () => {
  it("空值给默认组：基础数据 vs 业务知识网络，全部同问", () => {
    expect(normalizeCompareState(undefined)).toEqual({ on: false, sides: ["base", "kn"], target: "all" });
  });

  it("旧结构 target=both 迁移成 all", () => {
    expect(normalizeCompareState({ on: true, target: "both" })).toEqual({
      on: true,
      sides: ["base", "kn"],
      target: "all",
    });
  });

  it("旧结构带 PTC 开关时迁成知识网络 vs PTC，不静默换回默认组", () => {
    expect(normalizeCompareState({ on: true, target: "both" }, { ptcOn: true }).sides).toEqual(["kn", "ptc"]);
  });

  it("旧结构的单侧目标保留", () => {
    expect(normalizeCompareState({ on: true, target: "kn" }).target).toBe("kn");
  });

  it("目标指向未参与的一侧时退回全部同问", () => {
    expect(normalizeCompareState({ on: true, sides: ["base", "kn"], target: "ptc" }).target).toBe("all");
  });

  it("参与方按规范顺序排，存进去的顺序不影响栏位顺序", () => {
    expect(normalizeCompareState({ sides: ["ptc", "base", "kn"] }).sides).toEqual(["base", "kn", "ptc"]);
  });

  it("参与方不足两个时退回默认组", () => {
    expect(normalizeCompareState({ sides: ["ptc"] }).sides).toEqual(["base", "kn"]);
  });

  it("非法值一律丢掉，不进 sides", () => {
    expect(normalizeCompareState({ sides: ["base", "kn", "nope", 7, null] }).sides).toEqual(["base", "kn"]);
  });

  it("on 只认 true，缺省为关", () => {
    expect(normalizeCompareState({ on: "yes" }).on).toBe(false);
    expect(normalizeCompareState({ on: true }).on).toBe(true);
  });
});

describe("visibleSides", () => {
  it("全部同问渲染所有参与方", () => {
    expect(visibleSides({ on: true, sides: ["base", "kn", "ptc"], target: "all" })).toEqual([
      "base",
      "kn",
      "ptc",
    ]);
  });

  it("单侧补发只渲染那一栏", () => {
    expect(visibleSides({ on: true, sides: ["base", "kn", "ptc"], target: "kn" })).toEqual(["kn"]);
  });
});

describe("toggleSide", () => {
  it("勾选第三个模式后按规范顺序落位", () => {
    const next = toggleSide({ on: true, sides: ["base", "kn"], target: "all" }, "ptc");
    expect(next.sides).toEqual(["base", "kn", "ptc"]);
  });

  it("取消到只剩两个后拒绝再取消——一侧不成对比", () => {
    const state = { on: true, sides: ["base", "kn"] as const, target: "all" as const };
    expect(toggleSide({ ...state, sides: [...state.sides] }, "kn")).toEqual({
      on: true,
      sides: ["base", "kn"],
      target: "all",
    });
  });

  it("取消掉的正是当前发送目标时退回全部同问", () => {
    const next = toggleSide({ on: true, sides: ["base", "kn", "ptc"], target: "ptc" }, "ptc");
    expect(next).toEqual({ on: true, sides: ["base", "kn"], target: "all" });
  });

  it("取消非目标的一侧时保留目标", () => {
    const next = toggleSide({ on: true, sides: ["base", "kn", "ptc"], target: "ptc" }, "base");
    expect(next).toEqual({ on: true, sides: ["kn", "ptc"], target: "ptc" });
  });
});

describe("orderSides", () => {
  it("去重并按能力从弱到强排", () => {
    expect(orderSides(["ptc", "ptc", "base"])).toEqual(["base", "ptc"]);
  });
});
