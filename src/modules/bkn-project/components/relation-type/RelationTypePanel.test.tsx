/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, screen, waitFor } from "@testing-library/react";
import { AxiosError, type AxiosResponse } from "axios";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  registerExtension,
  resetExtensionsForTesting,
  type ProjectRelationSourceEditor,
} from "@/framework/extension/registry";
import { mapDraft, mockDraft } from "@/modules/bkn-project/services/draft.service";
import type { Draft } from "@/modules/bkn-project/types/draft";
import type { Project } from "@/modules/bkn-project/types/project";
import type {
  RelationTypeMappingFormValues,
  RelationTypeMappingReaders,
} from "@/modules/knowledge-network/components/relation-type/RelationTypeMappingEditor";
import { renderWithoutAntdStyles } from "@/test/render-without-antd-styles";

const mocks = vi.hoisted(() => ({
  ask: vi.fn(),
  confirm: vi.fn(),
  create: vi.fn(),
  editorProps: vi.fn(),
  message: { error: vi.fn(), info: vi.fn(), success: vi.fn(), warning: vi.fn() },
  remove: vi.fn(),
  save: vi.fn(),
  suggest: vi.fn(),
  // Stable like the real `t`; options are appended so they can be asserted.
  t: (key: string, options?: object) => (options ? `${key}:${JSON.stringify(options)}` : key),
}));

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: mocks.t }),
}));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({ message: mocks.message, modal: { confirm: mocks.confirm } }),
}));

vi.mock("@/modules/bkn-project/services/draft.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/bkn-project/services/draft.service")>()),
  createDraftRelationType: mocks.create,
  deleteDraftRelationType: mocks.remove,
  saveDraftRelationType: mocks.save,
}));

vi.mock("@/modules/bkn-project/services/ask.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/bkn-project/services/ask.service")>()),
  askDraftItem: mocks.ask,
}));

vi.mock("@/modules/bkn-project/services/relation-suggestions.service", () => ({
  getRelationSuggestions: mocks.suggest,
}));

vi.mock("@/modules/knowledge-network/services/object-metric-models.service", () => ({
  listObjectMetricAnswerModels: () => Promise.resolve([]),
}));

// Stands in for the mapping tables: a button fills in the ends and one pair.
vi.mock(
  "@/modules/knowledge-network/components/relation-type/RelationTypeMappingEditor",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("@/modules/knowledge-network/components/relation-type/RelationTypeMappingEditor")
    >()),
    RelationTypeMappingEditor: (props: {
      onChange: (value: RelationTypeMappingFormValues) => void;
      readers: RelationTypeMappingReaders;
      value: RelationTypeMappingFormValues;
    }) => {
      mocks.editorProps(props);
      return (
        <button
          onClick={() =>
            props.onChange({
              ...props.value,
              mappingRules: {
                ...props.value.mappingRules,
                propertyMappings: [
                  { sourcePropertyName: "customer_id", targetPropertyName: "name" },
                ],
                sourceObjectTypeId: "sales_orders",
                targetObjectTypeId: "customers",
              },
            })
          }
          type="button"
        >
          map the ends
        </button>
      );
    },
  }),
);

import { RelationTypePanel } from "./RelationTypePanel";

const project: Project = {
  archived: false,
  baselineNetworkId: "orders",
  branch: "project/p1",
  catalogIds: ["c1"],
  createTime: 1,
  id: "p1",
  knId: "orders",
  name: "Delivery warning",
  otherProjects: 0,
  owner: { id: "me", type: "user" },
  updateTime: 1,
};

function renderPanel(draft: Draft = mapDraft(mockDraft("p1")), id: string | null = null) {
  const handlers = {
    onClose: vi.fn(),
    onReload: vi.fn().mockResolvedValue(null),
    onSaved: vi.fn(),
  };
  renderWithoutAntdStyles(
    <RelationTypePanel draft={draft} project={project} relationTypeId={id} {...handlers} />,
  );
  return handlers;
}

