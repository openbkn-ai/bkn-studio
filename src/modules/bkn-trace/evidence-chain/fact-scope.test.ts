/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";
import { scopeObjectFacts, sourceFactGroups, scopeSourceFacts } from "./fact-scope";
import type { ChainGraph } from "./evidence-chain.types";
const graph: ChainGraph = {nodes:[
 {id:"a",kind:"object",label:"A"},{id:"b",kind:"object",label:"B"},
 {id:"a1",kind:"field",label:"A first"},{id:"a2",kind:"field",label:"A second"},{id:"b1",kind:"field",label:"B first"},
 {id:"s",kind:"source",label:"Shared source"}
], edges:[
 {id:"a1",source:"a",target:"a1",label:"Field",kind:"object"},
 {id:"a2",source:"a",target:"a2",label:"Field",kind:"object"},
 {id:"b1",source:"b",target:"b1",label:"Field",kind:"object"},
 {id:"s1",source:"s",target:"a1",label:"Returned",kind:"value"},
 {id:"s2",source:"s",target:"a2",label:"Returned",kind:"value"},
 {id:"s3",source:"s",target:"b1",label:"Returned",kind:"value"},
]};
describe("local fact scope",()=>{
 it("does not expand shared sources into other objects or fields",()=>{
  const local=scopeObjectFacts(graph,"a");
  expect(local.nodes.map(n=>n.id)).toEqual(["a","a1","a2","s"]);
  expect(local.edges.map(e=>e.id)).toEqual(["a1","a2","s1","s2"]);
  expect(graph.nodes).toHaveLength(6);
 });
 it("focuses one declared field and rejects foreign fields",()=>{
  expect(scopeObjectFacts(graph,"a","a2").nodes.map(n=>n.id)).toEqual(["a","a2","s"]);
  expect(scopeObjectFacts(graph,"a","b1").nodes.map(n=>n.id)).toEqual(["a"]);
 });
 it("never treats unknown edges as object membership",()=>{
  expect(scopeObjectFacts({...graph,edges:graph.edges.map(e=>({...e,kind:undefined}))},"a").nodes.map(n=>n.id)).toEqual(["a"]);
 });
});

describe("source-only returned facts", () => {
 const returns: ChainGraph = { nodes: [
 {id:"s1",kind:"source",label:"Same function"},{id:"s2",kind:"source",label:"Same function"},
 {id:"f1",kind:"field",label:"Delay",value:"24"},{id:"f2",kind:"field",label:"Delay",value:"19"}],
 edges:[{id:"r1",source:"s1",target:"f1",kind:"value",label:"Returned"},{id:"r2",source:"s2",target:"f2",kind:"value",label:"Returned"}] };
 it("groups unowned results by exact source identity, never equal labels", () => {
  expect(sourceFactGroups(returns).map(n=>n.id)).toEqual(["s1","s2"]);
  expect(scopeSourceFacts(returns,"s1").nodes.map(n=>n.id)).toEqual(["s1","f1"]);
  expect(scopeSourceFacts(returns,"s1","f2").nodes.map(n=>n.id)).toEqual(["s1"]);
 });
 it("keeps object-owned fields in their existing object directory", () => {
  expect(sourceFactGroups(graph)).toHaveLength(0);
 });
 it("keeps returned relationship nodes and their explicit endpoints", () => {
  const related: ChainGraph = {nodes:[...graph.nodes,{id:"rel",kind:"relation",label:"Uses"}],edges:[...graph.edges,{id:"from",source:"a",target:"rel",label:"From",kind:"relation"},{id:"to",source:"rel",target:"b",label:"To",kind:"relation"}]};
  expect(scopeObjectFacts(related,"a").nodes.map(n=>n.id)).toEqual(["a","b","a1","a2","s","rel"]);
  expect(scopeObjectFacts(related,"a","a1").nodes.map(n=>n.id)).toEqual(["a","a1","s"]);
 });
});
