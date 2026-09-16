/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { resourceTypeLabel } from "@/modules/system-admin/utils/resource-catalog";

vi.mock("antd", async (importOriginal) => ({
  ...(await importOriginal<typeof import("antd")>()),
  Select: ({ options }: { options?: Array<{ options?: Array<{ label: string; value: string }> }> }) => (
    <div role="listbox">
      {options?.flatMap((group) => group.options ?? []).map((option) => (
        <div key={option.value} role="option">{option.label}</div>
      ))}
    </div>
  ),
}));

import { ResourceGrantEditor } from "./ResourceGrantEditor";

beforeAll(() => {
  vi.stubGlobal("matchMedia", vi.fn(() => ({
    addEventListener: vi.fn(),
    addListener: vi.fn(),
    matches: false,
    removeEventListener: vi.fn(),
    removeListener: vi.fn(),
  })));
});

describe("ResourceGrantEditor resource choices", () => {
  it("offers Function as its own role grant resource", () => {
    render(<ResourceGrantEditor onChange={vi.fn()} value={[]} />);

    expect(screen.getByRole("option", { name: resourceTypeLabel("function") })).toBeTruthy();
  });
});
