/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export type {
  CatalogHealthStatus as DataConnectHealthStatus,
  CatalogListQuery as DataConnectListQuery,
  CatalogListResult as DataConnectListResult,
  CatalogRecord as DataConnectRecord,
  CatalogRecordStatus as DataConnectRecordStatus,
} from "@/shared/catalog/types";

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
