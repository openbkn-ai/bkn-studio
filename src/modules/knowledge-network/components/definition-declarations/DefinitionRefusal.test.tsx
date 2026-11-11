/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { cleanup, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key} ${JSON.stringify(params)}` : key,
  }),
}));

import { renderWithoutAntdStyles } from "@/test/render-without-antd-styles";

import { DefinitionRefusal } from "./DefinitionRefusal";

afterEach(cleanup);

// The backend's refusal of a second fallback path for a primary relation.
const refusal = {
  description: "Invalid declarations",
  details:
    'relation type "order_for_patient_by_phone" fallback_for "order_for_patient": relation type "order_for_patient_by_id_card" is already its fallback path; a primary relation has one',
};

describe("DefinitionRefusal", () => {
  it("links each other definition the details name, but not the one saved", () => {
    renderWithoutAntdStyles(
      <MemoryRouter>
        <DefinitionRefusal
          networkId="clinic"
          refusal={refusal}
          saved={{ id: "order_for_patient_by_phone", kind: "relation_type" }}
        />
      </MemoryRouter>,
    );

    const links = screen.getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/knowledge-network/workspace/clinic/relation-types/order_for_patient/detail",
      "/knowledge-network/workspace/clinic/relation-types/order_for_patient_by_id_card/detail",
    ]);
    expect(screen.getByText(refusal.details)).toBeTruthy();
  });

  it("links the definitions of other kinds an alias refusal names", () => {
    renderWithoutAntdStyles(
      <MemoryRouter>
        <DefinitionRefusal
          networkId="clinic"
          refusal={{
            description: "Invalid declarations",
            details: 'relation type "treats" alias "主治" is the name of object type "doctor"',
          }}
          saved={{ id: "treats", kind: "relation_type" }}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link").getAttribute("href")).toBe(
      "/knowledge-network/workspace/clinic/object-types/doctor/detail",
    );
  });
});
