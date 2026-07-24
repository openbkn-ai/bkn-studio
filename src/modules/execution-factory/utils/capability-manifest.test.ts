/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import type { McpProxyTool } from "@/modules/execution-factory/types/mcp";
import type { OperatorDetail } from "@/modules/execution-factory/types/operator";
import type { SkillRecord } from "@/modules/execution-factory/types/skill";
import type { ToolDetail } from "@/modules/execution-factory/types/tool";
import {
  buildMcpToolCapabilityManifest,
  buildOperatorCapabilityManifest,
  buildSkillCapabilityManifest,
  buildToolCapabilityManifest,
  getCapabilityReadiness,
} from "@/modules/execution-factory/utils/capability-manifest";

describe("capability-manifest", () => {
  it("maps an OpenAPI tool into an Agent-readable manifest", () => {
    const tool: ToolDetail = {
      toolId: "tool-customer-search",
      name: "Search customers",
      description: "Find customers by keyword.",
      status: "enabled",
      metadataType: "openapi",
      method: "GET",
      path: "/customers",
      serverUrl: "https://crm.example.com",
      useRule: "Use when a user mentions a customer name but not the customer ID.",
      ioSpec: {
        parameters: [
          {
            name: "keyword",
            in: "query",
            required: true,
            description: "Customer name, phone, or external code.",
            type: "string",
          },
        ],
        responses: {
          "200": {
            description: "Matched customers.",
            example: { items: [{ customer_id: "C001", name: "Acme" }] },
          },
        },
      },
    };

    const manifest = buildToolCapabilityManifest(tool);

    expect(manifest).toMatchObject({
      id: "tool:tool-customer-search",
      sourceId: "tool-customer-search",
      sourceType: "tool",
      title: "Search customers",
      intent: "Use when a user mentions a customer name but not the customer ID.",
      sideEffects: "read",
      riskLevel: "low",
      agentVisibility: "discoverable",
      agentInvokePolicy: "approval_required",
    });
    expect(manifest.inputSemantics).toEqual([
      expect.objectContaining({
        name: "keyword",
        location: "query",
        required: true,
        businessMeaning: "Customer name, phone, or external code.",
      }),
    ]);
    expect(manifest.outputSemantics).toEqual([
      expect.objectContaining({
        name: "200",
        businessMeaning: "Matched customers.",
      }),
    ]);
  });

  it("maps an MCP tool schema into argument semantics", () => {
    const tool: McpProxyTool = {
      name: "list_orders",
      description: "List orders for a customer.",
      inputSchema: {
        type: "object",
        required: ["customer_id"],
        properties: {
          customer_id: {
            type: "string",
            description: "Customer master data ID.",
          },
          limit: {
            type: "integer",
            description: "Maximum rows.",
          },
        },
      },
    };

    const manifest = buildMcpToolCapabilityManifest({
      mcpId: "mcp-crm",
      serviceName: "CRM MCP",
      tool,
    });

    expect(manifest).toMatchObject({
      id: "mcp:mcp-crm:list_orders",
      sourceType: "mcp",
      sourceId: "mcp-crm",
      title: "list_orders",
      sideEffects: "unknown",
      riskLevel: "medium",
    });
    expect(manifest.inputSemantics).toEqual([
      expect.objectContaining({
        name: "customer_id",
        location: "argument",
        required: true,
        businessMeaning: "Customer master data ID.",
      }),
      expect.objectContaining({
        name: "limit",
        required: false,
      }),
    ]);
  });

  it("maps a Skill record into a manifest shell", () => {
    const skill: SkillRecord = {
      skillId: "skill-report",
      name: "Quarterly report skill",
      description: "Prepare quarterly report steps.",
      status: "published",
      version: "1.2.0",
      category: "system",
    };

    const manifest = buildSkillCapabilityManifest(skill);

    expect(manifest).toMatchObject({
      id: "skill:skill-report",
      sourceType: "skill",
      sourceId: "skill-report",
      title: "Quarterly report skill",
      sideEffects: "unknown",
      riskLevel: "medium",
      agentVisibility: "discoverable",
      agentInvokePolicy: "approval_required",
    });
  });

  it("maps an Operator detail into a manifest shell with runtime constraints", () => {
    const operator: OperatorDetail = {
      operatorId: "op-sync",
      name: "Sync orders",
      version: "v3",
      status: "published",
      description: "Synchronize orders from ERP.",
      metadataType: "function",
      category: "data_process",
      executeControl: {
        timeout: 5000,
        retryPolicy: { maxAttempts: 3 },
      },
    };

    const manifest = buildOperatorCapabilityManifest(operator);

    expect(manifest).toMatchObject({
      id: "operator:op-sync:v3",
      sourceType: "operator",
      sourceId: "op-sync",
      title: "Sync orders",
      sideEffects: "write",
      riskLevel: "high",
      agentInvokePolicy: "approval_required",
    });
    expect(manifest.authRequirements).toContain("timeout: 5000ms");
    expect(manifest.authRequirements).toContain("max retry attempts: 3");
  });

  it("scores readiness from intent and input/output semantics", () => {
    const manifest = buildToolCapabilityManifest({
      toolId: "tool-ready",
      name: "Ready tool",
      description: "Ready for Agent use.",
      status: "enabled",
      metadataType: "openapi",
      useRule: "Use for safe read-only lookup.",
      ioSpec: {
        parameters: [{ name: "id", description: "Business object ID." }],
        responses: { "200": { description: "Business object." } },
      },
    });

    const readiness = getCapabilityReadiness(manifest);

    expect(readiness.score).toBe(100);
    expect(readiness.level).toBe("high");
    expect(readiness.missing).toEqual([]);
  });

  it("only flags fillable gaps, never verification or callable policy", () => {
    const manifest = buildToolCapabilityManifest({
      toolId: "tool-bare",
      name: "Bare tool",
      status: "enabled",
      metadataType: "openapi",
      ioSpec: {
        parameters: [{ name: "id" }],
        responses: {},
      },
    });

    const readiness = getCapabilityReadiness(manifest);

    expect(readiness.missing).toEqual([
      "business intent",
      "input semantics",
      "output semantics",
    ]);
    expect(readiness.missing).not.toContain("passed verification");
    expect(readiness.missing).not.toContain("Agent callable policy");
    expect(readiness.missing).not.toContain("verified example");
  });
});

