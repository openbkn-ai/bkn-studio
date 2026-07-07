/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { HttpCapabilityContractPanel } from "@/modules/execution-factory/components/HttpCapabilityContractPanel";
import type { CapabilityManifest } from "@/modules/execution-factory/types/capability-manifest";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? _key,
  }),
}));

describe("HttpCapabilityContractPanel", () => {
  it("shows inferred HTTP semantics and Agent governance in one contract surface", () => {
    const manifest: CapabilityManifest = {
      id: "tool:query-weather",
      sourceId: "query-weather",
      sourceType: "tool",
      title: "Query weather",
      description: "Query realtime weather by city.",
      status: "enabled",
      intent: "Use when a user asks for realtime weather in a city.",
      inputSemantics: [
        {
          name: "city",
          location: "query",
          dataType: "string",
          required: true,
          businessMeaning: "City name such as Beijing or Shanghai.",
          examples: ["Beijing"],
        },
      ],
      outputSemantics: [
        {
          name: "200",
          dataType: "object",
          businessMeaning: "Realtime weather result.",
          examples: [{ weather: "sunny", temperature: 26 }],
        },
      ],
      sideEffects: "read",
      riskLevel: "low",
      testStatus: "untested",
      agentVisibility: "discoverable",
      agentInvokePolicy: "approval_required",
    };

    render(<HttpCapabilityContractPanel manifest={manifest} />);

    expect(screen.getByText("Use when a user asks for realtime weather in a city.")).toBeTruthy();
    expect(screen.getByText("city")).toBeTruthy();
    expect(screen.getByText("query")).toBeTruthy();
    expect(screen.getByText("City name such as Beijing or Shanghai.")).toBeTruthy();
    expect(screen.getByText("Realtime weather result.")).toBeTruthy();
    expect(screen.getByText("Risk: low")).toBeTruthy();
    expect(screen.getByText("Agent: discoverable")).toBeTruthy();
    expect(screen.getByText("Invoke: approval_required")).toBeTruthy();
    expect(screen.getByText("Missing: verified example")).toBeTruthy();
  });
});
