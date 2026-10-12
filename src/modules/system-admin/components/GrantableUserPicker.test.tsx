/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listGrantableUsersForObject: vi.fn(),
}));

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/modules/system-admin/services/authz.service", () => ({
  listGrantableUsersForObject: mocks.listGrantableUsersForObject,
}));

import { GrantableUserPicker } from "./GrantableUserPicker";

const originalMatchMedia = window.matchMedia;

describe("GrantableUserPicker", () => {
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

  it("loads a first page and searches through the object-scoped candidate endpoint", async () => {
    const alice = {
      account: "alice",
      accountType: "local",
      email: "",
      enabled: true,
      id: "user-1",
      name: "Alice",
      roleIds: [],
      telephone: "",
    };
    const bob = { ...alice, account: "bob", id: "user-2", name: "Bob" };
    mocks.listGrantableUsersForObject.mockImplementation(
      (_resourceType: string, _resourceId: string, search: string) =>
        Promise.resolve(search ? [alice] : [bob]),
    );
    const onChange = vi.fn();

    render(
      <GrantableUserPicker
        onChange={onChange}
        presentation="inline"
        resourceId="network-1/object-1"
        resourceType="object_type"
      />,
    );

    await waitFor(() =>
      expect(mocks.listGrantableUsersForObject).toHaveBeenCalledWith(
        "object_type",
        "network-1/object-1",
        "",
      ),
    );
    fireEvent.change(
      screen.getByRole("textbox", { name: "systemAdmin.userPicker.searchAllUsers" }),
      { target: { value: "alice" } },
    );

    await waitFor(() =>
      expect(mocks.listGrantableUsersForObject).toHaveBeenCalledWith(
        "object_type",
        "network-1/object-1",
        "alice",
      ),
    );
    fireEvent.click(await screen.findByRole("option", { name: /Alice/ }));
    expect(onChange).toHaveBeenCalledWith("user-1");

    fireEvent.change(
      screen.getByRole("textbox", { name: "systemAdmin.userPicker.searchAllUsers" }),
      { target: { value: "" } },
    );
    await waitFor(() =>
      expect(mocks.listGrantableUsersForObject).toHaveBeenLastCalledWith(
        "object_type",
        "network-1/object-1",
        "",
      ),
    );
    expect(await screen.findByRole("option", { name: /Bob/ })).not.toBeNull();
  });

  it("contains a failed search inside the picker", async () => {
    mocks.listGrantableUsersForObject.mockRejectedValue(new Error("forbidden"));
    render(
      <GrantableUserPicker presentation="inline" resourceId="catalog-1" resourceType="catalog" />,
    );

    fireEvent.change(
      screen.getByRole("textbox", { name: "systemAdmin.userPicker.searchAllUsers" }),
      { target: { value: "alice" } },
    );

    expect(await screen.findByText("common.requestFailed")).not.toBeNull();
  });
});
