/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DeclarationsWouldBeClearedError } from "@/modules/knowledge-network/services/shared/declaration-errors";
import { KnowledgeNetworkImportConflictError } from "@/modules/knowledge-network/services/shared/runtime";

import { JsonResourceImportButton } from "./JsonResourceImportButton";

const mocks = vi.hoisted(() => ({
  messageError: vi.fn(),
  messageSuccess: vi.fn(),
  modalInfo: vi.fn(),
}));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({
    message: { error: mocks.messageError, success: mocks.messageSuccess },
    modal: { info: mocks.modalInfo },
  }),
}));

const payload = {
  id: "cg-lab",
  name: "Lab",
  object_types: [{ id: "lab_order", name: "检验申请" }],
};

function upload(container: HTMLElement) {
  const input = container.querySelector('input[type="file"]');
  if (!input) {
    throw new Error("no file input");
  }
  fireEvent.change(input, {
    target: {
      files: [new File([JSON.stringify(payload)], "cg-lab.json", { type: "application/json" })],
    },
  });
}

describe("JsonResourceImportButton", () => {
  beforeEach(() => {
    mocks.messageError.mockReset();
    mocks.messageSuccess.mockReset();
    mocks.modalInfo.mockReset();
    mocks.modalInfo.mockReturnValue({ destroy: vi.fn() });
  });

  // Regression: this refusal used to open the ID-conflict dialog, whose "overwrite" resent the
  // same request without the confirmation and got the same refusal, without end.
  it("lists the declarations an overwrite would clear and resends with the confirmation", async () => {
    const onImport = vi
      .fn()
      .mockRejectedValueOnce(
        new DeclarationsWouldBeClearedError("refused", [
          { fields: ["semantic"], id: "lab_order", kind: "object_type", property: "ordered_at" },
        ]),
      )
      .mockResolvedValueOnce(undefined);
    const onImported = vi.fn();
    const { container } = render(
      <JsonResourceImportButton onImport={onImport} onImported={onImported} />,
    );

    upload(container);

    const list = await screen.findByRole("region", { name: "检验申请" });
    expect(within(list).getByText("ordered_at：语义")).toBeInTheDocument();
    expect(mocks.modalInfo).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "清除声明并导入" }));

    await waitFor(() => expect(onImport).toHaveBeenCalledTimes(2));
    expect(onImport).toHaveBeenNthCalledWith(1, payload, undefined, false);
    expect(onImport).toHaveBeenNthCalledWith(2, payload, undefined, true);
    await waitFor(() => expect(onImported).toHaveBeenCalled());
    expect(mocks.messageSuccess).toHaveBeenCalled();
  });

  it("keeps the chosen overwrite when the conflict dialog leads to the list", async () => {
    const onImport = vi
      .fn()
      .mockRejectedValueOnce(new KnowledgeNetworkImportConflictError("cg-lab exists"))
      .mockRejectedValueOnce(
        new DeclarationsWouldBeClearedError("refused", [
          { fields: ["aliases"], id: "lab_order", kind: "object_type" },
        ]),
      )
      .mockResolvedValueOnce(undefined);
    const { container } = render(
      <JsonResourceImportButton onImport={onImport} onImported={vi.fn()} />,
    );

    upload(container);
    await waitFor(() => expect(mocks.modalInfo).toHaveBeenCalledTimes(1));
    const conflict = mocks.modalInfo.mock.calls[0]?.[0] as { footer: ReactElement };
    render(conflict.footer);
    fireEvent.click(screen.getByRole("button", { name: "覆 盖" }));

    await screen.findByRole("region", { name: "检验申请" });
    fireEvent.click(screen.getByRole("button", { name: "清除声明并导入" }));

    await waitFor(() => expect(onImport).toHaveBeenCalledTimes(3));
    expect(onImport).toHaveBeenNthCalledWith(2, payload, "overwrite", false);
    expect(onImport).toHaveBeenNthCalledWith(3, payload, "overwrite", true);
  });

  it("sends nothing more when the list is cancelled", async () => {
    const onImport = vi
      .fn()
      .mockRejectedValueOnce(
        new DeclarationsWouldBeClearedError("refused", [
          { fields: ["aliases"], id: "lab_order", kind: "object_type" },
        ]),
      );
    const { container } = render(
      <JsonResourceImportButton onImport={onImport} onImported={vi.fn()} />,
    );

    upload(container);
    await screen.findByRole("region", { name: "检验申请" });
    fireEvent.click(screen.getByRole("button", { name: "取 消" }));

    await waitFor(() =>
      expect(screen.queryByRole("region", { name: "检验申请" })).not.toBeInTheDocument(),
    );
    expect(onImport).toHaveBeenCalledTimes(1);
    expect(mocks.messageError).not.toHaveBeenCalled();
  });
});
