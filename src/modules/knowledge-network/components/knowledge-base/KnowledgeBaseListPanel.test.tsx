/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { AxiosError, type AxiosResponse } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CapabilityBindingRecord } from "@/modules/knowledge-network/types/knowledge-network";
import { renderWithoutAntdStyles } from "@/test/render-without-antd-styles";

const listCapabilitiesMock = vi.hoisted(() => vi.fn());
const attachMock = vi.hoisted(() => vi.fn());
const detachMock = vi.hoisted(() => vi.fn());
const listKnowledgeBasesMock = vi.hoisted(() => vi.fn());
const confirmMock = vi.hoisted(() => vi.fn<(config: { onOk: () => Promise<void> }) => void>());
const messageMock = vi.hoisted(() => ({ info: vi.fn(), success: vi.fn() }));

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key}:${JSON.stringify(options)}` : key,
  }),
}));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({ message: messageMock, modal: { confirm: confirmMock } }),
}));

vi.mock("@/framework/entitlement/use-entitlement", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/framework/entitlement/use-entitlement")>()),
  useEntitlement: () => ({ edition: "professional", extensions: ["knowledge_base"] }),
}));

vi.mock("@/modules/knowledge-network/components/shared/ResourcePermissionRequestAction", () => ({
  ResourcePermissionRequestAction: ({ resourceName }: { resourceName: string }) => (
    <button type="button">request {resourceName}</button>
  ),
}));

vi.mock("@/modules/knowledge-network/components/shared/resource-permission-request", () => ({
  canRequestResourcePermission: () => true,
}));

vi.mock("@/modules/knowledge-network/services/capability-binding.service", () => ({
  attachKnowledgeNetworkCapabilities: attachMock,
  detachKnowledgeNetworkCapabilities: detachMock,
  listKnowledgeNetworkCapabilities: listCapabilitiesMock,
}));

vi.mock("@/modules/knowledge-network/services/knowledge-base.service", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/modules/knowledge-network/services/knowledge-base.service")
  >()),
  listQueryableKnowledgeBases: listKnowledgeBasesMock,
}));

import { KnowledgeBaseListPanel } from "./KnowledgeBaseListPanel";

function binding(change: Partial<CapabilityBindingRecord>): CapabilityBindingRecord {
  return {
    boundAsBox: false,
    boxId: "",
    boxName: "",
    branch: "main",
    capabilityId: "11",
    capabilityType: "knowledge_base",
    comment: "",
    createTime: "2026-10-27 10:00:00",
    creatorName: "Li Lei",
    description: "",
    id: "binding-11",
    metadataType: "",
    name: "Contracts",
    sources: [],
    status: "",
    updateTime: "2026-10-27 10:00:00",
    updaterName: "Li Lei",
    ...change,
  };
}

function refusal(status: number, code: string) {
  return new AxiosError(String(status), "ERR_BAD_RESPONSE", undefined, undefined, {
    data: { description: "described", error_code: code },
    status,
  } as AxiosResponse);
}

const listed = (...entries: CapabilityBindingRecord[]) => ({
  boxes: [],
  entries,
  metadataAvailable: true,
  totalCount: entries.length,
});

describe("KnowledgeBaseListPanel", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    // Ant Design's table reads breakpoints, which jsdom lacks.
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
    listCapabilitiesMock.mockResolvedValue(
      listed(
        binding({}),
        binding({ capabilityId: "19", id: "binding-19", name: "", status: "missing" }),
      ),
    );
    listKnowledgeBasesMock.mockResolvedValue([
      { description: "", documentCount: 3, id: "11", name: "Contracts" },
      { description: "Reports", id: "12", name: "Incidents" },
    ]);
  });

  it("lists mounted knowledge bases with their status, naming one that is gone", async () => {
    renderWithoutAntdStyles(<KnowledgeBaseListPanel canModify networkId="kn-1" />);

    expect(await screen.findByText("Contracts")).toBeInTheDocument();
    expect(screen.getByText("knowledgeNetwork.knowledgeBasesMissingName")).toBeInTheDocument();
    expect(screen.getByText("knowledgeNetwork.knowledgeBasesStatusMissing")).toBeInTheDocument();
    expect(listCapabilitiesMock).toHaveBeenCalledWith("kn-1", {
      limit: 1000,
      type: "knowledge_base",
      withDetail: true,
    });
  });

  it("unmounts a knowledge base after asking, and lists again", async () => {
    detachMock.mockResolvedValue(undefined);
    renderWithoutAntdStyles(<KnowledgeBaseListPanel canModify networkId="kn-1" />);

    fireEvent.click(
      await screen.findByRole("button", {
        name: /knowledgeBasesDetachAction:.*knowledgeBasesMissingName/,
      }),
    );
    await act(async () => {
      await confirmMock.mock.calls[0][0].onOk();
    });

    expect(detachMock).toHaveBeenCalledWith("kn-1", ["binding-19"]);
    expect(listCapabilitiesMock).toHaveBeenCalledTimes(2);
  });

  it("offers neither mounting nor unmounting to someone who may not modify the network", async () => {
    renderWithoutAntdStyles(<KnowledgeBaseListPanel canModify={false} networkId="kn-1" />);

    expect(await screen.findByText("Contracts")).toBeInTheDocument();
    expect(screen.queryByText("knowledgeNetwork.knowledgeBasesMount")).toBeNull();
    expect(screen.queryByText("knowledgeNetwork.knowledgeBasesDetach")).toBeNull();
  });

  it("says when the deployment has no knowledge-base service, and offers no mount", async () => {
    listCapabilitiesMock.mockRejectedValue(
      refusal(400, "BknBackend.CapabilityBinding.KnowledgeBaseNotSupported"),
    );
    renderWithoutAntdStyles(<KnowledgeBaseListPanel canModify networkId="kn-1" />);

    expect(
      await screen.findByText("knowledgeNetwork.knowledgeBasesNotSupportedTitle"),
    ).toBeInTheDocument();
    expect(screen.queryByText("knowledgeNetwork.knowledgeBasesMount")).toBeNull();
  });

  it("explains a failed read in words and reads again on retry", async () => {
    listCapabilitiesMock.mockRejectedValueOnce(
      refusal(502, "BknBackend.CapabilityBinding.KnowledgeBaseServiceUnavailable"),
    );
    renderWithoutAntdStyles(<KnowledgeBaseListPanel canModify networkId="kn-1" />);

    expect(
      await screen.findByText("knowledgeNetwork.knowledgeBasesFailure.unavailable"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/BknBackend/)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "common.retry" }));
    expect(await screen.findByText("Contracts")).toBeInTheDocument();
  });

  it("mounts a picked knowledge base; one already mounted cannot be picked again", async () => {
    attachMock.mockResolvedValue([binding({ capabilityId: "12", id: "binding-12" })]);
    renderWithoutAntdStyles(<KnowledgeBaseListPanel canModify networkId="kn-1" />);

    fireEvent.click(await screen.findByText("knowledgeNetwork.knowledgeBasesMount"));
    const dialog = within(await screen.findByRole("dialog"));
    const boxes = await dialog.findAllByRole("checkbox");
    expect(boxes[0]).toBeChecked();
    expect(boxes[0]).toBeDisabled();
    // A document count kb-api did not report is not shown as zero.
    expect(dialog.getAllByText(/knowledgeBasesPicker.documents/)).toHaveLength(1);

    fireEvent.click(boxes[1]);
    fireEvent.click(
      dialog.getByRole("button", { name: "knowledgeNetwork.knowledgeBasesPicker.confirm" }),
    );

    await waitFor(() =>
      expect(attachMock).toHaveBeenCalledWith("kn-1", [
        { capabilityId: "12", capabilityType: "knowledge_base" },
      ]),
    );
    expect(messageMock.success).toHaveBeenCalledWith(
      'knowledgeNetwork.knowledgeBasesPicker.success:{"count":1}',
    );
  });

  it("offers to request query access when mounting is refused for it", async () => {
    attachMock.mockRejectedValue(
      refusal(403, "BknBackend.KnowledgeNetwork.Proxy.PermissionMissing"),
    );
    renderWithoutAntdStyles(<KnowledgeBaseListPanel canModify networkId="kn-1" />);

    fireEvent.click(await screen.findByText("knowledgeNetwork.knowledgeBasesMount"));
    const dialog = within(await screen.findByRole("dialog"));
    fireEvent.click((await dialog.findAllByRole("checkbox"))[1]);
    fireEvent.click(
      dialog.getByRole("button", { name: "knowledgeNetwork.knowledgeBasesPicker.confirm" }),
    );

    expect(
      await dialog.findByText("knowledgeNetwork.knowledgeBasesFailure.noPermission"),
    ).toBeInTheDocument();
    expect(dialog.getByRole("button", { name: "request Incidents" })).toBeInTheDocument();
  });

  it("keeps the latest search when an earlier one answers last", async () => {
    let answerFirst: (items: unknown[]) => void = () => undefined;
    listKnowledgeBasesMock
      .mockResolvedValueOnce([])
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            answerFirst = resolve;
          }),
      )
      .mockResolvedValueOnce([{ description: "", id: "12", name: "Incidents" }]);
    renderWithoutAntdStyles(<KnowledgeBaseListPanel canModify networkId="kn-1" />);

    fireEvent.click(await screen.findByText("knowledgeNetwork.knowledgeBasesMount"));
    const dialog = within(await screen.findByRole("dialog"));
    const search = await dialog.findByPlaceholderText(
      "knowledgeNetwork.knowledgeBasesPicker.search",
    );
    const searchButton = dialog.getByRole("button", { name: /search/ });
    fireEvent.change(search, { target: { value: "con" } });
    fireEvent.click(searchButton);
    fireEvent.change(search, { target: { value: "inc" } });
    fireEvent.click(searchButton);
    await waitFor(() => expect(listKnowledgeBasesMock).toHaveBeenCalledTimes(3));
    expect(await dialog.findByText("Incidents")).toBeInTheDocument();

    await act(async () => {
      answerFirst([{ description: "", id: "11", name: "Contracts" }]);
      await Promise.resolve();
    });
    expect(dialog.getByText("Incidents")).toBeInTheDocument();
    expect(dialog.queryByText("Contracts")).toBeNull();
  });

  it("tells an empty list from a search with no match", async () => {
    listKnowledgeBasesMock.mockResolvedValue([]);
    renderWithoutAntdStyles(<KnowledgeBaseListPanel canModify networkId="kn-1" />);

    fireEvent.click(await screen.findByText("knowledgeNetwork.knowledgeBasesMount"));
    const dialog = within(await screen.findByRole("dialog"));
    expect(
      await dialog.findByText("knowledgeNetwork.knowledgeBasesPicker.none"),
    ).toBeInTheDocument();

    const search = dialog.getByPlaceholderText("knowledgeNetwork.knowledgeBasesPicker.search");
    fireEvent.change(search, { target: { value: "minutes" } });
    fireEvent.keyDown(search, { code: "Enter", key: "Enter" });

    expect(
      await dialog.findByText(
        'knowledgeNetwork.knowledgeBasesPicker.noMatch:{"keyword":"minutes"}',
      ),
    ).toBeInTheDocument();
    expect(listKnowledgeBasesMock).toHaveBeenLastCalledWith("minutes");
  });
});
