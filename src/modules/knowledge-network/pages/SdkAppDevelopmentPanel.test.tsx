/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SdkAppDevelopmentPanel } from "./SdkAppDevelopmentPanel";

const mocks = vi.hoisted(() => ({ listKnowledgeNetworks: vi.fn() }));

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

type Option = { label: string; value: string };

// A native select stands in for antd's: options, search text and the picked option.
vi.mock("antd", () => ({
  Button: ({
    children,
    disabled,
    onClick,
  }: {
    children: ReactNode;
    disabled?: boolean;
    onClick: () => void;
  }) => (
    <button type="button" disabled={disabled} onClick={onClick}>
      {children}
    </button>
  ),
  Select: ({
    notFoundContent,
    onChange,
    onPopupScroll,
    onSearch,
    options,
    value,
  }: {
    notFoundContent: ReactNode;
    onChange: (value: string, option: Option) => void;
    onPopupScroll: (event: { currentTarget: HTMLElement }) => void;
    onSearch: (text: string) => void;
    options: Option[];
    value?: string;
  }) => (
    <div>
      <input aria-label="search" onChange={(event) => onSearch(event.target.value)} />
      <div data-testid="dropdown" onScroll={onPopupScroll} />
      <select
        aria-label="network"
        value={value ?? ""}
        onChange={(event) => {
          const option = options.find((item) => item.value === event.target.value);
          if (option) onChange(option.value, option);
        }}
      >
        <option value="" />
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {options.length === 0 ? <p>{notFoundContent}</p> : null}
    </div>
  ),
}));

vi.mock("@/modules/knowledge-network/services/network.service", () => ({
  listKnowledgeNetworks: mocks.listKnowledgeNetworks,
}));

function network(id: string, name: string) {
  return { id, name, identifier: `${id}-identifier` };
}

function renderPanel() {
  render(
    <MemoryRouter initialEntries={["/knowledge-network/integration?tab=sdk"]}>
      <Routes>
        <Route path="/knowledge-network/integration" element={<SdkAppDevelopmentPanel />} />
        <Route
          path="/knowledge-network/workspace/:networkId/develop"
          element={<p>develop page</p>}
        />
      </Routes>
    </MemoryRouter>,
  );
}

const openButton = () =>
  screen.getByRole("button", { name: /knowledgeNetwork\.integration\.sdk\.open/ });

beforeEach(() => {
  mocks.listKnowledgeNetworks.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("SdkAppDevelopmentPanel", () => {
  it("opens the App development page of the picked network", async () => {
    mocks.listKnowledgeNetworks.mockResolvedValue({
      items: [network("kn-1", "Supply chain"), network("kn-2", "Sales")],
      total: 2,
    });
    renderPanel();

    await screen.findByRole("option", { name: "Sales (kn-2-identifier)" });
    expect(mocks.listKnowledgeNetworks).toHaveBeenCalledWith(
      expect.objectContaining({ keyword: "", page: 1, sortBy: "name", direction: "asc" }),
    );
    expect(openButton()).toBeDisabled();

    fireEvent.change(screen.getByRole("combobox", { name: "network" }), {
      target: { value: "kn-2" },
    });
    fireEvent.click(openButton());

    expect(await screen.findByText("develop page")).toBeTruthy();
  });

  it("searches by name, keeps the picked network, and says when nothing else matches", async () => {
    mocks.listKnowledgeNetworks.mockResolvedValueOnce({
      items: [network("kn-1", "Supply chain")],
      total: 1,
    });
    mocks.listKnowledgeNetworks.mockResolvedValue({ items: [], total: 0 });
    renderPanel();
    await screen.findByRole("option", { name: "Supply chain (kn-1-identifier)" });
    fireEvent.change(screen.getByRole("combobox", { name: "network" }), {
      target: { value: "kn-1" },
    });

    fireEvent.change(screen.getByRole("textbox", { name: "search" }), {
      target: { value: " orders " },
    });

    await waitFor(() => {
      expect(mocks.listKnowledgeNetworks).toHaveBeenLastCalledWith(
        expect.objectContaining({ keyword: "orders" }),
      );
    });
    expect(screen.getByRole("option", { name: "Supply chain (kn-1-identifier)" })).toBeTruthy();
    expect(openButton()).not.toBeDisabled();
  });

  it("says when there are no networks at all", async () => {
    mocks.listKnowledgeNetworks.mockResolvedValue({ items: [], total: 0 });
    renderPanel();

    expect(
      await screen.findByText("knowledgeNetwork.integration.networkPicker.noNetworks"),
    ).toBeTruthy();
  });

  it("offers a retry when the networks cannot be loaded", async () => {
    mocks.listKnowledgeNetworks.mockRejectedValueOnce(new Error("503"));
    mocks.listKnowledgeNetworks.mockResolvedValue({
      items: [network("kn-1", "Supply chain")],
      total: 1,
    });
    renderPanel();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "knowledgeNetwork.integration.networkPicker.loadFailed",
    );
    fireEvent.click(
      screen.getByRole("button", { name: /knowledgeNetwork\.integration\.networkPicker\.retry/ }),
    );

    expect(
      await screen.findByRole("option", { name: "Supply chain (kn-1-identifier)" }),
    ).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("loads the next page when the dropdown is scrolled to its end", async () => {
    const firstPage = Array.from({ length: 50 }, (_, i) => network(`kn-${i}`, `Network ${i}`));
    mocks.listKnowledgeNetworks.mockResolvedValueOnce({ items: firstPage, total: 51 });
    mocks.listKnowledgeNetworks.mockResolvedValueOnce({
      items: [network("kn-50", "Network 50")],
      total: 51,
    });
    renderPanel();
    await screen.findByRole("option", { name: "Network 49 (kn-49-identifier)" });

    const dropdown = screen.getByTestId("dropdown");
    Object.defineProperties(dropdown, {
      scrollTop: { configurable: true, value: 760 },
      clientHeight: { configurable: true, value: 240 },
      scrollHeight: { configurable: true, value: 1000 },
    });
    fireEvent.scroll(dropdown);

    expect(
      await screen.findByRole("option", { name: "Network 50 (kn-50-identifier)" }),
    ).toBeTruthy();
    expect(mocks.listKnowledgeNetworks).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 2, pageSize: 50, keyword: "" }),
    );

    // Everything is loaded: further scrolling asks for nothing more.
    fireEvent.scroll(dropdown);
    expect(mocks.listKnowledgeNetworks).toHaveBeenCalledTimes(2);
  });
});
