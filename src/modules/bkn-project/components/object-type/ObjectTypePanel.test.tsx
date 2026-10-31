/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, screen, waitFor } from "@testing-library/react";
import { AxiosError, type AxiosResponse } from "axios";
import { forwardRef, useEffect, useImperativeHandle } from "react";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { AskError } from "@/modules/bkn-project/services/ask.service";
import { mapDraft, mockDraft } from "@/modules/bkn-project/services/draft.service";
import type { Project } from "@/modules/bkn-project/types/project";
import type { ObjectTypeDataProperty } from "@/modules/knowledge-network/types/object-type";
import { renderWithoutAntdStyles } from "@/test/render-without-antd-styles";

const mocks = vi.hoisted(() => ({
  editorProps: vi.fn(),
  confirm: vi.fn(),
  listFields: vi.fn(),
  message: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
  ask: vi.fn(),
  removed: new Set<string>(),
  save: vi.fn(),
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
  listDraftTableFields: mocks.listFields,
  saveDraftObjectType: mocks.save,
}));

vi.mock("@/modules/knowledge-network/services/object-metric-models.service", () => ({
  listObjectMetricAnswerModels: () => Promise.resolve([]),
}));

vi.mock("@/modules/bkn-project/services/ask.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/bkn-project/services/ask.service")>()),
  askDraftItem: mocks.ask,
}));

// Stands in for the canvas: hands back the properties it was given, as checked.
vi.mock(
  "@/modules/knowledge-network/components/object-type/data-attribute/ObjectTypeDataAttributeEditor",
  () => ({
    ObjectTypeDataAttributeEditor: forwardRef(function Editor(
      props: {
        dataProperties: ObjectTypeDataProperty[];
        onChange: (value: { dataProperties: ObjectTypeDataProperty[] }) => void;
        readResourceFields?: (id: string) => Promise<unknown>;
        resourceFixed?: boolean;
      },
      ref,
    ) {
      mocks.editorProps(props);
      // Removes the properties a case names, as a person would on the canvas.
      const { dataProperties, onChange } = props;
      useEffect(() => {
        if (dataProperties.some((property) => mocks.removed.has(property.name))) {
          onChange({
            dataProperties: dataProperties.filter((property) => !mocks.removed.has(property.name)),
          });
        }
      }, [dataProperties, onChange]);
      useImperativeHandle(ref, () => ({
        validateFields: () => Promise.resolve({ dataProperties: props.dataProperties }),
      }));
      return <div>property editor</div>;
    }),
  }),
);

import type { Draft } from "@/modules/bkn-project/types/draft";

import { ObjectTypePanel } from "./ObjectTypePanel";

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

function renderPanel(draft: Draft = mapDraft(mockDraft("p1")), objectTypeId = "customers") {
  const handlers = {
    onClose: vi.fn(),
    onReload: vi.fn().mockResolvedValue(null),
    onSaved: vi.fn(),
  };
  renderWithoutAntdStyles(
    <ObjectTypePanel draft={draft} objectTypeId={objectTypeId} project={project} {...handlers} />,
  );
  return handlers;
}

function refusal(status: number, code: string, details?: unknown) {
  return new AxiosError(code, "ERR_BAD_REQUEST", undefined, undefined, {
    data: { description: code, error_code: `BknProject.Draft.${code}`, error_details: details },
    status,
  } as AxiosResponse);
}

const save = () =>
  fireEvent.click(screen.getByRole("button", { name: "bknProject.objectEditor.save" }));
const nameBox = () => screen.getByRole("textbox", { name: "bknProject.objectEditor.name" });

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

