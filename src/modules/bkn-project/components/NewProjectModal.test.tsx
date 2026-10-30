/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const createProjectMock = vi.hoisted(() => vi.fn());
const translate = vi.hoisted(() => (key: string) => key);

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: translate }),
}));

vi.mock("@/modules/bkn-project/services/project.service", () => ({
  createProject: createProjectMock,
}));

import { renderWithoutAntdStyles } from "@/test/render-without-antd-styles";

import { NewProjectModal } from "./NewProjectModal";

const networks = [{ id: "orders", name: "Orders network" }];

function renderModal(onCreated = vi.fn(), catalogsError: string | null = null) {
  // Ant Design's injected styles make each jsdom query slow enough to time out under load.
  renderWithoutAntdStyles(
    <NewProjectModal
      catalogs={[{ id: "c1", name: "ERP" }]}
      catalogsError={catalogsError}
      networks={networks}
      networksError={null}
      onCancel={vi.fn()}
      onCreated={onCreated}
      open
    />,
  );
  return onCreated;
}

function pickOption(placeholder: string, label: string) {
  const select = screen.getByText(placeholder).closest(".ant-select") as HTMLElement;
  fireEvent.mouseDown(select.querySelector(".ant-select-selector") as HTMLElement);
  fireEvent.click(screen.getByTitle(label));
}

describe("NewProjectModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Ant Design's responsive grid observes media queries; jsdom has none.
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

  it("requires a name and a network before creating", async () => {
    renderModal();

    fireEvent.click(screen.getByText("bknProject.create.submit"));

    expect(await screen.findByText("bknProject.create.nameRequired")).toBeInTheDocument();
    expect(screen.getByText("bknProject.create.networkRequired")).toBeInTheDocument();
    expect(createProjectMock).not.toHaveBeenCalled();
  });

  it("creates a project of an existing network with the chosen catalogs", async () => {
    const created = { id: "p1" };
    createProjectMock.mockResolvedValue(created);
    const onCreated = renderModal();

    fireEvent.change(screen.getByPlaceholderText("bknProject.create.namePlaceholder"), {
      target: { value: "Orders" },
    });
    pickOption("bknProject.create.networkPlaceholder", "Orders network");
    pickOption("bknProject.create.catalogsPlaceholder", "ERP");
    fireEvent.click(screen.getByText("bknProject.create.submit"));

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(created));
    expect(createProjectMock).toHaveBeenCalledWith({
      catalogIds: ["c1"],
      knId: "orders",
      name: "Orders",
    });
  });

  it("creates a project of a new network, which needs its name", async () => {
    createProjectMock.mockResolvedValue({ id: "p1" });
    const onCreated = renderModal();

    fireEvent.click(screen.getByText("bknProject.create.newNetwork"));
    fireEvent.change(screen.getByPlaceholderText("bknProject.create.namePlaceholder"), {
      target: { value: "Orders" },
    });
    fireEvent.click(screen.getByText("bknProject.create.submit"));
    expect(await screen.findByText("bknProject.create.newNetworkNameRequired")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("bknProject.create.newNetworkNamePlaceholder"), {
      target: { value: "Delivery" },
    });
    fireEvent.click(screen.getByText("bknProject.create.submit"));

    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(createProjectMock).toHaveBeenCalledWith({
      catalogIds: [],
      name: "Orders",
      newKnName: "Delivery",
    });
  });

  it("stays open when creating fails", async () => {
    createProjectMock.mockRejectedValue(new Error("forbidden"));
    const onCreated = renderModal();

    fireEvent.click(screen.getByText("bknProject.create.newNetwork"));
    fireEvent.change(screen.getByPlaceholderText("bknProject.create.namePlaceholder"), {
      target: { value: "Orders" },
    });
    fireEvent.change(screen.getByPlaceholderText("bknProject.create.newNetworkNamePlaceholder"), {
      target: { value: "Delivery" },
    });
    fireEvent.click(screen.getByText("bknProject.create.submit"));

    await waitFor(() => expect(createProjectMock).toHaveBeenCalled());
    expect(onCreated).not.toHaveBeenCalled();
    expect(screen.getByText("bknProject.create.title")).toBeInTheDocument();
  });

  it("shows why the catalogs could not be loaded", () => {
    renderModal(vi.fn(), "catalogs are down");

    expect(screen.getByText("bknProject.create.catalogsLoadFailed")).toBeInTheDocument();
    expect(screen.getByText("catalogs are down")).toBeInTheDocument();
  });
});
