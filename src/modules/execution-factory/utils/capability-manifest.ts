/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type {
  CapabilityInputSemantic,
  CapabilityManifest,
  CapabilityOutputSemantic,
  CapabilityReadiness,
} from "@/modules/execution-factory/types/capability-manifest";
import type { McpProxyTool } from "@/modules/execution-factory/types/mcp";
import type { OperatorDetail } from "@/modules/execution-factory/types/operator";
import type { SkillRecord } from "@/modules/execution-factory/types/skill";
import type { ToolDetail, ToolIoParameter } from "@/modules/execution-factory/types/tool";

type JsonSchemaObject = {
  type?: string;
  description?: string;
  properties?: Record<string, JsonSchemaObject>;
  required?: string[];
  examples?: unknown[];
  example?: unknown;
};

function asSchemaObject(value: unknown): JsonSchemaObject | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value;
}

function buildInputFromToolParameter(parameter: ToolIoParameter): CapabilityInputSemantic {
  return {
    name: parameter.name,
    location: parameter.in as CapabilityInputSemantic["location"],
    dataType: parameter.type,
    required: parameter.required,
    businessMeaning: parameter.description,
    sourceHint: parameter.description ? "schema description" : undefined,
  };
}

function buildInputsFromJsonSchema(schema: unknown): CapabilityInputSemantic[] {
  const schemaObject = asSchemaObject(schema);
  if (!schemaObject?.properties) {
    return [];
  }

  const required = new Set(schemaObject.required ?? []);

  return Object.entries(schemaObject.properties).map(([name, property]) => ({
    name,
    location: "argument",
    dataType: property.type,
    required: required.has(name),
    businessMeaning: property.description,
    examples: property.examples ?? (property.example === undefined ? undefined : [property.example]),
    sourceHint: property.description ? "schema description" : undefined,
  }));
}

function buildToolOutputs(tool: ToolDetail): CapabilityOutputSemantic[] {
  const responses = tool.ioSpec?.responses;
  if (!responses) {
    return [];
  }

  return Object.entries(responses).map(([statusCode, response]) => ({
    name: statusCode,
    businessMeaning: response.description,
    examples: response.example === undefined ? undefined : [response.example],
  }));
}

function inferToolSideEffect(tool: ToolDetail): CapabilityManifest["sideEffects"] {
  const method = tool.method?.toUpperCase();
  if (!method || method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return "read";
  }

  return "write";
}

function inferToolRisk(tool: ToolDetail): CapabilityManifest["riskLevel"] {
  return inferToolSideEffect(tool) === "read" ? "low" : "medium";
}

export function buildToolCapabilityManifest(tool: ToolDetail): CapabilityManifest {
  return {
    id: `tool:${tool.toolId}`,
    sourceType: "tool",
    sourceId: tool.toolId,
    title: tool.name,
    description: tool.description,
    status: tool.status,
    category: tool.metadataType,
    intent: tool.useRule || tool.description,
    inputSemantics: tool.ioSpec?.parameters.map(buildInputFromToolParameter) ?? [],
    outputSemantics: buildToolOutputs(tool),
    sideEffects: inferToolSideEffect(tool),
    riskLevel: inferToolRisk(tool),
    testStatus: "untested",
    agentVisibility: tool.status === "enabled" ? "discoverable" : "hidden",
    agentInvokePolicy: "approval_required",
    updatedAt: tool.updateTime,
  };
}

export function buildMcpToolCapabilityManifest({
  mcpId,
  serviceName,
  tool,
}: {
  mcpId: string;
  serviceName?: string;
  tool: McpProxyTool;
}): CapabilityManifest {
  return {
    id: `mcp:${mcpId}:${tool.name}`,
    sourceType: "mcp",
    sourceId: mcpId,
    sourceName: serviceName,
    title: tool.name,
    description: tool.description,
    status: "discovered",
    intent: tool.description,
    inputSemantics: buildInputsFromJsonSchema(tool.inputSchema),
    outputSemantics: [],
    sideEffects: "unknown",
    riskLevel: "medium",
    testStatus: "untested",
    agentVisibility: "discoverable",
    agentInvokePolicy: "approval_required",
  };
}

export function buildSkillCapabilityManifest(skill: SkillRecord): CapabilityManifest {
  return {
    id: `skill:${skill.skillId}`,
    sourceType: "skill",
    sourceId: skill.skillId,
    title: skill.name,
    description: skill.description,
    status: skill.status,
    category: skill.category,
    intent: skill.description,
    inputSemantics: [],
    outputSemantics: [],
    sideEffects: "unknown",
    riskLevel: "medium",
    testStatus: "untested",
    agentVisibility: skill.status === "published" ? "discoverable" : "hidden",
    agentInvokePolicy: "approval_required",
    updatedAt: skill.updateTime,
  };
}

function buildOperatorAuthRequirements(operator: OperatorDetail): string[] {
  const requirements: string[] = [];

  if (operator.executeControl?.timeout) {
    requirements.push(`timeout: ${operator.executeControl.timeout}ms`);
  }

  if (operator.executeControl?.retryPolicy?.maxAttempts) {
    requirements.push(`max retry attempts: ${operator.executeControl.retryPolicy.maxAttempts}`);
  }

  return requirements;
}

export function buildOperatorCapabilityManifest(operator: OperatorDetail): CapabilityManifest {
  return {
    id: `operator:${operator.operatorId}:${operator.version}`,
    sourceType: "operator",
    sourceId: operator.operatorId,
    title: operator.name,
    description: operator.description,
    status: operator.status,
    category: operator.category,
    intent: operator.description,
    inputSemantics: [],
    outputSemantics: [],
    sideEffects: operator.metadataType === "function" ? "write" : "unknown",
    riskLevel: "high",
    testStatus: "untested",
    agentVisibility: operator.status === "published" ? "discoverable" : "hidden",
    agentInvokePolicy: "approval_required",
    authRequirements: buildOperatorAuthRequirements(operator),
    updatedAt: operator.updateTime,
  };
}

export function getCapabilityReadiness(manifest: CapabilityManifest): CapabilityReadiness {
  const missing: string[] = [];
  let score = 0;

  if (manifest.intent) {
    score += 20;
  } else {
    missing.push("business intent");
  }

  if ((manifest.inputSemantics ?? []).some((input) => input.businessMeaning)) {
    score += 20;
  } else {
    missing.push("input semantics");
  }

  if ((manifest.outputSemantics ?? []).some((output) => output.businessMeaning)) {
    score += 15;
  } else {
    missing.push("output semantics");
  }

  if ((manifest.examples ?? []).some((example) => example.status === "passed")) {
    score += 20;
  } else {
    missing.push("verified example");
  }

  if (manifest.testStatus === "passed") {
    score += 15;
  } else {
    missing.push("passed verification");
  }

  if (manifest.agentVisibility === "callable" && manifest.agentInvokePolicy) {
    score += 10;
  } else {
    missing.push("Agent callable policy");
  }

  return {
    score,
    level: score >= 80 ? "high" : score >= 50 ? "medium" : "low",
    missing,
  };
}

