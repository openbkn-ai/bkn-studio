/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  CAPABILITY_CATALOG,
  capabilitiesIntroducedBy,
} from "@/modules/subscription/capability-catalog";

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

  // 后端装配表今天登记的两个 key 必须在册,否则「你的集群」列对不上任何一行。
  it("覆盖后端已装配的能力", () => {
    const keys = CAPABILITY_CATALOG.map((entry) => entry.key);

    expect(keys).toContain("rbac_basic");
    expect(keys).toContain("perm_object_level");
  });
});
