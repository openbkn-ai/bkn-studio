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

import { RelationDeclarationRefusal } from "./RelationDeclarationRefusal";

afterEach(cleanup);

// The backend's refusal of a second fallback path for a primary relation.
const refusal = {
  description: "Invalid declarations",
  details:
    'relation type "order_for_patient_by_phone" fallback_for "order_for_patient": relation type "order_for_patient_by_id_card" is already its fallback path; a primary relation has one',
};

describe("RelationDeclarationRefusal", () => {
  it("links each other relation type the details name, but not the one saved", () => {
    renderWithoutAntdStyles(
      <MemoryRouter>
        <RelationDeclarationRefusal
          networkId="clinic"
          refusal={refusal}
          relationTypeId="order_for_patient_by_phone"
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
});
