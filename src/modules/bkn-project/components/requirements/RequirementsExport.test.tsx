/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, screen, waitFor } from "@testing-library/react";
import { AxiosError, type AxiosResponse } from "axios";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import i18n from "@/app/locales/i18n";

const exportMock = vi.hoisted(() => vi.fn());
const messageMock = vi.hoisted(() => ({ error: vi.fn() }));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({ message: messageMock }),
}));

vi.mock("@/modules/bkn-project/services/requirements.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/bkn-project/services/requirements.service")>()),
  exportRequirements: exportMock,
}));

import { renderWithoutAntdStyles } from "@/test/render-without-antd-styles";

import { RequirementsExport } from "./RequirementsExport";

describe("RequirementsExport", () => {
  beforeAll(() => {
    // Ant Design reads breakpoints, which jsdom lacks.
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

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage("zh-CN");
  });

  it("offers the two targets, says no data values go, and downloads the one chosen", async () => {
    exportMock.mockResolvedValue(undefined);
    renderWithoutAntdStyles(<RequirementsExport projectId="p1" ready />);

    fireEvent.click(screen.getByRole("button", { name: /导\s*出/ }));
    expect(await screen.findByText(/导出内容不含任何数据取值/)).toBeInTheDocument();
    expect(screen.getByText("导出给 Workshop")).toBeInTheDocument();
    fireEvent.click(screen.getByText("导出给评测"));
    await waitFor(() => expect(exportMock).toHaveBeenCalledWith("p1", "eval"));
  });

  it("is off until the requirements are drafted", () => {
    renderWithoutAntdStyles(<RequirementsExport projectId="p1" ready={false} />);
    expect(screen.getByRole("button", { name: /导\s*出/ })).toBeDisabled();
  });

  it("says when the requirements are gone, in business words", async () => {
    exportMock.mockRejectedValueOnce(
      new AxiosError("x", "ERR_BAD_REQUEST", undefined, undefined, {
        data: new Blob(),
        status: 404,
      } as AxiosResponse),
    );
    renderWithoutAntdStyles(<RequirementsExport projectId="p1" ready />);
    fireEvent.click(screen.getByRole("button", { name: /导\s*出/ }));
    fireEvent.click(await screen.findByText("导出给 Workshop"));
    await waitFor(() =>
      expect(messageMock.error).toHaveBeenCalledWith("需求规格起草完成后才能导出。"),
    );
  });
});
