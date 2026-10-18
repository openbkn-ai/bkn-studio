/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { render, screen, waitFor } from "@testing-library/react";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ObjectTypeMetricParticipantPanel } from "@/modules/knowledge-network/components/object-type/detail/ObjectTypeMetricParticipantPanel";
import { parseMetricParticipantIdentity } from "@/modules/knowledge-network/lib/object-type-instance-identity";
import type { ObjectTypeDataProperty } from "@/modules/knowledge-network/types/object-type";

const getInstance = vi.hoisted(() => vi.fn());

vi.mock("@/modules/knowledge-network/services/object-type.service", () => ({
  getObjectTypeInstanceData: getInstance,
}));

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

const properties = [
  { name: "order_id", displayName: "Order ID" },
  { name: "amount", displayName: "Amount" },
] as ObjectTypeDataProperty[];

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

describe("ObjectTypeMetricParticipantPanel", () => {
  beforeEach(() => getInstance.mockReset());

  it("loads and displays the exact linked instance instead of relying on sample rows", async () => {
    getInstance.mockResolvedValue({ order_id: 10361, amount: 25 });
    render(
      <ObjectTypeMetricParticipantPanel
        identityParam='{"order_id":10361}'
        networkId="kn-1"
        objectTypeId="order"
        primaryKeys={["order_id"]}
        properties={properties}
      />,
    );

    await waitFor(() =>
      expect(getInstance).toHaveBeenCalledWith("kn-1", "order", { order_id: 10361 }, [
        "order_id",
        "amount",
      ]),
    );
    expect(await screen.findByText("10361")).toBeInTheDocument();
    expect(screen.getByText("25")).toBeInTheDocument();
  });

  it("rejects malformed or lossy identities before querying", () => {
    expect(
      parseMetricParticipantIdentity('{"order_id":9007199254740993}', ["order_id"]),
    ).toBeNull();
    expect(parseMetricParticipantIdentity('{"other":1}', ["order_id"])).toBeNull();
    expect(parseMetricParticipantIdentity('{"order_id":"9007199254740993"}', ["order_id"])).toEqual(
      {
        order_id: "9007199254740993",
      },
    );
  });
});
