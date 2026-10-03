/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ listGrantableRolesForObject: vi.fn() }));

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({
    t: (key: string, options?: { count?: number }) =>
      typeof options?.count === "number" ? `${key}:${options.count}` : key,
  }),
}));
vi.mock("@/modules/system-admin/services/authz.service", () => ({
  listGrantableRolesForObject: mocks.listGrantableRolesForObject,
}));

import { GrantableRolePicker } from "./GrantableRolePicker";

const originalMatchMedia = window.matchMedia;

describe("GrantableRolePicker", () => {
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
  beforeEach(() => vi.clearAllMocks());

  it("loads and searches minimal roles through the exact-object endpoint", async () => {
    mocks.listGrantableRolesForObject.mockResolvedValue([
      { description: "Reads data", id: "role-readers", name: "Readers" },
    ]);
    const onChange = vi.fn();
    render(
      <GrantableRolePicker
        onChange={onChange}
        presentation="inline"
        resourceId="network-1/object-1"
        resourceType="object_type"
      />,
    );

    await waitFor(() =>
      expect(mocks.listGrantableRolesForObject).toHaveBeenCalledWith(
        "object_type",
        "network-1/object-1",
        "",
      ),
    );
    fireEvent.change(
      screen.getByRole("textbox", {
        name: "knowledgeNetwork.propertyAuthorizationSearchRole",
      }),
      { target: { value: "read" } },
    );
    await waitFor(() =>
      expect(mocks.listGrantableRolesForObject).toHaveBeenCalledWith(
        "object_type",
        "network-1/object-1",
        "read",
      ),
    );
    fireEvent.click(await screen.findByRole("option", { name: /Readers/ }));
    expect(onChange).toHaveBeenCalledWith("role-readers");
  });

  it("keeps initial roles selectable when the empty search request fails", async () => {
    mocks.listGrantableRolesForObject.mockRejectedValue(new Error("temporary failure"));
    render(
      <GrantableRolePicker
        initialRoles={[{ description: "Reads data", id: "role-readers", name: "Readers" }]}
        presentation="inline"
        resourceId="network-1/object-1"
        resourceType="object_type"
      />,
    );

    expect(await screen.findByText("common.requestFailed")).not.toBeNull();
    expect(screen.getByRole("option", { name: /Readers/ })).not.toBeNull();
    expect(screen.getByText("systemAdmin.userPicker.resultCount:1")).not.toBeNull();

    fireEvent.change(
      screen.getByRole("textbox", {
        name: "knowledgeNetwork.propertyAuthorizationSearchRole",
      }),
      { target: { value: "missing" } },
    );
    await waitFor(() =>
      expect(mocks.listGrantableRolesForObject).toHaveBeenLastCalledWith(
        "object_type",
        "network-1/object-1",
        "missing",
      ),
    );
    await waitFor(() => expect(screen.queryByRole("option", { name: /Readers/ })).toBeNull());
  });

  it("forwards the id to the select control", () => {
    mocks.listGrantableRolesForObject.mockResolvedValue([]);
    render(
      <GrantableRolePicker
        id="object-grant-subject"
        resourceId="network-1/object-1"
        resourceType="object_type"
      />,
    );

    expect(document.getElementById("object-grant-subject")).not.toBeNull();
  });
});
