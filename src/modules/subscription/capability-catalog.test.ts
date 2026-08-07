/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { CAPABILITIES } from "@/framework/entitlement/capabilities";
import {
  CAPABILITY_CATALOG,
  capabilitiesIntroducedBy,
} from "@/modules/subscription/capability-catalog";
import { resolveQuota } from "@/modules/subscription/subscription-plans";

describe("capability catalog", () => {
  // 登记表里 planned 的行(sso / explorer 等)对客户不可见——写进版本对比页就是在卖
  // 还没有的东西。business_provenance 不在此列:产品决定按企业能力在售(2026-08-06),
  // 上游登记表转 active 之前,页面先按在售展示。
  it("不收录任何 planned 能力", () => {
    const keys = CAPABILITY_CATALOG.map((entry) => entry.key);

    for (const planned of [
      // 上游 e8fdf2f 退回 planned:EE 侧从未实现,页面不该在卖
      "audit",
      "branding",
      "ops_dashboard",
      "bigdata_connect",
      "explorer",
      "multi_tenant",
      "offline_bundle",
      "sso",
      "version_mgmt",
    ]) {
      expect(keys).not.toContain(planned);
    }
  });

  it("key 不重复,档位分布与上游登记表一致", () => {
    const keys = CAPABILITY_CATALOG.map((entry) => entry.key);

    expect(new Set(keys).size).toBe(keys.length);
    expect(capabilitiesIntroducedBy("industry")).toEqual([]);
    expect(capabilitiesIntroducedBy("community")).toHaveLength(1);
    expect(capabilitiesIntroducedBy("professional")).toHaveLength(3);
    expect(capabilitiesIntroducedBy("enterprise")).toHaveLength(2);
  });

  /**
   * `/api/safe/v1/capabilities` 只描述 bkn-safe 自己的镜像(ee-design.md §6「A 答不了 B」),
   * 所以标成 bkn-safe 的那几条必须与 ee-features.md 的能力总账一致——多标一条,页面就会对
   * 别的服务的能力下「当前镜像不含」的错误结论。
   */
  it("只有 bkn-safe 实现的能力标为可实测", () => {
    const served = CAPABILITY_CATALOG.filter((entry) => entry.servedBy === "bkn-safe").map(
      (entry) => entry.key,
    );

    expect(served.sort()).toEqual(["perm_object_level", "rbac_basic"]);
  });

  // 常量表里的每个 key 都要在册,否则页面上少一行在售能力。
  it("覆盖 CAPABILITIES 里的每个 key", () => {
    const keys = CAPABILITY_CATALOG.map((entry) => entry.key);

    for (const key of Object.values(CAPABILITIES)) {
      expect(keys).toContain(key);
    }
  });

});

describe("resolveQuota", () => {
  // 合同可以覆盖默认配额（ee-design.md §3.3：行业版定制只能落在 limits 上），
  // 所以当前档位必须以证书为准，照静态表印会和客户签的合同对不上。
  it("证书里的值覆盖产品默认值", () => {
    expect(resolveQuota(100, 500)).toBe(500);
  });

  it("-1 表示不限", () => {
    expect(resolveQuota(100, -1)).toBeNull();
    expect(resolveQuota(null, undefined)).toBeNull();
  });

  // 证书判定语义里「缺失 = 0（不允许）」，但这里是展示：没写就退回默认值。
  // 显示成 0 方向正好反了，而产品侧今天根本没有配额判定（§3.5）。
  it("证书没写这项时退回默认值，不当成 0", () => {
    expect(resolveQuota(100, undefined)).toBe(100);
  });

  it("证书显式写 0 时照实显示", () => {
    expect(resolveQuota(100, 0)).toBe(0);
  });
});
