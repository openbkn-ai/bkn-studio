/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  ObjectTypeLogicProperty,
  ObjectTypeResourcePreview,
} from "@/modules/knowledge-network/types/knowledge-network";

import { ObjectTypeDetailLogicPropertyTrialPanel } from "./ObjectTypeDetailLogicPropertyTrialPanel";

const mocks = vi.hoisted(() => ({
  getValues: vi.fn(),
  message: { success: vi.fn(), warning: vi.fn() },
}));

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({
    t: (key: string, values?: { count?: number }) =>
      key === "knowledgeNetwork.objectTypeDetailLogicTrialRunSingle"
        ? "试算"
        : key === "knowledgeNetwork.objectTypeDetailLogicTrialCompleted"
          ? `已完成 ${values?.count ?? 0} 条`
          : key === "knowledgeNetwork.objectTypeDetailLogicTrialNoData"
            ? "无数据"
            : key,
  }),
}));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({ message: mocks.message }),
}));

vi.mock("@/modules/knowledge-network/services/object-type-logic-property-trial.service", () => ({
  getObjectTypeLogicPropertyValues: mocks.getValues,
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

beforeEach(() => {
  vi.clearAllMocks();
});

const metricProperty: ObjectTypeLogicProperty = {
  dataSource: { id: "metric-1", name: "订单金额", type: "metric" },
  displayName: "验收订单金额",
  name: "acceptance_order_amount",
  type: "metric",
};

const preview: ObjectTypeResourcePreview = {
  columns: [
    { dataIndex: "order_id", title: "主键" },
    { dataIndex: "order_no", title: "订单号" },
  ],
  name: "订单",
  rows: [{ order_id: 10357, order_no: "ORDER-10357" }],
};

describe("ObjectTypeDetailLogicPropertyTrialPanel", () => {
  it("runs a metric-backed logical property for one instance and renders the result", async () => {
    mocks.getValues.mockResolvedValue([
      {
        instanceIdentity: { order_id: 10357 },
        values: {
          acceptance_order_amount: {
            datas: [{ status: "ok", values: [14485.37] }],
            model: { unit: "CNY" },
            status: "ok",
          },
        },
      },
    ]);

    render(
      <ObjectTypeDetailLogicPropertyTrialPanel
        canQueryData
        dataProperties={[]}
        displayKey="order_no"
        logicProperties={[metricProperty]}
        networkId="metric_e2e_20261004"
        objectTypeId="order"
        preview={preview}
        primaryKeys={["order_id"]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "试算" }));

    await waitFor(() =>
      expect(mocks.getValues).toHaveBeenCalledWith(
        expect.objectContaining({
          instanceIdentities: [{ order_id: 10357 }],
          logicProperties: [metricProperty],
        }),
      ),
    );
    expect(await screen.findByText(/14485\.37/)).toBeInTheDocument();
    expect(mocks.message.success).toHaveBeenCalledWith("已完成 1 条");
  });

  it("shows a completed no-data result instead of leaving the pending placeholder", async () => {
    mocks.getValues.mockResolvedValue([
      {
        instanceIdentity: { order_id: 10357 },
        values: { acceptance_order_amount: { datas: [], status: "no_data" } },
      },
    ]);

    render(
      <ObjectTypeDetailLogicPropertyTrialPanel
        canQueryData
        dataProperties={[]}
        displayKey="order_no"
        logicProperties={[metricProperty]}
        networkId="metric_e2e_20261004"
        objectTypeId="order"
        preview={preview}
        primaryKeys={["order_id"]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "试算" }));

    expect(await screen.findByText("无数据")).toBeInTheDocument();
  });

  it("shows the backend error instead of silently leaving the pending placeholder", async () => {
    mocks.getValues.mockRejectedValue(new Error("工具执行失败，请检查工具配置"));

    render(
      <ObjectTypeDetailLogicPropertyTrialPanel
        canQueryData
        dataProperties={[]}
        displayKey="order_no"
        logicProperties={[metricProperty]}
        networkId="ecommerce_ops_bkn"
        objectTypeId="order"
        preview={preview}
        primaryKeys={["order_id"]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "试算" }));

    expect(await screen.findByText("工具执行失败，请检查工具配置")).toBeInTheDocument();
  });
});
