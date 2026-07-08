/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export type CapabilitySourceType = "tool" | "mcp" | "skill" | "operator";

export type CapabilitySideEffect =
  | "none"
  | "read"
  | "write"
  | "external_action"
  | "unknown";

export type CapabilityRiskLevel = "low" | "medium" | "high";

export type CapabilityTestStatus = "untested" | "passed" | "failed" | "stale";

export type AgentVisibility = "hidden" | "discoverable" | "callable";

export type AgentInvokePolicy =
  | "manual_only"
  | "approval_required"
  | "auto_allowed";

export type CapabilityInputSemantic = {
  name: string;
  location?: "query" | "path" | "header" | "cookie" | "body" | "argument";
  dataType?: string;
  required?: boolean;
  businessMeaning?: string;
  examples?: unknown[];
  defaultStrategy?: string;
  constraints?: string[];
  dependsOn?: string[];
  sourceHint?: string;
};

export type CapabilityOutputSemantic = {
  name: string;
  path?: string;
  dataType?: string;
  businessMeaning?: string;
  examples?: unknown[];
  caveats?: string[];
};

export type CapabilityExample = {
  title: string;
  scenario?: string;
  input: unknown;
  expectedOutputSummary?: string;
  verifiedAt?: number;
  status?: CapabilityTestStatus;
};

export type CapabilityManifest = {
  id: string;
  sourceType: CapabilitySourceType;
  sourceId: string;
  sourceName?: string;
  title: string;
  description?: string;
  status: string;
  category?: string;
  intent?: string;
  useCases?: string[];
  antiUseCases?: string[];
  inputSemantics?: CapabilityInputSemantic[];
  outputSemantics?: CapabilityOutputSemantic[];
  examples?: CapabilityExample[];
  sideEffects?: CapabilitySideEffect;
  authRequirements?: string[];
  riskLevel?: CapabilityRiskLevel;
  testStatus?: CapabilityTestStatus;
  agentVisibility?: AgentVisibility;
  agentInvokePolicy?: AgentInvokePolicy;
  updatedAt?: number;
};

export type CapabilityReadiness = {
  score: number;
  level: "low" | "medium" | "high";
  missing: string[];
};

