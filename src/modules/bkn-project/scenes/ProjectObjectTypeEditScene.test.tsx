/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, screen, waitFor } from "@testing-library/react";
import { AxiosError, type AxiosResponse } from "axios";
import { forwardRef, useEffect, useImperativeHandle } from "react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { mapDraft, mockDraft } from "@/modules/bkn-project/services/draft.service";
import type { Project } from "@/modules/bkn-project/types/project";
import type { ObjectTypeDataProperty } from "@/modules/knowledge-network/types/object-type";
import { renderWithoutAntdStyles } from "@/test/render-without-antd-styles";

const mocks = vi.hoisted(() => ({
  editorProps: vi.fn(),
  getDraft: vi.fn(),
  getProject: vi.fn(),
  listFields: vi.fn(),
  message: { error: vi.fn(), success: vi.fn() },
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
  useAppServices: () => ({ message: mocks.message, modal: { confirm: vi.fn() } }),
}));

vi.mock("@/modules/bkn-project/services/draft.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/bkn-project/services/draft.service")>()),
  getDraft: mocks.getDraft,
  listDraftTableFields: mocks.listFields,
  saveDraftObjectType: mocks.save,
}));

vi.mock("@/modules/bkn-project/services/project.service", () => ({
  getProject: mocks.getProject,
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

import { ProjectObjectTypeEditScene } from "./ProjectObjectTypeEditScene";

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

function Location() {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
}

function renderScene() {
  return renderWithoutAntdStyles(
    <MemoryRouter initialEntries={["/bkn-project/p1/model/object-types/customers"]}>
      <ProjectObjectTypeEditScene itemId="customers" projectId="p1" />
      <Location />
    </MemoryRouter>,
  );
}

function refusal(status: number, code: string, details?: unknown) {
  return new AxiosError(code, "ERR_BAD_REQUEST", undefined, undefined, {
    data: { description: code, error_code: `BknProject.Draft.${code}`, error_details: details },
    status,
  } as AxiosResponse);
}

async function toProperties() {
  expect(await screen.findByDisplayValue("customers")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "common.next" }));
  expect(await screen.findByText("property editor")).toBeInTheDocument();
}

const save = () =>
  fireEvent.click(screen.getByRole("button", { name: "bknProject.objectEditor.save" }));

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

describe("ProjectObjectTypeEditScene", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.removed.clear();
    mocks.getProject.mockResolvedValue(project);
    mocks.getDraft.mockResolvedValue(mapDraft(mockDraft("p1")));
    mocks.listFields.mockResolvedValue([]);
  });

  it("asks for a name before the properties, which read the draft's table and keep it", async () => {
    renderScene();
    fireEvent.change(await screen.findByDisplayValue("customers"), { target: { value: " " } });
    fireEvent.click(screen.getByRole("button", { name: "common.next" }));
    expect(await screen.findByText("bknProject.objectEditor.nameRequired")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("textbox", { name: "bknProject.objectEditor.name" }), {
      target: { value: "Customer" },
    });
    fireEvent.click(screen.getByRole("button", { name: "common.next" }));
    expect(await screen.findByText("property editor")).toBeInTheDocument();

    const props = mocks.editorProps.mock.lastCall![0] as {
      readResourceFields: (id: string) => Promise<unknown>;
      resourceFixed: boolean;
    };
    expect(props.resourceFixed).toBe(true);
    await props.readResourceFields("res-customers");
    expect(mocks.listFields).toHaveBeenCalledWith(project, "customers", "res-customers");
  });

  it("saves the object type whole with the draft's time, then returns to the model", async () => {
    const draft = mapDraft(mockDraft("p1"));
    mocks.getDraft.mockResolvedValue(draft);
    mocks.save.mockResolvedValue(draft);
    renderScene();
    await toProperties();
    save();

    await waitFor(() =>
      expect(mocks.save).toHaveBeenCalledWith(
        "p1",
        "customers",
        draft.updateTime,
        expect.objectContaining({ name: "customers", primaryKeys: ["customer_id"] }),
      ),
    );
    expect(mocks.message.success).toHaveBeenCalled();
    expect(screen.getByTestId("location")).toHaveTextContent("/bkn-project/p1/model?tab=objects");
  });

  it("offers to read the draft again when it changed, starting over from what it is now", async () => {
    mocks.save.mockRejectedValue(refusal(409, "Stale"));
    renderScene();
    await toProperties();
    save();

    expect(await screen.findByText("bknProject.objectEditor.errors.Stale")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "bknProject.objectEditor.reload" }));
    await waitFor(() => expect(mocks.getDraft).toHaveBeenCalledTimes(2));
    expect(await screen.findByDisplayValue("customers")).toBeVisible();
  });

  it("names the relations that use a removed property, and a refused name on its field", async () => {
    // Removed in the editor, the property is named as it was loaded.
    const draft = mapDraft(mockDraft("p1"));
    draft.items.objectTypes.find((item) => item.id === "customers")!.properties[0].displayName =
      "Customer number";
    mocks.getDraft.mockResolvedValue(draft);
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
    renderScene();
    await toProperties();
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
    expect(screen.getByDisplayValue("customers")).toBeVisible();
  });

  it("names the properties that map no column, without sending", async () => {
    const draft = mapDraft(mockDraft("p1"));
    draft.items.objectTypes.find((item) => item.id === "customers")!.properties[1].mappedField = "";
    mocks.getDraft.mockResolvedValue(draft);
    renderScene();
    await toProperties();
    save();

    expect(await screen.findByText(/^bknProject\.objectEditor\.unmapped:/)).toBeInTheDocument();
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("says when the draft has no such object type", async () => {
    mocks.getDraft.mockResolvedValue(null);
    renderScene();
    expect(await screen.findByText("bknProject.objectEditor.notFound")).toBeInTheDocument();
  });
});
