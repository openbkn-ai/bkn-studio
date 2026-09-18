/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";
import {
  recordedCallScope,
  recordedResourceMappings,
  requestedObjectLabels,
  recordedMetricTarget,
} from "./call-scope";
import type { OperationResolution } from "./business-provenance.service";
const operation = (input: unknown, toolName = "query_object_instance"): OperationResolution => ({
  operationId: "op",
  toolName,
  input: { mode: "inline", inline: input },
  elements: [],
  missingFacts: ["source_unavailable"],
  status: "not_evaluable",
});
describe("recorded call scope", () => {
  it("keeps explicit network and failed query target without declaring a resolved object", () => {
    const op = operation({ kn_id: "network-a", ot_id: "asset" });
    op.callStatus = "failed";
    expect(recordedCallScope(op)).toMatchObject({ networkId: "network-a", objectIds: ["asset"] });
    expect(op.elements).toEqual([]);
  });
  it("keeps all explicitly requested definitions", () => {
    expect(
      recordedCallScope(operation({ kn_id: "n", ids: ["a", "b"] }, "get_object_types")).objectIds,
    ).toEqual(["a", "b"]);
  });
  it("keeps the legacy explicit knowledge-network field", () => {
    const op = operation({ knowledge_network_id: "network-a", ot_id: "asset" });
    expect(recordedCallScope(op)).toMatchObject({ networkId: "network-a", objectIds: ["asset"] });
  });
  it("does not turn code mentions or schema candidates into object targets", () => {
    expect(
      recordedCallScope(
        operation({ kn_id: "n", code: "query_object_instance(ot_id='asset')" }, "run_code"),
      ).objectIds,
    ).toEqual([]);
    expect(
      recordedCallScope(operation({ kn_id: "n", query: "asset" }, "search_schema")).objectIds,
    ).toEqual([]);
  });
  it("retains resource ID and the full formal name mappings", () => {
    const op = operation({ kn_id: "n", resource_id: "r" }, "describe_resource");
    op.query = {
      resources: [
        { id: "r", name: "台账", objectId: "a", objectName: "资产" },
        { id: "r", name: "台账", objectId: "b", objectName: "设备" },
      ],
    };
    expect(recordedCallScope(op).resourceIds).toEqual(["r"]);
    expect(recordedCallScope(op).resourceMappings).toEqual(op.query.resources);
  });
  it("does not read omitted payloads or replace a conflicting explicit scope with the projection", () => {
    const op = operation({ kn_id: "a" });
    op.knowledgeNetworkId = "b";
    op.query = { resources: [{ id: "r", objectId: "foreign", objectName: "Foreign" }] };
    expect(recordedCallScope(op)).toMatchObject({
      networkId: "a",
      scopeConflict: true,
      resourceMappings: [],
    });
    op.input = { mode: "omitted", inline: { kn_id: "a" } };
    op.knowledgeNetworkId = undefined;
    expect(recordedCallScope(op).networkId).toBe("");
  });
});

it("uses only same-network recorded object definitions for historical resource display", () => {
  const target = operation({ kn_id: "n", resource_id: "r" }, "describe_resource");
  const definition = operation({ kn_id: "n" }, "get_object_types");
  definition.callStatus = "completed";
  definition.output = {
    mode: "inline",
    inline: {
      structuredContent: {
        object_types: [
          {
            id: "asset",
            name: "资产",
            data_source: { type: "resource", id: "r", name: "资产台账" },
          },
        ],
      },
    },
  };
  const brief = {
    ...definition,
    operationId: "brief",
    output: {
      mode: "inline",
      inline: {
        structuredContent: {
          object_types: [{ id: "asset", name: "资产", data_source: { type: "resource", id: "r" } }],
        },
      },
    },
  };
  expect(recordedResourceMappings(target, [brief, definition])).toHaveLength(1);
  expect(recordedResourceMappings(target, [brief, definition])).toMatchObject([
    { id: "r", name: "资产台账", objectId: "asset", objectName: "资产", sourceOperationId: "op" },
  ]);
  definition.input = { mode: "inline", inline: { kn_id: "foreign" } };
  expect(recordedResourceMappings(target, [definition])).toEqual([]);
});

it("falls back to IDs when recorded resource names conflict", () => {
  const target = operation({ kn_id: "n", resource_id: "r" }, "describe_resource");
  const first = operation({ kn_id: "n" }, "get_object_types");
  first.callStatus = "completed";
  first.output = {
    mode: "inline",
    inline: {
      structuredContent: {
        object_types: [
          {
            id: "asset",
            name: "资产",
            data_source: { type: "resource", id: "r", name: "资产台账" },
          },
        ],
      },
    },
  };
  const conflicting = {
    ...first,
    operationId: "conflicting",
    output: {
      mode: "inline",
      inline: {
        structuredContent: {
          object_types: [
            {
              id: "asset",
              name: "固定资产",
              data_source: { type: "resource", id: "r", name: "资产明细" },
            },
          ],
        },
      },
    },
  };
  expect(recordedResourceMappings(target, [first, conflicting])).toEqual([
    {
      id: "r",
      name: "",
      objectId: "asset",
      objectName: "",
      sourceOperationId: "op",
      nameConflict: true,
    },
  ]);
});

it("keeps every requested object when only one name was resolved", () => {
  const op = operation({ kn_id: "n", ids: ["a", "b"] }, "get_object_types");
  op.elements = [{ kind: "object", id: "a", name: "资产" }];
  expect(requestedObjectLabels(op)).toEqual(["资产", "b"]);
});

it("fills requested object names from recorded definitions without accepting foreign or conflicting names", () => {
  const target = operation({ kn_id: "n", ids: ["a", "b", "missing"] }, "get_object_types");
  const source = operation({ kn_id: "n" }, "get_kn_detail");
  source.callStatus = "completed";
  source.output = {
    mode: "inline",
    inline: {
      structuredContent: {
        object_types: [
          { id: "a", name: "资产" },
          { id: "b", name: "设备" },
        ],
      },
    },
  };
  expect(requestedObjectLabels(target, [source])).toEqual(["资产", "设备", "missing"]);
  const conflict = {
    ...source,
    output: { mode: "inline", inline: { object_types: [{ id: "a", name: "其他" }] } },
  };
  expect(requestedObjectLabels(target, [source, conflict])).toEqual(["a", "设备", "missing"]);
  source.input = { mode: "inline", inline: { kn_id: "foreign" } };
  expect(requestedObjectLabels(target, [source])).toEqual(["a", "b", "missing"]);
});

it("matches an explicitly requested metric to its recorded name and object scope", () => {
  const target = operation({ kn_id: "n", metric_id: "m" }, "query_metric");
  const source = operation({ kn_id: "n" }, "get_object_types");
  source.callStatus = "completed";
  source.output = {
    mode: "inline",
    inline: {
      structuredContent: {
        object_types: [{ id: "a", name: "资产", related_metrics: [{ id: "m", name: "可用量" }] }],
      },
    },
  };
  expect(recordedMetricTarget(target, [source])).toEqual({
    name: "可用量",
    objectId: "a",
    objectName: "资产",
  });
  const search = { ...source, operationId: "search", toolName: "search_schema" };
  expect(recordedMetricTarget(target, [search])).toBeUndefined();
  source.callStatus = "failed";
  expect(recordedMetricTarget(target, [source])).toBeUndefined();
});
