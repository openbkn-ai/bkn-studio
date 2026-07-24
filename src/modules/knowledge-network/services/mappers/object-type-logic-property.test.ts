/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  buildBackendObjectTypePayload,
  mapLogicProperty,
  toBackendLogicProperty,
} from "@/modules/knowledge-network/services/mappers";

describe("object type tool logic property mapper", () => {
  it("maps toolbox identifiers and result path from backend", () => {
    expect(
      mapLogicProperty({
        data_source: {
          box_id: "box-1",
          name: "Weather",
          result_path: "$.data.temperature",
          tool_id: "tool-1",
          type: "tool",
        },
        display_name: "Weather",
        name: "weather",
        type: "tool",
      }),
    ).toMatchObject({
      dataSource: {
        boxId: "box-1",
        resultPath: "$.data.temperature",
        toolId: "tool-1",
        type: "tool",
      },
      type: "tool",
    });
  });

  it("preserves toolbox identifiers and result path in create payloads", () => {
    expect(
      toBackendLogicProperty({
        dataSource: {
          boxId: "box-1",
          name: "Weather",
          resultPath: "$.data.temperature",
          toolId: "tool-1",
          type: "tool",
        },
        displayName: "Weather",
        name: "weather",
        type: "tool",
      }),
    ).toMatchObject({
      data_source: {
        box_id: "box-1",
        result_path: "$.data.temperature",
        tool_id: "tool-1",
        type: "tool",
      },
      type: "tool",
    });
  });

  it("preserves the tool result path in an object type mutation payload", () => {
    expect(
      buildBackendObjectTypePayload(
        {
          color: "#1677ff",
          conceptGroupIds: [],
          description: "",
          logicProperties: [
            {
              dataSource: {
                boxId: "box-1",
                name: "Weather",
                resultPath: "$.data.temperature",
                toolId: "tool-1",
                type: "tool",
              },
              displayName: "Weather",
              name: "weather",
              type: "tool",
            },
          ],
          name: "Weather object",
          tags: [],
        },
        [],
      ).logic_properties,
    ).toMatchObject([
      {
        data_source: {
          box_id: "box-1",
          result_path: "$.data.temperature",
          tool_id: "tool-1",
          type: "tool",
        },
      },
    ]);
  });
});
