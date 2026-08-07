/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CAPABILITIES } from "@/framework/entitlement/capabilities";
import { RequireEdition } from "@/framework/entitlement/RequireEdition";
import type { Entitlement } from "@/framework/entitlement/types";

const contextState = vi.hoisted(() => ({
  loading: false,
  snapshot: null as Entitlement | null,
}));

vi.mock("@/framework/entitlement/use-entitlement", () => ({
  useEntitlementContext: () => contextState,
}));

vi.mock("react-i18next", async (importOriginal) => {
  const original = await importOriginal<typeof import("react-i18next")>();
  return { ...original, useTranslation: () => ({ t: (key: string) => key }) };
});

vi.mock("react-router-dom", async (importOriginal) => {
  const original = await importOriginal<typeof import("react-router-dom")>();
  return { ...original, useNavigate: () => vi.fn() };
});

function entitlement(overrides: Partial<Entitlement>): Entitlement {
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

const CONTINUE = "common.entitlement.continueAnyway";

beforeEach(() => {
  contextState.loading = false;
  contextState.snapshot = null;
});

function renderGuard(capability: string, minEdition: "professional" | "enterprise") {
  render(
    <RequireEdition capability={capability} minEdition={minEdition}>
      <p>protected</p>
    </RequireEdition>,
  );
}

describe("RequireEdition · 快照缺席", () => {
  // 空白内容区说不清是加载中、还是端点根本不存在,用户只能去查路由配置。
  it("加载中给骨架,不留白", () => {
    contextState.loading = true;

    const { container } = render(
      <RequireEdition capability={CAPABILITIES.BUSINESS_PROVENANCE} minEdition="enterprise">
        <p>protected</p>
      </RequireEdition>,
    );

    expect(container.querySelector(".ant-skeleton")).not.toBeNull();
  });

  // 拉取失败后 Provider 停在 null 且没有重试触发点,得说清原因。
  it("拉取失败给未知态说明", () => {
    renderGuard(CAPABILITIES.BUSINESS_PROVENANCE, "enterprise");

    expect(screen.getByText("common.entitlement.unknownTitle")).toBeTruthy();
  });
});

describe("RequireEdition · 判不出镜像状态时留出口", () => {
  /*
    业务溯源由 bkn-trace 实现,bkn-safe 的清单里从来没有它(ee-design.md §6)。买了企业证、
    也换过企业包的客户照样会走到蒙版,而前端永远确认不了——没有出口就是把已付费功能永久
    锁死,而不是提示。
  */
  it("档位够但确认不了 → 可以「仍要继续」", () => {
    contextState.snapshot = entitlement({
      edition: "enterprise",
      licensed: true,
      state: "valid",
    });

    renderGuard(CAPABILITIES.BUSINESS_PROVENANCE, "enterprise");

    expect(screen.queryByText("protected")).not.toBeNull(); // 蒙版底下照常渲染
    fireEvent.click(screen.getByRole("button", { name: CONTINUE }));

    expect(screen.queryByText("common.entitlement.imageLikelyHint")).toBeNull();
  });

  // 档位不够是前端能确定的事,放进去服务端也会拒——这时给出口只会让人白跑一趟。
  it("档位不够 → 不给出口", () => {
    contextState.snapshot = entitlement({});

    renderGuard(CAPABILITIES.BUSINESS_PROVENANCE, "enterprise");

    expect(screen.queryByRole("button", { name: CONTINUE })).toBeNull();
  });
});

describe("RequireEdition · 能力确实可用", () => {
  it("证够了、镜像里也有 → 直接放行", () => {
    contextState.snapshot = entitlement({
      capabilities: [CAPABILITIES.RBAC_BASIC],
      edition: "professional",
      extensions: [CAPABILITIES.RBAC_BASIC],
      licensed: true,
      state: "valid",
    });

    renderGuard(CAPABILITIES.RBAC_BASIC, "professional");

    expect(screen.queryByText("protected")).not.toBeNull();
    expect(screen.queryByText("common.entitlement.unlockTitle")).toBeNull();
  });
});
