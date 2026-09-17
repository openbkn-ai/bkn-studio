/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { render, screen, within } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import i18n from "@/app/locales/i18n";
import { resourceTypeLabel } from "@/modules/system-admin/utils/resource-catalog";

type MockSelectOption = { label: string; options?: MockSelectOption[]; value?: string };

vi.mock("@/modules/system-admin/services/authorization-registry.service", async (importOriginal) => {
  const service = await importOriginal<typeof import("@/modules/system-admin/services/authorization-registry.service")>();
  return {
    ...service,
    usesMockAuthorizationRegistry: false,
    getAuthorizationRegistry: vi.fn(() => Promise.resolve(service.mockAuthorizationRegistry())),
  };
});

vi.mock("antd", async (importOriginal) => ({
  ...(await importOriginal<typeof import("antd")>()),
  Select: ({ options }: { options?: MockSelectOption[] }) => (
    <div role="listbox">
      {options?.map((option) => option.options ? (
        <div aria-label={option.label} key={option.label} role="group">
          {option.options.map((child) => (
            <div key={child.value} role="option">{child.label}</div>
          ))}
        </div>
      ) : (
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
  it("offers Function as its own role grant resource after the registry loads", async () => {
    render(<ResourceGrantEditor onChange={vi.fn()} value={[]} />);

    const executionGroup = await screen.findByRole("group", {
      name: i18n.t("systemAdmin.objectGrants.objectTypeGroups.execution"),
    });
    expect(within(executionGroup).getByRole("option", { name: resourceTypeLabel("function") })).toBeTruthy();
  });
});
