/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { render } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { ObjectTypeGraphSidebar } from "./ObjectTypeGraphSidebar";

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
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

describe("ObjectTypeGraphSidebar", () => {
  it("keeps pagination compact when there are many pages", () => {
    const { container } = render(
      <ObjectTypeGraphSidebar
        emptyContent={null}
        items={[]}
        loading={false}
        onPageChange={vi.fn()}
        onSelect={vi.fn()}
        page={10}
        pageSize={10}
        resourceCountLabel="resources"
        resourceCounts={{}}
        selectedId=""
        totalCount={200}
      />,
    );

    expect(container.querySelectorAll(".ant-pagination-item")).toHaveLength(5);
    expect(container.querySelector(".ant-pagination-jump-prev")).not.toBeNull();
    expect(container.querySelector(".ant-pagination-jump-next")).not.toBeNull();
  });
});
