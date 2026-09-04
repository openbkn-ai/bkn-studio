/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { cleanup, render, screen } from "@testing-library/react";
import type { PropsWithChildren, ReactNode } from "react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const { getConceptGroup } = vi.hoisted(() => ({
  getConceptGroup: vi.fn(),
}));

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router-dom")>()),
  useNavigate: () => vi.fn(),
  useParams: () => ({ conceptGroupId: "group-1", networkId: "network-1" }),
}));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({
    message: {
      error: vi.fn(),
      success: vi.fn(),
      warning: vi.fn(),
    },
  }),
}));

vi.mock("@/modules/knowledge-network/hooks/useKnowledgeNetworkCanModify", () => ({
  useKnowledgeNetworkOperationAccessState: () => ({
    access: { modify: true },
    isLoading: false,
  }),
}));

vi.mock("@/modules/knowledge-network/services/knowledge-network.service", () => ({
  getKnowledgeNetworkConceptGroup: getConceptGroup,
  removeObjectTypesFromKnowledgeNetworkConceptGroup: vi.fn(),
}));

vi.mock(
  "@/modules/knowledge-network/components/concept-group/ConceptGroupAddObjectTypesModal",
  () => ({ ConceptGroupAddObjectTypesModal: () => null }),
);

vi.mock(
  "@/modules/knowledge-network/components/shared/KnowledgeNetworkResourceConfigShell",
  () => ({
    KnowledgeNetworkResourceConfigShell: ({
      actions,
      children,
      loading = false,
    }: PropsWithChildren<{ actions?: ReactNode; loading?: boolean }>) => (
      <div data-loading={String(loading)} data-testid="detail-shell">
        <div data-testid="detail-header-actions">{actions}</div>
        {children}
      </div>
    ),
  }),
);

import { ConceptGroupDetailScene } from "./ConceptGroupDetailScene";

const nativeGetComputedStyle = window.getComputedStyle;

beforeAll(() => {
  vi.spyOn(window, "getComputedStyle").mockImplementation((element) =>
    nativeGetComputedStyle.call(window, element),
  );
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    addEventListener: vi.fn(),
    addListener: vi.fn(),
    dispatchEvent: vi.fn(),
    matches: false,
    media: query,
    onchange: null,
    removeEventListener: vi.fn(),
    removeListener: vi.fn(),
  }));
});

afterAll(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  cleanup();
  getConceptGroup.mockReset();
});

describe("ConceptGroupDetailScene", () => {
  it("renders Configure Permissions in the loaded detail header when authorized", async () => {
    getConceptGroup.mockResolvedValue({
      actionTypes: [],
      description: "Source data layer",
      id: "group-1",
      name: "Source Layer",
      objectTypes: [],
      relationTypes: [],
      tags: [],
      updateTime: "2026-08-20 16:09:36",
      operations: ["authorize"],
    });

    render(<ConceptGroupDetailScene />);

    expect(screen.getByTestId("detail-shell").dataset.loading).toBe("true");
    expect(await screen.findAllByText("Source Layer")).not.toHaveLength(0);
    expect(screen.getByText("knowledgeNetwork.authorizeAction")).not.toBeNull();
    expect(screen.queryByText("common.edit")).toBeNull();
    expect(screen.queryByText("knowledgeNetwork.conceptGroupExport")).toBeNull();
    expect(screen.queryByText("common.delete")).toBeNull();
  });
});
