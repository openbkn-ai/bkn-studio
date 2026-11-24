/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const getMock = vi.hoisted(() => vi.fn());
const putMock = vi.hoisted(() => vi.fn());
const postMock = vi.hoisted(() => vi.fn());
const deleteMock = vi.hoisted(() => vi.fn());
const deleteObjectTypeMock = vi.hoisted(() => vi.fn());
const deleteActionTypeMock = vi.hoisted(() => vi.fn());
const listToolboxesMock = vi.hoisted(() => vi.fn());

vi.mock("@/framework/request/http", () => ({
  http: { delete: deleteMock, get: getMock, post: postMock, put: putMock },
}));

vi.mock("@/modules/knowledge-network/services/object-type.service", () => ({
  deleteKnowledgeNetworkObjectType: deleteObjectTypeMock,
}));

vi.mock("@/modules/knowledge-network/services/action-type.service", () => ({
  deleteKnowledgeNetworkActionType: deleteActionTypeMock,
}));

vi.mock("@/modules/execution-factory/services/toolbox.service", () => ({
  listToolboxes: listToolboxesMock,
}));

vi.mock("@/modules/knowledge-network/services/shared/runtime", async () => {
  const actual = await vi.importActual<
    typeof import("@/modules/knowledge-network/services/shared/runtime")
  >("@/modules/knowledge-network/services/shared/runtime");

  return { ...actual, useMock: false };
});

import {
  checkKnEventType,
  createKnEventType,
  cronOfFixedRate,
  deleteKnEventType,
  getKnEventType,
  listKnEventRuleTools,
  listKnEventTypes,
  parameterFromBackend,
  parameterToBackend,
  ruleToBackend,
  trialKnEventRule,
  updateKnEventType,
} from "@/modules/knowledge-network/services/event-type.service";

const KN = "/bkn-backend/v1/knowledge-networks/kn-1";

const cypher = (knId: string, shape: string, inputs: unknown[] = []) => ({
  function_content: {
    code: "MATCH (o:order) RETURN o.id AS key",
    inputs,
    kn_id: knId,
    result_shape: shape,
    script_type: "cypher",
  },
});

const eventClass = (overrides: Record<string, unknown> = {}) => ({
  event: {
    handling_note: "Call",
    merge_hours: 0,
    severity: "P2",
    source: "rule",
    subject: "order",
  },
  id: "order_overdue",
  kinds: ["event"],
  name: "Overdue order",
  ...overrides,
});

const recognition = (overrides: Record<string, unknown> = {}) => ({
  action_type: "add",
  execution_subject: { id: "u-1", name: "Ann", type: "user" },
  id: "order_overdue_recognition",
  name: "Overdue order recognition",
  object_type_id: "order",
  operation_config: {
    event_class: "order_overdue",
    targets: {
      function: {
        box_id: "b-1",
        parameters: {
          days: { value: 3, value_from: "const" },
          today: { value_from: "check_date" },
        },
        tool_id: "t-1",
      },
    },
    type: "event",
  },
  rule_version: "v1",
  schedule: { expression: "0 8 * * *", timezone: "Asia/Shanghai", type: "CRON" },
  ...overrides,
});

/** Answers the reads of an event class and its recognition action and schedule. */
function serve(options: { action?: unknown; schedule?: unknown } = {}) {
  getMock.mockImplementation((url: string) => {
    if (url === `${KN}/object-types/order_overdue`) {
      return Promise.resolve({ data: { entries: [eventClass()] } });
    }
    if (url === `${KN}/object-types`) {
      return Promise.resolve({ data: { entries: [eventClass()], total_count: 1 } });
    }
    if (url === `${KN}/action-types`) {
      return Promise.resolve({
        data: { entries: options.action ? [options.action] : [], total_count: 1 },
      });
    }
    if (url === `${KN}/action-schedules`) {
      return Promise.resolve({
        data: { entries: options.schedule ? [options.schedule] : [], total_count: 1 },
      });
    }
    return Promise.reject(new Error(`unexpected GET ${url}`));
  });
}

const conditionConfig = {
  event_class: "order_overdue",
  type: "event",
};

/** Due more than two days ago and still open, as the backend keeps it. */
const backendCondition = {
  object_type_id: "order",
  operation: "and",
  sub_conditions: [
    {
      field: "due_time",
      object_type_id: "order",
      operation: "<",
      value: "-PT48H",
      value_from: "check_time",
    },
    {
      field: "status",
      object_type_id: "order",
      operation: "==",
      value: "open",
      value_from: "const",
    },
  ],
  value_from: "const",
};

