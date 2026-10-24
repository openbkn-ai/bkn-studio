/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { McpSetupModal } from "./McpIntegrationModals";

const translate = vi.hoisted(() => (key: string) => key);
vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: translate }),
}));

function renderModal(mcpUrl: string) {
  render(
    <MemoryRouter>
      <McpSetupModal
        open
        onClose={vi.fn()}
        mcpUrl={mcpUrl}
        onManageApiKey={vi.fn()}
        copy={vi.fn()}
      />
    </MemoryRouter>,
  );
}

describe("McpSetupModal certificate option", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("is ticked by default for an IP address", () => {
    renderModal("https://10.211.55.4/api/agent-retrieval/v1/mcp");
    expect(screen.getByRole("checkbox")).toHaveProperty("checked", true);
  });

  it("is left unticked for a domain name", () => {
    renderModal("https://platform.example.com/api/agent-retrieval/v1/mcp");
    expect(screen.getByRole("checkbox")).toHaveProperty("checked", false);
  });
});
