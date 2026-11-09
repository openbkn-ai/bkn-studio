/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import "@/app/locales/i18n";
import type { KnowledgeNetworkExportRefusal } from "@/modules/knowledge-network/services/knowledge-network.service";

import { KnowledgeNetworkExportRefusedDialog } from "./KnowledgeNetworkExportRefusedDialog";

const checkRefusal: KnowledgeNetworkExportRefusal = {
  check: {
    invalidParameters: [
      { actionTypeId: "urge_report", current: { valueFrom: "context" }, parameter: "operator" },
    ],
    misplacedParameters: [
      {
        actionTypeId: "urge_report",
        conflict: false,
        current: { source: "property", value: "order_no" },
        parameter: "order_no",
        suggested: { value: "order_no", valueFrom: "property" },
      },
      {
        conflict: true,
        current: { source: "const", value: { days: 7 } },
        logicProperty: "turnaround_hours",
        objectTypeId: "lab_order",
        parameter: "window",
        suggested: { value: { days: 7 }, valueFrom: "const" },
      },
    ],
  },
  kind: "network_check",
};

function renderDialog(refusal: KnowledgeNetworkExportRefusal, exporting = false) {
  const onCancel = vi.fn();
  const onExportV2 = vi.fn();
  render(
    <MemoryRouter>
      <KnowledgeNetworkExportRefusedDialog
        exporting={exporting}
        networkId="clinic-lab"
        onCancel={onCancel}
        onExportV2={onExportV2}
        refusal={refusal}
      />
    </MemoryRouter>,
  );
  return { onCancel, onExportV2 };
}

describe("KnowledgeNetworkExportRefusedDialog", () => {
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

  it("shows the network check, linking each parameter to the definition it is fixed in", () => {
    renderDialog(checkRefusal);

    expect(screen.getByText("需要先处理参数才能按 3.0 导出")).toBeInTheDocument();
    expect(screen.getByText("错位参数（2）")).toBeInTheDocument();
    expect(screen.getByText("无效参数（1）")).toBeInTheDocument();

    const [actionLink] = screen.getAllByRole("link", { name: "urge_report" });
    expect(actionLink).toHaveAttribute(
      "href",
      "/knowledge-network/workspace/clinic-lab/action-types/urge_report/edit",
    );
    expect(screen.getByRole("link", { name: "lab_order" })).toHaveAttribute(
      "href",
      "/knowledge-network/workspace/clinic-lab/object-types/lab_order/edit",
    );
    expect(screen.getByText(/逻辑属性 turnaround_hours/)).toBeInTheDocument();

    expect(screen.getByText("source = property")).toBeInTheDocument();
    expect(screen.getAllByText("value_from = property")).toHaveLength(1);
    expect(screen.getAllByText('value = {"days":7}')).toHaveLength(2);
    expect(screen.getByText("value_from = context")).toBeInTheDocument();

    // Only the rewrite that would replace a value already there is flagged.
    const flagged = screen.getByText("会覆盖已有值").closest("tr");
    expect(flagged && within(flagged).getByText("window")).toBeInTheDocument();
    expect(screen.getAllByText("会覆盖已有值")).toHaveLength(1);
  });

  it("offers a 2.x export or cancel, never exporting by itself", () => {
    const { onCancel, onExportV2 } = renderDialog(checkRefusal);

    expect(onExportV2).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "导出为 2.x" }));
    expect(onExportV2).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "取 消" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("shows why the package did not read back as 3.0", () => {
    renderDialog({
      kind: "not_readable_as_v3",
      reason: "object type lab_order: semantic end_time needs event_time",
    });

    expect(screen.getByText("无法按 3.0 导出")).toBeInTheDocument();
    expect(
      screen.getByText("object type lab_order: semantic end_time needs event_time"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("cannot be cancelled while the 2.x export runs", () => {
    renderDialog(checkRefusal, true);

    expect(screen.getByRole("button", { name: "取 消" })).toBeDisabled();
  });
});
