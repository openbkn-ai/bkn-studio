/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type { KnVersioning } from "@/modules/knowledge-network/types/kn-version";

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({
    t: (key: string, values?: { version?: string }) =>
      values?.version ? `${key}:${values.version}` : key,
  }),
}));

vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router-dom")>()),
  useNavigate: () => vi.fn(),
}));

vi.mock("@/modules/knowledge-network/components/versions/useReadableKnVersions", () => ({
  useReadableKnVersions: () => [],
  versionOptionLabel: (version: { version: number }) => `v${version.version}`,
}));

vi.mock("@/modules/knowledge-network/components/versions/PublishVersionModal", () => ({
  PublishVersionModal: () => null,
}));
vi.mock("@/modules/knowledge-network/components/versions/KnDiffModal", () => ({
  KnDiffModal: () => null,
}));

import { KnVersionBar } from "@/modules/knowledge-network/components/versions/KnVersionBar";
import {
  KnVersionSlotHost,
  KnVersionSlotProvider,
} from "@/modules/knowledge-network/components/versions/KnVersionSlot";

function versioning(running: number, hasChanges: boolean): KnVersioning {
  return {
    draft: { base_version: running, has_changes: hasChanges, outdated: false, revision: 4 },
    enabled: true,
    full_history: true,
    previous_version: 0,
    running_version: running,
  };
}

function renderBar(value: KnVersioning) {
  return render(
    <KnVersionBar
      canModify
      networkId="kn-1"
      onChanged={vi.fn()}
      onViewChange={vi.fn()}
      versioning={value}
      view="draft"
    />,
  );
}

describe("KnVersionBar", () => {
  beforeAll(() => {
    // antd reads responsive breakpoints, which jsdom does not provide.
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

  afterEach(cleanup);

  it("shows a draft that matches the running version as that version", () => {
    renderBar(versioning(2, false));
    expect(screen.getByText("v2")).toBeTruthy();
    expect(screen.queryByText(/knowledgeNetwork\.versions\.basedOn/)).toBeNull();
    expect(screen.queryByText("knowledgeNetwork.versions.publish.action")).toBeNull();
  });

  it("brings out the draft, its base and publishing once it has changes", () => {
    renderBar(versioning(2, true));
    expect(
      screen.getByText("knowledgeNetwork.versions.draft · knowledgeNetwork.versions.basedOn:v2"),
    ).toBeTruthy();
    // Publishing is the one thing to do with a changed draft, so it stands out.
    expect(
      screen
        .getByRole("button", { name: /knowledgeNetwork\.versions\.publish\.action/ })
        .classList.contains("ant-btn-variant-solid"),
    ).toBe(true);
  });

  it("says the network is not published yet before the first version", () => {
    renderBar(versioning(0, false));
    expect(
      screen.getByText("knowledgeNetwork.versions.draft · knowledgeNetwork.versions.notPublished"),
    ).toBeTruthy();
    expect(screen.getByText("knowledgeNetwork.versions.publish.action")).toBeTruthy();
  });

  it("leaves only the way to version management under the version list", () => {
    renderBar(versioning(2, true));
    expect(screen.queryByText("knowledgeNetwork.versions.title")).toBeNull();

    fireEvent.mouseDown(screen.getByRole("combobox"));

    expect(screen.getByText("knowledgeNetwork.versions.title")).toBeTruthy();
    expect(screen.queryByText("knowledgeNetwork.versions.viewChanges")).toBeNull();
    expect(screen.queryByText("knowledgeNetwork.versions.discard")).toBeNull();
  });

  it("sits beside the network's title when the section shows one", () => {
    render(
      <KnVersionSlotProvider>
        <h2 data-testid="title">
          name
          <KnVersionSlotHost />
        </h2>
        <KnVersionBar
          canModify
          networkId="kn-1"
          onChanged={vi.fn()}
          onViewChange={vi.fn()}
          versioning={versioning(2, false)}
          view="draft"
        />
      </KnVersionSlotProvider>,
    );
    expect(screen.getByTestId("title").textContent).toContain("v2");
  });
});
