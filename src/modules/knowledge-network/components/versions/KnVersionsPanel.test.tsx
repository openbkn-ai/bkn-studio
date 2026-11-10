/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { KnVersioning } from "@/modules/knowledge-network/types/kn-version";

const { listEvents, listVersions } = vi.hoisted(() => ({
  listEvents: vi.fn(),
  listVersions: vi.fn(),
}));

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router-dom")>()),
  useNavigate: () => vi.fn(),
}));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({ message: { error: vi.fn(), success: vi.fn() } }),
}));

vi.mock("@/modules/knowledge-network/services/kn-version.service", () => ({
  listKnVersionEvents: listEvents,
  listKnVersions: listVersions,
}));

vi.mock("@/modules/knowledge-network/components/versions/PublishVersionModal", () => ({
  PublishVersionModal: () => null,
}));
vi.mock("@/modules/knowledge-network/components/versions/KnDiffModal", () => ({
  KnDiffModal: () => null,
}));
vi.mock("@/modules/knowledge-network/components/versions/EnableVersioningModal", () => ({
  EnableVersioningModal: () => null,
}));

import { KnVersionsPanel } from "@/modules/knowledge-network/components/versions/KnVersionsPanel";

const versioned = (fullHistory: boolean): KnVersioning => ({
  draft: { base_version: 3, has_changes: true, outdated: false, revision: 12 },
  enabled: true,
  full_history: fullHistory,
  previous_version: 2,
  running_version: 3,
});

function renderPanel(props: { fullHistory?: boolean; canModify?: boolean; unversioned?: boolean }) {
  return render(
    <KnVersionsPanel
      canDelete
      canModify={props.canModify ?? true}
      networkId="kn-1"
      onChanged={vi.fn()}
      onViewChange={vi.fn()}
      versioning={
        props.unversioned
          ? { enabled: false, full_history: true, previous_version: 0, running_version: 0 }
          : versioned(props.fullHistory ?? true)
      }
    />,
  );
}

describe("KnVersionsPanel", () => {
  beforeAll(() => {
    // The table reads responsive breakpoints, which jsdom does not provide.
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

  beforeEach(() => {
    listEvents.mockResolvedValue({ items: [], total: 0 });
    listVersions.mockResolvedValue({
      items: [
        { status: "running", version: 3 },
        { status: "history", version: 2 },
      ],
      total: 2,
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("offers to enable versioning on a network without it", () => {
    renderPanel({ unversioned: true });

    expect(
      screen.getByRole("button", { name: "knowledgeNetwork.versions.enable.action" }),
    ).toBeEnabled();
    expect(listVersions).not.toHaveBeenCalled();
  });

  it("does not let a reader enable versioning", () => {
    renderPanel({ canModify: false, unversioned: true });

    expect(
      screen.getByRole("button", { name: "knowledgeNetwork.versions.enable.action" }),
    ).toBeDisabled();
  });

  it("shows deprecate and purge for a history version in the Professional edition", async () => {
    renderPanel({ fullHistory: true });

    await waitFor(() => expect(screen.getByText("v2")).toBeInTheDocument());
    expect(
      screen.getByRole("button", { name: "knowledgeNetwork.versions.deprecate" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "knowledgeNetwork.versions.purge" }),
    ).toBeInTheDocument();
  });

  it("hides deprecate, restore and purge when only two versions are kept", async () => {
    renderPanel({ fullHistory: false });

    await waitFor(() => expect(screen.getByText("v2")).toBeInTheDocument());
    expect(
      screen.queryByRole("button", { name: "knowledgeNetwork.versions.deprecate" }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: "knowledgeNetwork.versions.purge" })).toBeNull();
    expect(
      screen.getAllByRole("button", { name: "knowledgeNetwork.versions.activate.action" }),
    ).toHaveLength(1);
  });
});
