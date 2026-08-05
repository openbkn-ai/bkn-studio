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
  // 登记表里 planned 的行(sso / explorer / business_provenance 等)对客户不可见——
  // 写进版本对比页就是在卖还没有的东西。
  it("不收录任何 planned 能力", () => {
    const keys = CAPABILITY_CATALOG.map((entry) => entry.key);

    for (const planned of [
      "bigdata_connect",
      "business_provenance",
      "explorer",
      "multi_tenant",
      "offline_bundle",
      "sso",
      "version_mgmt",
    ]) {
      expect(keys).not.toContain(planned);
    }
  });

  it("key 不重复,且档位只有 professional / enterprise 两种", () => {
    const keys = CAPABILITY_CATALOG.map((entry) => entry.key);

    expect(new Set(keys).size).toBe(keys.length);
    expect(capabilitiesIntroducedBy("community")).toEqual([]);
    expect(capabilitiesIntroducedBy("industry")).toEqual([]);
    expect(capabilitiesIntroducedBy("professional")).toHaveLength(6);
    expect(capabilitiesIntroducedBy("enterprise")).toHaveLength(4);
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

    expect(served.sort()).toEqual(["audit", "perm_object_level", "rbac_basic"]);
  });

  // 后端装配表今天登记的能力必须在册且标为可实测,否则「你的集群」列对不上任何一行。
  it("覆盖后端已装配的能力,且都标成 bkn-safe", () => {
    for (const key of Object.values(CAPABILITIES)) {
      const entry = CAPABILITY_CATALOG.find((item) => item.key === key);

      expect(entry).toBeDefined();
      expect(entry?.servedBy).toBe("bkn-safe");
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
