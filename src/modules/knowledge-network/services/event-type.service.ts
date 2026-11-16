/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import i18n from "@/app/locales/i18n";
import { registerErrorCodeMessage } from "@/framework/request/error-message";
import { http } from "@/framework/request/http";
import { listToolboxes } from "@/modules/execution-factory/services/toolbox.service";
import type { ToolboxRecord } from "@/modules/execution-factory/types/toolbox";
import {
  mapFunctionContent,
  type BackendMetadata,
} from "@/modules/execution-factory/utils/metadata-content";
import {
  logServiceFallback,
  useMock,
  wait,
} from "@/modules/knowledge-network/services/shared/runtime";
import type {
  KnEventRuleCheck,
  KnEventRuleCheckResult,
  KnEventRuleToolOption,
  KnEventType,
  KnEventTypeInput,
  KnEventTypeUpdate,
} from "@/modules/knowledge-network/types/event-type";

// The backend's text for a taken code names only the code; a create is also refused when the
// network has an object type with the class's ID or with the same name.
registerErrorCodeMessage("BknBackend.KnEvent.EventTypeExisted", () =>
  i18n.t("knowledgeNetwork.eventClasses.errors.existed"),
);

function eventTypesPath(networkId: string) {
  return `/bkn-backend/v1/knowledge-networks/${encodeURIComponent(networkId)}/event-types`;
}

function eventTypePath(networkId: string, code: string) {
  return `${eventTypesPath(networkId)}/${encodeURIComponent(code)}`;
}

/** The ID of the event class an event type gets: its code with the dots made underscores. */
export function eventClassIdOf(code: string) {
  return code.replace(/\./g, "_");
}

/**
 * A replace that keeps everything an event type has. A replace takes the zero value for any field
 * it leaves out, so a save that sent only what it changed would, say, stop the platform's checks.
 */
export function eventTypeUpdateBody(eventType: KnEventType): KnEventTypeUpdate {
  return {
    check_schedule: eventType.check_schedule ?? null,
    merge_hours: eventType.merge_hours ?? 0,
    name: eventType.name,
    rule: eventType.rule ?? {},
    rule_tool: eventType.rule_tool ?? null,
    rule_version: eventType.rule_version ?? "",
    severity: eventType.severity ?? "",
    subject: eventType.subject ?? "",
  };
}

/**
 * The body as sent: no rule tool and no schedule are left out rather than sent as null. The backend
 * reads both the same, and an event module from before rule tools refuses fields it does not know,
 * so reported types and types without a tool still save there.
 */
function withoutEmptyRuleFields<T extends Pick<KnEventTypeUpdate, "check_schedule" | "rule_tool">>(
  body: T,
): T {
  const { check_schedule: schedule, rule_tool: tool, ...rest } = body;
  return {
    ...rest,
    ...(schedule ? { check_schedule: schedule } : {}),
    ...(tool ? { rule_tool: tool } : {}),
  } as T;
}

const mockEventTypes = new Map<string, KnEventType[]>();

function mockList(networkId: string) {
  const list = mockEventTypes.get(networkId) ?? [];
  mockEventTypes.set(networkId, list);
  return list;
}

export async function listKnEventTypes(networkId: string): Promise<KnEventType[]> {
  if (useMock) {
    return wait(mockList(networkId).map((item) => ({ ...item })));
  }
  const response = await http.get<{ entries?: KnEventType[] }>(eventTypesPath(networkId), {
    skipErrorToast: true,
  });
  return response.data.entries ?? [];
}

export async function getKnEventType(networkId: string, code: string): Promise<KnEventType> {
  if (useMock) {
    const found = mockList(networkId).find((item) => item.code === code);
    if (!found) {
      throw new Error(i18n.t("common.notFound"));
    }
    return wait({ ...found });
  }
  const response = await http.get<KnEventType>(eventTypePath(networkId, code));
  return response.data;
}

export async function createKnEventType(
  networkId: string,
  input: KnEventTypeInput,
): Promise<KnEventType> {
  if (useMock) {
    const list = mockList(networkId);
    const created: KnEventType = {
      ...input,
      kn_id: networkId,
      object_type_id: eventClassIdOf(input.code),
      dataset_id: `kn_event_${input.code}`,
      next_check_at: input.rule_tool ? Date.now() + 3_600_000 : 0,
      check_subject: input.rule_tool ? { id: "mock", name: "mock" } : null,
      trial: input.rule_tool ? { hits: 3, limited: false } : undefined,
    };
    list.push(created);
    return wait({ ...created });
  }
  const response = await http.post<KnEventType>(
    eventTypesPath(networkId),
    withoutEmptyRuleFields(input),
  );
  return response.data;
}

export async function updateKnEventType(
  networkId: string,
  code: string,
  update: KnEventTypeUpdate,
): Promise<KnEventType> {
  if (useMock) {
    const list = mockList(networkId);
    const index = list.findIndex((item) => item.code === code);
    if (index < 0) {
      throw new Error(i18n.t("common.notFound"));
    }
    const updated: KnEventType = {
      ...list[index],
      ...update,
      object_type_id: eventClassIdOf(code),
    };
    list[index] = updated;
    return wait({ ...updated });
  }
  const response = await http.put<KnEventType>(
    eventTypePath(networkId, code),
    withoutEmptyRuleFields(update),
  );
  return response.data;
}

