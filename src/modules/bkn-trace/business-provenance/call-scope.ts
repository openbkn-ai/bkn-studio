/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { OperationResolution } from "./business-provenance.service";
function record(value: unknown): Record<string, unknown> {
 return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function text(value: unknown): string { return typeof value === "string" ? value.trim() : ""; }
function strings(value: unknown): string[] { return Array.isArray(value) ? value.map(text).filter(Boolean) : []; }
/** Request scope is not a resolved object or a conclusion assessment. */
export function recordedCallScope(operation: OperationResolution) {
 const envelope = record(operation.input);
 const input = envelope.mode === "inline" ? record(envelope.inline) : {};
 const explicitNetwork = text(input.kn_id);
 const objectIds = [text(input.ot_id) || text(input.object_type_id)];
 if (operation.toolName === "get_object_types") objectIds.push(...strings(input.ids));
 const scopeConflict = Boolean(explicitNetwork && operation.knowledgeNetworkId && explicitNetwork !== operation.knowledgeNetworkId);
 const resourceMappings = scopeConflict ? [] : operation.query?.resources ?? [];
 const resourceIds = [text(input.resource_id), ...(operation.query?.resourceIds ?? []), ...resourceMappings.map(item => item.id)];
 return {
  networkId: explicitNetwork || operation.knowledgeNetworkId || "",
  scopeConflict,
  objectIds: [...new Set(objectIds.filter(Boolean))], metricId: text(input.metric_id),
  resourceIds: [...new Set(resourceIds.filter(Boolean))], resourceMappings,
 };
}

/** Display metadata from this interaction only; never a query result or claim. */
export function recordedResourceMappings(operation: OperationResolution, operations: OperationResolution[]) {
 const scope=recordedCallScope(operation);
 const result: Array<{id:string;name:string;objectId:string;objectName:string;sourceOperationId:string}>=[];
 if (!scope.networkId || scope.scopeConflict) return result;
 for (const source of operations) {
  if (source.callStatus!=="completed" || !["get_object_types","get_kn_detail"].includes(source.toolName ?? "")) continue;
  const sourceScope=recordedCallScope(source);
  if(sourceScope.scopeConflict || sourceScope.networkId!==scope.networkId) continue;
  const envelope=record(source.output);
  if(envelope.mode!=="inline") continue;
  const inline=record(envelope.inline);
  const output=record(inline.structuredContent ?? inline);
  if(!Array.isArray(output.object_types)) continue;
  for(const value of output.object_types) {
   const object=record(value), resource=record(object.data_source);
   const id=text(resource.id), objectId=text(object.id);
   if(resource.type!=="resource" || !scope.resourceIds.includes(id) || !objectId) continue;
   const name=text(resource.name), objectName=text(object.name);
   const existing=result.find(item => item.id===id && item.objectId===objectId && (!item.name || !name || item.name===name) && (!item.objectName || !objectName || item.objectName===objectName));
   if(existing) {
    if(!existing.name && name) {existing.name=name;existing.sourceOperationId=source.operationId;}
    if(!existing.objectName && objectName) existing.objectName=objectName;
    continue;
   }
   result.push({id,name,objectId,objectName,sourceOperationId:source.operationId});
  }
 }
 return result;
}

export function requestedObjectLabels(operation: OperationResolution): string[] {
 const scope=recordedCallScope(operation);
 if(scope.objectIds.length) return scope.objectIds.map(id => {
  const element=scope.scopeConflict ? undefined : operation.elements.find(item => item.kind==="object" && item.id===id);
  return element?.name || id;
 });
 return scope.scopeConflict ? [] : operation.elements.filter(item=>item.kind==="object").map(item=>item.name || item.id);
}
