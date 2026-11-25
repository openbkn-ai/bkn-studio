/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mapStoredRelationProperties,
  toBackendRelationTypeCreateEntry,
} from "@/modules/knowledge-network/services/mappers/relation-type.mapper";
import type { StoredRelationProperty } from "@/modules/knowledge-network/types/knowledge-network";
import { renderWithoutAntdStyles } from "@/test/render-without-antd-styles";

import { RelationPropertiesEditor } from "./RelationPropertiesEditor";

const PREFIX = "knowledgeNetwork.relationProperties.";
const RANGE = "knowledgeNetwork.valueTypes.rules.";
const mocks = vi.hoisted(() => ({ listFields: vi.fn() }));

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/modules/knowledge-network/services/knowledge-network.service", () => ({
  listObjectTypeResourceFields: mocks.listFields,
}));

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
beforeEach(() => {
  mocks.listFields
    .mockReset()
    .mockResolvedValue([{ name: "edge_value", displayName: "Edge value", type: "integer" }]);
});

function roundTrip(properties: StoredRelationProperty[]) {
  const payload = toBackendRelationTypeCreateEntry({
    color: "#1677ff",
    description: "",
    mappingMode: "resource",
    mappingRules: {
      backingDataSourceId: "bridge",
      resourceMappings: [],
      propertyMappings: [],
      relationProperties: properties,
      sourceObjectTypeId: "source",
      targetObjectTypeId: "target",
    },
    name: "Association",
    sourceObjectTypeId: "source",
    targetObjectTypeId: "target",
    tags: [],
  });
  return mapStoredRelationProperties(payload.mapping_rules);
}

function renderEditor(initial: StoredRelationProperty[] = [], readOnly = false) {
  const changed = vi.fn<(properties: StoredRelationProperty[]) => void>();
  function Editor() {
    const [properties, setProperties] = useState(initial);
    return (
      <RelationPropertiesEditor
        networkId="kn"
        resourceId="bridge"
        value={properties}
        readOnly={readOnly}
        onChange={(next) => {
          changed(next);
          setProperties(roundTrip(next));
        }}
      />
    );
  }
  renderWithoutAntdStyles(<Editor />);
  return changed;
}

async function openNewProperty() {
  fireEvent.click(
    screen.getByRole("button", { name: /knowledgeNetwork\.relationProperties\.add$/ }),
  );
  const dialog = await screen.findByRole("dialog", {
    name: /knowledgeNetwork\.relationProperties\.add$/,
  });
  fireEvent.mouseDown(within(dialog).getByRole("combobox", { name: PREFIX + "mappedField" }));
  fireEvent.click(await screen.findByText("Edge value (integer)"));
  await waitFor(() =>
    expect(within(dialog).getByRole("textbox", { name: PREFIX + "name" })).toHaveValue(
      "edge_value",
    ),
  );
  return dialog;
}

function enterRange(dialog: HTMLElement, min: string, max: string) {
  for (const [label, value] of [
    ["rangeMin", min],
    ["rangeMax", max],
  ]) {
    const field = within(dialog).getByRole("spinbutton", { name: RANGE + label });
    fireEvent.change(field, { target: { value } });
    fireEvent.blur(field);
  }
}

function apiProperty(): StoredRelationProperty {
  return mapStoredRelationProperties({
    properties: [
      {
        name: "edge_value",
        display_name: "API edge",
        type: "integer",
        required: true,
        mapped_field: { name: "edge_value", type: "integer", origin: "bridge-schema-v2" },
        constraints: { range: { min: 7, max: 11 }, future: { policy: "retained" } },
        business_source: "manual-v3",
      },
    ],
  })[0];
}

