/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { createMemoryRouter, Link, RouterProvider, useLocation } from "react-router-dom";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { useUnsavedChanges } from "./unsaved";
import { UnsavedLeaveGuard } from "./UnsavedLeaveGuard";

/** An editor: typing makes a change not saved; saving answers as `save` does. */
function Editor({ save }: { save: () => Promise<boolean> }) {
  const [value, setValue] = useState("");
  const [saved, setSaved] = useState("");
  useUnsavedChanges(value !== saved, async () => {
    const ok = await save();
    if (ok) {
      setSaved(value);
    }
    return ok;
  });
  return (
    <input aria-label="name" onChange={(event) => setValue(event.target.value)} value={value} />
  );
}

function Where() {
  const location = useLocation();
  return <div data-testid="where">{`${location.pathname}${location.search}`}</div>;
}

function renderGuard(save: () => Promise<boolean> = () => Promise.resolve(true)) {
  const page = (
    <UnsavedLeaveGuard>
      <Editor save={save} />
      <Link to="/bkn-project/p1/scenarios">scenarios</Link>
      <Link to="/bkn-project/p1/model?object=teams">same page</Link>
      <Where />
    </UnsavedLeaveGuard>
  );
  const router = createMemoryRouter(
    [
      { element: page, path: "/bkn-project/p1/model" },
      { element: <Where />, path: "*" },
    ],
    { initialEntries: ["/bkn-project/p1/model"] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

const type = () => fireEvent.change(screen.getByLabelText("name"), { target: { value: "Teams" } });
const leave = () => fireEvent.click(screen.getByText("scenarios"));
const where = () => screen.getByTestId("where");

describe("UnsavedLeaveGuard", () => {
  beforeAll(() => {
    // Ant Design's modal reads media queries, which jsdom lacks.
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        addEventListener: vi.fn(),
        addListener: vi.fn(),
        dispatchEvent: vi.fn(),
        matches: false,
        media: query,
        onchange: null,
        removeEventListener: vi.fn(),
        removeListener: vi.fn(),
      })),
    );
  });

  it("leaves at once when nothing is left unsaved", () => {
    renderGuard();
    leave();
    expect(where()).toHaveTextContent("/bkn-project/p1/scenarios");
  });

  it("asks before leaving with changes not saved, and stays when asked to", async () => {
    renderGuard();
    type();
    leave();

    expect(await screen.findByText("bknProject.leaveUnsaved.title")).toBeInTheDocument();
    expect(where()).toHaveTextContent("/bkn-project/p1/model");
    fireEvent.click(screen.getByRole("button", { name: "bknProject.leaveUnsaved.stay" }));
    await waitFor(() =>
      expect(screen.queryByText("bknProject.leaveUnsaved.title")).not.toBeVisible(),
    );
    expect(screen.getByLabelText("name")).toHaveValue("Teams");
  });

  it("leaves without saving when asked to", async () => {
    const save = vi.fn(() => Promise.resolve(true));
    renderGuard(save);
    type();
    leave();

    fireEvent.click(await screen.findByRole("button", { name: "bknProject.leaveUnsaved.discard" }));
    await waitFor(() => expect(where()).toHaveTextContent("/bkn-project/p1/scenarios"));
    expect(save).not.toHaveBeenCalled();
  });

  it("saves, then leaves; a save refused stays where the editor says why", async () => {
    const save = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    renderGuard(save);
    type();
    leave();

    fireEvent.click(await screen.findByRole("button", { name: "bknProject.leaveUnsaved.save" }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(where()).toHaveTextContent("/bkn-project/p1/model");

    leave();
    fireEvent.click(await screen.findByRole("button", { name: "bknProject.leaveUnsaved.save" }));
    await waitFor(() => expect(where()).toHaveTextContent("/bkn-project/p1/scenarios"));
    expect(save).toHaveBeenCalledTimes(2);
  });

  it("does not ask when only the page's own state in the address changes", () => {
    renderGuard();
    type();
    fireEvent.click(screen.getByText("same page"));
    expect(where()).toHaveTextContent("/bkn-project/p1/model?object=teams");
    expect(screen.queryByText("bknProject.leaveUnsaved.title")).toBeNull();
  });

  it("asks the browser to warn before reloading or closing with changes not saved", () => {
    renderGuard();
    const quiet = new Event("beforeunload", { cancelable: true });
    act(() => {
      window.dispatchEvent(quiet);
    });
    expect(quiet.defaultPrevented).toBe(false);

    type();
    const warned = new Event("beforeunload", { cancelable: true });
    act(() => {
      window.dispatchEvent(warned);
    });
    expect(warned.defaultPrevented).toBe(true);
  });
});
