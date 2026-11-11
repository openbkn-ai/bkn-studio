/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type { KnDiffResult, KnVersioning } from "@/modules/knowledge-network/types/kn-version";

const { diffVersions, summary } = vi.hoisted(() => ({
  diffVersions: vi.fn(),
  summary: vi.fn(),
}));

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/modules/knowledge-network/components/versions/KnDiffSummary", () => ({
  KnDiffSummary: (props: { result: KnDiffResult | null }) => {
    summary(props.result);
    return null;
  },
}));

vi.mock("@/modules/knowledge-network/components/versions/useReadableKnVersions", () => ({
  useReadableKnVersions: () => [
    { status: "running", version: 3 },
    { status: "history", version: 2 },
  ],
  versionOptionLabel: (version: { version: number }) => `v${version.version}`,
}));

vi.mock("@/modules/knowledge-network/services/kn-version.service", () => ({
  diffKnVersions: diffVersions,
}));

import { KnDiffModal } from "@/modules/knowledge-network/components/versions/KnDiffModal";

const versioning: KnVersioning = {
  draft: { base_version: 3, has_changes: true, outdated: false, revision: 4 },
  enabled: true,
  full_history: true,
  previous_version: 2,
  running_version: 3,
};

const props = { canDraft: true, networkId: "kn-1", onClose: vi.fn(), versioning };

describe("KnDiffModal", () => {
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

  it("compares what the selectors show each time it opens", async () => {
    diffVersions.mockResolvedValue({ changes: [] });
    const { rerender } = render(<KnDiffModal {...props} initialBase={3} open />);
    await waitFor(() => expect(diffVersions).toHaveBeenCalledTimes(1));
    expect(diffVersions).toHaveBeenLastCalledWith("kn-1", 3, "draft");

    rerender(<KnDiffModal {...props} initialBase={3} open={false} />);
    rerender(<KnDiffModal {...props} initialBase={2} open />);
    await waitFor(() => expect(diffVersions).toHaveBeenCalledTimes(2));
    expect(diffVersions).toHaveBeenLastCalledWith("kn-1", 2, "draft");
  });

  it("keeps the latest comparison when an earlier one answers last", async () => {
    let answerFirst: (value: KnDiffResult) => void = () => undefined;
    const first = { changes: [{ id: "old" }] } as unknown as KnDiffResult;
    const second = { changes: [{ id: "new" }] } as unknown as KnDiffResult;
    diffVersions
      .mockReturnValueOnce(new Promise((resolve) => (answerFirst = resolve)))
      .mockResolvedValueOnce(second);
    const { rerender } = render(<KnDiffModal {...props} initialBase={3} open />);
    rerender(<KnDiffModal {...props} initialBase={3} open={false} />);
    rerender(<KnDiffModal {...props} initialBase={2} open />);
    await waitFor(() => expect(summary).toHaveBeenLastCalledWith(second));

    await act(() => {
      answerFirst(first);
      return Promise.resolve();
    });
    expect(summary).toHaveBeenLastCalledWith(second);
  });
});