export async function deleteKnEventType(networkId: string, code: string): Promise<void> {
  if (useMock) {
    const list = mockList(networkId);
    mockEventTypes.set(
      networkId,
      list.filter((item) => item.code !== code),
    );
    await wait(null);
    return;
  }
  // The caller explains the refusals (events recorded, class in use) with their details.
  await http.delete(eventTypePath(networkId, code), { skipErrorToast: true });
}

/** Checks a rule type now, as its scheduled checks do. */
export async function checkKnEventType(
  networkId: string,
  code: string,
): Promise<KnEventRuleCheckResult> {
  if (useMock) {
    return wait({ check: { event_type: code, hits: 3, status: "ok", time: Date.now() } });
  }
  const response = await http.post<KnEventRuleCheckResult>(
    `${eventTypePath(networkId, code)}/check`,
  );
  return response.data;
}

/** The last recorded check of each rule type; needs `query_data` on the network. */
export async function listKnEventRuleChecks(networkId: string): Promise<KnEventRuleCheck[]> {
  if (useMock) {
    return wait([]);
  }
  const response = await http.get<{ entries?: KnEventRuleCheck[] }>(
    `/bkn-backend/v1/knowledge-networks/${encodeURIComponent(networkId)}/rule-checks`,
    { skipErrorToast: true },
  );
  return response.data.entries ?? [];
}

type BackendToolList = {
  data?: { has_next?: boolean; tools?: BackendTool[] };
  has_next?: boolean;
  tools?: BackendTool[];
};

type BackendTool = {
  description?: string;
  metadata?: BackendMetadata;
  name?: string;
  tool_id: string;
};

/** The largest page the tool box service returns; it refuses a larger one. */
const RULE_TOOL_PAGE_SIZE = 100;
/** Pages read at most, so a list that keeps reporting more cannot keep the form waiting. */
const RULE_TOOL_MAX_PAGES = 20;

async function listPublishedFunctionBoxes() {
  const boxes: ToolboxRecord[] = [];
  for (let page = 1; page <= RULE_TOOL_MAX_PAGES; page += 1) {
    const result = await listToolboxes({
      all: true,
      metadataType: "function",
      page,
      pageSize: RULE_TOOL_PAGE_SIZE,
      status: "published",
    });
    boxes.push(...result.items);
    if (result.items.length < RULE_TOOL_PAGE_SIZE || boxes.length >= result.total) break;
  }
  return boxes;
}

async function listEnabledTools(boxId: string) {
  const tools: BackendTool[] = [];
  for (let page = 1; page <= RULE_TOOL_MAX_PAGES; page += 1) {
    const response = await http.get<BackendToolList>(
      `/agent-operator-integration/v1/tool-box/${encodeURIComponent(boxId)}/tools/list`,
      {
        params: {
          all: true,
          box_id: boxId,
          page,
          page_size: RULE_TOOL_PAGE_SIZE,
          status: "enabled",
        },
        skipErrorToast: true,
      },
    );
    const entries = response.data.data?.tools ?? response.data.tools ?? [];
    tools.push(...entries);
    const hasNext = response.data.has_next ?? response.data.data?.has_next;
    if (entries.length < RULE_TOOL_PAGE_SIZE || hasNext === false) break;
  }
  return tools;
}

/**
 * The tools a rule of this network may use: enabled Cypher functions of the network that return a
 * table, in published tool boxes. The backend checks the same when the rule is saved.
 */
export async function listKnEventRuleTools(networkId: string): Promise<KnEventRuleToolOption[]> {
  if (useMock) {
    return wait([]);
  }
  const boxes = await listPublishedFunctionBoxes();
  const lists = await Promise.all(
    boxes.map(async (box) => {
      try {
        const tools = await listEnabledTools(box.boxId);
        return tools.flatMap((tool): KnEventRuleToolOption[] => {
          const content = mapFunctionContent(tool.metadata);
          if (
            content?.script_type !== "cypher" ||
            content.kn_id !== networkId ||
            content.result_shape !== "table"
          ) {
            return [];
          }
          return [
            {
              boxId: box.boxId,
              boxName: box.name,
              description: tool.description,
              parameters: (content.inputs ?? []).flatMap((input) =>
                input.name
                  ? [
                      {
                        description: input.description,
                        name: input.name,
                        required: input.required,
                        type: input.type,
                      },
                    ]
                  : [],
              ),
              toolId: tool.tool_id,
              toolName: tool.name ?? tool.tool_id,
            },
          ];
        });
      } catch (error) {
        // A box that cannot be read offers no tools; the others still can.
        logServiceFallback("listKnEventRuleTools", error, `boxId=${box.boxId}`);
        return [];
      }
    }),
  );
  return lists.flat();
}

/** Clears the mock store between tests. */
export function resetKnEventTypeMocksForTests() {
  mockEventTypes.clear();
}
