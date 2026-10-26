/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { bknProjectKbMode } from "@/framework/entitlement/bkn-project-kb-mode";
import { BknProjectKbBadge, BknProjectKbSlot } from "@/framework/entitlement/BknProjectKbSlot";
import { CAPABILITIES } from "@/framework/entitlement/capabilities";
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
  return {
    ...original,
    useNavigate: () => vi.fn(),
    useLocation: () => ({ pathname: "/", search: "", hash: "", key: "k", state: null }),
  };
});

const KB = CAPABILITIES.KNOWLEDGE_BASE;
const EXT = CAPABILITIES.BKN_PROJECT_KB;

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

/** 社区版镜像:扩展没装。 */
const mirror = entitlement({ licensed: true, state: "valid" });
/** 专业版镜像 + 社区版授权:装了没买。 */
const communityLicensed = entitlement({ extensions: [EXT, KB], licensed: true, state: "valid" });
/** 专业版授权。 */
const professional = entitlement({
  capabilities: [EXT, KB],
  edition: "professional",
  extensions: [EXT, KB],
  licensed: true,
  state: "valid",
});

function renderSlot(props: { knowledgeBaseUnavailable?: boolean } = {}) {
  return render(
    <>
      <span>
        <BknProjectKbBadge>concept-model</BknProjectKbBadge>
      </span>
      <BknProjectKbSlot preview={<p>preview</p>} {...props}>
        <button type="button">extract</button>
      </BknProjectKbSlot>
    </>,
  );
}

beforeEach(() => {
  contextState.loading = false;
  contextState.snapshot = null;
});

describe("bknProjectKbMode", () => {
  it("maps the capability state onto hidden, locked and enabled", () => {
    expect(bknProjectKbMode(null)).toBe("hidden");
    expect(bknProjectKbMode(mirror)).toBe("hidden");
    expect(bknProjectKbMode(communityLicensed)).toBe("locked");
    expect(bknProjectKbMode(professional)).toBe("enabled");
  });
});

describe("BknProjectKbSlot", () => {
  it("shows no professional entry, badge or copy in the community mirror", () => {
    contextState.snapshot = mirror;
    const { container } = renderSlot();

    expect(container.textContent).toBe("");
    expect(container.querySelector(".console-edition-badge")).toBeNull();
  });

  it("shows nothing while the licence snapshot is unknown", () => {
    const { container } = renderSlot();

    expect(container.textContent).toBe("");
  });

  it("badges and masks the entry under a community licence, and does not mount it", () => {
    contextState.snapshot = communityLicensed;
    const { container } = renderSlot();

    expect(container.querySelector(".console-edition-badge-professional")).not.toBeNull();
    expect(container.querySelector(".console-upgrade-mask")).not.toBeNull();
    expect(container.querySelector(".console-upgrade-locked-content")?.textContent).toBe("preview");
    expect(container.querySelector(".console-upgrade-locked-content")).toHaveAttribute("inert");
    expect(screen.queryByRole("button", { name: "extract" })).toBeNull();
    expect(screen.getByText("subscription.capabilities.bkn_project_kb.name")).toBeInTheDocument();
  });

  it("mounts nothing under the mask when no preview is given", () => {
    contextState.snapshot = communityLicensed;
    const { container } = render(
      <BknProjectKbSlot>
        <button type="button">extract</button>
      </BknProjectKbSlot>,
    );

    expect(container.querySelector(".console-upgrade-mask")).not.toBeNull();
    expect(container.querySelector(".console-upgrade-locked-content")).toBeNull();
    expect(screen.queryByRole("button", { name: "extract" })).toBeNull();
  });

  it("enables the entry with a professional licence, keeping the badge without the mask", () => {
    contextState.snapshot = professional;
    const { container } = renderSlot();

    expect(screen.getByRole("button", { name: "extract" })).toBeEnabled();
    expect(screen.getByText("concept-model")).toBeInTheDocument();
    expect(container.querySelector(".console-upgrade-mask")).toBeNull();
    expect(container.querySelector(".console-edition-badge-professional")).not.toBeNull();
  });

  it("drops the mask as soon as an imported licence reaches the snapshot", () => {
    contextState.snapshot = communityLicensed;
    const { container, rerender } = renderSlot();
    expect(container.querySelector(".console-upgrade-mask")).not.toBeNull();

    contextState.snapshot = professional;
    rerender(
      <BknProjectKbSlot preview={<p>preview</p>}>
        <button type="button">extract</button>
      </BknProjectKbSlot>,
    );
    expect(container.querySelector(".console-upgrade-mask")).toBeNull();
    expect(screen.getByRole("button", { name: "extract" })).toBeInTheDocument();
  });

  it("shows the empty state when the knowledge base module is not available", () => {
    contextState.snapshot = { ...professional, capabilities: [EXT], extensions: [EXT] };
    renderSlot();

    expect(screen.queryByRole("button", { name: "extract" })).toBeNull();
    expect(
      screen.getByText("common.entitlement.knowledgeBaseUnavailable.title"),
    ).toBeInTheDocument();
  });

  it("shows the empty state when the caller finds the knowledge base API down", () => {
    contextState.snapshot = professional;
    renderSlot({ knowledgeBaseUnavailable: true });

    expect(screen.queryByRole("button", { name: "extract" })).toBeNull();
    expect(
      screen.getByText("common.entitlement.knowledgeBaseUnavailable.description"),
    ).toBeInTheDocument();
  });
});
