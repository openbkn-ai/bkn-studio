/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { MetricPropertyBindingV1 } from "@/modules/knowledge-network/types/object-metric";

export type BackendAccountInfo = {
  id?: string | null;
  name?: string | null;
};

export type BackendActionTypeEnum =
  "ADD" | "UPDATE" | "DELETE" | "NOTIFY" | "add" | "modify" | "delete" | "notify";

export type BackendKnowledgeNetwork = {
  code?: string;
  color?: string;
  comment?: string;
  create_time?: number;
  creator?: BackendAccountInfo;
  description?: string;
  display_id?: string;
  icon?: string;
  id: string;
  name: string;
  operations?: string[];
  statistics?: {
    action_types_total?: number;
    concept_groups_total?: number;
    apis_total?: number;
    functions_total?: number;
    mcp_tools_total?: number;
    metrics_total?: number;
    object_types_total?: number;
    relation_types_total?: number;
    skills_total?: number;
  };
  tags?: string[];
  update_time?: number;
  updater?: BackendAccountInfo;
  embedding_model_id?: string;
  embedding_dim?: number;
};

export type BackendDataProperty = {
  comment?: string;
  display_name?: string;
  mapped_field?: {
    comment?: string;
    display_name?: string;
    name: string;
    type?: string;
  };
  name: string;
  index_features?: Array<{
    available?: boolean | null;
    configured?: boolean;
    type: "keyword" | "fulltext" | "vector";
  }>;
  mask_rule?:
    | { kind: "fixed"; replacement: string }
    | { kind: "partial"; keep_start: number; keep_end: number; replacement: string }
    | {
        kind: "email";
        local_keep_start: number;
        preserve_domain: boolean;
        replacement: string;
      }
    | { kind: "round"; step: number }
    | { kind: "date_granularity"; granularity: "year" | "month" | "day" | "hour" };
  original_name?: string;
  type?: string;
};

export type BackendDataSource = {
  id: string;
  name?: string;
  type: "resource";
};

export type BackendLogicParameter = {
  description?: string;
  id?: string;
  if_system_generate?: boolean;
  name: string;
  operation?: string;
  required?: boolean;
  source?: string;
  type?: string;
  value?: string | boolean | number;
  value_from?: string;
};

export type BackendLogicProperty = {
  comment?: string;
  data_source?: {
    box_id?: string;
    id?: string;
    name?: string;
    result_path?: string;
    tool_id?: string;
    type: string;
  } | null;
  display_name?: string;
  metric_binding?: MetricPropertyBindingV1 | null;
  name: string;
  parameters?: BackendLogicParameter[] | null;
  type?: string;
};

export type BackendObjectTypeMutation = {
  branch?: string;
  color?: string;
  comment?: string;
  concept_groups?: Array<{
    id: string;
    name?: string;
  }>;
  data_properties?: BackendDataProperty[];
  data_source?: BackendDataSource;
  display_key?: string;
  icon?: string;
  id?: string;
  incremental_key?: string;
  logic_properties?: BackendLogicProperty[];
  name: string;
  primary_keys?: string[];
  tags?: string[];
};

export type BackendObjectType = {
  color?: string;
  comment?: string;
  concept_groups?: Array<{
    id: string;
    name?: string;
  }>;
  data_properties?: BackendDataProperty[];
  data_source?: BackendDataSource;
  display_key?: string;
  icon?: string;
  id: string;
  index_status?: {
    state?: "available" | "unavailable" | "unknown" | "resource_missing" | "not_applicable";
    source_status?: string;
  };
  incremental_key?: string;
  logic_properties?: BackendLogicProperty[];
  name: string;
  operations?: string[];
  primary_keys?: string[];
  tags?: string[];
  update_time?: number;
  updater?: BackendAccountInfo;
};

export type BackendSmallModel = {
  batch_size?: number;
  embedding_dim?: number;
  max_tokens?: number;
  model_id: string;
  model_name?: string;
};

export type BackendConceptGroup = {
  action_types?: Array<
    BackendObjectType & {
      action_type?: BackendActionTypeEnum;
      object_type?: {
        color?: string;
        icon?: string;
        id?: string;
        name?: string;
      };
    }
  >;
  color?: string;
  comment?: string;
  id: string;
  name: string;
  operations?: string[];
  object_types?: BackendObjectType[];
  relation_types?: BackendObjectType[];
  statistics?: {
    action_types_total?: number;
    object_types_total?: number;
    relation_types_total?: number;
  };
  tags?: string[];
  update_time?: number;
  updater?: { name?: string };
  updater_name?: string;
};

export type BackendRelationType = {
  color?: string;
  comment?: string;
  id: string;
  mapping_mode?: "direct" | "indirect";
  mapping_rules?: import("./relation-type.mapper").BackendRelationTypeMappingRules;
  name: string;
  operations?: string[];
  source_object_type?: {
    id?: string;
    name?: string;
  };
  source_object_type_id?: string;
  tags?: string[];
  target_object_type?: {
    id?: string;
    name?: string;
  };
  target_object_type_id?: string;
  type?: "direct" | "indirect";
  update_time?: number;
  updater?: BackendAccountInfo;
};

export type BackendActionType = {
  action_source?: {
    box_id?: string;
    mcp_id?: string;
    tool_id?: string;
    tool_name?: string;
    type?: "manual" | "mcp" | "tool";
  };
  action_type?: BackendActionTypeEnum;
  affect?: {
    comment?: string;
    object_type_id?: string;
  };
  color?: string;
  comment?: string;
  condition?: {
    field?: string;
    object_type_id?: string;
    operation?: string;
    sub_conditions?: BackendActionType["condition"][];
    value?: string | string[];
    value_from?: "const";
  };
  id: string;
  name: string;
  operations?: string[];
  object_type?: {
    id?: string;
    name?: string;
  };
  object_type_id?: string;
  parameters?: Array<{
    name: string;
    value?: string;
    value_from?: "property" | "input" | "const";
  }>;
  tags?: string[];
  update_time?: number;
  updater?: BackendAccountInfo;
};

export type BackendListResponse<T> = {
  entries: T[];
  total_count: number;
};
