/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { renderWithoutAntdStyles } from "@/test/render-without-antd-styles";

const mocks = vi.hoisted(() => ({ list: vi.fn() }));

// Keys, with the parameters a message takes after them.
vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key} ${JSON.stringify(params)}` : key,
  }),
}));

vi.mock("@/modules/knowledge-network/services/relation-type.service", () => ({
  listKnowledgeNetworkRelationTypePage: mocks.list,
}));

import type {
  KnowledgeNetworkRelationTypeRecord,
  RelationDeclarations,
} from "@/modules/knowledge-network/types/knowledge-network";

import { RelationDeclarationsSection } from "./RelationDeclarationsSection";

const PREFIX = "knowledgeNetwork.relationDeclarations";
const sameEnds = { sourceObjectTypeId: "department", targetObjectTypeId: "department" };
const otherEnds = { sourceObjectTypeId: "lab_order", targetObjectTypeId: "patient" };

const originalMatchMedia = window.matchMedia;

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

afterAll(() => {
  window.matchMedia = originalMatchMedia;
});

afterEach(() => {
  cleanup();
  mocks.list.mockReset();
});

const relation = (
  id: string,
  declarations?: RelationDeclarations,
  extra: Partial<KnowledgeNetworkRelationTypeRecord> = {},
): KnowledgeNetworkRelationTypeRecord => ({
  color: "#7c3aed",
  declarations,
  description: "",
  id,
  mappingMode: "direct",
  name: `name of ${id}`,
  sourceObjectTypeId: "lab_order",
  sourceObjectTypeName: "检验申请",
  tags: [],
  targetObjectTypeId: "patient",
  targetObjectTypeName: "患者",
  updateTime: "",
  updaterName: "",
  ...extra,
});

/** The section as the form holds it: its value in state, each change recorded. */
function renderSection(
  initial: RelationDeclarations | undefined,
  ends: { sourceObjectTypeId: string; targetObjectTypeId: string },
) {
  const changes: Array<RelationDeclarations | undefined> = [];
  let setEnds: (next: typeof ends) => void = () => undefined;

  function Harness() {
    const [value, setValue] = useState(initial);
    const [currentEnds, setCurrentEnds] = useState(ends);
    setEnds = setCurrentEnds;
    return (
      <RelationDeclarationsSection
        ends={currentEnds}
        networkId="clinic"
        onChange={(next) => {
          changes.push(next);
          setValue(next);
        }}
        relationName="检验对象（按身份证号）"
        relationTypeId="order_for_patient_by_id_card"
        sourceName="检验申请"
        targetName="患者"
        value={value}
      />
    );
  }

  renderWithoutAntdStyles(<Harness />);
  return { changes, setEnds: (next: typeof ends) => setEnds(next) };
}

const lastChange = (changes: Array<RelationDeclarations | undefined>) => changes.at(-1);

function openSelect(label: string) {
  fireEvent.mouseDown(screen.getByRole("combobox", { name: label }));
}

describe("RelationDeclarationsSection", () => {
  it("opens for a relation that declares something, and is folded otherwise", () => {
    renderSection({ verification: "confirmed" }, otherEnds);
    expect(screen.getByRole("button", { expanded: true })).toBeTruthy();
    cleanup();

    renderSection(undefined, otherEnds);
    const header = screen.getByRole("button", { expanded: false });
    expect(within(header).getByText(`${PREFIX}.notDeclared`)).toBeTruthy();
  });

  it("says from source to target what the cardinality and the required ends mean", async () => {
    renderSection({ cardinality: "many_to_one", requiredEnds: ["source"] }, otherEnds);
    // On the hover of the cardinality's label, not in the form; each end in turn. The badge's own
    // test reads the words with the names in bold.
    expect(screen.queryByText((text) => text.includes(`${PREFIX}.count.`))).toBeNull();
    const label = screen.getByText(`${PREFIX}.cardinality`, { selector: "label" });
    fireEvent.mouseEnter(label.querySelector(".anticon") as Element);
    const text = (await screen.findByRole("tooltip")).textContent ?? "";
    expect(text.indexOf(`${PREFIX}.count.exactlyOne`)).toBeGreaterThanOrEqual(0);
    expect(text.indexOf(`${PREFIX}.count.several`)).toBeGreaterThan(
      text.indexOf(`${PREFIX}.count.exactlyOne`),
    );
  });

  it("offers characteristics only for a relation from an object type to itself", () => {
    renderSection({ cardinality: "many_to_one" }, otherEnds);
    expect(screen.queryByText(`${PREFIX}.characteristics`)).toBeNull();
    cleanup();

    renderSection({ cardinality: "many_to_one" }, sameEnds);
    expect(screen.getByText(`${PREFIX}.characteristics`)).toBeTruthy();
  });

  it("clears what a symmetric relation cannot declare once it is checked, and says so", () => {
    const { changes } = renderSection(
      { cardinality: "many_to_one", requiredEnds: ["source"], reverseName: "下辖" },
      sameEnds,
    );
    fireEvent.click(screen.getByRole("checkbox", { name: (name) => name.includes("symmetric") }));

    expect(lastChange(changes)).toEqual({ characteristics: ["symmetric"] });
    expect(screen.queryByText(`${PREFIX}.reverseName`)).toBeNull();
    expect(screen.getByText(`${PREFIX}.requiredBoth`)).toBeTruthy();
    expect(
      screen.getByText((text) => text.startsWith(`${PREFIX}.cleared.symmetric`)).textContent,
    ).toContain(`${PREFIX}.clearedName.reverseName`);
  });

  it("offers a symmetric relation only one to one and many to many", async () => {
    renderSection({ characteristics: ["symmetric"] }, sameEnds);
    openSelect(`${PREFIX}.cardinality`);

    // The options' accessible list holds their values.
    await waitFor(() =>
      expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
        "one_to_one",
        "many_to_many",
      ]),
    );
  });

  it("clears the characteristics when the ends become different, and says so", async () => {
    const { changes, setEnds } = renderSection(
      { characteristics: ["transitive"], reverseName: "下辖" },
      sameEnds,
    );
    act(() => setEnds({ sourceObjectTypeId: "department", targetObjectTypeId: "" }));
    expect(changes).toEqual([]);

    act(() => setEnds({ sourceObjectTypeId: "department", targetObjectTypeId: "doctor" }));
    await waitFor(() => expect(lastChange(changes)).toEqual({ reverseName: "下辖" }));
    expect(screen.getByText(`${PREFIX}.cleared.ends`)).toBeTruthy();
  });

  it("offers as fallback paths the active primary relations with the same ends, itself aside", async () => {
    mocks.list.mockResolvedValue({
      entries: [
        relation("order_for_patient_by_id_card", { importance: "secondary" }),
        relation("order_for_patient", { cardinality: "many_to_one" }),
        relation("order_for_patient_by_phone", { importance: "secondary" }),
        relation("order_for_patient_legacy", undefined, {
          definitionDeclarations: { lifecycle: { reason: "旧路径", status: "deprecated" } },
        }),
      ],
      totalCount: 4,
    });
    renderSection({ importance: "secondary" }, otherEnds);

    await waitFor(() =>
      expect(mocks.list).toHaveBeenCalledWith(
        "clinic",
        expect.objectContaining({
          limit: -1,
          sourceObjectTypeId: "lab_order",
          targetObjectTypeId: "patient",
        }),
      ),
    );
    openSelect(`${PREFIX}.fallbackFor`);
    await waitFor(() =>
      expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
        "order_for_patient",
      ]),
    );
    expect(
      screen.getByText(
        `${PREFIX}.fallbackForOption {"id":"order_for_patient","name":"name of order_for_patient"}`,
      ),
    ).toBeTruthy();
  });

  it("drops the fallback path when the relation becomes primary", () => {
    mocks.list.mockResolvedValue({ entries: [], totalCount: 0 });
    const { changes } = renderSection(
      { fallbackFor: "order_for_patient", importance: "secondary", verification: "unconfirmed" },
      otherEnds,
    );
    fireEvent.click(screen.getByRole("radio", { name: `${PREFIX}.importanceOption.primary` }));

    expect(lastChange(changes)).toEqual({
      fallbackFor: undefined,
      importance: undefined,
      verification: "unconfirmed",
    });
    expect(screen.queryByText(`${PREFIX}.fallbackFor`)).toBeNull();
  });

  it("does not edit the verification, and keeps one a BKN file declares", () => {
    mocks.list.mockResolvedValue({ entries: [], totalCount: 0 });
    const { changes } = renderSection({ verification: "confirmed" }, otherEnds);
    expect(screen.queryByText(`${PREFIX}.verification`)).toBeNull();

    fireEvent.click(screen.getByRole("radio", { name: `${PREFIX}.importanceOption.secondary` }));
    expect(lastChange(changes)).toMatchObject({
      importance: "secondary",
      verification: "confirmed",
    });
  });

  it("keeps a reverse name to the backend's length", () => {
    renderSection({ verification: "confirmed" }, otherEnds);
    const input = screen.getByRole<HTMLInputElement>("textbox");
    expect(input.maxLength).toBe(40);
  });
});
