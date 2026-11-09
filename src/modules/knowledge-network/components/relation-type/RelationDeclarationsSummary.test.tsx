/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key} ${JSON.stringify(params)}` : key,
  }),
}));

import type {
  KnowledgeNetworkRelationTypeRecord,
  RelationDeclarations,
} from "@/modules/knowledge-network/types/knowledge-network";

import { RelationDeclarationName } from "./RelationDeclarationTags";
import { RelationDeclarationsSummary } from "./RelationDeclarationsSummary";

const PREFIX = "knowledgeNetwork.relationDeclarations";
const ends = { sourceObjectTypeId: "lab_order", targetObjectTypeId: "patient" };

afterEach(cleanup);

const relation = (
  id: string,
  name: string,
  declarations?: RelationDeclarations,
): KnowledgeNetworkRelationTypeRecord => ({
  color: "#7c3aed",
  declarations,
  description: "",
  id,
  mappingMode: "direct",
  name,
  sourceObjectTypeId: "lab_order",
  sourceObjectTypeName: "检验申请",
  tags: [],
  targetObjectTypeId: "patient",
  targetObjectTypeName: "患者",
  updateTime: "",
  updaterName: "",
});

const byIdCard: RelationDeclarations = {
  cardinality: "many_to_one",
  fallbackFor: "order_for_patient",
  importance: "secondary",
  verification: "unconfirmed",
};
const primary = relation("order_for_patient", "检验对象", { cardinality: "many_to_one" });
const fallback = relation("order_for_patient_by_id_card", "检验对象（按身份证号）", byIdCard);

function renderSummary(
  id: string,
  declarations: RelationDeclarations | undefined,
  onOpen = vi.fn(),
) {
  render(
    <RelationDeclarationsSummary
      declarations={declarations}
      ends={ends}
      onOpenRelationType={onOpen}
      relationTypeId={id}
      sameEndRelationTypes={[primary, fallback]}
      sourceName="检验申请"
      targetName="患者"
    />,
  );
  return onOpen;
}

describe("RelationDeclarationsSummary", () => {
  it("links a fallback path to its primary relation, by name", () => {
    const onOpen = renderSummary(fallback.id, byIdCard);
    fireEvent.click(screen.getByRole("button", { name: "检验对象" }));

    expect(onOpen).toHaveBeenCalledWith("order_for_patient");
    expect(screen.getByText(`${PREFIX}.importanceOption.secondary`)).toBeTruthy();
    expect(screen.getByText(`${PREFIX}.verificationShort.unconfirmed`)).toBeTruthy();
  });

  it("says not declared where the relation declares nothing, and primary as the default", () => {
    renderSummary(primary.id, { cardinality: "many_to_one" });

    // Reverse name, required ends and verification.
    expect(screen.getAllByText(`${PREFIX}.notDeclared`)).toHaveLength(3);
    expect(screen.getByText(`${PREFIX}.importanceOption.primary`)).toBeTruthy();
    // Characteristics are for a relation from an object type to itself.
    expect(screen.queryByText(`${PREFIX}.characteristics`)).toBeNull();
  });

  it("lists on a primary relation the fallback paths that stand in for it", () => {
    const onOpen = renderSummary(primary.id, { cardinality: "many_to_one" });
    expect(screen.getByText(`${PREFIX}.fallbackPaths`)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "检验对象（按身份证号）" }));

    expect(onOpen).toHaveBeenCalledWith("order_for_patient_by_id_card");
  });
});

describe("RelationDeclarationName", () => {
  it("tags a secondary relation, its primary and an inferred join", () => {
    render(
      <RelationDeclarationName declarations={byIdCard} relationTypes={[primary, fallback]}>
        <span>{fallback.name}</span>
      </RelationDeclarationName>,
    );

    expect(screen.getByText(`${PREFIX}.listTag.secondary`)).toBeTruthy();
    expect(screen.getByText(`${PREFIX}.listTag.fallbackFor {"name":"检验对象"}`)).toBeTruthy();
    expect(screen.getByText(`${PREFIX}.listTag.unconfirmed`)).toBeTruthy();
  });

  it("shows only the name of a relation that is none of these", () => {
    const { container } = render(
      <RelationDeclarationName declarations={{ cardinality: "one_to_one" }} relationTypes={[]}>
        <span>{primary.name}</span>
      </RelationDeclarationName>,
    );

    expect(container.innerHTML).toBe("<span>检验对象</span>");
  });
});
