/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { render, screen, within } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { ValueTypeEnumItems } from "./ValueTypeEnumItems";

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

const PREFIX = "knowledgeNetwork.valueTypes.enumColumn";

describe("ValueTypeEnumItems status column", () => {
  beforeAll(() => {
    // antd's Table reads the viewport through matchMedia, which jsdom lacks.
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

  it("shows an active status for items that omit or clear deprecated, and a deprecated one otherwise", () => {
    render(
      <ValueTypeEnumItems
        items={[
          { display: "Applied", value: "applied" },
          { deprecated: false, display: "Refunding", value: "refunding" },
          { deprecated: true, display: "Paid", value: "paid" },
        ]}
      />,
    );

    const rowOf = (value: string) => screen.getByText(value).closest("tr") as HTMLElement;
    expect(within(rowOf("applied")).getByText(`${PREFIX}.active`)).toBeTruthy();
    expect(within(rowOf("refunding")).getByText(`${PREFIX}.active`)).toBeTruthy();
    expect(within(rowOf("paid")).getByText(`${PREFIX}.deprecated`)).toBeTruthy();
    expect(within(rowOf("paid")).queryByText(`${PREFIX}.active`)).toBeNull();
  });
});
