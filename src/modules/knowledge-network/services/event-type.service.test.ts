/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const getMock = vi.hoisted(() => vi.fn());
const putMock = vi.hoisted(() => vi.fn());
const deleteMock = vi.hoisted(() => vi.fn());
const listToolboxesMock = vi.hoisted(() => vi.fn());

vi.mock("@/framework/request/http", () => ({
  http: { delete: deleteMock, get: getMock, put: putMock },
}));

vi.mock("@/modules/execution-factory/services/toolbox.service", () => ({
  listToolboxes: listToolboxesMock,
}));

vi.mock("@/modules/knowledge-network/services/shared/runtime", async () => {
  const actual = await vi.importActual<
    typeof import("@/modules/knowledge-network/services/shared/runtime")
  >("@/modules/knowledge-network/services/shared/runtime");

  return { ...actual, useMock: false };
});

import {
  deleteKnEventType,
  eventClassIdOf,
  eventTypeUpdateBody,
  listKnEventRuleTools,
  updateKnEventType,
} from "@/modules/knowledge-network/services/event-type.service";
import type { KnEventType } from "@/modules/knowledge-network/types/event-type";

const cypher = (knId: string, shape: string, inputs: unknown[] = []) => ({
  function_content: {
    code: "MATCH (o:order) RETURN o.id AS key",
    inputs,
    kn_id: knId,
    result_shape: shape,
    script_type: "cypher",
  },
});

describe("event-type.service", () => {
  beforeEach(() => {
    getMock.mockReset();
    putMock.mockReset();
    deleteMock.mockReset();
    listToolboxesMock.mockReset();
  });

  it("names the event class after the code, dots made underscores", () => {
    expect(eventClassIdOf("stock.low")).toBe("stock_low");
    expect(eventClassIdOf("order-overdue")).toBe("order-overdue");
  });

  it("replaces an event type with everything it has, so a save keeps its checks", async () => {
    const stored: KnEventType = {
      check_failures: 2,
      check_schedule: { cron: "0 8 * * *", timezone: "Asia/Shanghai" },
      check_subject: { id: "u-1", name: "Ann" },
      code: "order.overdue",
      merge_hours: 0,
      name: "Overdue order",
      next_check_at: 1,
      object_type_id: "",
      rule: { legacy: true },
      rule_tool: { box_id: "b-1", parameters: { today: { check_time: "date" } }, tool_id: "t-1" },
      rule_version: "v1",
      severity: "P2",
      source: "rule",
      subject: "order",
    };
    putMock.mockResolvedValue({ data: { ...stored, object_type_id: "order_overdue" } });

    await updateKnEventType("kn-1", stored.code, eventTypeUpdateBody(stored));

    expect(putMock).toHaveBeenCalledWith(
      "/bkn-backend/v1/knowledge-networks/kn-1/event-types/order.overdue",
      {
        check_schedule: { cron: "0 8 * * *", timezone: "Asia/Shanghai" },
        merge_hours: 0,
        name: "Overdue order",
        rule: { legacy: true },
        rule_tool: {
          box_id: "b-1",
          parameters: { today: { check_time: "date" } },
          tool_id: "t-1",
        },
        rule_version: "v1",
        severity: "P2",
        subject: "order",
      },
    );
  });

  it("leaves out an empty rule tool and schedule, which an older event module refuses", async () => {
    putMock.mockResolvedValue({ data: {} });
    const reported: KnEventType = {
      code: "quality.complaint",
      merge_hours: 24,
      name: "Complaint",
      source: "report",
      subject: "order",
    };

    await updateKnEventType("kn-1", reported.code, eventTypeUpdateBody(reported));

    const body = putMock.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(body).not.toHaveProperty("rule_tool");
    expect(body).not.toHaveProperty("check_schedule");
    expect(body).toMatchObject({ merge_hours: 24, name: "Complaint", subject: "order" });
  });

  it("leaves the refusal of a delete to the caller to explain", async () => {
    deleteMock.mockResolvedValue({});

    await deleteKnEventType("kn-1", "order.overdue");

    expect(deleteMock).toHaveBeenCalledWith(
      "/bkn-backend/v1/knowledge-networks/kn-1/event-types/order.overdue",
      { skipErrorToast: true },
    );
  });

  it("offers only this network's Cypher functions that return a table as rule tools", async () => {
    listToolboxesMock.mockResolvedValue({
      items: [
        { boxId: "box-a", name: "Order rules" },
        { boxId: "box-b", name: "Broken box" },
      ],
    });
    getMock.mockImplementation((url: string) => {
      if (url.includes("box-b")) {
        return Promise.reject(new Error("gone"));
      }
      return Promise.resolve({
        data: {
          data: {
            tools: [
              {
                metadata: cypher("kn-1", "table", [
                  { name: "today", required: true, type: "string" },
                  { name: "days", type: "integer" },
                ]),
                name: "Overdue orders",
                tool_id: "t-table",
              },
              { metadata: cypher("kn-1", "value"), name: "Count", tool_id: "t-value" },
              { metadata: cypher("kn-2", "table"), name: "Other network", tool_id: "t-other" },
              {
                metadata: {
                  function_content: { code: "def handler(e): ...", script_type: "python" },
                },
                name: "Python",
                tool_id: "t-python",
              },
            ],
          },
        },
      });
    });

    const tools = await listKnEventRuleTools("kn-1");

    expect(listToolboxesMock).toHaveBeenCalledWith(
      expect.objectContaining({ metadataType: "function", status: "published" }),
    );
    expect(tools).toEqual([
      {
        boxId: "box-a",
        boxName: "Order rules",
        description: undefined,
        parameters: [
          { description: undefined, name: "today", required: true, type: "string" },
          { description: undefined, name: "days", required: undefined, type: "integer" },
        ],
        toolId: "t-table",
        toolName: "Overdue orders",
      },
    ]);
  });

  it("reads every page of tool boxes and tools, never asking for more than the service allows", async () => {
    const boxes = Array.from({ length: 101 }, (_, at) => ({
      boxId: `box-${at}`,
      name: `Box ${at}`,
    }));
    listToolboxesMock.mockImplementation(({ page }: { page: number }) =>
      Promise.resolve({
        items: page === 1 ? boxes.slice(0, 100) : boxes.slice(100),
        total: boxes.length,
      }),
    );
    const other = (at: number) => ({
      metadata: cypher("kn-2", "table"),
      name: `Other ${at}`,
      tool_id: `other-${at}`,
    });
    getMock.mockImplementation((url: string, config: { params: { page: number } }) => {
      if (!url.includes("box-100")) {
        return Promise.resolve({ data: { has_next: false, tools: [] } });
      }
      return Promise.resolve({
        data:
          config.params.page === 1
            ? { has_next: true, tools: Array.from({ length: 100 }, (_, at) => other(at)) }
            : {
                has_next: false,
                tools: [{ metadata: cypher("kn-1", "table"), name: "Late", tool_id: "t-late" }],
              },
      });
    });

    const tools = await listKnEventRuleTools("kn-1");

    expect(tools.map((tool) => tool.toolId)).toEqual(["t-late"]);
    expect(listToolboxesMock).toHaveBeenCalledTimes(2);
    for (const [query] of listToolboxesMock.mock.calls as [{ pageSize: number }][]) {
      expect(query.pageSize).toBeLessThanOrEqual(100);
    }
    for (const [, config] of getMock.mock.calls as [string, { params: { page_size: number } }][]) {
      expect(config.params.page_size).toBeLessThanOrEqual(100);
    }
  });
});
