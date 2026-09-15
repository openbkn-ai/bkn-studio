/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";
import { recordedCallScope, recordedResourceMappings, requestedObjectLabels } from "./call-scope";
import type { OperationResolution } from "./business-provenance.service";
const operation = (input: unknown, toolName = "query_object_instance"): OperationResolution => ({ operationId: "op", toolName, input: { mode: "inline", inline: input }, elements: [], missingFacts: ["source_unavailable"], status: "not_evaluable" });
describe("recorded call scope", () => {
 it("keeps explicit network and failed query target without declaring a resolved object", () => {
  const op = operation({ kn_id: "network-a", ot_id: "asset" }); op.callStatus = "failed";
  expect(recordedCallScope(op)).toMatchObject({ networkId: "network-a", objectIds: ["asset"] });
  expect(op.elements).toEqual([]);
 });
 it("keeps all explicitly requested definitions", () => {
  expect(recordedCallScope(operation({ kn_id: "n", ids: ["a", "b"] }, "get_object_types")).objectIds).toEqual(["a", "b"]);
 });
 it("does not turn code mentions or schema candidates into object targets", () => {
  expect(recordedCallScope(operation({ kn_id: "n", code: "query_object_instance(ot_id='asset')" }, "run_code")).objectIds).toEqual([]);
  expect(recordedCallScope(operation({ kn_id: "n", query: "asset" }, "search_schema")).objectIds).toEqual([]);
 });
 it("retains resource ID and the full formal name mappings", () => {
  const op = operation({ kn_id: "n", resource_id: "r" }, "describe_resource");
  op.query = { resources: [{id:"r",name:"台账",objectId:"a",objectName:"资产"},{id:"r",name:"台账",objectId:"b",objectName:"设备"}] };
  expect(recordedCallScope(op).resourceIds).toEqual(["r"]);
  expect(recordedCallScope(op).resourceMappings).toEqual(op.query.resources);
 });
 it("does not read omitted payloads or replace a conflicting explicit scope with the projection", () => {
  const op = operation({ kn_id: "a" }); op.knowledgeNetworkId="b";
  op.query={resources:[{id:"r",objectId:"foreign",objectName:"Foreign"}]};
  expect(recordedCallScope(op)).toMatchObject({ networkId:"a", scopeConflict:true, resourceMappings:[] });
  op.input={ mode:"omitted", inline:{kn_id:"a"} }; op.knowledgeNetworkId=undefined;
  expect(recordedCallScope(op).networkId).toBe("");
 });
});

it("uses only same-network recorded object definitions for historical resource display", () => {
 const target=operation({kn_id:"n",resource_id:"r"},"describe_resource");
 const definition=operation({kn_id:"n"},"get_object_types");definition.callStatus="completed";
 definition.output={mode:"inline",inline:{structuredContent:{object_types:[{id:"asset",name:"资产",data_source:{type:"resource",id:"r",name:"资产台账"}}]}}};
 const brief={...definition,operationId:"brief",output:{mode:"inline",inline:{structuredContent:{object_types:[{id:"asset",name:"资产",data_source:{type:"resource",id:"r"}}]}}}};
 expect(recordedResourceMappings(target,[brief,definition])).toHaveLength(1);
 expect(recordedResourceMappings(target,[brief,definition])).toMatchObject([{id:"r",name:"资产台账",objectId:"asset",objectName:"资产",sourceOperationId:"op"}]);
 definition.input={mode:"inline",inline:{kn_id:"foreign"}};
 expect(recordedResourceMappings(target,[definition])).toEqual([]);
});

it("keeps every requested object when only one name was resolved",()=>{
 const op=operation({kn_id:"n",ids:["a","b"]},"get_object_types");op.elements=[{kind:"object",id:"a",name:"资产"}];
 expect(requestedObjectLabels(op)).toEqual(["资产","b"]);
});
