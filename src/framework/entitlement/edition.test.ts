/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { atLeast, parseEdition } from "@/framework/entitlement/edition";
import { isCommunityBuild, type Entitlement } from "@/framework/entitlement/types";

describe("atLeast", () => {
  it("lets a higher tier through a lower requirement", () => {
    expect(atLeast("enterprise", "professional")).toBe(true);
  });

  it("blocks a lower tier", () => {
    expect(atLeast("professional", "enterprise")).toBe(false);
  });

  it("treats the same tier as satisfied", () => {
    expect(atLeast("professional", "professional")).toBe(true);
  });

  // 行业版排在企业版之上,不与它并列——否则付得更多的客户反而被企业版能力挡在门外。
  it("ranks industry above enterprise", () => {
    expect(atLeast("industry", "enterprise")).toBe(true);
    expect(atLeast("enterprise", "industry")).toBe(false);
  });

  it("gates everything paid away from community", () => {
    expect(atLeast("community", "professional")).toBe(false);
    expect(atLeast("community", "community")).toBe(true);
  });
});

describe("parseEdition", () => {
  it("keeps known editions", () => {
    expect(parseEdition("enterprise")).toBe("enterprise");
  });

  // 新增档位时老前端会见到不认识的值,当社区版处理是唯一安全的选择。
  it("falls back to community for anything unknown", () => {
    expect(parseEdition("platinum")).toBe("community");
    expect(parseEdition("")).toBe("community");
    expect(parseEdition(undefined)).toBe("community");
    expect(parseEdition(42)).toBe("community");
  });
});

describe("isCommunityBuild", () => {
  const base: Entitlement = {
    capabilities: [],
    edition: "community",
    extensions: [],
    features: [],
    licensed: false,
    limits: {},
    state: "unlicensed",
  };

  it("reports a community binary when no socket is filled", () => {
    expect(isCommunityBuild(base)).toBe(true);
  });

  // 企业镜像无条件注册,不看证书——所以插座非空即代表付费实现在这个二进制里。
  it("reports an ee binary even without a licence", () => {
    expect(isCommunityBuild({ ...base, extensions: ["permobject"] })).toBe(false);
  });
});
