/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type {
  KnowledgeNetworkMetricRecord,
  KnowledgeNetworkTaskChildRecord,
  KnowledgeNetworkTaskRecord,
} from "@/modules/knowledge-network/types/knowledge-network";

export type BackendAccountInfo = {
  id?: string | null;
  name?: string | null;
};

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
  statistics?: {
    action_types_total?: number;
    concept_groups_total?: number;
    metrics_total?: number;
    object_types_total?: number;
    relation_types_total?: number;
  };
  tags?: string[];
  update_time?: number;
  updater?: BackendAccountInfo;
  embedding_model_id?: string;
  embedding_dim?: number;
};

export type BackendIndexConfig = {
  fulltext_config?: {
    analyzer?: string;
    enabled?: boolean;
  };
  keyword_config?: {
    enabled?: boolean;
    ignore_above_len?: number;
  };
  vector_config?: {
    enabled?: boolean;
    model_id?: string;
  };
};

export type BackendDataProperty = {
  comment?: string;
  display_name?: string;
  index_config?: BackendIndexConfig;
  mapped_field?: {
    comment?: string;
    display_name?: string;
    name: string;
    type?: string;
  };
  name: string;
  original_name?: string;
  type?: string;
};

export type BackendDataSource = {
  id: string;
  name?: string;
  type: "data_view" | "resource";
};

export type BackendLogicParameter = {
  description?: string;
  id?: string;
  if_system_generate?: boolean;
  name: string;
  operation?: string;
  source?: string;
  type?: string;
  value?: string | boolean | number;
  value_from?: string;
};

export type BackendLogicProperty = {
  comment?: string;
  data_source?: {
    id: string;
    name?: string;
    type: string;
  } | null;
  display_name?: string;
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
  has_index?: boolean;
  icon?: string;
  id: string;
  incremental_key?: string;
  logic_properties?: BackendLogicProperty[];
  name: string;
  primary_keys?: string[];
  status?: {
    index_available?: boolean;
  };
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
  action_types?: BackendObjectType[];
  color?: string;
  comment?: string;
  id: string;
  name: string;
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
  mapping_mode?: "direct" | "data_view";
  mapping_rules?: import("./relation-type.mapper").BackendRelationTypeMappingRules;
  name: string;
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
  type?: "direct" | "data_view";
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
  action_type?: "ADD" | "UPDATE" | "DELETE" | "NOTIFY" | "add" | "modify" | "delete" | "notify";
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

export type BackendMetricCondition = {
  field?: string;
  object_type_id?: string;
  operation?: string;
  sub_conditions?: BackendMetricCondition[];
  value?: string | string[];
  value_from?: "const";
};

export type BackendMetric = {
  calculation_formula?: {
    aggregation?: {
      aggr?: KnowledgeNetworkMetricRecord["calculationFormula"]["aggregation"]["aggr"];
      property?: string;
    };
    analysis_dimensions?: Array<{ property?: string } | string>;
    condition?: BackendMetricCondition;
    group_by?: Array<{ property?: string } | string>;
    having?: {
      field?: string;
      operation?: string;
      value?: number | string;
    };
    order_by?: Array<{
      direction?: "asc" | "desc";
      property?: string;
    }>;
  };
  comment?: string;
  id: string;
  metric_type?: KnowledgeNetworkMetricRecord["metricType"];
  name: string;
  scope_ref?: string;
  scope_type?: KnowledgeNetworkMetricRecord["scopeType"];
  tags?: string[];
  time_dimension?: {
    default_range_policy?: string;
    property?: string;
  };
  unit?: KnowledgeNetworkMetricRecord["unit"];
  unit_type?: KnowledgeNetworkMetricRecord["unitType"];
  update_time?: number;
  updater?: BackendAccountInfo;
};

export type BackendTaskChild = {
  concept_id?: string;
  concept_name?: string;
  concept_type?: string;
  id: string;
  state?: KnowledgeNetworkTaskChildRecord["state"];
  state_detail?: string;
  time_cost?: number;
};

export type BackendTask = {
  finish_time?: number;
  id: string;
  job_type?: KnowledgeNetworkTaskRecord["jobType"];
  name?: string;
  start_time?: number;
  state?: KnowledgeNetworkTaskRecord["state"];
  state_detail?: string;
};
