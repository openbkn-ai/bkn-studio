/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { homeEnUS } from "@/modules/home/locales/en-US";
import { homeZhCN } from "@/modules/home/locales/zh-CN";

const downloadErrorLocale = vi.hoisted(() => ({ value: null as "zh-CN" | "en-US" | null }));
const listSamples = vi.hoisted(() => vi.fn());
const createSampleInstallation = vi.hoisted(() => vi.fn());
const retrySampleInstallation = vi.hoisted(() => vi.fn());
const getSampleInstallation = vi.hoisted(() => vi.fn());
const navigate = vi.hoisted(() => vi.fn());
const getSampleReleaseNotes = vi.hoisted(() => vi.fn());
const listSampleInstallations = vi.hoisted(() => vi.fn());
const refreshSamples = vi.hoisted(() => vi.fn());
const uninstallSample = vi.hoisted(() => vi.fn());
const deleteSamplePackage = vi.hoisted(() => vi.fn());
const scrollIntoView = vi.hoisted(() => vi.fn());

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({
    i18n: { language: "zh-CN", resolvedLanguage: "zh-CN" },
    t: (key: string, values?: Record<string, unknown>) => {
      if (downloadErrorLocale.value) {
        const messages =
          downloadErrorLocale.value === "zh-CN" ? homeZhCN.home.sample : homeEnUS.home.sample;
        const translations: Record<string, string> = {
          "home.sample.downloadFailed": messages.downloadFailed,
          "home.sample.downloadFailedAfterLink": messages.downloadFailedAfterLink,
          "home.sample.downloadOffline": messages.downloadOffline,
        };
        if (key in translations) return translations[key];
      }
      if (values && "defaultValue" in values) {
        const { defaultValue, ...rest } = values;
        if (Object.keys(rest).length === 0) {
          return (key.startsWith("home.sample.stages.") ||
            key.startsWith("home.sample.uninstallStages.")) &&
            ![
              "home.sample.stages.capabilities",
              "home.sample.stages.database",
              "home.sample.stages.discover",
              "home.sample.stages.knowledge",
              "home.sample.stages.verify",
              "home.sample.uninstallStages.knowledge",
              "home.sample.uninstallStages.capabilities",
              "home.sample.uninstallStages.discover",
              "home.sample.uninstallStages.database",
              "home.sample.uninstallStages.verify",
            ].includes(key)
            ? String(defaultValue)
            : key;
        }

        return `${key}:${JSON.stringify(rest)}`;
      }

      return values ? `${key}:${JSON.stringify(values)}` : key;
    },
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
  getSampleReleaseNotes,
  listSampleInstallations,
  refreshSamples,
  deleteSamplePackage,
  uninstallSample,
}));

