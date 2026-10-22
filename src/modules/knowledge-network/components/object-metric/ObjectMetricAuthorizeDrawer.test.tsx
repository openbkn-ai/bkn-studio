/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ObjectMetricRecordV1 } from "@/modules/knowledge-network/types/object-metric";

vi.mock(
  "@/modules/knowledge-network/components/shared/KnowledgeNetworkObjectAuthorizeDrawer",
  () => ({
    KnowledgeNetworkObjectAuthorizeDrawer: ({
      networkId,
      networkName,
      objectType,
      open,
      record,
    }: {
      networkId: string;
      networkName?: string;
      objectType: string;
      open: boolean;
      record: { id: string; name: string; operations?: string[] } | null;
    }) => (
      <div
        data-id={record?.id}
        data-name={record?.name}
        data-network-id={networkId}
        data-network-name={networkName}
        data-object-type={objectType}
        data-open={String(open)}
        data-operations={record?.operations?.join(",")}
        data-testid="authorization-drawer"
      />
    ),
  }),
);

import { ObjectMetricAuthorizeDrawer } from "./ObjectMetricAuthorizeDrawer";

describe("ObjectMetricAuthorizeDrawer", () => {
  it("maps every metric version to the same visible metric authorization resource", () => {
    const metric = {
      definition: { id: "metric-1", name: "订单金额", version: 7 },
    } as ObjectMetricRecordV1;

    render(
      <ObjectMetricAuthorizeDrawer
        metric={metric}
        networkId="network-1"
        networkName="销售网络"
        onClose={vi.fn()}
        open
      />,
    );

    const drawer = screen.getByTestId("authorization-drawer");
    expect(drawer).toHaveAttribute("data-id", "metric-1");
    expect(drawer).toHaveAttribute("data-name", "订单金额");
    expect(drawer).toHaveAttribute("data-network-id", "network-1");
    expect(drawer).toHaveAttribute("data-network-name", "销售网络");
    expect(drawer).toHaveAttribute("data-object-type", "metric");
    expect(drawer).toHaveAttribute("data-operations", "view_detail");
  });
});