/** A relation the fields suggest from sales orders to customers. */
const suggestion = (name: string) => ({
  ends: {
    mapping: [{ sourceProperty: "customer_id", targetProperty: "customer_id" }],
    source: "sales_orders",
    target: "customers",
  },
  evidence: {
    computed: true,
    hitRate: 1,
    hits: 10,
    nulls: 0,
    orphans: 0,
    rows: 10,
    sourceDistinct: 10,
  },
  name,
  origin: "name_match",
  reason: "",
  relationTypeId: "",
});

function refusal(status: number, code: string, details?: unknown) {
  return new AxiosError(code, "ERR_BAD_REQUEST", undefined, undefined, {
    data: { description: code, error_code: `BknProject.Draft.${code}`, error_details: details },
    status,
  } as AxiosResponse);
}

const save = () =>
  fireEvent.click(screen.getByRole("button", { name: "bknProject.objectEditor.save" }));
const nameBox = () => screen.getByRole("textbox", { name: "bknProject.objectEditor.name" });

/** The draft with a relation a person made between sales orders and customers. */
function madeDraft(from: Draft) {
  const made = structuredClone(from);
  made.updateTime = from.updateTime + 1;
  made.items.relationTypes.push({
    ...from.items.relationTypes[0],
    adopted: false,
    id: "made",
    mapping: [{ sourceProperty: "customer_id", targetProperty: "name" }],
    name: "Orders by name",
    origin: "manual",
  });
  return made;
}

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

