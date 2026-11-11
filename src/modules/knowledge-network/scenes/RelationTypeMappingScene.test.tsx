/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import type { PropsWithChildren, ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

type Ends = { sourceObjectTypeId: string; targetObjectTypeId: string };

const mocks = vi.hoisted(() => ({
  confirm: vi.fn(),
  error: vi.fn(),
  getDetail: vi.fn(),
  navigate: vi.fn(),
  // Stable, as the real one is: the page reads again when it changes.
  translate: (key: string) => key,
  update: vi.fn(),
}));

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: mocks.translate }),
}));

vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router-dom")>()),
  useNavigate: () => mocks.navigate,
  useParams: () => ({ networkId: "clinic", relationTypeId: "colleague" }),
}));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({
    message: { error: mocks.error, success: vi.fn() },
    modal: { confirm: mocks.confirm },
  }),
}));

vi.mock("@/modules/knowledge-network/services/knowledge-network.service", () => ({
  getKnowledgeNetworkRelationTypeDetail: mocks.getDetail,
  listKnowledgeNetworkObjectTypes: vi.fn().mockResolvedValue([]),
  updateKnowledgeNetworkRelationType: mocks.update,
}));

// The mapping editor is tested on its own; here it moves the target to another object type.
vi.mock("@/modules/knowledge-network/components/relation-type/RelationTypeMappingEditor", () => ({
  buildRelationTypeMappingRulesFromDetail: (detail: Ends) => ({
    sourceObjectTypeId: detail.sourceObjectTypeId,
    targetObjectTypeId: detail.targetObjectTypeId,
  }),
  createDefaultRelationTypeMappingValues: () => ({
    mappingMode: "direct",
    mappingRules: { sourceObjectTypeId: "", targetObjectTypeId: "" },
  }),
  normalizeRelationTypeMappingValues: (value: unknown) => value,
  RelationTypeMappingEditor: ({
    onChange,
    semantics,
    value,
  }: {
    onChange: (value: unknown) => void;
    semantics?: ReactNode;
    value: { mappingMode: string; mappingRules: Ends };
  }) => (
    <div>
      <button
        onClick={() =>
          onChange({
            ...value,
            mappingRules: { ...value.mappingRules, targetObjectTypeId: "nurse" },
          })
        }
        type="button"
      >
        move target
      </button>
      <section aria-label="semantics">{semantics}</section>
      <section aria-label="mapping rules" />
    </div>
  ),
  validateRelationTypeMappingValues: () => null,
}));

vi.mock(
  "@/modules/knowledge-network/components/shared/KnowledgeNetworkResourceConfigShell",
  () => ({
    KnowledgeNetworkResourceConfigShell: ({
      actions,
      children,
    }: PropsWithChildren<{ actions: ReactNode }>) => (
      <div>
        {actions}
        {children}
      </div>
    ),
  }),
);

import { renderWithoutAntdStyles } from "@/test/render-without-antd-styles";

import { RelationTypeMappingScene } from "./RelationTypeMappingScene";

// A symmetric relation from doctors to doctors.
const detail = {
  color: "#7c3aed",
  declarations: { cardinality: "many_to_many", characteristics: ["symmetric"] },
  description: "",
  id: "colleague",
  mappingMode: "direct",
  name: "同事",
  propertyMappings: [],
  resourceMappings: [],
  sourceObjectTypeId: "doctor",
  sourceObjectTypeName: "医生",
  tags: [],
  targetObjectTypeId: "doctor",
  targetObjectTypeName: "医生",
  updateTime: "",
  updaterName: "",
};

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

beforeEach(() => {
  mocks.getDetail.mockResolvedValue(detail);
  mocks.update.mockResolvedValue(null);
  mocks.confirm.mockImplementation(({ onOk }: { onOk: () => void }) => onOk());
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderScene() {
  renderWithoutAntdStyles(
    <MemoryRouter>
      <RelationTypeMappingScene />
    </MemoryRouter>,
  );
}

async function save() {
  fireEvent.click(await screen.findByRole("button", { name: "common.save" }));
}

describe("RelationTypeMappingScene", () => {
  it("sends no declaration when the ends stay as they were", async () => {
    renderScene();
    await save();

    await waitFor(() => expect(mocks.update).toHaveBeenCalled());
    expect(mocks.update.mock.calls[0][2]).not.toHaveProperty("declarationEdit");
  });

  it("clears the characteristics new ends no longer allow, and says so before saving", async () => {
    renderScene();
    fireEvent.click(await screen.findByRole("button", { name: "move target" }));

    expect(
      await screen.findByText("knowledgeNetwork.relationDeclarations.cleared.ends"),
    ).toBeInTheDocument();
    await save();

    await waitFor(() => expect(mocks.update).toHaveBeenCalled());
    expect(mocks.update.mock.calls[0][2]).toMatchObject({
      declarationEdit: { baseline: detail.declarations, current: { cardinality: "many_to_many" } },
      targetObjectTypeId: "nurse",
    });
  });

  it("puts the semantics among the mapping and the advanced settings after it", async () => {
    renderScene();

    const semantics = await screen.findByRole("region", { name: "semantics" });
    expect(
      within(semantics).getByText("knowledgeNetwork.relationDeclarations.cardinality"),
    ).toBeInTheDocument();
    const advanced = screen.getByText("knowledgeNetwork.relationDeclarations.advanced");
    const rules = screen.getByRole("region", { name: "mapping rules" });
    expect(rules.compareDocumentPosition(advanced) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("shows a declaration refusal with links to what it names, not as a toast", async () => {
    mocks.update.mockRejectedValue({
      response: {
        data: {
          description: "Invalid declarations",
          error_code: "BknBackend.RelationType.InvalidParameter.Declarations",
          error_details:
            'relation type "colleague" is the fallback_for of relation type "colleague_by_phone"',
        },
        status: 400,
      },
    });
    renderScene();
    await save();

    expect(await screen.findByRole("link")).toHaveAttribute(
      "href",
      "/knowledge-network/workspace/clinic/relation-types/colleague_by_phone/detail",
    );
    expect(mocks.error).not.toHaveBeenCalled();
  });
});
