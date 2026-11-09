/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

import { EvalOverviewScopeDrawer } from "./EvalOverviewScopeDrawer";
import {
  getEvalOverviewScope,
  listEvalCaseResourcesPage,
  saveEvalOverviewScope,
} from "./m0-run.service";

vi.mock("./m0-run.service", () => ({
  getEvalOverviewScope: vi.fn(),
  listEvalCaseResourcesPage: vi.fn(),
  saveEvalOverviewScope: vi.fn(),
}));

Object.defineProperty(window, "matchMedia", {
  configurable: true,
  value: vi.fn().mockImplementation(() => ({
    addEventListener: vi.fn(),
    addListener: vi.fn(),
    matches: false,
    removeEventListener: vi.fn(),
    removeListener: vi.fn(),
  })),
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getEvalOverviewScope).mockResolvedValue({
    revision: 2,
    excluded_kinds: [],
    excluded_resources: [],
  });
  vi.mocked(listEvalCaseResourcesPage).mockResolvedValue({
    entries: [{ id: "material", name: "物料", kind: "objectType" }],
    total: 1,
  });
  vi.mocked(saveEvalOverviewScope).mockImplementation((_networkId, scope) =>
    Promise.resolve({
      ...scope,
      revision: scope.revision + 1,
    }),
  );
});

it("persists excluded resource types as the assessment scope", async () => {
  const onSaved = vi.fn();
  render(
    <EvalOverviewScopeDrawer
      networkId="supply_ontology_hand"
      open
      canManage
      onClose={vi.fn()}
      onSaved={onSaved}
    />,
  );

  const objectType = await screen.findByRole("checkbox", { name: "对象类" });
  expect((objectType as HTMLInputElement).checked).toBe(true);
  fireEvent.click(objectType);
  fireEvent.click(screen.getByRole("button", { name: /确.*定/ }));

  await waitFor(() =>
    expect(saveEvalOverviewScope).toHaveBeenCalledWith(
      "supply_ontology_hand",
      expect.objectContaining({ revision: 2, excluded_kinds: ["objectType"] }),
    ),
  );
  expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ revision: 3 }));
});