describe("RelationTypePanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("makes a relation with the draft's time, then goes on editing it", async () => {
    const draft = mapDraft(mockDraft("p1"));
    const made = madeDraft(draft);
    mocks.create.mockResolvedValue(made);
    const { onSaved } = renderPanel(draft);
    expect(screen.getByText("bknProject.relationEditor.newTitle")).toBeInTheDocument();
    // Nothing typed yet is nothing unsaved, aliases included.
    expect(screen.queryByText("bknProject.objectEditor.unsaved")).toBeNull();
    // A drafted end's properties come from the draft.
    const readers = (mocks.editorProps.mock.lastCall![0] as { readers: RelationTypeMappingReaders })
      .readers;
    expect((await readers.readObjectTypeProperties("customers")).map(({ name }) => name)).toEqual([
      "customer_id",
      "name",
    ]);

    fireEvent.change(nameBox(), { target: { value: "Orders by name" } });
    fireEvent.click(screen.getByRole("button", { name: "map the ends" }));
    save();

    await waitFor(() =>
      expect(mocks.create).toHaveBeenCalledWith("p1", draft.updateTime, {
        description: "",
        mapping: [{ sourceProperty: "customer_id", targetProperty: "name" }],
        name: "Orders by name",
        source: "sales_orders",
        target: "customers",
      }),
    );
    expect(onSaved).toHaveBeenCalledWith(made);
    // Its ends are not both adopted: so is it, and the page says why.
    expect(mocks.message.info).toHaveBeenCalledWith(
      `bknProject.relationEditor.createdNotAdopted:${JSON.stringify({ name: "Orders by name" })}`,
    );
    expect(await screen.findByText("Orders by name")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "bknProject.relationEditor.delete" })).toBeVisible();
  });

  it("starts a new relation from a suggestion, saved only when the person saves it", async () => {
    const draft = mapDraft(mockDraft("p1"));
    mocks.create.mockResolvedValue(madeDraft(draft));
    renderWithoutAntdStyles(
      <RelationTypePanel
        draft={draft}
        onClose={vi.fn()}
        onReload={vi.fn().mockResolvedValue(null)}
        onSaved={vi.fn()}
        prefill={{
          ends: {
            mapping: [{ sourceProperty: "customer_id", targetProperty: "customer_id" }],
            source: "sales_orders",
            target: "customers",
          },
          name: "Orders of a customer",
        }}
        project={project}
        relationTypeId={null}
      />,
    );

    expect(nameBox()).toHaveValue("Orders of a customer");
    // Unsaved until the person saves it.
    expect(screen.getByText("bknProject.objectEditor.unsaved")).toBeInTheDocument();
    expect(mocks.create).not.toHaveBeenCalled();
    save();
    await waitFor(() =>
      expect(mocks.create).toHaveBeenCalledWith("p1", draft.updateTime, {
        description: "",
        mapping: [{ sourceProperty: "customer_id", targetProperty: "customer_id" }],
        name: "Orders of a customer",
        source: "sales_orders",
        target: "customers",
      }),
    );
  });

  it("asks AI about a relation being made, and fills in a suggestion for its source", async () => {
    const draft = mapDraft(mockDraft("p1"));
    mocks.create.mockResolvedValue(madeDraft(draft));
    mocks.suggest.mockResolvedValue({
      answer: "",
      candidates: [
        { ...suggestion("Already drafted"), origin: "drafted", relationTypeId: "rt1" },
        suggestion("Orders of a customer"),
      ],
      objectType: { id: "sales_orders", name: "sales_orders" },
    });
    renderWithoutAntdStyles(
      <RelationTypePanel
        draft={draft}
        onClose={vi.fn()}
        onReload={vi.fn().mockResolvedValue(null)}
        onSaved={vi.fn()}
        // Only its source chosen so far.
        prefill={{ ends: { mapping: [], source: "sales_orders", target: "" }, name: "" }}
        project={project}
        relationTypeId={null}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "bknProject.objectEditor.ask" }));
    // Examples for a relation being made.
    expect(
      screen.getByRole("button", { name: "bknProject.model.ask.examples.relation_types_new.0" }),
    ).toBeInTheDocument();
    // The source's suggestions from its fields, without the one the draft already has.
    expect(await screen.findByText("Orders of a customer")).toBeInTheDocument();
    expect(mocks.suggest).toHaveBeenCalledWith("p1", "sales_orders");
    expect(screen.queryByText("Already drafted")).toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: "bknProject.relationEditor.sourceSuggestions.use" }),
    );
    expect(nameBox()).toHaveValue("Orders of a customer");
    expect(mocks.create).not.toHaveBeenCalled();
    save();
    await waitFor(() =>
      expect(mocks.create).toHaveBeenCalledWith(
        "p1",
        draft.updateTime,
        expect.objectContaining({
          mapping: [{ sourceProperty: "customer_id", targetProperty: "customer_id" }],
          name: "Orders of a customer",
          source: "sales_orders",
          target: "customers",
        }),
      ),
    );
  });

  it("asks what the mapping misses before sending", async () => {
    renderPanel();
    fireEvent.change(nameBox(), { target: { value: "Orders by name" } });
    save();
    expect(
      await screen.findByText("knowledgeNetwork.relationTypeSourceObjectRequired"),
    ).toBeInTheDocument();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it.each([
    "BusinessIdentityNotVerified",
    "BusinessIdentityNotUnique",
    "BusinessIdentityUnavailable",
  ])("explains %s without backend text", async (code) => {
    const draft = mapDraft(mockDraft("p1"));
    renderPanel(draft, draft.items.relationTypes[0].id);
    mocks.save.mockRejectedValueOnce(refusal(409, code));
    save();
    expect(await screen.findByText(`bknProject.objectEditor.errors.${code}`)).toBeInTheDocument();
  });

  it("words a refused relation by its reason, in the names people know", async () => {
    const draft = mapDraft(mockDraft("p1"));
    renderPanel(draft, draft.items.relationTypes[0].id);
    mocks.save.mockRejectedValueOnce(
      refusal(400, "InvalidRelation", {
        reason: "duplicate",
        relation: { id: "r2", kind: "relation_types", name: "Orders of customer" },
      }),
    );
    save();
    expect(
      await screen.findByText(
        `bknProject.relationEditor.invalid.duplicate:${JSON.stringify({
          field: "",
          objectType: "",
          property: "",
          relation: "Orders of customer",
          source: "",
          target: "",
        })}`,
      ),
    ).toBeInTheDocument();

    mocks.save.mockRejectedValueOnce(
      refusal(400, "InvalidRelation", { object_type: "customers", reason: "unknown_property" }),
    );
    save();
    expect(
      await screen.findByText(/^bknProject\.relationEditor\.invalid\.unknown_property:/),
    ).toHaveTextContent('"objectType":"customers"');

    // A reason the page does not know is never shown as it is.
    mocks.save.mockRejectedValueOnce(refusal(400, "InvalidRelation", { reason: "invalid_type" }));
    save();
    expect(await screen.findByText("bknProject.relationEditor.invalid.other")).toBeInTheDocument();
  });

  it("deletes only a relation a person made, after asking", async () => {
    const draft = madeDraft(mapDraft(mockDraft("p1")));
    const left = mapDraft(mockDraft("p1"));
    mocks.remove.mockResolvedValue(left);
    const { onClose, onSaved } = renderPanel(draft, "made");

    fireEvent.click(screen.getByRole("button", { name: "bknProject.relationEditor.delete" }));
    const asked = mocks.confirm.mock.lastCall![0] as { onOk: () => Promise<void> };
    await asked.onOk();
    expect(mocks.remove).toHaveBeenCalledWith("p1", "made", draft.updateTime);
    expect(onSaved).toHaveBeenCalledWith(left);
    expect(onClose).toHaveBeenCalled();
  });

  it("offers no deleting for a relation drafting found", () => {
    const draft = mapDraft(mockDraft("p1"));
    renderPanel(draft, draft.items.relationTypes[0].id);
    expect(nameBox()).toHaveValue(draft.items.relationTypes[0].name);
    expect(screen.queryByRole("button", { name: "bknProject.relationEditor.delete" })).toBeNull();
  });
});