describe("RelationPropertiesEditor", () => {
  it("configures a required integer range and reopens the saved API declaration", async () => {
    const changed = renderEditor();
    await waitFor(() => expect(mocks.listFields).toHaveBeenCalledWith("kn", "bridge"));
    const dialog = await openNewProperty();
    expect(within(dialog).getByRole("textbox", { name: PREFIX + "name" })).toHaveValue(
      "edge_value",
    );
    fireEvent.click(within(dialog).getByRole("checkbox", { name: PREFIX + "required" }));
    enterRange(dialog, "7", "11");
    fireEvent.click(within(dialog).getByRole("button", { name: "common.save" }));
    await waitFor(() => expect(changed).toHaveBeenCalledTimes(1));
    expect(changed.mock.calls[0][0]).toEqual([
      expect.objectContaining({
        name: "edge_value",
        type: "integer",
        required: true,
        constraints: { range: { min: 7, max: 11 } },
      }),
    ]);
    expect(await screen.findByText("7 – 11")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: PREFIX + "edit" }));
    const reopened = await screen.findByRole("dialog", { name: PREFIX + "edit" });
    expect(within(reopened).getByRole("spinbutton", { name: RANGE + "rangeMin" })).toHaveValue("7");
    expect(within(reopened).getByRole("spinbutton", { name: RANGE + "rangeMax" })).toHaveValue(
      "11",
    );
    expect(within(reopened).getByRole("checkbox", { name: PREFIX + "required" })).toBeChecked();
  });

  it("edits API-created attributes while preserving unknown declaration and field data", async () => {
    const changed = renderEditor([apiProperty()]);
    fireEvent.click(screen.getByRole("button", { name: PREFIX + "edit" }));
    const dialog = await screen.findByRole("dialog", { name: PREFIX + "edit" });
    expect(within(dialog).getByRole("spinbutton", { name: RANGE + "rangeMin" })).toHaveValue("7");
    fireEvent.change(within(dialog).getByRole("textbox", { name: PREFIX + "displayName" }), {
      target: { value: "Updated edge" },
    });
    enterRange(dialog, "7", "10");
    fireEvent.click(within(dialog).getByRole("button", { name: "common.save" }));
    await waitFor(() => expect(changed).toHaveBeenCalledTimes(1));
    const saved = roundTrip(changed.mock.calls[0][0])[0];
    expect(saved).toMatchObject({
      displayName: "Updated edge",
      constraints: { range: { min: 7, max: 10 }, future: { policy: "retained" } },
      declaration: {
        business_source: "manual-v3",
        mapped_field: { name: "edge_value", type: "integer", origin: "bridge-schema-v2" },
      },
    });
  });

  it("updates the mapped column's schema type while preserving mapping extensions", async () => {
    mocks.listFields.mockResolvedValueOnce([
      { name: "edge_value", displayName: "Edge value", type: "integer" },
      { name: "edge_decimal", displayName: "Decimal value", type: "decimal" },
    ]);
    const changed = renderEditor([apiProperty()]);
    await waitFor(() => expect(mocks.listFields).toHaveBeenCalledWith("kn", "bridge"));
    fireEvent.click(screen.getByRole("button", { name: PREFIX + "edit" }));
    const dialog = await screen.findByRole("dialog", { name: PREFIX + "edit" });
    fireEvent.mouseDown(within(dialog).getByRole("combobox", { name: PREFIX + "mappedField" }));
    fireEvent.click(await screen.findByText("Decimal value (decimal)"));
    fireEvent.click(within(dialog).getByRole("button", { name: "common.save" }));
    await waitFor(() => expect(changed).toHaveBeenCalledTimes(1));
    const saved = roundTrip(changed.mock.calls[0][0])[0];
    expect(saved.mappedField).toBe("edge_decimal");
    expect(saved.declaration?.mapped_field).toEqual({
      name: "edge_decimal",
      type: "decimal",
      origin: "bridge-schema-v2",
    });
  });

  it("clears exposed bounds without reviving the saved range or dropping other constraints", async () => {
    const changed = renderEditor([apiProperty()]);
    fireEvent.click(screen.getByRole("button", { name: PREFIX + "edit" }));
    const dialog = await screen.findByRole("dialog", { name: PREFIX + "edit" });
    enterRange(dialog, "", "");
    fireEvent.click(within(dialog).getByRole("button", { name: "common.save" }));
    await waitFor(() => expect(changed).toHaveBeenCalledTimes(1));
    const saved = roundTrip(changed.mock.calls[0][0])[0];
    expect(saved.constraints).toEqual({ future: { policy: "retained" } });
    expect(saved.declaration?.constraints).toEqual({ future: { policy: "retained" } });
  });

  it("changes an integer property to string after explicitly clearing its incompatible range", async () => {
    const changed = renderEditor([apiProperty()]);
    fireEvent.click(screen.getByRole("button", { name: PREFIX + "edit" }));
    const dialog = await screen.findByRole("dialog", { name: PREFIX + "edit" });
    fireEvent.mouseDown(within(dialog).getByRole("combobox", { name: PREFIX + "type" }));
    fireEvent.click(
      await screen.findByText("string", { selector: ".ant-select-item-option-content" }),
    );
    expect(await within(dialog).findByText(PREFIX + "rangeIncompatible")).toBeVisible();
    expect(
      within(dialog).queryByRole("spinbutton", { name: RANGE + "rangeMin" }),
    ).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: PREFIX + "clearRange" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "common.save" }));
    await waitFor(() => expect(changed).toHaveBeenCalledTimes(1));
    const saved = roundTrip(changed.mock.calls[0][0])[0];
    expect(saved.type).toBe("string");
    expect(saved.constraints).toEqual({ future: { policy: "retained" } });
    expect(saved.declaration?.constraints).toEqual({ future: { policy: "retained" } });
    expect(saved.declaration?.mapped_field).toEqual({
      name: "edge_value",
      type: "integer",
      origin: "bridge-schema-v2",
    });
  });

  it("accepts a replacement numeric range after clearing the whole saved range", async () => {
    const changed = renderEditor([apiProperty()]);
    fireEvent.click(screen.getByRole("button", { name: PREFIX + "edit" }));
    const dialog = await screen.findByRole("dialog", { name: PREFIX + "edit" });
    fireEvent.click(within(dialog).getByRole("button", { name: PREFIX + "clearRange" }));
    enterRange(dialog, "3", "9");
    fireEvent.click(within(dialog).getByRole("button", { name: "common.save" }));
    await waitFor(() => expect(changed).toHaveBeenCalledTimes(1));
    const saved = roundTrip(changed.mock.calls[0][0])[0];
    expect(saved.constraints).toEqual({
      range: { min: 3, max: 9 },
      future: { policy: "retained" },
    });
  });

  it("rejects duplicate property names", async () => {
    const changed = renderEditor([apiProperty()]);
    const dialog = await openNewProperty();
    fireEvent.click(within(dialog).getByRole("button", { name: "common.save" }));
    expect(await within(dialog).findByText(PREFIX + "duplicateName")).toBeVisible();
    expect(changed).not.toHaveBeenCalled();
  });

  it("retains the draft when the range is reversed", async () => {
    const changed = renderEditor();
    const dialog = await openNewProperty();
    enterRange(dialog, "12", "7");
    fireEvent.click(within(dialog).getByRole("button", { name: "common.save" }));
    expect(await within(dialog).findByText(RANGE + "rangeReversed")).toBeVisible();
    expect(changed).not.toHaveBeenCalled();
    expect(dialog).toBeVisible();
  });

  it("deletes only after confirmation and sends an explicit empty list", async () => {
    const changed = renderEditor([apiProperty()]);
    fireEvent.click(screen.getByRole("button", { name: PREFIX + "remove" }));
    let confirmation = screen.getByRole("tooltip");
    fireEvent.click(within(confirmation).getByRole("button", { name: "Cancel" }));
    expect(changed).not.toHaveBeenCalled();
    expect(screen.getByText("API edge")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: PREFIX + "remove" }));
    confirmation = screen.getByRole("tooltip");
    fireEvent.click(within(confirmation).getByRole("button", { name: "OK" }));
    await waitFor(() => expect(changed).toHaveBeenCalledWith([]));
    expect(screen.getByText(PREFIX + "empty")).toBeVisible();
  });

  it("shows bridge-field authorization failures", async () => {
    mocks.listFields.mockRejectedValueOnce(new Error("Forbidden"));
    const changed = renderEditor();
    expect(await screen.findByText(PREFIX + "fieldsUnavailable")).toBeVisible();
    expect(changed).not.toHaveBeenCalled();
  });

  it("views saved constraints read-only without querying current bridge fields", async () => {
    const changed = renderEditor([apiProperty()], true);
    expect(mocks.listFields).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("button", { name: /knowledgeNetwork\.relationProperties\.add$/ }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: PREFIX + "remove" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: PREFIX + "view" }));
    const dialog = await screen.findByRole("dialog", { name: PREFIX + "view" });
    expect(within(dialog).getByRole("spinbutton", { name: RANGE + "rangeMin" })).toHaveValue("7");
    expect(within(dialog).getByRole("spinbutton", { name: RANGE + "rangeMax" })).toHaveValue("11");
    expect(within(dialog).getByRole("textbox", { name: PREFIX + "name" })).toBeDisabled();
    expect(within(dialog).getByText(/"future"/)).toBeVisible();
    expect(within(dialog).queryByRole("button", { name: "common.save" })).not.toBeInTheDocument();
    expect(changed).not.toHaveBeenCalled();
  });
});
