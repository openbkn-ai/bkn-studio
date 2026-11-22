/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { apiResourceView } from "../lib/api-resource";
import type { ApiResource, ApiResourceField } from "../types/api-resource";
import type { CatalogResource } from "../types/data-catalog";

const orderProperties = {
  order_id: { type: "string" },
  order_no: { type: "string" },
  customer_name: { type: "string" },
  amount: { type: "number" },
  status: { type: "string", enum: ["pending", "confirmed", "shipped"] },
  created_at: { type: "string", format: "date-time" },
};
const orderSchema = {
  type: "object",
  required: Object.keys(orderProperties),
  properties: orderProperties,
};
const fields: ApiResourceField[] = [
  {
    name: "id",
    original_name: "order_id",
    display_name: "订单 ID",
    type: "string",
    filterable: true,
  },
  {
    name: "order_number",
    original_name: "order_no",
    display_name: "订单编号",
    type: "string",
    filterable: false,
  },
  {
    name: "customer",
    original_name: "customer_name",
    display_name: "客户",
    type: "string",
    filterable: false,
  },
  {
    name: "total_amount",
    original_name: "amount",
    display_name: "订单金额",
    type: "decimal",
    attributes: { precision: 20, scale: 2 },
    filterable: false,
  },
  {
    name: "status",
    original_name: "status",
    display_name: "订单状态",
    type: "string",
    filterable: false,
  },
  {
    name: "created_at",
    original_name: "created_at",
    display_name: "创建时间",
    type: "datetime",
    filterable: false,
  },
];
const successRule = {
  http_status: [200],
  body_filter_condition: { field: "success", operation: "eq", value: true },
};
const timestamp = Date.parse("2026-11-19T00:00:00Z");
const ordersListId = "res-api-orders-list";
const orderDetailId = "res-api-order-detail";

