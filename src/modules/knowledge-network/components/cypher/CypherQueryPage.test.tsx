/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

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

describe("CypherQueryPage", () => {
  it("publishes to the toolbox's workbench with the draft and a way back here", () => {
    mocks.permissions = ["execution-factory:function:edit"];
    render(<CypherQueryPage knId="supply" networkId="kn-1" />);

    lastSceneProps().onPublishFunction?.("box 1", { query: "RETURN 1", knId: "kn-1" });

    expect(mocks.navigate).toHaveBeenCalledWith("/execution-factory/toolboxes/box%201/tools", {
      state: {
        returnTo: "/knowledge-network/kn-1?section=cypher",
        cypherDraft: { query: "RETURN 1", knId: "kn-1" },
      },
    });
  });

  it("offers no publishing without the right to edit functions", () => {
    mocks.permissions = [];
    render(<CypherQueryPage knId="supply" networkId="kn-1" />);
    expect(lastSceneProps().onPublishFunction).toBeUndefined();
  });
});