const formCondition = {
  objectTypeId: "order",
  operation: "and" as const,
  subConditions: [
    {
      field: "due_time",
      objectTypeId: "order",
      operation: "<" as const,
      value: "-PT48H",
      valueFrom: "check_time" as const,
    },
    {
      field: "status",
      objectTypeId: "order",
      operation: "==" as const,
      value: "open",
      valueFrom: "const" as const,
    },
  ],
  valueFrom: "const" as const,
};

const cypherTargets = {
  cypher: {
    parameters: {
      since: { value: "-P1D", value_from: "check_date" },
      status: { value: "open", value_from: "const" },
    },
    query: "MATCH (o:order) WHERE o.status = $status RETURN o.id AS key",
  },
};

const schedule = {
  action_type_id: "order_overdue_recognition",
  id: "sch-1",
  next_run_time: 1_700_000_000_000,
  source: "action_type",
};

describe("event-type.service", () => {
  beforeEach(() => {
    getMock.mockReset();
    putMock.mockReset();
    postMock.mockReset();
    deleteMock.mockReset();
    deleteObjectTypeMock.mockReset();
    deleteActionTypeMock.mockReset();
    listToolboxesMock.mockReset();
  });

  it("converts rule tool arguments to action target parameters and back", () => {
    expect(parameterToBackend({ check_time: "date" })).toEqual({ value_from: "check_date" });
    expect(parameterToBackend(3)).toEqual({ value: 3, value_from: "const" });
    expect(parameterToBackend("open")).toEqual({ value: "open", value_from: "const" });
    expect(parameterToBackend({ value: "-P3D", value_from: "check_date" })).toEqual({
      value: "-P3D",
      value_from: "check_date",
    });
    expect(parameterFromBackend({ value_from: "check_date" })).toEqual({ check_time: "date" });
    expect(parameterFromBackend({ value: 3, value_from: "const" })).toBe(3);
    expect(parameterFromBackend({ value: "x" })).toBe("x");
    // A check day moved by a duration has no form of its own, so it is kept as the backend has it.
    expect(parameterFromBackend({ value: "-P3D", value_from: "check_date" })).toEqual({
      value: "-P3D",
      value_from: "check_date",
    });
  });

  it("composes an event class from its object type, recognition action and schedule", async () => {
    serve({ action: recognition(), schedule });

    const [type] = await listKnEventTypes("kn-1");

    expect(getMock).toHaveBeenCalledWith(
      `${KN}/object-types`,
      expect.objectContaining({ params: expect.objectContaining({ kinds: "event" }) }),
    );
    expect(getMock).toHaveBeenCalledWith(
      `${KN}/action-types`,
      expect.objectContaining({ params: expect.objectContaining({ operation_kind: "event" }) }),
    );
    expect(type).toMatchObject({
      check_schedule: { cron: "0 8 * * *", timezone: "Asia/Shanghai" },
      check_subject: { id: "u-1", name: "Ann", type: "user" },
      code: "order_overdue",
      handling_note: "Call",
      name: "Overdue order",
      next_check_at: 1_700_000_000_000,
      object_type_id: "order_overdue",
      recognition_action_id: "order_overdue_recognition",
      recognition_basis: "function",
      rule_tool: {
        box_id: "b-1",
        parameters: { days: 3, today: { check_time: "date" } },
        tool_id: "t-1",
      },
      rule_version: "v1",
      severity: "P2",
      source: "rule",
      subject: "order",
    });
  });

  it("reads a class that has no recognition action, and ignores object types of other kinds", async () => {
    getMock.mockImplementation((url: string) =>
      Promise.resolve({
        data: {
          entries:
            url === `${KN}/object-types` ? [eventClass(), { id: "plain", name: "Plain" }] : [],
          total_count: 2,
        },
      }),
    );

    const types = await listKnEventTypes("kn-1");

    expect(types.map((type) => type.code)).toEqual(["order_overdue"]);
    expect(types[0]).toMatchObject({ check_schedule: null, rule_tool: null });
    expect(types[0]?.recognition_action_id).toBeUndefined();
  });

  it("names a basis other than a function and leaves the rule tool empty", async () => {
    serve({
      action: recognition({
        operation_config: {
          event_class: "order_overdue",
          targets: { cypher: { query: "MATCH (o:order) RETURN o" } },
          type: "event",
        },
      }),
    });

    const type = await getKnEventType("kn-1", "order_overdue");

    expect(type).toMatchObject({ recognition_basis: "cypher", rule_tool: null });
  });

  it("reads each basis as the rule the form edits", async () => {
    serve({
      action: recognition({ condition: backendCondition, operation_config: conditionConfig }),
    });
    expect((await getKnEventType("kn-1", "order_overdue")).rule).toEqual({
      basis: "condition",
      condition: formCondition,
    });

    serve({
      action: recognition({ operation_config: { ...conditionConfig, targets: cypherTargets } }),
    });
    expect((await getKnEventType("kn-1", "order_overdue")).rule).toEqual({
      basis: "cypher",
      cypher: {
        parameters: {
          since: { value: "-P1D", value_from: "check_date" },
          status: { value: "open", value_from: "const" },
        },
        query: "MATCH (o:order) WHERE o.status = $status RETURN o.id AS key",
      },
    });

    serve({ action: recognition() });
    expect((await getKnEventType("kn-1", "order_overdue")).rule).toEqual({
      basis: "function",
      tool: {
        box_id: "b-1",
        parameters: { days: 3, today: { check_time: "date" } },
        tool_id: "t-1",
      },
    });

    serve({
      action: recognition({
        operation_config: { ...conditionConfig, targets: { metric: { metric_id: "m-1" } } },
      }),
    });
    expect(await getKnEventType("kn-1", "order_overdue")).toMatchObject({
      recognition_basis: "metric",
      rule: null,
    });
  });

  it("writes a condition without targets, and targets without a condition", () => {
    // A row left on another object type is put on the subject, as the backend requires.
    const condition = ruleToBackend(
      {
        basis: "condition",
        condition: { ...formCondition, objectTypeId: undefined },
      },
      "order",
    );
    expect(condition).toEqual({ condition: backendCondition });
    expect(condition).not.toHaveProperty("targets");

    const cypher = ruleToBackend(
      {
        basis: "cypher",
        cypher: {
          parameters: {
            now: { value: "", value_from: "check_time" },
            since: { value: "-P1D", value_from: "check_date" },
            status: { value: "open", value_from: "const" },
          },
          query: "MATCH (o:order) WHERE o.status = $status RETURN o.id AS key",
        },
      },
      "order",
    );
    expect(cypher).toEqual({
      targets: {
        cypher: {
          ...cypherTargets.cypher,
          parameters: { ...cypherTargets.cypher.parameters, now: { value_from: "check_time" } },
        },
      },
    });
    expect(cypher).not.toHaveProperty("condition");

    expect(
      ruleToBackend({ basis: "function", tool: { box_id: "b-1", tool_id: "t-1" } }, "order"),
    ).toEqual({ targets: { function: { box_id: "b-1", tool_id: "t-1" } } });
  });

  it("creates the object type first, then the recognition action, and surfaces the trial", async () => {
    const order: string[] = [];
    postMock.mockImplementation((url: string) => {
      order.push(url);
      return Promise.resolve({
        data: url.endsWith("/action-types")
          ? [
              {
                id: "order_overdue_recognition",
                trial: { hit_count: 4, hits: [], limited: true, subject: "order" },
              },
            ]
          : [{ id: "order_overdue" }],
      });
    });
    serve({ action: recognition(), schedule });

    const saved = await createKnEventType("kn-1", {
      check_schedule: { cron: "0 8 * * *", timezone: "Asia/Shanghai" },
      code: "order_overdue",
      name: "Overdue order",
      rule: {
        basis: "function",
        tool: {
          box_id: "b-1",
          parameters: { days: 3, today: { check_time: "date" } },
          tool_id: "t-1",
        },
      },
      severity: "P2",
      source: "rule",
      subject: "order",
    });

    expect(order).toEqual([`${KN}/object-types`, `${KN}/action-types`]);
    expect(postMock.mock.calls[0]?.[1]).toEqual({
      entries: [
        {
          event: { severity: "P2", source: "rule", subject: "order" },
          id: "order_overdue",
          kinds: ["event"],
          name: "Overdue order",
        },
      ],
    });
    expect(postMock.mock.calls[1]?.[1]).toEqual({
      entries: [
        expect.objectContaining({
          action_type: "add",
          id: "order_overdue_recognition",
          object_type_id: "order",
          operation_config: {
            event_class: "order_overdue",
            targets: {
              function: {
                box_id: "b-1",
                parameters: {
                  days: { value: 3, value_from: "const" },
                  today: { value_from: "check_date" },
                },
                tool_id: "t-1",
              },
            },
            type: "event",
          },
          schedule: { expression: "0 8 * * *", timezone: "Asia/Shanghai", type: "CRON" },
        }),
      ],
    });
    expect(saved.trial).toEqual({ hits: 4, limited: true });
    expect(saved.recognition_action_id).toBe("order_overdue_recognition");
  });

  it("creates a recognition action that selects by a condition", async () => {
    postMock.mockResolvedValue({ data: [{ id: "x" }] });
    serve({
      action: recognition({ condition: backendCondition, operation_config: conditionConfig }),
    });

    await createKnEventType("kn-1", {
      check_schedule: { cron: "0 8 * * *", timezone: "Asia/Shanghai" },
      code: "order_overdue",
      name: "Overdue order",
      rule: { basis: "condition", condition: formCondition },
      source: "rule",
      subject: "order",
    });

    expect(postMock.mock.calls[1]?.[1]).toEqual({
      entries: [
        {
          action_type: "add",
          branch: "main",
          condition: backendCondition,
          id: "order_overdue_recognition",
          name: "Overdue order recognition",
          object_type_id: "order",
          operation_config: { event_class: "order_overdue", type: "event" },
          schedule: { expression: "0 8 * * *", timezone: "Asia/Shanghai", type: "CRON" },
        },
      ],
    });
  });

  it("creates a reported class without an action", async () => {
    postMock.mockResolvedValue({ data: [{ id: "complaint" }] });
    getMock.mockImplementation((url: string) =>
      Promise.resolve({
        data: {
          entries: url.endsWith("/complaint")
            ? [
                eventClass({
                  event: { merge_hours: 24, source: "report", subject: "order" },
                  id: "complaint",
                }),
              ]
            : [],
        },
      }),
    );

    await createKnEventType("kn-1", {
      code: "complaint",
      merge_hours: 24,
      name: "Complaint",
      source: "report",
      subject: "order",
    });

    expect(postMock).toHaveBeenCalledTimes(1);
    expect((postMock.mock.calls[0]?.[1] as { entries: unknown[] }).entries[0]).toMatchObject({
      event: { merge_hours: 24, source: "report", subject: "order" },
    });
  });

  it("takes the class back when its recognition action is refused", async () => {
    postMock.mockImplementation((url: string) =>
      url.endsWith("/action-types")
        ? Promise.reject(new Error("trial failed"))
        : Promise.resolve({ data: [{ id: "order_overdue" }] }),
    );

    await expect(
      createKnEventType("kn-1", {
        check_schedule: { cron: "0 8 * * *" },
        code: "order_overdue",
        name: "Overdue order",
        rule: { basis: "function", tool: { box_id: "b-1", tool_id: "t-1" } },
        source: "rule",
        subject: "order",
      }),
    ).rejects.toThrow("trial failed");

    expect(deleteObjectTypeMock).toHaveBeenCalledWith("kn-1", "order_overdue");
  });

  it("replaces the class and the recognition action, and reads the trial of a 200", async () => {
    serve({ action: recognition(), schedule });
    putMock.mockImplementation((url: string) =>
      Promise.resolve({
        data: url.includes("/action-types/")
          ? { trial: { hit_count: 2, hits: [], limited: false, subject: "order" } }
          : "",
      }),
    );

    const saved = await updateKnEventType("kn-1", "order_overdue", {
      check_schedule: { cron: "*/30 * * * *", timezone: "UTC" },
      name: "Overdue",
      rule: {
        basis: "function",
        tool: { box_id: "b-1", parameters: { today: { check_time: "date" } }, tool_id: "t-1" },
      },
      severity: "",
      subject: "order",
    });

    expect(putMock).toHaveBeenNthCalledWith(
      1,
      `${KN}/object-types/order_overdue`,
      {
        event: {
          handling_note: "",
          merge_hours: 0,
          severity: "",
          source: "rule",
          subject: "order",
        },
        kinds: ["event"],
        name: "Overdue",
      },
      { skipErrorToast: true },
    );
    expect(putMock.mock.calls[1]?.[0]).toBe(`${KN}/action-types/order_overdue_recognition`);
    expect(putMock.mock.calls[1]?.[1]).toMatchObject({
      id: "order_overdue_recognition",
      operation_config: {
        event_class: "order_overdue",
        targets: {
          function: { box_id: "b-1", parameters: { today: { value_from: "check_date" } } },
        },
        type: "event",
      },
      schedule: { expression: "*/30 * * * *", timezone: "UTC", type: "CRON" },
    });
    expect(saved.trial).toEqual({ hits: 2, limited: false });
  });

  it("sends back what the form does not edit when it replaces the class", async () => {
    serve({ action: recognition(), schedule });
    const served = getMock.getMockImplementation();
    getMock.mockImplementation((url: string, ...rest: unknown[]) =>
      url === `${KN}/object-types/order_overdue`
        ? Promise.resolve({
            data: {
              entries: [
                eventClass({ color: "#f00", comment: "Kept", icon: "bell", tags: ["ops"] }),
              ],
            },
          })
        : served?.(url, ...rest),
    );
    putMock.mockResolvedValue({ data: "" });

    await updateKnEventType("kn-1", "order_overdue", {
      name: "Overdue",
      rule: null,
      subject: "order",
    });

    expect(putMock.mock.calls[0]?.[1]).toMatchObject({
      color: "#f00",
      comment: "Kept",
      icon: "bell",
      name: "Overdue",
      tags: ["ops"],
    });
  });

  it("creates the recognition action when a class that had none is given a rule", async () => {
    serve();
    putMock.mockResolvedValue({ data: "" });
    postMock.mockResolvedValue({ data: [{ id: "order_overdue_recognition" }] });

    await updateKnEventType("kn-1", "order_overdue", {
      check_schedule: { cron: "0 8 * * *" },
      name: "Overdue order",
      rule: { basis: "function", tool: { box_id: "b-1", tool_id: "t-1" } },
      subject: "order",
    });

    expect(postMock).toHaveBeenCalledWith(
      `${KN}/action-types`,
      { entries: [expect.objectContaining({ id: "order_overdue_recognition" })] },
      { skipErrorToast: true },
    );
  });

  it("replaces a recognition action of another basis with the rule it is given", async () => {
    serve({
      action: recognition({ operation_config: { ...conditionConfig, targets: cypherTargets } }),
    });
    putMock.mockResolvedValue({ data: "" });

    await updateKnEventType("kn-1", "order_overdue", {
      check_schedule: { cron: "0 8 * * *", timezone: "Asia/Shanghai" },
      name: "Overdue order",
      rule: { basis: "condition", condition: formCondition },
      subject: "order",
    });

    const body = putMock.mock.calls[1]?.[1] as Record<string, unknown>;
    expect(putMock.mock.calls[1]?.[0]).toBe(`${KN}/action-types/order_overdue_recognition`);
    expect(body).toMatchObject({
      condition: backendCondition,
      operation_config: { event_class: "order_overdue", type: "event" },
    });
    expect(body.operation_config).not.toHaveProperty("targets");
  });

  it("leaves the recognition action as it is when no rule is given", async () => {
    serve({
      action: recognition({
        operation_config: { ...conditionConfig, targets: { metric: { metric_id: "m-1" } } },
      }),
    });
    putMock.mockResolvedValue({ data: "" });

    await updateKnEventType("kn-1", "order_overdue", {
      name: "Overdue order",
      rule: null,
      subject: "order",
    });

    expect(putMock).toHaveBeenCalledTimes(1);
    expect(postMock).not.toHaveBeenCalled();
    expect(deleteActionTypeMock).not.toHaveBeenCalled();
  });

  it("tries an unsaved rule on the branch it is written to, and reads the hits", async () => {
    postMock.mockResolvedValue({
      data: {
        event: {
          hit_count: 230,
          hits: [
            {
              attributes: { status: { key: "open", label: "open" } },
              key: "1024",
              name: "PO-1024",
            },
            { key: "1025", name: "" },
          ],
          limited: true,
          row_filter_applied: true,
          subject: "order",
        },
      },
    });
    const input = {
      check_schedule: { cron: "0 8 * * *", timezone: "UTC" },
      code: "order_overdue",
      name: "Overdue order",
      rule: { basis: "condition" as const, condition: formCondition },
      subject: "order",
    };

    const result = await trialKnEventRule("kn-1", input, { versioned: false });

    expect(postMock).toHaveBeenCalledWith(
      "/ontology-query/v1/knowledge-networks/kn-1/action-trial",
      {
        action_type: "add",
        condition: backendCondition,
        id: "order_overdue_recognition",
        name: "Overdue order recognition",
        object_type_id: "order",
        operation_config: { event_class: "order_overdue", type: "event" },
        schedule: { expression: "0 8 * * *", timezone: "UTC", type: "CRON" },
      },
      { params: { branch: "main" }, skipErrorToast: true },
    );
    expect(result).toEqual({
      hit_count: 230,
      hits: [
        { key: "1024", name: "PO-1024" },
        { key: "1025", name: "1025" },
      ],
      limited: true,
      row_filter_applied: true,
    });

    await trialKnEventRule("kn-1", input, { versioned: true });
    expect(postMock.mock.calls[1]?.[2]).toEqual({
      params: { branch: "draft" },
      skipErrorToast: true,
    });
  });

  const refusedWith = (code: string) =>
    Object.assign(new Error(code), { response: { data: { error_code: code }, status: 409 } });

  it("deletes the recognition action when it is what keeps the class", async () => {
    serve({ action: recognition() });
    const order: string[] = [];
    deleteActionTypeMock.mockImplementation(async () => {
      order.push("action");
    });
    deleteObjectTypeMock
      .mockImplementationOnce(async () => {
        order.push("class refused");
        throw refusedWith("BknBackend.KnEvent.RecognizedByAction");
      })
      .mockImplementationOnce(async () => {
        order.push("class");
      });

    await deleteKnEventType("kn-1", "order_overdue");

    expect(order).toEqual(["class refused", "action", "class"]);
    expect(deleteActionTypeMock).toHaveBeenCalledWith("kn-1", "order_overdue_recognition");
    expect(postMock).not.toHaveBeenCalled();
  });

  it("leaves the recognition action of a class that has events", async () => {
    serve({ action: recognition() });
    const refusal = refusedWith("BknBackend.KnEvent.EventTypeInUse");
    deleteObjectTypeMock.mockRejectedValue(refusal);

    await expect(deleteKnEventType("kn-1", "order_overdue")).rejects.toBe(refusal);

    expect(deleteObjectTypeMock).toHaveBeenCalledTimes(1);
    expect(deleteActionTypeMock).not.toHaveBeenCalled();
    expect(postMock).not.toHaveBeenCalled();
  });

  it("restores the recognition action when the class is refused after it went", async () => {
    serve({ action: recognition() });
    const refusal = refusedWith("BknBackend.KnEvent.EventTypeInUse");
    deleteObjectTypeMock
      .mockRejectedValueOnce(refusedWith("BknBackend.KnEvent.RecognizedByAction"))
      .mockRejectedValueOnce(refusal);
    deleteActionTypeMock.mockResolvedValue(undefined);
    postMock.mockResolvedValue({ data: [{ id: "order_overdue_recognition" }] });

    await expect(deleteKnEventType("kn-1", "order_overdue")).rejects.toBe(refusal);

    expect(postMock).toHaveBeenCalledWith(
      `${KN}/action-types`,
      { entries: [expect.objectContaining({ id: "order_overdue_recognition" })] },
      { skipErrorToast: true },
    );
  });

  it("deletes a class without a recognition action directly", async () => {
    serve();
    deleteObjectTypeMock.mockResolvedValue(undefined);

    await deleteKnEventType("kn-1", "order_overdue");

    expect(deleteActionTypeMock).not.toHaveBeenCalled();
    expect(deleteObjectTypeMock).toHaveBeenCalledWith("kn-1", "order_overdue");
  });

  it("checks now by running the platform schedule of the recognition action", async () => {
    serve({ action: recognition(), schedule });
    postMock.mockResolvedValue({ data: { execution_id: "ex-1" } });

    const result = await checkKnEventType("kn-1", "order_overdue");

    expect(getMock).toHaveBeenCalledWith(
      `${KN}/action-schedules`,
      expect.objectContaining({
        params: expect.objectContaining({ action_type_id: "order_overdue_recognition" }),
      }),
    );
    expect(postMock).toHaveBeenCalledWith(`${KN}/action-schedules/sch-1/run`);
    expect(result).toEqual({ execution_id: "ex-1" });
  });

  it("does not run anything for a class that has no recognition action", async () => {
    serve();

    await expect(checkKnEventType("kn-1", "order_overdue")).rejects.toThrow();

    expect(postMock).not.toHaveBeenCalled();
  });

  it("offers only this network's Cypher functions that return a table as rule tools", async () => {
    listToolboxesMock.mockResolvedValue({
      items: [
        { boxId: "box-a", name: "Order rules" },
        { boxId: "box-b", name: "Broken box" },
      ],
    });
    getMock.mockImplementation((url: string) => {
      if (url.includes("box-b")) {
        return Promise.reject(new Error("gone"));
      }
      return Promise.resolve({
        data: {
          data: {
            tools: [
              {
                metadata: cypher("kn-1", "table", [
                  { name: "today", required: true, type: "string" },
                  { name: "days", type: "integer" },
                ]),
                name: "Overdue orders",
                tool_id: "t-table",
              },
              { metadata: cypher("kn-1", "value"), name: "Count", tool_id: "t-value" },
              { metadata: cypher("kn-2", "table"), name: "Other network", tool_id: "t-other" },
              {
                metadata: {
                  function_content: { code: "def handler(e): ...", script_type: "python" },
                },
                name: "Python",
                tool_id: "t-python",
              },
            ],
          },
        },
      });
    });

    const tools = await listKnEventRuleTools("kn-1");

    expect(listToolboxesMock).toHaveBeenCalledWith(
      expect.objectContaining({ metadataType: "function", status: "published" }),
    );
    expect(tools).toEqual([
      {
        boxId: "box-a",
        boxName: "Order rules",
        description: undefined,
        parameters: [
          { description: undefined, name: "today", required: true, type: "string" },
          { description: undefined, name: "days", required: undefined, type: "integer" },
        ],
        toolId: "t-table",
        toolName: "Overdue orders",
      },
    ]);
  });

  it("reads every page of tool boxes and tools, never asking for more than the service allows", async () => {
    const boxes = Array.from({ length: 101 }, (_, at) => ({
      boxId: `box-${at}`,
      name: `Box ${at}`,
    }));
    listToolboxesMock.mockImplementation(({ page }: { page: number }) =>
      Promise.resolve({
        items: page === 1 ? boxes.slice(0, 100) : boxes.slice(100),
        total: boxes.length,
      }),
    );
    const other = (at: number) => ({
      metadata: cypher("kn-2", "table"),
      name: `Other ${at}`,
      tool_id: `other-${at}`,
    });
    getMock.mockImplementation((url: string, config: { params: { page: number } }) => {
      if (!url.includes("box-100")) {
        return Promise.resolve({ data: { has_next: false, tools: [] } });
      }
      return Promise.resolve({
        data:
          config.params.page === 1
            ? { has_next: true, tools: Array.from({ length: 100 }, (_, at) => other(at)) }
            : {
                has_next: false,
                tools: [{ metadata: cypher("kn-1", "table"), name: "Late", tool_id: "t-late" }],
              },
      });
    });

    const tools = await listKnEventRuleTools("kn-1");

    expect(tools.map((tool) => tool.toolId)).toEqual(["t-late"]);
    expect(listToolboxesMock).toHaveBeenCalledTimes(2);
    for (const [query] of listToolboxesMock.mock.calls as [{ pageSize: number }][]) {
      expect(query.pageSize).toBeLessThanOrEqual(100);
    }
    for (const [, config] of getMock.mock.calls as [string, { params: { page_size: number } }][]) {
      expect(config.params.page_size).toBeLessThanOrEqual(100);
    }
  });

  it("reads a fixed rate as the cron of the same meaning, when there is one", () => {
    expect(cronOfFixedRate("30m")).toBe("*/30 * * * *");
    expect(cronOfFixedRate("60m")).toBe("0 * * * *");
    expect(cronOfFixedRate("6h")).toBe("0 */6 * * *");
    expect(cronOfFixedRate("1d")).toBe("0 0 * * *");
    expect(cronOfFixedRate("45m")).toBeUndefined();
    expect(cronOfFixedRate("5h")).toBeUndefined();
    expect(cronOfFixedRate("2d")).toBeUndefined();
  });

  it("shows the schedule of a recognition action that runs at a fixed rate", async () => {
    serve({
      action: recognition({
        schedule: { expression: "30m", timezone: "Asia/Shanghai", type: "FIX_RATE" },
      }),
      schedule,
    });

    const eventType = await getKnEventType("kn-1", "order_overdue");

    expect(eventType.check_schedule).toEqual({ cron: "*/30 * * * *", timezone: "Asia/Shanghai" });
  });
});