export const mockApiResourceFixtures: ApiResource[] = [
  {
    id: ordersListId,
    catalog_id: "cat-api-demo",
    name: "orders_list",
    source_identifier: ordersListId,
    description: "订单列表演示：Query 参数、offset 分页、响应提取与字段映射。",
    category: "api",
    api_effect_type: "read",
    enabled: true,
    status: "active",
    tags: ["api", "demo", "orders"],
    operations: ["view_detail", "query_data", "modify", "delete"],
    update_time: timestamp,
    schema_definition: fields.map((field) =>
      field.name === "order_number" || field.name === "customer"
        ? { ...field, filterable: true }
        : field,
    ),
    api_definition: {
      variables: { order_status: { value: "confirmed", sensitive: false } },
      request: {
        method: "GET",
        path: "orders",
        headers: {
          Accept: "application/json",
          Authorization: "Bearer {{ api_key }}",
          "X-Client-Name": "{{ client_name }}",
        },
        parameters: [
          { name: "tenant", value: "{{ tenant }}", default_value: "demo", required: true },
          { name: "status", value: "{{ order_status }}", required: false },
          { name: "order_id", value: "{{ __filter_values.id }}", required: false },
          { name: "order_no", value: "{{ __filter_values.order_number }}", required: false },
          { name: "customer_name", value: "{{ __filter_values.customer }}", required: false },
          { name: "offset", value: "{{ __paging.offset }}", default_value: 0, required: true },
          { name: "limit", value: "{{ __paging.limit }}", default_value: 2, required: true },
        ],
      },
      response: {
        content_type: "application/json",
        statuses: {
          "200": {
            description: "订单列表与总条数",
            headers: { "X-Request-ID": { description: "请求编号", schema: { type: "string" } } },
            schema: {
              type: "object",
              required: ["success", "data"],
              properties: {
                success: { type: "boolean", const: true },
                data: {
                  type: "object",
                  required: ["items", "total"],
                  properties: {
                    items: { type: "array", items: orderSchema },
                    total: { type: "integer", minimum: 0 },
                  },
                },
              },
            },
            result_rows: "data.items",
            result_total: "data.total",
          },
          "401": { description: "凭据无效", schema: false },
          default: { description: "不接受其他响应", schema: false },
        },
      },
      success_rule: successRule,
      paging_rule: { mode: "offset", default_limit: 2, max_limit: 100 },
    },
  },
  {
    id: orderDetailId,
    catalog_id: "cat-api-demo",
    name: "order_detail",
    source_identifier: orderDetailId,
    description: "订单详情演示：只读 POST、资源变量、嵌套 Body 与单对象结果映射。",
    category: "api",
    api_effect_type: "read",
    enabled: true,
    status: "active",
    tags: ["api", "demo", "orders"],
    operations: ["view_detail", "query_data", "modify", "delete"],
    update_time: timestamp,
    schema_definition: [
      ...fields,
      {
        name: "items",
        original_name: "items",
        display_name: "订单明细",
        type: "json",
        filterable: false,
      },
    ],
    api_definition: {
      variables: { order_number: { value: "SO-2026-001", sensitive: false } },
      request: {
        method: "POST",
        path: "orders/detail",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: "Bearer {{ api_key }}",
        },
        parameters: [
          { name: "tenant", value: "{{ tenant }}", default_value: "demo", required: true },
          { name: "order_id", value: "{{ __filter_values.id }}", required: false },
        ],
        body: {
          type: "object",
          required: ["order_no", "context"],
          properties: {
            order_no: { type: "string", value: "{{ order_number }}" },
            include_items: { type: "boolean", value: true },
            context: {
              type: "object",
              required: ["client", "locale"],
              properties: {
                client: { type: "string", value: "{{ client_name }}" },
                locale: { type: "integer", value: "{{ locale }}" },
              },
            },
          },
        },
      },
      response: {
        content_type: "application/json",
        statuses: {
          "200": {
            description: "单条订单详情",
            schema: {
              type: "object",
              required: ["success", "data"],
              properties: {
                success: { type: "boolean", const: true },
                data: {
                  ...orderSchema,
                  properties: {
                    ...orderProperties,
                    items: {
                      type: "array",
                      items: {
                        type: "object",
                        required: ["sku", "quantity", "unit_price"],
                        properties: {
                          sku: { type: "string" },
                          quantity: { type: "integer", minimum: 1 },
                          unit_price: { type: "number" },
                        },
                      },
                    },
                  },
                },
              },
            },
            result_rows: "data",
          },
          "404": { description: "订单不存在", schema: false },
          default: { description: "不接受其他响应", schema: false },
        },
      },
      success_rule: successRule,
    },
  },
];

/** Display-safe fixed rows keyed by upstream field names; mapping uses the saved definition. */
export const mockApiOrderRows: Record<string, unknown>[] = [
  {
    order_id: "9007199254740993",
    order_no: "SO-2026-001",
    customer_name: "示例客户 A",
    amount: "1280.50",
    status: "confirmed",
    created_at: "2026-11-18T09:30:00Z",
    items: [{ sku: "SKU-DEMO-001", quantity: 2, unit_price: "640.25" }],
  },
  {
    order_id: "9007199254740994",
    order_no: "SO-2026-002",
    customer_name: "示例客户 B",
    amount: "2599.00",
    status: "confirmed",
    created_at: "2026-11-18T10:15:00Z",
    items: [{ sku: "SKU-DEMO-002", quantity: 1, unit_price: "2599.00" }],
  },
  {
    order_id: "9007199254740995",
    order_no: "SO-2026-003",
    customer_name: "示例客户 C",
    amount: "99.90",
    status: "confirmed",
    created_at: "2026-11-19T02:00:00Z",
    items: [{ sku: "SKU-DEMO-003", quantity: 3, unit_price: "33.30" }],
  },
];

export function apiResourceMockSummary(resource: ApiResource): CatalogResource {
  const summary = apiResourceView(resource);
  return {
    ...summary,
    schema: summary.schema.map((field) => ({
      ...field,
      originalType: field.type,
      originalDescription: field.description ?? "",
      filterable: field.filterable ?? false,
    })),
  };
}