describe("ObjectTypePanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.removed.clear();
    mocks.listFields.mockResolvedValue([]);
  });

  it("shows the name, description and properties on one page, the table kept as it is", async () => {
    renderPanel();
    expect(nameBox()).toHaveValue("customers");
    expect(screen.getByText("property editor")).toBeInTheDocument();
    const props = mocks.editorProps.mock.lastCall![0] as {
      readResourceFields: (id: string) => Promise<unknown>;
      resourceFixed: boolean;
    };
    expect(props.resourceFixed).toBe(true);
    await props.readResourceFields("res-customers");
    expect(mocks.listFields).toHaveBeenCalledWith(project, "customers", "res-customers");

    // A name is needed before anything is sent.
    fireEvent.change(nameBox(), { target: { value: " " } });
    save();
    expect(await screen.findByText("bknProject.objectEditor.nameRequired")).toBeInTheDocument();
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("saves whole with the draft's time and stays open on the draft saved", async () => {
    const draft = mapDraft(mockDraft("p1"));
    const saved = mapDraft(mockDraft("p1"));
    saved.updateTime = draft.updateTime + 1;
    saved.items.objectTypes.find((item) => item.id === "customers")!.name = "Customer";
    mocks.save.mockResolvedValue(saved);
    const { onClose, onSaved } = renderPanel(draft);

    fireEvent.change(nameBox(), { target: { value: "Customer" } });
    expect(screen.getByText("bknProject.objectEditor.unsaved")).toBeInTheDocument();
    save();

    await waitFor(() =>
      expect(mocks.save).toHaveBeenCalledWith(
        "p1",
        "customers",
        draft.updateTime,
        expect.objectContaining({ name: "Customer", primaryKeys: ["customer_id"] }),
      ),
    );
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(saved));
    expect(mocks.message.success).toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    // What was saved is the new start: nothing is left unsaved, and saving again sends its time.
    await waitFor(() => expect(screen.queryByText("bknProject.objectEditor.unsaved")).toBeNull());
    save();
    await waitFor(() =>
      expect(mocks.save).toHaveBeenLastCalledWith(
        "p1",
        "customers",
        saved.updateTime,
        expect.anything(),
      ),
    );
  });

  it("closes at once without changes, and asks first with changes not saved", () => {
    const { onClose } = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "bknProject.objectEditor.close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mocks.confirm).not.toHaveBeenCalled();

    fireEvent.change(nameBox(), { target: { value: "Customer" } });
    fireEvent.click(screen.getByRole("button", { name: "bknProject.objectEditor.close" }));
    expect(mocks.confirm).toHaveBeenCalledWith(
      expect.objectContaining({ title: "bknProject.objectEditor.leaveTitle" }),
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("offers to read the draft again when it changed, starting over from what it is now", async () => {
    const now = mapDraft(mockDraft("p1"));
    now.items.objectTypes.find((item) => item.id === "customers")!.name = "Client";
    mocks.save.mockRejectedValue(refusal(409, "Stale"));
    const { onReload } = renderPanel();
    onReload.mockResolvedValue(now);
    save();

    expect(await screen.findByText("bknProject.objectEditor.errors.Stale")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "bknProject.objectEditor.reload" }));
    await waitFor(() => expect(onReload).toHaveBeenCalled());
    await waitFor(() => expect(nameBox()).toHaveValue("Client"));
    expect(screen.queryByText("bknProject.objectEditor.errors.Stale")).toBeNull();
  });

  it("names the relations that use a removed property, and a refused name on its field", async () => {
    // Removed in the editor, the property is named as it was loaded.
    const draft = mapDraft(mockDraft("p1"));
    draft.items.objectTypes.find((item) => item.id === "customers")!.properties[0].displayName =
      "Customer number";
    mocks.removed.add("customer_id");
    const end = (name: string) => ({ id: name, kind: "object_types", name });
    mocks.save.mockRejectedValueOnce(
      refusal(409, "PropertyInUse", [
        {
          property: "customer_id",
          relation: { id: "r1", kind: "relation_types", name: "Orders of customer" },
          source: end("Order"),
          target: end("Customer"),
        },
        {
          property: "customer_id",
          relation: { id: "r2", kind: "relation_types", name: "Invoices of customer" },
          source: end("Invoice"),
          target: end("Customer"),
        },
      ]),
    );
    renderPanel(draft);
    save();
    const relation = (name: string, source: string) =>
      `bknProject.objectEditor.relationUse:${JSON.stringify({
        relation: name,
        source,
        target: "Customer",
      })}`;
    // Grouped by property: both relations that join by customer_id under it.
    const use = `bknProject.objectEditor.propertyUse:${JSON.stringify({
      property: "Customer number",
      relations: `${relation("Orders of customer", "Order")}bknProject.objectEditor.listSeparator${relation("Invoices of customer", "Invoice")}`,
    })}`;
    expect(
      await screen.findByText(
        `bknProject.objectEditor.errors.PropertyInUse:${JSON.stringify({ uses: use })}`,
      ),
    ).toBeInTheDocument();

    mocks.save.mockRejectedValueOnce(
      refusal(400, "InvalidProperty", { field: "customer_id", reason: "field_mapped_twice" }),
    );
    save();
    expect(
      await screen.findByText(
        `bknProject.objectEditor.invalidProperty.field_mapped_twice:${JSON.stringify({ name: "customer_id" })}`,
      ),
    ).toBeInTheDocument();

    mocks.save.mockRejectedValueOnce(refusal(400, "InvalidName"));
    save();
    expect(
      await screen.findByText("bknProject.objectEditor.errors.InvalidName"),
    ).toBeInTheDocument();
  });

  it("names the properties that map no column, without sending", async () => {
    const draft = mapDraft(mockDraft("p1"));
    draft.items.objectTypes.find((item) => item.id === "customers")!.properties[1].mappedField = "";
    renderPanel(draft);
    save();

    expect(await screen.findByText(/^bknProject\.objectEditor\.unmapped:/)).toBeInTheDocument();
    expect(mocks.save).not.toHaveBeenCalled();
  });

  const askAi = (question: string) => {
    fireEvent.change(screen.getByRole("textbox", { name: "bknProject.model.ask.question" }), {
      target: { value: question },
    });
    fireEvent.click(screen.getByRole("button", { name: "bknProject.model.ask.submit" }));
  };

  it("asks AI with the unsaved values, and applies the chosen changes to the form to save", async () => {
    const draft = mapDraft(mockDraft("p1"));
    mocks.save.mockResolvedValueOnce(draft);
    mocks.ask.mockImplementationOnce(({ onText }: { onText: (text: string) => void }) => {
      onText("Customers are ");
      onText("known by their name.");
      return Promise.resolve({
        answer: "Customers are known by their name.",
        dropped: [{ field: "display_key", reason: "unknown_property" }],
        revisions: [
          { field: "comment", reason: "Empty.", value: "A buyer." },
          {
            field: "data_property",
            reason: "",
            value: { displayName: "Customer ID", name: "customer_id" },
          },
          { field: "primary_keys", reason: "", value: ["customer_id", "name"] },
        ],
      });
    });
    renderPanel(draft);
    fireEvent.change(nameBox(), { target: { value: "Customer" } });
    fireEvent.click(screen.getByRole("button", { name: "bknProject.objectEditor.ask" }));
    // Before the first question: what it does, and examples to start from.
    expect(screen.getByText("bknProject.model.ask.intro.object_types")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "bknProject.model.ask.examples.object_types.0" }),
    );
    expect(screen.getByRole("textbox", { name: "bknProject.model.ask.question" })).toHaveValue(
      "bknProject.model.ask.examples.object_types.0",
    );
    askAi("Is the identity right?");

    // The answer is written as it comes, then stays in the conversation with its changes.
    expect(await screen.findByRole("button", { name: "bknProject.model.ask.apply" })).toBeVisible();
    expect(screen.getByText("Customers are known by their name.")).toBeInTheDocument();
    expect(mocks.ask).toHaveBeenCalledWith(
      expect.objectContaining({
        history: [],
        itemId: "customers",
        kind: "object_types",
        projectId: "p1",
        question: "Is the identity right?",
      }),
    );
    // What the editor holds, the name not saved yet included.
    expect((mocks.ask.mock.calls[0] as [{ working: object }])[0].working).toMatchObject({
      name: "Customer",
      primaryKeys: ["customer_id"],
    });
    // Each change from what the editor holds to what it would be; what was dropped, in words.
    expect(screen.getByText('bknProject.model.ask.after:{"value":"A buyer."}')).toBeInTheDocument();
    expect(
      screen.getByText(
        'bknProject.model.ask.dropped.item:{"field":"bknProject.model.ask.field.display_key","reason":"bknProject.model.ask.dropped.reason.unknown_property"}',
      ),
    ).toBeInTheDocument();

    // Only the checked changes are applied, and only to the form.
    fireEvent.click(screen.getAllByRole("checkbox")[1]);
    fireEvent.click(screen.getByRole("button", { name: "bknProject.model.ask.apply" }));
    expect(screen.getByText("bknProject.model.ask.applied")).toBeInTheDocument();
    expect(mocks.save).not.toHaveBeenCalled();
    save();
    await waitFor(() => expect(mocks.save).toHaveBeenCalled());
    const [projectId, itemId, updateTime, saved] = mocks.save.mock.calls[0] as [
      string,
      string,
      number,
      { properties: object[] },
    ];
    expect([projectId, itemId, updateTime]).toEqual(["p1", "customers", draft.updateTime]);
    expect(saved).toMatchObject({
      description: "A buyer.",
      name: "Customer",
      primaryKeys: ["customer_id", "name"],
    });
    expect(saved.properties[0]).not.toMatchObject({ displayName: "Customer ID" });
  });

  it("takes back what was applied, unless the form changed since", async () => {
    const reply = {
      answer: "A.",
      dropped: [],
      revisions: [{ field: "comment", reason: "", value: "A buyer." }],
    };
    mocks.ask.mockResolvedValueOnce(reply).mockResolvedValueOnce(reply);
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "bknProject.objectEditor.ask" }));
    const description = () =>
      screen.getByRole("textbox", { name: "bknProject.objectEditor.description" });

    askAi("Describe it");
    fireEvent.click(await screen.findByRole("button", { name: "bknProject.model.ask.apply" }));
    expect(description()).toHaveValue("A buyer.");
    fireEvent.click(screen.getByRole("button", { name: "bknProject.model.ask.undo" }));
    expect(description()).toHaveValue("");
    expect(mocks.message.success).toHaveBeenCalledWith("bknProject.model.ask.undone");

    askAi("Again");
    fireEvent.click(await screen.findByRole("button", { name: "bknProject.model.ask.apply" }));
    fireEvent.change(description(), { target: { value: "Mine." } });
    fireEvent.click(screen.getByRole("button", { name: "bknProject.model.ask.undo" }));
    expect(description()).toHaveValue("Mine.");
    expect(mocks.message.warning).toHaveBeenCalledWith("bknProject.model.ask.undoStale");
  });

  it("asks again only from the last question that stopped", async () => {
    mocks.ask
      .mockRejectedValueOnce(new AskError("AskUnavailable"))
      .mockResolvedValueOnce({ answer: "Second.", dropped: [], revisions: [] });
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "bknProject.objectEditor.ask" }));
    askAi("One?");
    expect(
      await screen.findByText("bknProject.model.ask.error.AskUnavailable"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "bknProject.model.ask.retry" })).toBeInTheDocument();

    askAi("Two?");
    expect(await screen.findByText("Second.")).toBeInTheDocument();
    // The answer after it built on the conversation as it was: the stopped one is not asked again.
    expect(screen.queryByRole("button", { name: "bknProject.model.ask.retry" })).toBeNull();
  });

  it("keeps what was written when the answer stops, and asks again with the turns before", async () => {
    mocks.ask
      .mockResolvedValueOnce({ answer: "First.", dropped: [], revisions: [] })
      .mockImplementationOnce(({ onText }: { onText: (text: string) => void }) => {
        onText("Half an ans");
        return Promise.reject(new AskError("AskTimeout"));
      })
      .mockResolvedValueOnce({ answer: "Whole.", dropped: [], revisions: [] });
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "bknProject.objectEditor.ask" }));
    askAi("One?");
    expect(await screen.findByText("First.")).toBeInTheDocument();
    askAi("Two?");

    expect(await screen.findByText("bknProject.model.ask.error.AskTimeout")).toBeInTheDocument();
    expect(screen.getByText("Half an ans")).toBeInTheDocument();
    expect(mocks.ask).toHaveBeenLastCalledWith(
      expect.objectContaining({
        history: [{ answer: "First.", question: "One?" }],
        question: "Two?",
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "bknProject.model.ask.retry" }));
    expect(await screen.findByText("Whole.")).toBeInTheDocument();
    expect(screen.getAllByText("Two?")).toHaveLength(1);
    expect(mocks.ask).toHaveBeenLastCalledWith(
      expect.objectContaining({
        history: [{ answer: "First.", question: "One?" }],
        question: "Two?",
      }),
    );
  });

  it("says when the draft has no such object type", () => {
    renderPanel(undefined, "missing");
    expect(screen.getByText("bknProject.objectEditor.notFound")).toBeInTheDocument();
  });

  it("goes through candidates: adopts or leaves out over the draft as it is, saving changes first", async () => {
    const draft = mapDraft(mockDraft("p1"));
    const saved = structuredClone(draft);
    saved.updateTime = draft.updateTime + 1;
    mocks.save.mockResolvedValue(saved);
    const review = {
      name: "customers",
      onAdopt: vi.fn().mockResolvedValue(undefined),
      onExclude: vi.fn().mockResolvedValue(undefined),
      onNext: vi.fn(),
    };
    renderWithoutAntdStyles(
      <ObjectTypePanel
        draft={draft}
        objectTypeId="customers"
        onClose={vi.fn()}
        onReload={vi.fn()}
        onSaved={vi.fn()}
        project={project}
        review={review}
      />,
    );
    const button = (name: string) =>
      screen.getByRole("button", { name: `bknProject.model.candidates.review.${name}` });

    // Nothing changed: the decision is made on the draft as read.
    fireEvent.click(button("adoptNext"));
    await waitFor(() => expect(review.onAdopt).toHaveBeenCalledWith(draft.updateTime));
    expect(mocks.save).not.toHaveBeenCalled();

    // A change is saved first, and the decision follows the draft saved.
    fireEvent.change(nameBox(), { target: { value: "Clients" } });
    fireEvent.click(button("adoptNext"));
    await waitFor(() => expect(review.onAdopt).toHaveBeenLastCalledWith(saved.updateTime));
    expect(mocks.save).toHaveBeenCalledTimes(1);

    fireEvent.click(button("excludeNext"));
    const asked = mocks.confirm.mock.lastCall![0] as { onOk: () => Promise<void>; title: string };
    expect(asked.title).toBe(
      `bknProject.model.candidates.review.excludeTitle:${JSON.stringify({ name: "customers" })}`,
    );
    await asked.onOk();
    expect(review.onExclude).toHaveBeenCalledWith(saved.updateTime, "");

    fireEvent.click(button("next"));
    expect(review.onNext).toHaveBeenCalled();
  });
});
