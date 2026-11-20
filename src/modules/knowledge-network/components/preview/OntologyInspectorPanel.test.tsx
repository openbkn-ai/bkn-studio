/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { cleanup, screen, waitFor, within } from "@testing-library/react";
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

import { getKnowledgeNetworkObjectTypeDetail } from "@/modules/knowledge-network/services/knowledge-network.service";
import { renderWithoutAntdStyles } from "@/test/render-without-antd-styles";
import type { ObjectTypeDataProperty } from "@/modules/knowledge-network/types/object-type";
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

function renderPanel(selectedId: string | null, eventClassIds?: ReadonlySet<string>) {
  renderWithoutAntdStyles(
    <MemoryRouter>
      <OntologyInspectorPanel
        eventClassIds={eventClassIds}
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
    // The replacement line and the other end of each relation both open the replacing type.
    const replacement = screen.getByText(
      /knowledgeNetwork.definitionDeclarations.bannerReplacedBy/,
    );
    expect(within(replacement).getByRole("link", { name: "患者" })).toHaveAttribute(
      "href",
      "/knowledge-network/workspace/clinic/object-types/patient/detail",
    );
    // The reason is on the tag only: the panel is narrow.
    expect(screen.queryByText(/并入患者/)).toBeNull();
  });

  it("links the selected type, its relations and their other end to their detail pages", () => {
    renderPanel("patient");

    const base = "/knowledge-network/workspace/clinic";
    const href = (name: string) => screen.getAllByText(name)[0].closest("a")?.getAttribute("href");
    expect(href("患者")).toBe(`${base}/object-types/patient/detail`);
    expect(href("入院")).toBe(`${base}/relation-types/admitted/detail`);
    expect(href("住院患者")).toBe(`${base}/object-types/inpatient/detail`);
  });

  it("tags event classes in its list and when selected", () => {
    renderPanel(null, new Set(["inpatient"]));

    const tags = screen.getAllByTestId("event-class-tag");
    expect(tags).toHaveLength(1);
    expect(tags[0].closest("button")?.textContent).toContain("住院患者");

    cleanup();
    renderPanel("inpatient", new Set(["inpatient"]));
    expect(screen.getByTestId("event-class-tag")).toBeInTheDocument();
  });

  it("tags the deprecated relations of the selected type", () => {
    renderPanel("patient");

    const tags = screen.getAllByText(TAG);
    expect(tags).toHaveLength(1);
    expect(tags[0].closest("span[class]")?.parentElement?.textContent).toContain("入院（旧）");
  });

  it("keeps each relation on one line, with its full name on hover and no cardinality", () => {
    renderPanel("patient");

    // The panel is narrow: cardinality shows in the relation's own drawer instead.
    expect(screen.queryByText(/^[1N]:[1N]$/)).toBeNull();
    expect(screen.getByText("入院（旧）")).toHaveAttribute("title", "入院（旧）");
  });

  it("leads each property with its display name and keeps the name beside it", async () => {
    const property = {
      displayKey: false,
      incrementalKey: false,
      primaryKey: false,
      type: "string",
    };
    const dataProperties: ObjectTypeDataProperty[] = [
      { ...property, displayName: "审核日期", name: "auditdate", type: "timestamp" },
      // No display name, or the same as the name: the name shows once.
      { ...property, displayName: "", name: "billno" },
      { ...property, displayName: "id", name: "id", primaryKey: true },
    ];
    vi.mocked(getKnowledgeNetworkObjectTypeDetail).mockResolvedValueOnce({
      ...objectTypes[0],
      dataProperties,
      displayKey: "",
      incrementalKey: "",
      logicProperties: [],
      operations: [],
      primaryKeys: ["id"],
    });
    renderPanel("patient");

    const row = (await screen.findByText("审核日期")).closest("div");
    expect(row?.textContent).toBe("审核日期auditdatetimestamp");
    await waitFor(() => expect(screen.getAllByText("billno")).toHaveLength(1));
    expect(screen.getAllByText("id")).toHaveLength(1);
    expect(screen.getByText("id").parentElement?.textContent).toBe("idPK");
  });
});
