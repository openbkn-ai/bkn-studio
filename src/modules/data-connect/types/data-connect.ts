export type ConnectorFieldConfig = {
  description: string;
  encrypted: boolean;
  name: string;
  required: boolean;
  type: string;
};

export type DataConnectConnectorType = {
  category: string;
  description: string;
  enabled: boolean;
  fieldConfig: Record<string, ConnectorFieldConfig>;
  mode: string;
  name: string;
  type: string;
};

export type DataConnectRecordStatus = "disabled" | "enabled";

export type DataConnectHealthStatus =
  | "degraded"
  | "healthy"
  | "offline"
  | "unchecked"
  | "unhealthy";

export type DataConnectRecord = {
  category: string;
  connectorConfig: Record<string, unknown>;
  connectorType: string;
  createTime: string;
  creatorName: string;
  description: string;
  enabled: boolean;
  healthCheckEnabled: boolean;
  healthCheckResult: string;
  healthStatus: DataConnectHealthStatus;
  id: string;
  metadata: Record<string, unknown>;
  mode: string;
  name: string;
  operations: string[];
  status: DataConnectRecordStatus;
  tags: string[];
  type: string;
  updateTime: string;
  updaterName: string;
};

export type DataConnectListQuery = {
  connectorType?: string;
  keyword: string;
  page: number;
  pageSize: number;
};

export type DataConnectListResult = {
  items: DataConnectRecord[];
  total: number;
};

export type DataConnectMutationInput = {
  connectorConfig: Record<string, boolean | number | string | string[]>;
  connectorType: string;
  description: string;
  enabled: boolean;
  name: string;
  tags: string[];
};

export type DataConnectMutationPayload = {
  connectorConfig: Record<string, unknown>;
  connectorType: string;
  description: string;
  enabled: boolean;
  name: string;
  tags: string[];
};
