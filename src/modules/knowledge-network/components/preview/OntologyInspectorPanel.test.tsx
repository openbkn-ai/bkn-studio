/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { cleanup, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  // Stable, as the real one is: the panel reads again when it changes.
  translate: (key: string, params?: Record<string, unknown>) =>
    params ? `${key} ${JSON.stringify(params)}` : key,
}));

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: mocks.translate }),
}));

vi.mock("@/modules/knowledge-network/services/knowledge-network.service", () => ({
  getKnowledgeNetworkObjectTypeDetail: vi.fn().mockResolvedValue(null),
}));

vi.mock(
  "@/modules/knowledge-network/components/definition-declarations/use-definition-name",
  () => ({
    useDefinitionName: () => "患者",
  }),
);

import { renderWithoutAntdStyles } from "@/test/render-without-antd-styles";
import type {
  KnowledgeNetworkObjectTypeRecord,
  KnowledgeNetworkRelationTypeRecord,
} from "@/modules/knowledge-network/types/knowledge-network";

import { OntologyInspectorPanel } from "./OntologyInspectorPanel";

afterEach(cleanup);

const deprecated = {
  lifecycle: { reason: "并入患者", replacedBy: "patient", status: "deprecated" as const },
};
const record = {
  color: "#2563eb",
  conceptGroupIds: [],
  conceptGroupNames: [],
  description: "",
  hasIndex: false,
  tags: [],
  updateTime: "",
  updaterName: "",
};
const objectTypes: KnowledgeNetworkObjectTypeRecord[] = [
  { ...record, id: "patient", name: "患者" },
  { ...record, declarations: deprecated, id: "inpatient", name: "住院患者" },
];
const relation = {
  color: "",
  description: "",
  mappingMode: "direct" as const,
  sourceObjectTypeId: "patient",
  sourceObjectTypeName: "患者",
  tags: [],
  targetObjectTypeId: "inpatient",
  targetObjectTypeName: "住院患者",
  updateTime: "",
  updaterName: "",
};
const relationTypes: KnowledgeNetworkRelationTypeRecord[] = [
  { ...relation, declarations: { cardinality: "one_to_many" }, id: "admitted", name: "入院" },
  { ...relation, definitionDeclarations: deprecated, id: "admitted_old", name: "入院（旧）" },
];

function renderPanel(selectedId: string | null) {
  renderWithoutAntdStyles(
    <MemoryRouter>
      <OntologyInspectorPanel
        networkId="clinic"
        objectTypes={objectTypes}
        onSelect={vi.fn()}
        relationTypes={relationTypes}
        selectedId={selectedId}
      />
    </MemoryRouter>,
  );
}

const TAG = "knowledgeNetwork.definitionDeclarations.deprecatedTag";

describe("OntologyInspectorPanel", () => {
  it("tags the deprecated object types in its list", () => {
    renderPanel(null);

    const tags = screen.getAllByText(TAG);
    expect(tags).toHaveLength(1);
    expect(tags[0].closest("button")?.textContent).toContain("住院患者");
  });

  it("tags a selected deprecated type, with its reason on the tag, and links what replaces it", () => {
    renderPanel("inpatient");

    // Its own tag first, then the deprecated relation's in its relations.
    const tags = screen.getAllByText(TAG);
    expect(tags).toHaveLength(2);
    expect(tags[0]).toHaveAttribute("title", "并入患者");
    expect(screen.getByRole("link", { name: "患者" })).toHaveAttribute(
      "href",
      "/knowledge-network/workspace/clinic/object-types/patient/detail",
    );
    // The reason is on the tag only: the panel is narrow.
    expect(screen.queryByText(/并入患者/)).toBeNull();
  });

  it("tags the deprecated relations of the selected type", () => {
    renderPanel("patient");

    const tags = screen.getAllByText(TAG);
    expect(tags).toHaveLength(1);
    expect(tags[0].closest("span[class]")?.parentElement?.textContent).toContain("入院（旧）");
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("shows the cardinality of a relation that declares one", () => {
    renderPanel("patient");

    // Only 入院 declares one.
    expect(screen.getAllByText(/^[1N]:[1N]$/).map((badge) => badge.textContent)).toEqual(["1:N"]);
  });
});