import { SampleExperience } from "@/modules/home/scenes/SampleExperience";
import { SampleRequestError } from "@/modules/home/services/sample-catalog.service";
import styles from "./SampleExperience.module.css";

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
  it("keeps retry and confirms failed cleanup using the original installation version", async () => {
    const failed = sample({
      status: "failed",
      installationId: "inst-old",
      canUninstall: true,
      version: "0.1.4",
      source: "offline",
    });
    listSamples.mockResolvedValue({ samples: [failed], sourceRejected: false });
    getSampleInstallation.mockResolvedValue({
      id: "inst-old",
      sample: "northwind",
      version: "0.1.3",
      status: "failed",
      stages: [],
      error: { code: "discover_incomplete", message: "scan failed", stage: "discover" },
    });
    uninstallSample.mockResolvedValue({
      id: "inst-old",
      sample: "northwind",
      version: "0.1.3",
      status: "uninstalling",
      operation: "uninstall",
      stages: [],
    });
    renderExperience();
    const cleanup = await screen.findByRole("button", { name: "home.sample.cleanupFailed" });
    await waitFor(() => expect(getSampleInstallation).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: "home.sample.actions.failureDetails" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "home.sample.actions.retry" })).toBeEnabled(),
    );
    fireEvent.click(cleanup);
    await waitFor(() => {
      expect(
        screen.getByText('home.sample.cleanupFailedTitle:{"name":"Northwind","version":"0.1.3"}'),
      ).toBeVisible();
      expect(screen.getByText("home.sample.cleanupFailedWarning")).toBeVisible();
    });
    expect(uninstallSample).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "common.cancel" }));
    expect(uninstallSample).not.toHaveBeenCalled();
    fireEvent.click(cleanup);
    fireEvent.click(await screen.findByRole("button", { name: "common.delete" }));
    await waitFor(() => expect(uninstallSample).toHaveBeenCalledWith("northwind", "inst-old"));
    expect(retrySampleInstallation).not.toHaveBeenCalled();
  });

  it("does not offer failed cleanup without the existing operation capability", async () => {
    listSamples.mockResolvedValue({
      samples: [
        sample({
          status: "failed",
          installationId: "inst-old",
          installable: false,
          canUninstall: false,
        }),
      ],
      sourceRejected: false,
    });
    renderExperience();
    await screen.findByText("Northwind");
    expect(
      screen.queryByRole("button", { name: "home.sample.cleanupFailed" }),
    ).not.toBeInTheDocument();
  });

  it.each(["failed", "conflict"])(
    "allows cleanup of %s even when installation is unavailable",
    async (status) => {
      listSamples.mockResolvedValue({
        samples: [
          sample({ status, installationId: "inst-old", installable: false, canUninstall: true }),
        ],
        sourceRejected: false,
      });
      getSampleInstallation.mockResolvedValue({
        id: "inst-old",
        sample: "northwind",
        version: "0.1.0",
        status,
        stages: [],
      });
      uninstallSample.mockResolvedValue({
        id: "inst-old",
        sample: "northwind",
        version: "0.1.0",
        status: "uninstalling",
        operation: "uninstall",
        stages: [],
      });
      renderExperience();
      const cleanup = await screen.findByRole("button", { name: "home.sample.cleanupFailed" });
      expect(cleanup).toBeEnabled();
      fireEvent.click(screen.getByRole("button", { name: "home.sample.actions.failureDetails" }));
      expect(
        await screen.findByRole("button", { name: "home.sample.actions.retry" }),
      ).toBeDisabled();
      fireEvent.click(cleanup);
      fireEvent.click(await screen.findByRole("button", { name: "common.delete" }));
      await waitFor(() => expect(uninstallSample).toHaveBeenCalledWith("northwind", "inst-old"));
    },
  );

  it("allows cleanup after installation details fail without showing the imported version as the cleanup target", async () => {
    listSamples.mockResolvedValue({
      samples: [
        sample({
          status: "failed",
          installationId: "inst-old",
          version: "0.1.4",
          source: "offline",
          canUninstall: true,
        }),
      ],
      sourceRejected: false,
    });
    getSampleInstallation.mockRejectedValue(new Error("installation details unavailable"));
    uninstallSample.mockResolvedValue({
      id: "inst-old",
      sample: "northwind",
      version: "0.1.3",
      status: "uninstalling",
      operation: "uninstall",
      stages: [],
    });
    renderExperience();
    const cleanup = await screen.findByRole("button", { name: "home.sample.cleanupFailed" });
    fireEvent.click(screen.getByRole("button", { name: "home.sample.actions.failureDetails" }));
    await screen.findByText("home.sample.progressUnavailable");
    expect(cleanup).toBeEnabled();
    expect(screen.getByRole("button", { name: "home.sample.actions.retry" })).toBeDisabled();
    fireEvent.click(cleanup);
    await waitFor(() =>
      expect(
        screen.getByText(
          'home.sample.cleanupFailedTitle:{"name":"Northwind","version":"home.sample.versionUnknown"}',
        ),
      ).toBeVisible(),
    );
    fireEvent.click(screen.getByRole("button", { name: "common.delete" }));
    await waitFor(() => expect(uninstallSample).toHaveBeenCalledWith("northwind", "inst-old"));
  });

  it("disables cleanup when the catalog does not provide an installation ID", async () => {
    listSamples.mockResolvedValue({
      samples: [sample({ status: "failed", canUninstall: true })],
      sourceRejected: false,
    });
    renderExperience();
    expect(await screen.findByRole("button", { name: "home.sample.cleanupFailed" })).toBeDisabled();
    expect(uninstallSample).not.toHaveBeenCalled();
  });

  it("continues incomplete cleanup through the existing uninstall endpoint", async () => {
    listSamples.mockResolvedValue({
      samples: [
        sample({
          status: "uninstall_failed",
          installationId: "inst-old",
          installable: false,
          canUninstall: true,
        }),
      ],
      sourceRejected: false,
    });
    uninstallSample.mockResolvedValue({
      id: "inst-old",
      sample: "northwind",
      version: "0.1.0",
      status: "uninstalling",
      operation: "uninstall",
      stages: [],
    });
    renderExperience();
    fireEvent.click(await screen.findByRole("button", { name: "home.sample.retryUninstall" }));
    await waitFor(() =>
      expect(
        screen.getByText('home.sample.continueCleanupTitle:{"name":"Northwind","version":"0.1.0"}'),
      ).toBeVisible(),
    );
    fireEvent.click(await screen.findByRole("button", { name: "common.delete" }));
    await waitFor(() => expect(uninstallSample).toHaveBeenCalledWith("northwind", "inst-old"));
    expect(retrySampleInstallation).not.toHaveBeenCalled();
  });

  it("returns to the existing offline installation flow after failed cleanup", async () => {
    const failed = sample({
      status: "failed",
      installationId: "inst-old",
      canUninstall: true,
      source: "offline",
      manifestSha256: "a".repeat(64),
    });
    let cleaned = false;
    listSamples.mockImplementation(() =>
      Promise.resolve({
        samples: [cleaned ? { ...failed, status: "not_installed", canUninstall: false } : failed],
        sourceRejected: false,
      }),
    );
    getSampleInstallation.mockResolvedValue({
      id: "inst-old",
      sample: "northwind",
      version: "0.1.0",
      status: "failed",
      stages: [],
    });
    uninstallSample.mockImplementation(() => {
      cleaned = true;
      return Promise.resolve({
        id: "inst-old",
        sample: "northwind",
        version: "0.1.0",
        status: "uninstalling",
        operation: "uninstall",
        stages: [],
      });
    });
    createSampleInstallation.mockResolvedValue({
      id: "inst-new",
      sample: "northwind",
      version: "0.1.0",
      status: "installing",
      stages: [],
    });
    renderExperience();
    const cleanup = await screen.findByRole("button", { name: "home.sample.cleanupFailed" });
    await waitFor(() => expect(cleanup).toBeEnabled());
    fireEvent.click(cleanup);
    fireEvent.click(await screen.findByRole("button", { name: "common.delete" }));
    fireEvent.click(await screen.findByRole("button", { name: "home.sample.actions.install" }));
    await waitFor(() =>
      expect(createSampleInstallation).toHaveBeenCalledWith("northwind", {
        version: "0.1.0",
        manifestSha256: "a".repeat(64),
      }),
    );
    expect(retrySampleInstallation).not.toHaveBeenCalled();
  });

  it("confirms uninstall and displays its progress above release notes", async () => {
    const installed = sample({
      name: "supply-chain",
      status: "installed",
      installedVersion: "0.1.3",
      installationId: "inst-old",
      installable: false,
      canUninstall: true,
      hasReleaseNotes: true,
    });
    const task = {
      id: "inst-old",
      sample: "supply-chain",
      version: "0.1.3",
      status: "uninstalling",
      operation: "uninstall",
      stages: [{ id: "knowledge", name: "Remove network", state: "running" }],
    };
    listSamples
      .mockResolvedValueOnce({ samples: [installed], sourceRejected: false })
      .mockResolvedValue({
        samples: [{ ...installed, status: "uninstalling", canUninstall: false }],
        sourceRejected: false,
      });
    uninstallSample.mockResolvedValue(task);
    getSampleInstallation.mockResolvedValue(task);
    getSampleReleaseNotes.mockResolvedValue({
      version: "0.1.3",
      content: "Release notes",
      resolvedLocale: "zh-CN",
    });
    renderExperience();
    fireEvent.click(await screen.findByRole("button", { name: "home.sample.uninstall" }));
    expect(uninstallSample).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByText("home.sample.uninstallWarning")).toBeVisible());
    fireEvent.click(screen.getByRole("button", { name: "common.cancel" }));
    expect(uninstallSample).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "home.sample.uninstall" }));
    fireEvent.click(await screen.findByRole("button", { name: "common.delete" }));
    await waitFor(() => expect(uninstallSample).toHaveBeenCalledWith("supply-chain", "inst-old"));
    const stage = await screen.findByText("1. home.sample.uninstallStages.knowledge");
    const notes = await screen.findByText("Release notes");
    expect(stage.compareDocumentPosition(notes) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "home.sample.actions.install" }),
    ).not.toBeInTheDocument();
  });

  it("uses the server label for an unknown uninstall stage", async () => {
    listSamples.mockResolvedValue({
      samples: [sample({ status: "uninstalling", installationId: "inst-old" })],
      sourceRejected: false,
    });
    getSampleInstallation.mockResolvedValue({
      id: "inst-old",
      sample: "northwind",
      version: "0.1.0",
      operation: "uninstall",
      status: "uninstalling",
      stages: [{ id: "future_cleanup", name: "Remove future resource", state: "running" }],
    });
    renderExperience();
    fireEvent.click(await screen.findByRole("button", { name: "home.sample.actions.expand" }));
    expect(await screen.findByText("1. Remove future resource")).toBeVisible();
    expect(
      screen.queryByText("1. home.sample.uninstallStages.future_cleanup"),
    ).not.toBeInTheDocument();
  });

  it("hides uninstall without the backend capability", async () => {
    listSamples.mockResolvedValue({
      samples: [sample({ status: "installed", canUninstall: false })],
      sourceRejected: false,
    });
    renderExperience();
    await screen.findByText("Northwind");
    expect(screen.queryByRole("button", { name: "home.sample.uninstall" })).not.toBeInTheDocument();
  });

  it("installs the chosen published version with that version's manifest digest", async () => {
    listSamples.mockResolvedValue({
      samples: [
        sample({
          manifestSha256: "a".repeat(64),
          hasReleaseNotes: true,
          versions: [
            {
              version: "0.1.0",
              hasReleaseNotes: true,
              installable: true,
              manifestSha256: "a".repeat(64),
            },
            {
              version: "0.2.0",
              hasReleaseNotes: true,
              installable: true,
              manifestSha256: "b".repeat(64),
            },
          ],
        }),
      ],
      sourceRejected: false,
    });
    getSampleReleaseNotes.mockImplementation((_name: string, version: string) =>
      Promise.resolve({
        sample: "northwind",
        version,
        content: "Chosen version notes",
        digest: "sha256:" + "c".repeat(64),
        resolvedLocale: "zh-CN",
      }),
    );
    createSampleInstallation.mockResolvedValue({
      id: "inst-1",
      sample: "northwind",
      version: "0.2.0",
      status: "installing",
      stages: [],
    });
    renderExperience();
    fireEvent.click(await screen.findByRole("button", { name: "home.sample.actions.expand" }));
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "0.2.0" } });
    await waitFor(() =>
      expect(getSampleReleaseNotes).toHaveBeenCalledWith("northwind", "0.2.0", "zh-CN"),
    );
    fireEvent.click(screen.getByRole("button", { name: "home.sample.actions.install" }));
    await waitFor(() =>
      expect(createSampleInstallation).toHaveBeenCalledWith("northwind", {
        version: "0.2.0",
        manifestSha256: "b".repeat(64),
      }),
    );
  });
  beforeEach(() => {
    downloadErrorLocale.value = null;
    vi.clearAllMocks();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });
    refreshSamples.mockReset();
    getSampleReleaseNotes.mockReset();
    listSampleInstallations.mockResolvedValue({ items: [], historyComplete: false });
    getSampleInstallation.mockImplementation((sampleName: string, installationId: string) => ({
      id: installationId,
      sample: sampleName,
      stages: [{ id: "database", name: "Prepare database", state: "running" }],
      status: "installing",
      version: "0.1.0",
    }));
  });

  it("automatically refreshes the official catalog on entry and shows the latest version", async () => {
    listSamples.mockResolvedValue({
      samples: [sample()],
      sourceRefresh: { supported: true, status: "not_refreshed" },
    });
    refreshSamples.mockResolvedValue({
      samples: [sample({ version: "0.1.2", latestPublishedVersion: "0.1.2" })],
      sourceRefresh: { supported: true, status: "updated" },
    });
    renderExperience();
    expect(await screen.findByText('home.sample.latestVersion:{"version":"0.1.2"}')).toBeTruthy();
    expect(refreshSamples).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status")).toHaveClass(styles.refreshSuccess);
    expect(screen.getByRole("status").parentElement).toHaveClass(styles.catalogSummary);
  });

  it("keeps cached samples visible when the automatic refresh request fails", async () => {
    listSamples.mockResolvedValue({
      samples: [sample()],
      sourceRefresh: { supported: true, status: "not_refreshed" },
    });
    refreshSamples.mockRejectedValue(new Error("Network unavailable"));
    renderExperience();
    expect(await screen.findByText("home.sample.refreshStatus.failed")).toBeTruthy();
    expect(screen.getByRole("alert")).toHaveClass(styles.refreshFailure);
    expect(screen.getByRole("alert").parentElement).toHaveClass(styles.catalogSummary);
    expect(screen.getByRole("alert").querySelectorAll("p")).toHaveLength(1);
    expect(screen.getByText("Northwind")).toBeTruthy();
    expect(screen.getByRole("button", { name: "home.sample.refreshSource" })).toBeEnabled();
    refreshSamples.mockResolvedValue({
      samples: [sample({ version: "0.1.2" })],
      sourceRefresh: { supported: true, status: "updated" },
    });
    fireEvent.click(screen.getByRole("button", { name: "home.sample.refreshSource" }));
    expect(await screen.findByText("home.sample.refreshStatus.updated")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(refreshSamples).toHaveBeenCalledTimes(2);
  });

  it.each([false, true])(
    "shows the cache warning for a server refresh failure (throttled: %s)",
    async (throttled) => {
      const cached = {
        samples: [sample()],
        sourceRefresh: { supported: true, status: "not_refreshed" },
      };
      listSamples.mockResolvedValue(cached);
      refreshSamples.mockResolvedValue({
        ...cached,
        sourceRefresh: { supported: true, status: "failed", code: "source_unavailable", throttled },
      });
      renderExperience();
      expect(await screen.findByText("home.sample.refreshStatus.failed")).toBeTruthy();
      expect(screen.getByRole("alert")).toHaveClass(styles.refreshFailure);
      expect(screen.getByRole("link", { name: "home.sample.downloadOffline" })).toHaveAttribute(
        "href",
        "https://github.com/openbkn-ai/bkn-samples/releases",
      );
      expect(screen.getByText("Northwind")).toBeTruthy();
    },
  );

  it("uses the existing list path when official refresh is unsupported", async () => {
    listSamples.mockResolvedValue({ samples: [sample()] });
    renderExperience();
    expect(await screen.findByText("Northwind")).toBeTruthy();
    expect(refreshSamples).not.toHaveBeenCalled();
  });

  it("reports an initial catalog read failure without blaming official refresh", async () => {
    listSamples.mockRejectedValueOnce(new Error("Service unavailable"));
    renderExperience();
    expect(await screen.findByText("home.sample.loadFailed")).toBeTruthy();
    expect(screen.queryByText("home.sample.refreshStatus.failed")).toBeNull();
    expect(screen.queryByRole("link", { name: "home.sample.downloadOffline" })).toBeNull();
    expect(refreshSamples).not.toHaveBeenCalled();
    listSamples.mockResolvedValue({ samples: [sample()] });
    fireEvent.click(screen.getByRole("button", { name: "home.sample.reload" }));
    expect(await screen.findByText("Northwind")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("keeps the catalog-not-published explanation in the compact status row", async () => {
    const cached = {
      samples: [sample()],
      sourceRefresh: { supported: true, status: "not_refreshed" },
    };
    listSamples.mockResolvedValue(cached);
    refreshSamples.mockResolvedValue({
      ...cached,
      sourceRefresh: { supported: true, status: "failed", code: "catalog_not_published" },
    });
    renderExperience();
    expect(await screen.findByText("home.sample.catalogNotPublished")).toBeTruthy();
    expect(screen.getByText("Northwind")).toBeTruthy();
    expect(screen.getByRole("alert").parentElement).toHaveClass(styles.catalogSummary);
    expect(screen.getByRole("alert").querySelectorAll("p")).toHaveLength(1);
  });

  it("does not duplicate the automatic refresh during StrictMode effect replay", async () => {
    const catalog = {
      samples: [sample()],
      sourceRefresh: { supported: true, status: "updated" },
    };
    listSamples.mockResolvedValue(catalog);
    refreshSamples.mockResolvedValue(catalog);
    render(
      <StrictMode>
        <SampleExperience />
      </StrictMode>,
    );
    expect(await screen.findByText("home.sample.refreshStatus.updated")).toBeTruthy();
    expect(refreshSamples).toHaveBeenCalledTimes(1);
  });

  it("starts collapsed and permits only one expanded card", async () => {
    listSamples.mockResolvedValue({
      samples: [sample(), sample({ name: "harbor", displayName: "Harbor" })],
      sourceRejected: false,
    });
    renderExperience();
    const toggles = await screen.findAllByRole("button", { name: "home.sample.actions.expand" });
    expect(toggles).toHaveLength(2);
    expect(toggles[0]).toHaveAttribute("aria-expanded", "false");
    expect(scrollIntoView).not.toHaveBeenCalled();
    fireEvent.click(toggles[0]);
    expect(toggles[0]).toHaveAttribute("aria-expanded", "true");
    expect(scrollIntoView).toHaveBeenLastCalledWith({
      block: "start",
      inline: "nearest",
      behavior: "auto",
    });
    expect(scrollIntoView.mock.instances.at(-1)).toBe(toggles[0].closest("article"));
    fireEvent.click(screen.getByRole("button", { name: "home.sample.actions.expand" }));
    expect(toggles[0]).toHaveAttribute("aria-expanded", "false");
    expect(toggles[1]).toHaveAttribute("aria-expanded", "true");
    expect(scrollIntoView.mock.instances.at(-1)).toBe(toggles[1].closest("article"));
    scrollIntoView.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "home.sample.actions.collapse" }));
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it.each(["notes-first", "history-first"])(
    "aligns a lower card after its initial details settle (%s)",
    async (order) => {
      let finishNotes!: () => void;
      let finishHistory!: () => void;
      const notesReady = new Promise<void>((resolve) => {
        finishNotes = resolve;
      });
      const historyReady = new Promise<void>((resolve) => {
        finishHistory = resolve;
      });
      getSampleReleaseNotes.mockImplementation(() =>
        notesReady.then(() => ({
          version: "0.1.0",
          content: "Loaded release notes",
          resolvedLocale: "en-US",
        })),
      );
      listSampleInstallations.mockImplementation(() =>
        historyReady.then(() => ({
          items: [],
          historyComplete: true,
        })),
      );
      listSamples.mockResolvedValue({
        samples: [
          sample(),
          sample({
            name: "harbor",
            displayName: "Harbor",
            hasReleaseNotes: true,
            installationId: "old-install",
          }),
        ],
      });
      renderExperience();
      const toggles = await screen.findAllByRole("button", { name: "home.sample.actions.expand" });
      fireEvent.click(toggles[0]);
      scrollIntoView.mockClear();
      fireEvent.click(toggles[1]);
      expect(scrollIntoView).not.toHaveBeenCalled();
      await act(async () => {
        (order === "notes-first" ? finishNotes : finishHistory)();
        await (order === "notes-first" ? notesReady : historyReady);
      });
      expect(scrollIntoView).not.toHaveBeenCalled();
      await act(async () => {
        (order === "notes-first" ? finishHistory : finishNotes)();
        await Promise.all([notesReady, historyReady]);
      });
      expect(screen.getByText("Loaded release notes")).toBeVisible();
      expect(scrollIntoView).toHaveBeenCalledTimes(1);
      expect(scrollIntoView.mock.instances.at(-1)).toBe(toggles[1].closest("article"));
      fireEvent.click(toggles[1]);
      fireEvent.click(toggles[1]);
      expect(scrollIntoView).toHaveBeenCalledTimes(2);
    },
  );

  it("aligns the card when initial details fail to load", async () => {
    getSampleReleaseNotes.mockRejectedValue(new Error("Notes unavailable"));
    listSampleInstallations.mockRejectedValue(new Error("History unavailable"));
    listSamples.mockResolvedValue({
      samples: [
        sample(),
        sample({
          name: "harbor",
          displayName: "Harbor",
          hasReleaseNotes: true,
          installationId: "old-install",
        }),
      ],
    });
    renderExperience();
    const toggles = await screen.findAllByRole("button", { name: "home.sample.actions.expand" });
    fireEvent.click(toggles[1]);
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledTimes(1));
    expect(scrollIntoView.mock.instances.at(-1)).toBe(toggles[1].closest("article"));
  });

  it.each(["notes", "history"])(
    "aligns after a pending %s request becomes unnecessary during a catalog reload",
    async (pending) => {
      const old = sample({
        name: "harbor",
        displayName: "Harbor",
        hasReleaseNotes: true,
        installationId: "old-install",
      });
      const current = {
        ...old,
        hasReleaseNotes: pending !== "notes",
        installationId: pending === "history" ? null : "old-install",
      };
      listSamples
        .mockResolvedValueOnce({ samples: [sample(), old] })
        .mockResolvedValue({ samples: [sample(), current] });
      getSampleReleaseNotes.mockImplementation(() =>
        pending === "notes"
          ? new Promise<never>(() => {})
          : Promise.resolve({
              version: "0.1.0",
              content: "Ready notes",
              resolvedLocale: "en-US",
            }),
      );
      listSampleInstallations.mockImplementation(() =>
        pending === "history"
          ? new Promise<never>(() => {})
          : Promise.resolve({
              items: [],
              historyComplete: true,
            }),
      );
      renderExperience();
      const toggles = await screen.findAllByRole("button", { name: "home.sample.actions.expand" });
      fireEvent.click(toggles[1]);
      await waitFor(() =>
        expect(
          pending === "notes" ? getSampleReleaseNotes : listSampleInstallations,
        ).toHaveBeenCalled(),
      );
      expect(scrollIntoView).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole("button", { name: "home.sample.reload" }));
      await waitFor(() => expect(scrollIntoView).toHaveBeenCalledTimes(1));
      expect(scrollIntoView.mock.instances.at(-1)).toBe(toggles[1].closest("article"));
    },
  );

  it("does not scroll a card collapsed while its initial notes are loading", async () => {
    let finishNotes!: () => void;
    const notesReady = new Promise<void>((resolve) => {
      finishNotes = resolve;
    });
    getSampleReleaseNotes.mockImplementation(() =>
      notesReady.then(() => ({
        version: "0.1.0",
        content: "Late release notes",
        resolvedLocale: "en-US",
      })),
    );
    listSamples.mockResolvedValue({
      samples: [
        sample(),
        sample({
          name: "harbor",
          displayName: "Harbor",
          hasReleaseNotes: true,
        }),
      ],
    });
    renderExperience();
    const toggles = await screen.findAllByRole("button", { name: "home.sample.actions.expand" });
    fireEvent.click(toggles[1]);
    fireEvent.click(toggles[1]);
    await act(async () => {
      finishNotes();
      await notesReady;
    });
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("removes an imported offline package and reloads the catalog", async () => {
    listSamples
      .mockResolvedValueOnce({
        canImport: true,
        samples: [sample({ source: "offline", displayName: "Offline sample" })],
        sourceRejected: false,
      })
      .mockResolvedValueOnce({ canImport: true, samples: [sample()], sourceRejected: false });
    deleteSamplePackage.mockResolvedValue(undefined);
    renderExperience();
    expect(await screen.findByText("home.sample.offlinePackagesTitle")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "home.sample.removeOffline" }));
    await waitFor(() => expect(deleteSamplePackage).toHaveBeenCalledWith("northwind"));
    await waitFor(() => expect(screen.queryByText("home.sample.offlinePackagesTitle")).toBeNull());
  });

  it("hides offline package removal from non-admin catalogs", async () => {
    listSamples.mockResolvedValue({
      canImport: false,
      samples: [sample({ source: "offline" })],
      sourceRejected: false,
    });
    renderExperience();
    await screen.findByText("home.sample.offlinePackagesTitle");
    expect(screen.queryByRole("button", { name: "home.sample.removeOffline" })).toBeNull();
  });

  it("starts installation immediately while loading the fixed version notes", async () => {
    const manifestSha256 = "a".repeat(64);
    listSamples.mockResolvedValue({
      samples: [
        sample({
          manifestSha256,
          hasReleaseNotes: true,
          versions: [{ version: "0.1.0", hasReleaseNotes: true }],
        }),
      ],
      sourceRejected: false,
    });
    getSampleReleaseNotes.mockResolvedValue({
      version: "0.1.0",
      resolvedLocale: "zh-CN",
      content: "Release details",
      digest: "sha256:" + "b".repeat(64),
    });
    createSampleInstallation.mockResolvedValue({
      id: "inst-1",
      sample: "northwind",
      stages: [],
      status: "installing",
      version: "0.1.0",
    });
    renderExperience();
    fireEvent.click(await screen.findByRole("button", { name: "home.sample.actions.install" }));
    expect(await screen.findByText("Release details")).toBeVisible();
    await waitFor(() =>
      expect(createSampleInstallation).toHaveBeenCalledWith("northwind", {
        version: "0.1.0",
        manifestSha256,
      }),
    );
    expect(getSampleReleaseNotes).toHaveBeenCalledWith("northwind", "0.1.0", "zh-CN");
  });

  it("starts installation even when release notes cannot be loaded", async () => {
    listSamples.mockResolvedValue({
      samples: [
        sample({ hasReleaseNotes: true, versions: [{ version: "0.1.0", hasReleaseNotes: true }] }),
      ],
      sourceRejected: false,
    });
    getSampleReleaseNotes.mockRejectedValue(new Error("unavailable"));
    renderExperience();
    fireEvent.click(await screen.findByRole("button", { name: "home.sample.actions.install" }));
    expect(await screen.findByText("home.sample.notesFailed")).toBeVisible();
    await waitFor(() => expect(createSampleInstallation).toHaveBeenCalledWith("northwind"));
  });

  it("shows the installed record and notes only after expansion", async () => {
    listSamples.mockResolvedValue({
      samples: [
        sample({
          status: "installed",
          installedVersion: "0.1.0",
          installationId: "inst-1",
          installable: false,
          hasReleaseNotes: true,
          versions: [{ version: "0.1.0", hasReleaseNotes: true }],
        }),
      ],
      sourceRejected: false,
    });
    getSampleReleaseNotes.mockResolvedValue({
      version: "0.1.0",
      resolvedLocale: "zh-CN",
      content: "Release details",
      digest: "sha256:" + "b".repeat(64),
    });
    listSampleInstallations.mockResolvedValue({
      items: [
        {
          id: "inst-1",
          attemptId: "attempt-success",
          sample: "northwind",
          version: "0.1.0",
          status: "installed",
          stages: [],
          finishedAt: "2026-10-09T05:52:05Z",
        },
        {
          id: "inst-1",
          attemptId: "attempt-failure",
          sample: "northwind",
          version: "0.1.0",
          status: "failed",
          stages: [],
          finishedAt: "2026-10-09T05:50:00Z",
        },
      ],
      historyComplete: false,
    });
    renderExperience();
    fireEvent.click(await screen.findByRole("button", { name: "home.sample.actions.expand" }));
    expect(await screen.findByText("Release details")).toBeVisible();
    expect(await screen.findByText("2026-10-09T05:52:05Z")).toBeVisible();
    expect(await screen.findByText("2026-10-09T05:50:00Z")).toBeVisible();
    expect(screen.getByText("home.sample.historyPartial")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "home.sample.actions.collapse" }));
    expect(screen.getByText("Release details")).not.toBeVisible();
    expect(screen.getByRole("button", { name: "home.sample.actions.open" })).toBeEnabled();
  });

  it("starts installing a catalog sample from the card action", async () => {
    listSamples.mockResolvedValue({ samples: [sample()], sourceRejected: false });
    createSampleInstallation.mockResolvedValue({
      id: "inst-1",
      sample: "northwind",
      stages: [],
      status: "installing",
      version: "0.1.0",
    });
    renderExperience();

    const installButton = await screen.findByRole("button", {
      name: "home.sample.actions.install",
    });
    installButton.focus();
    fireEvent.click(installButton);
    expect(screen.getByRole("button", { name: "home.sample.actions.collapse" })).toHaveFocus();
    await waitFor(() => expect(createSampleInstallation).toHaveBeenCalledWith("northwind"));
  });

  it.each(["zh-CN", "en-US"] as const)(
    "shows a localized offline-package link for a download failure in %s",
    async (locale) => {
      downloadErrorLocale.value = locale;
      const messages = locale === "zh-CN" ? homeZhCN.home.sample : homeEnUS.home.sample;
      listSamples.mockResolvedValue({
        samples: [sample({ status: "failed", installationId: "inst-1" })],
        sourceRejected: false,
      });
      getSampleInstallation.mockResolvedValue({
        id: "inst-1",
        sample: "northwind",
        status: "failed",
        version: "0.1.0",
        stages: ["database", "discover", "knowledge", "capabilities", "verify"].map((id) => ({
          id,
          name: id,
          state: "pending",
        })),
        error: { code: "release_download_failed", message: "Server transport detail", stage: "" },
      });
      renderExperience();
      const link = await screen.findByRole("link", { name: messages.downloadOffline });
      expect(link).toHaveAttribute("href", "https://github.com/openbkn-ai/bkn-samples/releases");
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noreferrer");
      expect(link.parentElement?.textContent).toBe(
        messages.downloadFailed + messages.downloadOffline + messages.downloadFailedAfterLink,
      );
      expect(screen.queryByText("Server transport detail")).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: "home.sample.actions.failureDetails" }));
      expect(screen.getAllByText("home.sample.stageState.pending")).toHaveLength(5);
      expect(screen.queryByText("home.sample.stageState.failed")).toBeNull();
      expect(screen.queryByText("home.sample.stageState.succeeded")).toBeNull();
    },
  );

  it("localizes a recovered interruption and permits retrying the original task", async () => {
    listSamples.mockResolvedValue({
      samples: [
        sample({ status: "failed", installationId: "inst-1", message: "Server English detail" }),
      ],
      sourceRejected: false,
    });
    getSampleInstallation.mockResolvedValue({
      id: "inst-1",
      sample: "northwind",
      status: "failed",
      version: "0.1.0",
      stages: [],
      error: { code: "install_interrupted", message: "Server English detail" },
    });
    renderExperience();
    expect(await screen.findByText("home.sample.errors.install_interrupted")).toBeVisible();
    expect(screen.queryByText("Server English detail")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "home.sample.actions.failureDetails" }));
    expect(screen.getByRole("button", { name: "home.sample.actions.retry" })).toBeEnabled();
  });

  it("tracks an accepted task after the create request returns", async () => {
    listSamples.mockResolvedValueOnce({ samples: [sample()], sourceRejected: false });
    listSamples.mockResolvedValue({
      samples: [sample({ status: "installing", installationId: "inst-1", installable: false })],
      sourceRejected: false,
    });
    createSampleInstallation.mockResolvedValue({
      id: "inst-1",
      sample: "northwind",
      status: "installing",
      version: "0.1.0",
      stages: [{ id: "database", name: "Prepare database", state: "running" }],
    });
    renderExperience();
    fireEvent.click(await screen.findByRole("button", { name: "home.sample.actions.install" }));
    await waitFor(() => expect(getSampleInstallation).toHaveBeenCalledWith("northwind", "inst-1"));
    expect(
      await screen.findByRole("button", { name: "home.sample.actions.progress" }),
    ).toBeEnabled();
    expect(screen.queryByRole("button", { name: "home.sample.actions.install" })).toBeNull();
    expect(screen.queryByRole("button", { name: "home.sample.actions.open" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "home.sample.actions.collapse" }));
    expect(screen.getByRole("button", { name: "home.sample.actions.progress" })).toBeEnabled();
    expect(createSampleInstallation).toHaveBeenCalledTimes(1);
  });

  it("shows the install error from the card action", async () => {
    listSamples.mockResolvedValue({ samples: [sample()], sourceRejected: false });
    createSampleInstallation.mockRejectedValue(
      new SampleRequestError("forbidden", "Need an administrator"),
    );
    renderExperience();

    fireEvent.click(await screen.findByRole("button", { name: "home.sample.actions.install" }));

    expect(await screen.findByText("Need an administrator")).toBeTruthy();
  });

  it("clears an unknown request error when polling later reports success", async () => {
    listSamples
      .mockResolvedValueOnce({ samples: [sample()], sourceRejected: false })
      .mockResolvedValueOnce({
        samples: [
          sample({ status: "installed", installationId: "inst-1", installedVersion: "0.1.0" }),
        ],
        sourceRejected: false,
      });
    createSampleInstallation.mockRejectedValue(new SampleRequestError("status_unknown", ""));
    renderExperience();

    fireEvent.click(await screen.findByRole("button", { name: "home.sample.actions.install" }));

    expect(await screen.findByText("home.sample.errors.status_unknown")).toBeTruthy();
    await waitFor(() => expect(screen.queryByText("home.sample.errors.status_unknown")).toBeNull());
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
    fireEvent.click(screen.getByRole("button", { name: "home.sample.actions.failureDetails" }));
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
    getSampleInstallation.mockImplementation((sampleName: string, installationId: string) => ({
      id: installationId,
      sample: sampleName,
      stages: [{ id: "database", name: "Prepare", state: "running" }],
      status: sampleName === "northwind" ? "failed" : "installing",
      version: "0.1.0",
    }));
    retrySampleInstallation.mockResolvedValue({
      id: "inst-9",
      sample: "northwind",
      stages: [],
      status: "installing",
      version: "0.1.0",
    });
    renderExperience();

    fireEvent.click(
      await screen.findByRole("button", { name: "home.sample.actions.failureDetails" }),
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "home.sample.actions.retry" })).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "home.sample.actions.retry" }));
    await waitFor(() =>
      expect(retrySampleInstallation).toHaveBeenCalledWith("northwind", "inst-9"),
    );
    await waitFor(() => expect(getSampleInstallation).toHaveBeenCalledWith("harbor", "inst-1"));
    expect(await screen.findByText("1. home.sample.stages.database")).toBeTruthy();
  });

  it("lets another sample start while one install request is still open", async () => {
    listSamples.mockResolvedValue({
      samples: [
        sample(),
        sample({
          displayName: "Harbor",
          knowledgeNetwork: { displayName: "Harbor network", id: "harbor_kn" },
          name: "harbor",
        }),
      ],
      sourceRejected: false,
    });
    createSampleInstallation.mockImplementation(() => new Promise(() => undefined));
    renderExperience();

    const installButtons = await screen.findAllByRole("button", {
      name: "home.sample.actions.install",
    });
    fireEvent.click(installButtons[0]);

    expect(await screen.findByText("home.sample.status.installing")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "home.sample.actions.install" }));
    await waitFor(() => expect(createSampleInstallation).toHaveBeenCalledTimes(2));
  });

  it("hides the previous failure while a retry is still running", async () => {
    listSamples
      .mockResolvedValueOnce({
        samples: [
          sample({
            installationId: "inst-9",
            installable: false,
            status: "installing",
          }),
        ],
        sourceRejected: false,
      })
      .mockResolvedValue({
        samples: [
          sample({
            installationId: "inst-9",
            message: "Smoke failed",
            status: "failed",
          }),
        ],
        sourceRejected: false,
      });
    getSampleInstallation.mockResolvedValue({
      error: { code: "verify_failed", message: "previous failure", stage: "verify" },
      id: "inst-9",
      requestedBy: "admin",
      sample: "northwind",
      stages: [{ id: "verify", name: "Smoke", state: "failed" }],
      status: "failed",
      version: "0.1.0",
    });
    retrySampleInstallation.mockImplementation(() => new Promise(() => undefined));
    renderExperience();

    expect(await screen.findByText("previous failure")).toBeTruthy();
    expect(screen.getByText("1. home.sample.stages.verify")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "home.sample.actions.failureDetails" }));
    fireEvent.click(screen.getByRole("button", { name: "home.sample.actions.retry" }));

    expect(await screen.findByText("home.sample.status.installing")).toBeTruthy();
    expect(screen.queryByText("previous failure")).toBeNull();
    expect(screen.queryByText("Smoke failed")).toBeNull();
    expect(screen.queryByText("1. home.sample.stages.verify")).toBeNull();
    expect(screen.queryByText("home.sample.stageState.running")).toBeNull();
  });

  it("shows a name conflict with retry and the finished steps", async () => {
    listSamples.mockResolvedValue({
      samples: [
        sample({
          installationId: "inst-1",
          installable: true,
          message: "knowledge network already exists",
          status: "conflict",
        }),
      ],
      sourceRejected: false,
    });
    getSampleInstallation.mockResolvedValue({
      error: {
        code: "ownership_conflict",
        message: "knowledge network already exists",
        stage: "knowledge",
      },
      id: "inst-1",
      requestedBy: "admin",
      sample: "northwind",
      stages: [
        { id: "database", name: "Prepare database", state: "succeeded" },
        { id: "discover", name: "Scan resources", state: "succeeded" },
        { id: "knowledge", name: "Import network", state: "failed" },
        { id: "capabilities", name: "Publish", state: "pending" },
        { id: "verify", name: "Smoke", state: "pending" },
      ],
      status: "conflict",
      version: "0.1.0",
    });
    renderExperience();

    expect(await screen.findByText("home.sample.errors.ownership_conflict")).toBeTruthy();
    expect(screen.getByText("home.sample.conflictHint")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "home.sample.actions.failureDetails" }));
    expect(screen.getByRole("button", { name: "home.sample.actions.retry" })).toBeTruthy();
    expect(screen.queryByText("knowledge network already exists")).toBeNull();
    expect(await screen.findByText("2. home.sample.stages.discover")).toBeTruthy();
    expect(screen.getAllByText("home.sample.stageState.succeeded")).toHaveLength(2);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(listSamples).toHaveBeenCalledTimes(1);
    expect(getSampleInstallation).toHaveBeenCalledTimes(1);
  });

  it("does not invent steps before the server reports them", async () => {
    listSamples.mockResolvedValue({
      samples: [sample({ installationId: "inst-1", installable: false, status: "installing" })],
      sourceRejected: false,
    });
    getSampleInstallation.mockResolvedValue({
      id: "inst-1",
      requestedBy: "admin",
      sample: "northwind",
      stages: [],
      status: "installing",
      version: "0.1.0",
    });
    renderExperience();

    expect(await screen.findByText("home.sample.status.installing")).toBeTruthy();
    await waitFor(() => expect(getSampleInstallation).toHaveBeenCalled());
    expect(screen.queryByText("1. home.sample.stages.database")).toBeNull();
    expect(screen.queryByText("home.sample.stageState.running")).toBeNull();
  });

  it("uses the server stage name when that step has no translation", async () => {
    listSamples.mockResolvedValue({
      samples: [sample({ installationId: "inst-1", installable: false, status: "installing" })],
      sourceRejected: false,
    });
    getSampleInstallation.mockResolvedValue({
      id: "inst-1",
      requestedBy: "admin",
      sample: "northwind",
      stages: [{ id: "publish-index", name: "Publish index", state: "running" }],
      status: "installing",
      version: "0.1.0",
    });
    renderExperience();

    expect(await screen.findByText("1. Publish index")).toBeTruthy();
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
