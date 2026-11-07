/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getMock = vi.hoisted(() => vi.fn());

vi.mock("@/framework/request/http", () => ({
  http: { get: getMock },
}));

describe("checkKnowledgeNetwork", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("VITE_USE_MOCK", "false");
    getMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reads the check result, handling its errors itself", async () => {
    getMock.mockResolvedValue({
      data: {
        invalid_parameters: [
          {
            action_type_id: "urge_report",
            current: { value_from: "context" },
            parameter: "operator",
          },
        ],
        misplaced_parameters: [
          {
            conflict: true,
            current: { source: "const", value: 7 },
            logic_property: "turnaround_hours",
            object_type_id: "lab_order",
            parameter: "window_days",
            suggested: { value: 7, value_from: "const" },
          },
        ],
      },
    });
    const { checkKnowledgeNetwork } =
      await import("@/modules/knowledge-network/services/network.service");

    await expect(checkKnowledgeNetwork("clinic-lab")).resolves.toEqual({
      invalidParameters: [
        { actionTypeId: "urge_report", current: { valueFrom: "context" }, parameter: "operator" },
      ],
      misplacedParameters: [
        {
          conflict: true,
          current: { source: "const", value: 7 },
          logicProperty: "turnaround_hours",
          objectTypeId: "lab_order",
          parameter: "window_days",
          suggested: { value: 7, valueFrom: "const" },
        },
      ],
    });
    expect(getMock).toHaveBeenCalledWith("/bkn-backend/v1/bkns/clinic-lab/check", {
      skipErrorToast: true,
    });
  });

  it("reads a clean network as two empty lists", async () => {
    getMock.mockResolvedValue({ data: { invalid_parameters: [], misplaced_parameters: [] } });
    const { checkKnowledgeNetwork } =
      await import("@/modules/knowledge-network/services/network.service");

    await expect(checkKnowledgeNetwork("clinic-lab")).resolves.toEqual({
      invalidParameters: [],
      misplacedParameters: [],
    });
  });
});
