/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { PropsWithChildren, ReactNode } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const {
  getCatalogResources,
  getKnowledgeNetworkConceptGroup,
  navigate,
  translate,
  updateKnowledgeNetworkConceptGroup,
} = vi.hoisted(() => ({
  getCatalogResources: vi.fn(),
  getKnowledgeNetworkConceptGroup: vi.fn(),
  navigate: vi.fn(),
  translate: (key: string) => key,
  updateKnowledgeNetworkConceptGroup: vi.fn(),
}));

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: translate }),
}));

vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router-dom")>()),
  useNavigate: () => navigate,
  useParams: () => ({ conceptGroupId: "group-1", networkId: "network-1" }),
}));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({
    message: { error: vi.fn(), success: vi.fn() },
  }),
}));

vi.mock("@/modules/data-catalog/services/resource.service", () => ({
  getCatalogResources,
}));

vi.mock("@/modules/knowledge-network/services/knowledge-network.service", () => ({
  createKnowledgeNetworkConceptGroup: vi.fn(),
  getKnowledgeNetworkConceptGroup,
  updateKnowledgeNetworkConceptGroup,
}));

vi.mock(
  "@/modules/knowledge-network/components/shared/KnowledgeNetworkResourceConfigShell",
  () => ({
    KnowledgeNetworkResourceConfigShell: ({
      actions,
      children,
    }: PropsWithChildren<{ actions?: ReactNode }>) => (
      <div>
        {actions}
        {children}
      </div>
    ),
  }),
);

vi.mock("@/modules/knowledge-network/components/shared/ResourceColorSelect", () => ({
  DEFAULT_RESOURCE_COLOR: "#1677ff",
  ResourceColorSelect: () => <input aria-label="color" />,
}));

vi.mock("@/modules/knowledge-network/components/shared/ResourceTagsSelect", () => ({
  ResourceTagsSelect: () => <input aria-label="tags" />,
  validateKnowledgeNetworkTags: () => Promise.resolve(),
}));

import { ConceptGroupFormScene } from "./ConceptGroupFormScene";

beforeAll(() => {
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

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ConceptGroupFormScene resource authorization regression", () => {
  it.each([
    { memberCount: 0, name: "Empty group" },
    { memberCount: 1, name: "Group with members" },
  ])(
    "saves basic information for a group with $memberCount members without reading resource details",
    async ({ memberCount, name }) => {
      getKnowledgeNetworkConceptGroup.mockResolvedValue({
        actionTypes: [],
        color: "#1677ff",
        description: "Original description",
        id: "group-1",
        name,
        objectTypes: memberCount === 0 ? [] : [{ id: "object-1", name: "Customer", tags: [] }],
        relationTypes: [],
        tags: ["existing"],
      });
      getCatalogResources.mockRejectedValue(new Error("403 resource detail denied"));
      updateKnowledgeNetworkConceptGroup.mockResolvedValue(null);

      render(<ConceptGroupFormScene mode="edit" />);

      const descriptionInput = await screen.findByDisplayValue("Original description");
      fireEvent.change(descriptionInput, { target: { value: "Updated description" } });
      fireEvent.click(screen.getByRole("button", { name: "common.save" }));

      await waitFor(() => {
        expect(updateKnowledgeNetworkConceptGroup).toHaveBeenCalledWith("network-1", "group-1", {
          color: "#1677ff",
          description: "Updated description",
          name,
          tags: ["existing"],
        });
      });
      expect(navigate).toHaveBeenCalledWith(
        "/knowledge-network/workspace/network-1/concept-groups",
      );
      expect(getCatalogResources).not.toHaveBeenCalled();
    },
  );
});
