/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EntitlementContext } from "@/framework/entitlement/entitlement-context";
import { FALLBACK_ENTITLEMENT, type Entitlement } from "@/framework/entitlement/types";

import { CypherQueryPage } from "./CypherQueryPage";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  permissions: [] as string[],
  sceneProps: vi.fn(),
}));

vi.mock("react-router-dom", () => ({
  useLocation: () => ({ pathname: "/knowledge-network/kn-1", search: "?section=cypher" }),
  useNavigate: () => mocks.navigate,
}));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({ runtimeConfig: { currentUser: { permissions: mocks.permissions } } }),
}));

vi.mock("@/modules/knowledge-network/components/cypher/CypherQueryScene", () => ({
  CypherQueryScene: (props: unknown) => {
    mocks.sceneProps(props);
    return null;
  },
}));

type SceneProps = {
  onPublishFunction?: (boxId: string, draft: { query: string; knId: string }) => void;
};

function lastSceneProps(): SceneProps {
  return mocks.sceneProps.mock.calls.at(-1)?.[0] as SceneProps;
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const professional: Entitlement = {
  ...FALLBACK_ENTITLEMENT,
  edition: "professional",
  licensed: true,
  state: "valid",
};

function renderPage(snapshot: Entitlement | null) {
  render(
    <EntitlementContext.Provider value={{ loading: false, refresh: async () => {}, snapshot }}>
      <CypherQueryPage knId="supply" networkId="kn-1" />
    </EntitlementContext.Provider>,
  );
}

describe("CypherQueryPage", () => {
  it("publishes to the toolbox's workbench with the draft and a way back here", () => {
    mocks.permissions = ["execution-factory:function:edit"];
    renderPage(professional);

    lastSceneProps().onPublishFunction?.("box 1", { query: "RETURN 1", knId: "kn-1" });

    expect(mocks.navigate).toHaveBeenCalledWith("/execution-factory/toolboxes/box%201/tools", {
      state: {
        returnTo: "/knowledge-network/kn-1?section=cypher",
        cypherDraft: { query: "RETURN 1", knId: "kn-1" },
      },
    });
  });

  it.each([
    { edition: "Community", snapshot: FALLBACK_ENTITLEMENT },
    { edition: "expired Professional", snapshot: { ...professional, licensed: false } },
    { edition: "unknown", snapshot: null },
  ])("offers no publishing with $edition even when the role can edit", ({ snapshot }) => {
    mocks.permissions = ["execution-factory:function:edit"];
    renderPage(snapshot);

    expect(lastSceneProps().onPublishFunction).toBeUndefined();
  });

  it("offers no publishing without the right to edit functions", () => {
    mocks.permissions = [];
    renderPage(professional);
    expect(lastSceneProps().onPublishFunction).toBeUndefined();
  });
});
