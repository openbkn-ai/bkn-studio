/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listSamples = vi.hoisted(() => vi.fn());
const createSampleInstallation = vi.hoisted(() => vi.fn());
const retrySampleInstallation = vi.hoisted(() => vi.fn());
const getSampleInstallation = vi.hoisted(() => vi.fn());
const navigate = vi.hoisted(() => vi.fn());

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values ? `${key}:${JSON.stringify(values)}` : key,
  }),
}));

vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router-dom")>()),
  useNavigate: () => navigate,
}));

vi.mock("@/modules/home/services/sample-catalog.service", () => ({
  SampleRequestError: class SampleRequestError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
  createSampleInstallation,
  getSampleInstallation,
  listSamples,
  retrySampleInstallation,
}));

import { SampleExperience } from "@/modules/home/scenes/SampleExperience";
import { SampleRequestError } from "@/modules/home/services/sample-catalog.service";

const network = { displayName: "Northwind network", id: "northwind_kn" };

function sample(overrides: Record<string, unknown> = {}) {
  return {
    displayName: "Northwind",
    expectedTables: 4,
    installationId: null,
    installable: true,
    knowledgeNetwork: network,
    licenseNote: "Demo data",
    message: "",
    name: "northwind",
    questions: [],
    status: "not_installed",
    summary: "A small order sample.",
    version: "0.1.0",
    ...overrides,
  };
}

function renderExperience() {
  render(<SampleExperience />);
}

describe("SampleExperience", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSampleInstallation.mockImplementation((sampleName: string, installationId: string) => ({
      id: installationId,
      sample: sampleName,
      stages: [{ id: "database", name: "Prepare database", state: "running" }],
      status: "installing",
      version: "0.1.0",
    }));
  });

  it("asks for confirmation before installing a catalog sample", async () => {
    listSamples.mockResolvedValue({ samples: [sample()], sourceRejected: false });
    createSampleInstallation.mockResolvedValue({
      id: "inst-1",
      sample: "northwind",
      stages: [],
      status: "installing",
      version: "0.1.0",
    });
    renderExperience();

    fireEvent.click(await screen.findByRole("button", { name: "home.sample.actions.install" }));
    expect(screen.getByText("home.sample.confirm.irreversible")).toBeTruthy();
    expect(screen.getByText(/bkn-sample-northwind/)).toBeTruthy();
    expect(createSampleInstallation).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "home.sample.actions.start" }));

    await waitFor(() => expect(createSampleInstallation).toHaveBeenCalledWith("northwind"));
  });

  it("closes the confirm dialog and shows the install error", async () => {
    listSamples.mockResolvedValue({ samples: [sample()], sourceRejected: false });
    createSampleInstallation.mockRejectedValue(
      new SampleRequestError("forbidden", "Need an administrator"),
    );
    renderExperience();

    fireEvent.click(await screen.findByRole("button", { name: "home.sample.actions.install" }));
    fireEvent.click(screen.getByRole("button", { name: "home.sample.actions.start" }));

    expect(await screen.findByText("Need an administrator")).toBeTruthy();
    await waitFor(() => expect(screen.queryByText("home.sample.confirm.irreversible")).toBeNull());
  });

  it("polls the created installation when the catalog omits its id", async () => {
    listSamples
      .mockResolvedValueOnce({ samples: [sample()], sourceRejected: false })
      .mockResolvedValue({
        samples: [sample({ installable: false, installationId: null, status: "installing" })],
        sourceRejected: false,
      });
    createSampleInstallation.mockResolvedValue({
      id: "inst-created",
      sample: "northwind",
      stages: [],
      status: "installing",
      version: "0.1.0",
    });
    renderExperience();

    fireEvent.click(await screen.findByRole("button", { name: "home.sample.actions.install" }));
    fireEvent.click(screen.getByRole("button", { name: "home.sample.actions.start" }));

    await waitFor(() =>
      expect(getSampleInstallation).toHaveBeenCalledWith("northwind", "inst-created"),
    );
  });

  it("shows an installed sample without install or retry", async () => {
    listSamples.mockResolvedValue({
      samples: [
        sample({
          installable: false,
          questions: ["Which orders are open?"],
          status: "installed",
        }),
      ],
      sourceRejected: false,
    });
    renderExperience();

    expect(await screen.findByRole("button", { name: "home.sample.actions.open" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "home.sample.actions.install" })).toBeNull();
    expect(screen.queryByRole("button", { name: "home.sample.actions.retry" })).toBeNull();
    expect(screen.getByText("Which orders are open?")).toBeTruthy();
    expect(screen.getByText("home.sample.llmNote")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "home.sample.actions.open" }));
    expect(navigate).toHaveBeenCalledWith("/knowledge-network/workspace/northwind_kn/overview");
  });

  it("disables install and retry for a non-admin", async () => {
    listSamples.mockResolvedValue({
      samples: [
        sample({ installable: false }),
        sample({
          displayName: "Harbor",
          installationId: "inst-2",
          installable: false,
          name: "harbor",
          status: "failed",
        }),
      ],
      sourceRejected: false,
    });
    renderExperience();

    const install = await screen.findByRole("button", { name: "home.sample.actions.install" });
    const retry = screen.getByRole("button", { name: "home.sample.actions.retry" });

    expect(install).toHaveProperty("disabled", true);
    expect(retry).toHaveProperty("disabled", true);
    expect(screen.getAllByText("home.sample.adminHint")).toHaveLength(2);
  });

  it("retries a failed installation and restores an in-progress one", async () => {
    listSamples.mockResolvedValue({
      samples: [
        sample({
          installationId: "inst-9",
          message: "Smoke failed",
          status: "failed",
        }),
        sample({
          displayName: "Harbor",
          installationId: "inst-1",
          installable: false,
          name: "harbor",
          status: "installing",
        }),
      ],
      sourceRejected: false,
    });
    retrySampleInstallation.mockResolvedValue({
      id: "inst-9",
      sample: "northwind",
      stages: [],
      status: "installing",
      version: "0.1.0",
    });
    renderExperience();

    fireEvent.click(await screen.findByRole("button", { name: "home.sample.actions.retry" }));
    expect(screen.queryByText("home.sample.confirm.irreversible")).toBeNull();
    await waitFor(() =>
      expect(retrySampleInstallation).toHaveBeenCalledWith("northwind", "inst-9"),
    );
    await waitFor(() => expect(getSampleInstallation).toHaveBeenCalledWith("harbor", "inst-1"));
    expect(await screen.findByText("1. Prepare database")).toBeTruthy();
  });

  it("shows a name conflict without retry", async () => {
    listSamples.mockResolvedValue({
      samples: [sample({ installable: false, message: "Catalog exists", status: "conflict" })],
      sourceRejected: false,
    });
    renderExperience();

    expect(await screen.findByText("Catalog exists")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "home.sample.actions.retry" })).toBeNull();
    expect(screen.queryByRole("button", { name: "home.sample.actions.install" })).toBeNull();
  });

  it("shows the unavailable banner when the source is rejected", async () => {
    listSamples.mockResolvedValue({
      samples: [sample({ installable: false, status: "unavailable" })],
      sourceRejected: true,
    });
    renderExperience();

    expect(await screen.findByText("home.sample.unavailableBanner")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "home.sample.actions.install" })).toBeNull();
  });
});