describe("an edition's source editor", () => {
  // Offers its kind of relation on every draft and edits its ends with one button.
  const editor: ProjectRelationSourceEditor = {
    appliesTo: (relation) => Boolean(relation.document),
    toSave: (relation) => ({
      cardinality: relation.cardinality,
      description: relation.description,
      mapping: [],
      name: relation.name,
      source: relation.source,
      target: relation.target,
    }),
    applyRevisions: (value) => value,
    Editor: ({ onChange, value }) => (
      <button
        onClick={() => onChange({ ...value, source: "sales_orders", target: "customers" })}
        type="button"
      >
        choose the ends
      </button>
    ),
    newItem: {
      labelKey: "edition.newRelation",
      offered: () => true,
      start: ({ description, name }) => ({
        cardinality: "many_to_one",
        description,
        mapping: [],
        name,
        source: "",
        target: "",
      }),
    },
  };
  beforeAll(() => {
    registerExtension({
      capability: "knowledge_base",
      id: "edition",
      projectRelationSourceEditor: editor,
    });
  });
  afterAll(() => resetExtensionsForTesting());

  it("makes a relation of its kind by the switch, with its editor instead of the mapping", async () => {
    vi.clearAllMocks();
    const draft = mapDraft(mockDraft("p1"));
    mocks.create.mockResolvedValue(madeDraft(draft));
    renderPanel(draft);
    fireEvent.change(nameBox(), { target: { value: "Mentions" } });
    fireEvent.click(screen.getByRole("switch"));
    expect(screen.queryByRole("button", { name: "map the ends" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "choose the ends" }));
    save();
    await waitFor(() =>
      expect(mocks.create).toHaveBeenCalledWith("p1", draft.updateTime, {
        cardinality: "many_to_one",
        description: "",
        mapping: [],
        name: "Mentions",
        source: "sales_orders",
        target: "customers",
      }),
    );
  });

  it("offers no switch for a relation that exists", () => {
    const draft = mapDraft(mockDraft("p1"));
    renderPanel(draft, draft.items.relationTypes[0].id);
    expect(screen.queryByRole("switch")).toBeNull();
    expect(screen.getByRole("button", { name: "map the ends" })).toBeInTheDocument();
  });
});
