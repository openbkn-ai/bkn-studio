/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import type { Entitlement } from "@/framework/entitlement/types";
import {
  CAPABILITY_CATALOG,
  capabilitiesIntroducedBy,
} from "@/modules/subscription/capability-catalog";
import { clusterCapabilityStatus } from "@/modules/subscription/cluster-capability-status";

const eeBuild: Entitlement = {
  capabilities: ["rbac_basic"],
  edition: "professional",
  extensions: ["rbac_basic", "perm_object_level"],
  features: ["rbac_basic", "source_sync"],
  licensed: true,
  limits: {},
  state: "valid",
};

describe("clusterCapabilityStatus", () => {
  it("在 capabilities 里 = 可用", () => {
    expect(clusterCapabilityStatus("rbac_basic", eeBuild, "ready")).toBe("available");
  });

  // 镜像里有、档位不够——换一张证就能用,这是唯一该出商务信息的状态。
  it("只在 extensions 里 = 需升级", () => {
    expect(clusterCapabilityStatus("perm_object_level", eeBuild, "ready")).toBe(
      "not-licensed",
    );
  });

  // 两个都不在 = 这个二进制根本没装,换证也没用,得换镜像。
  it("两个列表都没有 = 不可用", () => {
    expect(clusterCapabilityStatus("audit", eeBuild, "ready")).toBe("not-installed");
  });

  // 快照没到时报「不可用」,会对着一个其实买了的客户显示未安装。
  it("快照未到一律未知,不借兜底下结论", () => {
    expect(clusterCapabilityStatus("rbac_basic", eeBuild, "loading")).toBe("unknown");
    expect(clusterCapabilityStatus("audit", eeBuild, "loading")).toBe("unknown");
  });
});

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
