/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ObjectMetricFormScene } from "./ObjectMetricFormScene";

const mocks = vi.hoisted(() => {
  const routeParams: { current: { metricId?: string; networkId: string } } = {
    current: { metricId: "metric-1", networkId: "network-1" },
  };
  return {
    createObjectMetricDraftV1: vi.fn(),
    getKnowledgeNetworkObjectTypeDetail: vi.fn(),
    getObjectMetricV1: vi.fn(),
    message: { error: vi.fn(), info: vi.fn(), success: vi.fn() },
    navigate: vi.fn(),
    routeParams,
    searchParams: { current: "" },
    runtimeConfig: {
      auth: { tokenManager: { getAccessToken: () => null, refreshAccessToken: vi.fn() } },
    },
  };
});

vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router-dom")>()),
  useNavigate: () => mocks.navigate,
  useParams: () => mocks.routeParams.current,
  useSearchParams: () => [new URLSearchParams(mocks.searchParams.current)],
}));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({
    message: mocks.message,
    runtimeConfig: mocks.runtimeConfig,
  }),
}));

vi.mock(
  "@/modules/knowledge-network/services/knowledge-network.service",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("@/modules/knowledge-network/services/knowledge-network.service")
    >()),
    createObjectMetricDraftV1: mocks.createObjectMetricDraftV1,
    getObjectMetricCapabilitiesV1: vi.fn().mockResolvedValue(undefined),
    getObjectMetricV1: mocks.getObjectMetricV1,
    listKnowledgeNetworkObjectTypes: vi.fn().mockResolvedValue([]),
    listKnowledgeNetworkRelationTypes: vi.fn().mockResolvedValue([]),
    listObjectMetricsV1: vi.fn().mockResolvedValue({ entries: [], total_count: 0 }),
  }),
);

vi.mock("@/modules/knowledge-network/services/object-type.service", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/modules/knowledge-network/services/object-type.service")
  >()),
  getKnowledgeNetworkObjectTypeDetail: mocks.getKnowledgeNetworkObjectTypeDetail,
}));

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

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

beforeEach(() => {
  mocks.createObjectMetricDraftV1.mockResolvedValue(undefined);
  mocks.routeParams.current = { metricId: "metric-1", networkId: "network-1" };
  mocks.searchParams.current = "";
});

describe("ObjectMetricFormScene object properties", () => {
  it("does not offer a silent fallback or save when object-type detail fails", async () => {
    mocks.routeParams.current = { metricId: undefined, networkId: "network-1" };
    mocks.searchParams.current = "objectTypeId=order&metricType=atomic";
    mocks.getKnowledgeNetworkObjectTypeDetail.mockRejectedValueOnce(new Error("offline"));

    render(<ObjectMetricFormScene mode="create" />);

    expect(await screen.findByText("对象属性加载失败")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "保存草稿" }));
    await waitFor(() => expect(mocks.message.error).toHaveBeenCalled());
    expect(mocks.createObjectMetricDraftV1).not.toHaveBeenCalled();
  });
});

describe("ObjectMetricFormScene edit loading", () => {
  it.each([
    { error: { isAxiosError: true, response: { status: 403 } }, title: "无权查看该指标" },
    { error: { isAxiosError: true, response: { status: 404 } }, title: "指标不存在" },
    { error: new Error("request timeout"), title: "指标加载失败" },
  ])(
    "does not fall back to creation when the metric cannot be read: $title",
    async ({ error, title }) => {
      mocks.getObjectMetricV1.mockRejectedValueOnce(error);

      render(<ObjectMetricFormScene mode="edit" />);

      expect(await screen.findByText(title)).toBeInTheDocument();
      expect(
        screen.getByText("未加载到原指标，编辑操作已停止，不会创建新指标。"),
      ).toBeInTheDocument();
      expect(screen.queryByText("保存草稿")).not.toBeInTheDocument();
      await waitFor(() => expect(mocks.getObjectMetricV1).toHaveBeenCalledTimes(1));
      expect(mocks.createObjectMetricDraftV1).not.toHaveBeenCalled();
      expect(mocks.navigate).not.toHaveBeenCalled();
    },
  );
});
