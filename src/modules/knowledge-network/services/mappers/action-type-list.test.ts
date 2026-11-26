/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  mapActionKind,
  mapActionType,
  mapActionTypeDetail,
  mapConceptGroupDetail,
  mapRecentObject,
} from "@/modules/knowledge-network/services/mappers";

describe("action type list mapper", () => {
  it("maps backend lowercase action types to frontend action kinds", () => {
    expect(mapActionKind("add")).toBe("create");
    expect(mapActionKind("modify")).toBe("update");
    expect(mapActionKind("delete")).toBe("delete");
    expect(mapActionKind("notify")).toBe("notify");
  });

  it("keeps supporting backend uppercase action types", () => {
    expect(mapActionKind("ADD")).toBe("create");
    expect(mapActionKind("UPDATE")).toBe("update");
    expect(mapActionKind("DELETE")).toBe("delete");
    expect(mapActionKind("NOTIFY")).toBe("notify");
  });

  it("maps modify records to update for the action type list", () => {
    const record = mapActionType({
      action_type: "modify",
      id: "action-1",
      name: "Edit order",
      operations: ["authorize"],
    });

    expect(record.actionKind).toBe("update");
    expect(record.operations).toEqual(["authorize"]);
  });

  it("preserves operations for the action type detail", () => {
    const detail = mapActionTypeDetail({
      action_type: "modify",
      id: "action-1",
      name: "Edit order",
      operations: ["modify", "authorize", "delete"],
    });

    expect(detail.operations).toEqual(["modify", "authorize", "delete"]);
  });

  it("names the event class of a recognition action, and none of another action", () => {
    const recognition = mapActionTypeDetail({
      action_type: "add",
      id: "order_overdue_recognition",
      name: "Overdue order recognition",
      operation_config: { event_class: "order_overdue", type: "event" },
    } as unknown as Parameters<typeof mapActionTypeDetail>[0]);
    const other = mapActionTypeDetail({
      action_type: "modify",
      id: "action-1",
      name: "Edit order",
      operation_config: { type: "object" },
    });

    expect(recognition.eventClassId).toBe("order_overdue");
    expect(recognition.operationConfig).toBeUndefined();
    expect(other.eventClassId).toBeUndefined();
  });

  it("maps concept group action type entries with lowercase backend enums", () => {
    const detail = mapConceptGroupDetail({
      action_types: [
        {
          action_type: "modify",
          id: "action-1",
          name: "Edit order",
        },
      ],
      id: "group-1",
      name: "Order group",
      operations: ["authorize"],
    });

    expect(detail.actionTypes[0]?.actionKind).toBe("update");
    expect(detail.operations).toEqual(["authorize"]);
  });

  it("preserves operations for recently modified object types", () => {
    const record = mapRecentObject({
      id: "object-1",
      name: "Risk order",
      operations: ["view_detail", "modify"],
    });

    expect(record.operations).toEqual(["view_detail", "modify"]);
  });
});
