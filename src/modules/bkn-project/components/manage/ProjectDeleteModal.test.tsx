/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, screen, waitFor } from "@testing-library/react";
import { AxiosError, type AxiosResponse } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Project } from "@/modules/bkn-project/types/project";

const deleteProjectMock = vi.hoisted(() => vi.fn());
const translate = vi.hoisted(
  () => (key: string, options?: Record<string, unknown>) =>
    options ? `${key}:${JSON.stringify(options)}` : key,
);

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: translate }),
}));

vi.mock("@/modules/bkn-project/services/project.service", () => ({
  deleteProject: deleteProjectMock,
  renameProject: vi.fn(),
}));

import { renderWithoutAntdStyles } from "@/test/render-without-antd-styles";

import { ProjectDeleteModal } from "./ProjectDeleteModal";

const project = { canManage: true, id: "p1", name: "Orders" } as Project;

function renderModal(onDeleted = vi.fn()) {
  renderWithoutAntdStyles(
    <ProjectDeleteModal onCancel={vi.fn()} onDeleted={onDeleted} project={project} />,
  );
  return onDeleted;
}

const deleteButton = () => screen.getByRole("button", { name: "common.delete" });
const typeName = (value: string) =>
  fireEvent.change(screen.getByLabelText("bknProject.manage.delete.typeNameLabel"), {
    target: { value },
  });

describe("ProjectDeleteModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("says what goes and what stays, and deletes only once the name is typed", async () => {
    deleteProjectMock.mockResolvedValue(undefined);
    const onDeleted = renderModal();

    expect(screen.getByText("bknProject.manage.delete.removes")).toBeInTheDocument();
    expect(screen.getByText("bknProject.manage.delete.withdraws")).toBeInTheDocument();
    expect(screen.getByText("bknProject.manage.delete.keeps")).toBeInTheDocument();
    expect(deleteButton()).toBeDisabled();

    typeName("Order");
    expect(deleteButton()).toBeDisabled();
    fireEvent.click(deleteButton());
    expect(deleteProjectMock).not.toHaveBeenCalled();

    typeName("Orders");
    expect(deleteButton()).toBeEnabled();
    fireEvent.click(deleteButton());

    await waitFor(() => expect(deleteProjectMock).toHaveBeenCalledWith("p1"));
    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith(project));
  });

  it("sends one request when Enter is pressed again while deleting", async () => {
    let finish: () => void = () => undefined;
    deleteProjectMock.mockReturnValue(new Promise<void>((resolve) => (finish = resolve)));
    const onDeleted = renderModal();

    typeName("Orders");
    const field = screen.getByLabelText("bknProject.manage.delete.typeNameLabel");
    fireEvent.keyDown(field, { code: "Enter", key: "Enter", keyCode: 13 });
    fireEvent.keyDown(field, { code: "Enter", key: "Enter", keyCode: 13 });
    finish();

    await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1));
    expect(deleteProjectMock).toHaveBeenCalledTimes(1);
  });

  it("explains a refusal while a release is being published, and stays open", async () => {
    deleteProjectMock.mockRejectedValue(
      new AxiosError("busy", "ERR_BAD_REQUEST", undefined, undefined, {
        data: { description: "busy", error_code: "BknProject.Project.ReleasePublishing" },
        status: 409,
      } as AxiosResponse),
    );
    const onDeleted = renderModal();

    typeName("Orders");
    fireEvent.click(deleteButton());

    expect(await screen.findByText("bknProject.manage.releasePublishing")).toBeInTheDocument();
    expect(onDeleted).not.toHaveBeenCalled();
  });
});
