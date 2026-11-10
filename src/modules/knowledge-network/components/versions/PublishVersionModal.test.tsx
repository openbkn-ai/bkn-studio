/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type { KnVersioning } from "@/modules/knowledge-network/types/kn-version";

const { diffVersions, publishVersion } = vi.hoisted(() => ({
  diffVersions: vi.fn(),
  publishVersion: vi.fn(),
}));

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/modules/knowledge-network/components/versions/KnDiffSummary", () => ({
  KnDiffSummary: () => null,
}));

vi.mock("@/modules/knowledge-network/services/kn-version.service", () => ({
  diffKnVersions: diffVersions,
  isKnVersionConflict: () => false,
  publishKnVersion: publishVersion,
  readKnVersionErrorCode: () => undefined,
  readKnVersionProblems: () => [],
}));

import { PublishVersionModal } from "@/modules/knowledge-network/components/versions/PublishVersionModal";

const versioning = (running: number, revision: number): KnVersioning => ({
  draft: { base_version: running, has_changes: true, outdated: false, revision },
  enabled: true,
  full_history: false,
  previous_version: running - 1,
  running_version: running,
});

describe("PublishVersionModal", () => {
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

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("keeps the completion page when the network reloads after publishing", async () => {
    diffVersions.mockResolvedValue({ changes: [] });
    publishVersion.mockResolvedValue({ purged_version: 1, version: 3, warnings: [] });
    const onChanged = vi.fn();
    const props = { networkId: "kn-1", onChanged, onClose: vi.fn(), open: true };
    const { rerender } = render(<PublishVersionModal {...props} versioning={versioning(2, 7)} />);

    fireEvent.change(screen.getByRole("textbox", { name: /notes/ }), {
      target: { value: "first release" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "knowledgeNetwork.versions.publish.action" }),
    );
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(screen.getByText("knowledgeNetwork.versions.publish.purgedNotice")).toBeTruthy();

    // onChanged reloads the network: the running version and the draft revision move on.
    rerender(<PublishVersionModal {...props} versioning={versioning(3, 8)} />);

    expect(screen.getByText("knowledgeNetwork.versions.publish.purgedNotice")).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "knowledgeNetwork.versions.publish.action" }),
    ).toBeNull();
  });
});
