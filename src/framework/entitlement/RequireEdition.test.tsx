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

const router = vi.hoisted(() => ({
  navigate: vi.fn(),
  state: null as { returnTo?: string } | null,
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const original = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...original,
    useNavigate: () => router.navigate,
    useLocation: () => ({ pathname: "/", search: "", hash: "", key: "k", state: router.state }),
  };
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

beforeEach(() => {
  contextState.loading = false;
  contextState.snapshot = null;
  router.navigate.mockReset();
  router.state = null;
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
  it("拉取失败时独立页也带回到来源页的返回", () => {
    router.state = { returnTo: "/knowledge-network/workspace/network-1/overview" };

    renderGuard(CAPABILITIES.BUSINESS_PROVENANCE, "enterprise");
    fireEvent.click(screen.getByText("common.back"));

    expect(screen.getByText("common.entitlement.unknownTitle")).toBeTruthy();
    expect(router.navigate).toHaveBeenCalledWith("/knowledge-network/workspace/network-1/overview");
  });

  it("拉取失败给未知态说明", () => {
    renderGuard(CAPABILITIES.BUSINESS_PROVENANCE, "enterprise");

    expect(screen.getByText("common.entitlement.unknownTitle")).toBeTruthy();
  });
});

describe("RequireEdition · 核实不了镜像的能力以证书为准", () => {
  /*
    业务溯源由 bkn-trace 实现,bkn-safe 的清单里从来没有它(ee-design.md §6)。前端核实
    不了那个包,不等于那个包没装——买了企业版证、也换了企业版包的客户,不该被自己付过钱
    的功能挡在门外。
  */
  it("档位够 → 直接放行,不盖蒙版", () => {
    contextState.snapshot = entitlement({
      edition: "enterprise",
      licensed: true,
      state: "valid",
    });

    renderGuard(CAPABILITIES.BUSINESS_PROVENANCE, "enterprise");

    expect(screen.queryByText("protected")).not.toBeNull();
    expect(screen.queryByText("common.entitlement.imageMissingTitle")).toBeNull();
    expect(screen.queryByText("common.entitlement.unlockTitle")).toBeNull();
  });

  // 档位不够是前端能确定的事,这时候拦得住,也该拦。
  it("档位不够 → 拦下并给升级引导", () => {
    contextState.snapshot = entitlement({});

    renderGuard(CAPABILITIES.BUSINESS_PROVENANCE, "enterprise");

    expect(screen.getByText("common.entitlement.unlockTitle")).toBeTruthy();
  });

  it("锁定页可选择不挂载实时内容", () => {
    contextState.snapshot = entitlement({});

    render(
      <RequireEdition
        capability={CAPABILITIES.BUSINESS_PROVENANCE}
        minEdition="enterprise"
        mountLockedContent={false}
      >
        <p>protected live content</p>
      </RequireEdition>,
    );

    expect(screen.getByText("common.entitlement.unlockTitle")).toBeTruthy();
    expect(screen.queryByText("protected live content")).toBeNull();
  });

  it("锁定的独立页带回到来源页的返回", () => {
    contextState.snapshot = entitlement({});

    renderGuard(CAPABILITIES.BUSINESS_PROVENANCE, "enterprise");
    expect(screen.queryByText("common.back")).toBeNull();

    router.state = { returnTo: "/knowledge-network/workspace/network-1/experience" };
    renderGuard(CAPABILITIES.BUSINESS_PROVENANCE, "enterprise");
    fireEvent.click(screen.getByText("common.back"));
    expect(router.navigate).toHaveBeenCalledWith(
      "/knowledge-network/workspace/network-1/experience",
    );
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
