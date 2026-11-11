/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { KnowledgeNetworkFormModal } from "./KnowledgeNetworkFormModal";

describe("KnowledgeNetworkFormModal", () => {
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

  it("offers no versioning choice: every network is versioned", () => {
    render(<KnowledgeNetworkFormModal mode="create" onCancel={vi.fn()} onSubmit={vi.fn()} open />);
    expect(screen.getByText("knowledgeNetwork.createTitle")).toBeTruthy();
    expect(screen.queryByRole("switch")).toBeNull();
  });
});
