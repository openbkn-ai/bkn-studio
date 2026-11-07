/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen, within } from "@testing-library/react";
import { AxiosError, AxiosHeaders } from "axios";
import { MemoryRouter } from "react-router-dom";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import "@/app/locales/i18n";

const checkMock = vi.hoisted(() => vi.fn());

vi.mock(
  "@/modules/knowledge-network/services/knowledge-network.service",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("@/modules/knowledge-network/services/knowledge-network.service")
    >()),
    checkKnowledgeNetwork: checkMock,
  }),
);

import { KnowledgeNetworkCheckDialog } from "./KnowledgeNetworkCheckDialog";

function renderDialog() {
  const onClose = vi.fn();
  render(
    <MemoryRouter>
      <KnowledgeNetworkCheckDialog
        network={{ id: "clinic-lab", name: "检验科" }}
        onClose={onClose}
      />
    </MemoryRouter>,
  );
  return { onClose };
}

describe("KnowledgeNetworkCheckDialog", () => {
  // antd's table reads breakpoints, which jsdom does not implement.
  const originalMatchMedia = window.matchMedia;

  beforeAll(() => {
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

  afterAll(() => {
    window.matchMedia = originalMatchMedia;
  });

  beforeEach(() => {
    checkMock.mockReset();
  });

  it("runs the check on opening and links each parameter to its definition", async () => {
    checkMock.mockResolvedValue({
      invalidParameters: [],
      misplacedParameters: [
        {
          actionTypeId: "urge_report",
          conflict: false,
          current: { source: "property", value: "order_no" },
          parameter: "order_no",
          suggested: { value: "order_no", valueFrom: "property" },
        },
      ],
    });
    renderDialog();

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("网络体检 · 检验科")).toBeInTheDocument();
    expect(await within(dialog).findByText("错位参数（1）")).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: "urge_report" })).toHaveAttribute(
      "href",
      "/knowledge-network/workspace/clinic-lab/action-types/urge_report/edit",
    );
    expect(within(dialog).queryByText("无效参数（0）")).toBeNull();
    expect(checkMock).toHaveBeenCalledWith("clinic-lab");
  });

  // The check sends unset fields as empty strings, as test server 23 showed.
  it("leaves out the fields a parameter does not set", async () => {
    checkMock.mockResolvedValue({
      invalidParameters: [],
      misplacedParameters: [
        {
          actionTypeId: "revoke_lab_order",
          conflict: false,
          current: { source: "input", value: "", valueFrom: "-" },
          parameter: "reason",
          suggested: { source: "", value: "", valueFrom: "input" },
        },
      ],
    });
    renderDialog();

    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByText("source = input")).toBeInTheDocument();
    expect(within(dialog).getByText("value_from = -")).toBeInTheDocument();
    expect(within(dialog).getByText("value_from = input")).toBeInTheDocument();
    expect(within(dialog).queryByText(/^value =/)).toBeNull();
    expect(within(dialog).queryByText(/^source =\s*$/)).toBeNull();
  });

  it("says so when there is nothing to fix", async () => {
    checkMock.mockResolvedValue({ invalidParameters: [], misplacedParameters: [] });
    renderDialog();

    expect(await screen.findByText("没有发现问题")).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("shows why the check failed, and runs it again on request", async () => {
    checkMock
      .mockRejectedValueOnce(
        new AxiosError("Request failed with status code 403", undefined, undefined, undefined, {
          config: { headers: new AxiosHeaders() },
          data: { description: "没有读取该知识网络的权限", error_code: "BknBackend.Forbidden" },
          headers: {},
          status: 403,
          statusText: "Forbidden",
        }),
      )
      .mockResolvedValueOnce({ invalidParameters: [], misplacedParameters: [] });
    const { onClose } = renderDialog();

    expect(await screen.findByText("体检没有完成")).toBeInTheDocument();
    expect(screen.getByText("没有读取该知识网络的权限")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "重新检查" }));

    expect(await screen.findByText("没有发现问题")).toBeInTheDocument();
    expect(checkMock).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByRole("button", { name: "关 闭" }));
    expect(onClose).toHaveBeenCalled();
  });
});
