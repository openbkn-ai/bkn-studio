/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import type { Entitlement } from "@/framework/entitlement/types";
import {
  capabilitySatisfied,
  upgradeReason,
} from "@/framework/entitlement/upgrade-reason";

/** 客户实际会处在的三种部署组合,加上「都齐了」那种。 */
function deployment(overrides: Partial<Entitlement>): Entitlement {
  return {
    capabilities: [],
    edition: "community",
    extensions: [],
    features: [],
    licensed: false,
    limits: {},
    state: "unlicensed",
    ...overrides,
  };
}

const RBAC = "rbac_basic";

describe("upgradeReason — 三种部署组合", () => {
  // 1. 无授权、无镜像:社区版的常态。要买证,也要换镜像,但第一步是买。
  it("无授权 + 社区镜像 → 买证书", () => {
    expect(upgradeReason(RBAC, deployment({}), "professional", true)).toBe("buy");
  });

  // 2. 有授权、无镜像:证是专业版,跑的还是社区包。这时劝人升级证书就把人指错了地方。
  it("有授权 + 社区镜像 → 升级镜像", () => {
    const snapshot = deployment({ edition: "professional", licensed: true, state: "valid" });

    expect(upgradeReason(RBAC, snapshot, "professional", true)).toBe("image");
  });

  // 3. 有授权、有镜像:能力在 capabilities 里,压根不会弹这个窗;真弹了也不该说「没装」。
  it("有授权 + 企业镜像 → 不是镜像问题", () => {
    const snapshot = deployment({
      capabilities: [RBAC],
      edition: "professional",
      extensions: [RBAC],
      licensed: true,
      state: "valid",
    });

    expect(upgradeReason(RBAC, snapshot, "professional", true)).toBe("buy");
  });

  // 4. 镜像装了但档位不够:换证书,不是换镜像。
  it("镜像装了、档位不够 → 买证书", () => {
    const snapshot = deployment({
      edition: "professional",
      extensions: ["perm_object_level"],
      licensed: true,
      state: "valid",
    });

    expect(upgradeReason("perm_object_level", snapshot, "enterprise", true)).toBe("buy");
  });
});

describe("upgradeReason — 别的服务实现的能力", () => {
  /**
   * bkn-safe 的清单里从来没有它们,缺席说明不了任何事(ee-design.md §6「A 答不了 B」)。
   * 档位够却仍走到升级引导,只能给方向,不能断言「没装」。
   */
  it("档位够 → 给方向而不是结论", () => {
    const snapshot = deployment({ edition: "professional", licensed: true, state: "valid" });

    expect(upgradeReason("connector_certified", snapshot, "professional", false)).toBe(
      "image-likely",
    );
  });

  it("档位不够 → 仍是买证书", () => {
    expect(upgradeReason("business_provenance", deployment({}), "enterprise", false)).toBe(
      "buy",
    );
  });
});

describe("upgradeReason — 快照缺席", () => {
  // 拿不到快照时不能凭空断言客户已经买了。
  it("按未购买处理", () => {
    expect(upgradeReason(RBAC, null, "professional", true)).toBe("buy");
  });
});

describe("capabilitySatisfied — 判不了就不算满足", () => {
  const licensed = deployment({ edition: "professional", licensed: true, state: "valid" });

  // 别的服务的能力确认不了镜像；「证够了但包没换」恰恰是客户最常处在的状态，
  // 当成满足会让标记消失，客户以为一切正常，点下去才发现用不了。
  it("别的服务实现的能力：档位够也不算满足", () => {
    expect(capabilitySatisfied("semantic_task", licensed, "professional", false)).toBe(false);
  });

  it("bkn-safe 的能力：证够 + 装了才算满足", () => {
    expect(capabilitySatisfied(RBAC, licensed, "professional", true)).toBe(false);

    const ready = deployment({
      capabilities: [RBAC],
      edition: "professional",
      extensions: [RBAC],
      licensed: true,
      state: "valid",
    });

    expect(capabilitySatisfied(RBAC, ready, "professional", true)).toBe(true);
  });
});
