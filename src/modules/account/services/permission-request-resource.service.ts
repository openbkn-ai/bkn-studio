/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { isRequestForbidden, isRequestNotFound } from "@/framework/request/error-message";
import { http } from "@/framework/request/http";
import type { PermissionRequest } from "@/modules/account/services/permission-requests.service";

export type PermissionRequestResourceCheck =
  "exists" | "not_found" | "forbidden" | "unavailable" | "unsupported";

function resourceReadPath(request: PermissionRequest) {
  const resourceID = encodeURIComponent(request.resource_id);
  if (request.resource_type === "knowledge_network")
    return `/bkn-backend/v1/knowledge-networks/${resourceID}`;
  if (
    ["concept_group", "object_type", "relation_type", "action_type", "metric"].includes(
      request.resource_type,
    )
  ) {
    const [networkID, childID] = request.resource_id.split("/", 2);
    const segment: Record<string, string> = {
      concept_group: "concept-groups",
      object_type: "object-types",
      relation_type: "relation-types",
      action_type: "action-types",
      metric: "metrics",
    };
    if (networkID && childID)
      return `/bkn-backend/v1/knowledge-networks/${encodeURIComponent(networkID)}/${segment[request.resource_type]}/${encodeURIComponent(childID)}`;
  }
  if (request.resource_type === "catalog") return `/vega-backend/v1/catalogs/${resourceID}`;
  if (request.resource_type === "resource") return `/vega-backend/v1/resources/${resourceID}`;
  if (request.resource_type === "tool_box")
    return `/agent-operator-integration/v1/tool-box/${resourceID}`;
  if (request.resource_type === "mcp") return `/agent-operator-integration/v1/mcp/${resourceID}`;
  if (request.resource_type === "skill")
    return `/agent-operator-integration/v1/skills/${resourceID}`;
  return undefined;
}

export async function checkPermissionRequestResource(
  request: PermissionRequest,
): Promise<PermissionRequestResourceCheck> {
  const path = resourceReadPath(request);
  if (!path) return "unsupported";

  try {
    await http.get(path, { skipErrorToast: true });
    return "exists";
  } catch (error) {
    if (isRequestNotFound(error)) return "not_found";
    if (isRequestForbidden(error)) return "forbidden";
    return "unavailable";
  }
}
