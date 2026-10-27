/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { UserPill } from "./UserPill";

const menuItems = [{ key: "account", label: "Account settings" }];

describe("UserPill", () => {
  it("keeps the account menu available when there are no roles", async () => {
    render(<UserPill menuItems={menuItems} name="Alice" roles={[]} />);

    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Alice" }));
    await waitFor(() => {
      expect(screen.getByRole("menuitem", { name: "Account settings" })).toBeVisible();
    });
  });

  it("shows all roles on hover without changing the account menu click", async () => {
    const roles = Array.from({ length: 100 }, (_, index) => `role-${index}`);
    roles[99] = "a-very-long-role-name-without-any-spaces-or-natural-breaks";
    render(<UserPill menuItems={menuItems} name="Alice" roles={roles} />);

    const summary = document.querySelector(".console-user-roles-summary");
    expect(summary).toHaveTextContent(roles.join("、"));
    fireEvent.mouseEnter(summary!);

    const list = await screen.findByRole("list");
    expect(within(list).getAllByRole("listitem")).toHaveLength(100);
    await waitFor(() => {
      expect(within(list).getByText(roles[99])).toBeVisible();
    });

    fireEvent.click(screen.getByRole("button", { name: /Alice/ }));
    await waitFor(() => {
      expect(screen.getByRole("menuitem", { name: "Account settings" })).toBeVisible();
    });
  });
});
