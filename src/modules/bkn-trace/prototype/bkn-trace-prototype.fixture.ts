/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { BknTracePrototypeFixture } from "@/modules/bkn-trace/prototype/bkn-trace-prototype.types";

const inventorySql = `SELECT warehouse, stock_status, SUM(inventory_qty) AS inventory_qty
FROM {{d9qpqpco8jec73ec20ug}}
WHERE material_code = '101-000015'
GROUP BY warehouse, stock_status
ORDER BY warehouse, stock_status`;

const purchaseOrderSql = `SELECT supplier_number, supplier_name, SUM(order_quantity) AS order_quantity
FROM {{d9qpqpco8jec73ec210g}}
WHERE material_number = '101-000015'
GROUP BY supplier_number, supplier_name
ORDER BY order_quantity DESC`;

const purchaseOrderFuzzySql = `SELECT material_number, material_name, supplier_number, supplier_name, order_quantity
FROM {{d9qpqpco8jec73ec210g}}
WHERE material_name LIKE '%101-000015%' OR material_number LIKE '%101-000015%'
LIMIT 20`;

const purchaseRequestSql = `SELECT material_number, material_description, supplier_number, supplier_name, requested_quantity
FROM {{d9qpqpco8jec73ec2110}}
WHERE material_number = '101-000015'
LIMIT 50`;

const purchaseOrderByNameSql = `SELECT supplier_number, supplier_name, SUM(order_quantity) AS order_quantity
FROM {{d9qpqpco8jec73ec210g}}
WHERE material_name = 'HD401_外置电池'
GROUP BY supplier_number, supplier_name
ORDER BY order_quantity DESC`;

const bomSql = `SELECT parent_material_code, material_code, material_name, standard_usage,
  usage_numerator, usage_denominator, bom_level, alt_method, alt_group_no, alt_priority
FROM {{d9qpqpco8jec73ec20tg}}
WHERE parent_material_code IN ('900-000044','900-000063')
ORDER BY parent_material_code, bom_level, seq_no, material_code`;

export const tracePrototypeFixture: BknTracePrototypeFixture = {
  conversationId: "conv_73fc12a00ac46933c3d8015616a1b1b3",
  agentName: "Codex",
  network: { id: "supplychain_hd0202", name: "HD供应链业务知识网络_v3" },
  explorationCandidateCount: 28,
  observedRelationIds: [],
  interactions: [
    {
      id: "int_41d61bc56f7e5488171fa395ba73f58b",
      question: "使用 HD供应链业务知识网络_v3 查询物料 101-000015 有多少库存、分别分布在哪些仓库，以及这个物料的供应商是谁？",
      answerSummary: "物料 101-000015（HD401_外置电池）库存合计 1,756；已获得仓库分布，但现有采购订单中未匹配到可确认的供应商。",
      startedAt: "2026-08-08T11:01:45.182186Z",
      completedAt: "2026-08-08T11:03:23.075149Z",
      durationMs: 97892,
      operations: [
        {
          id: "op-list-networks",
          tool: "list_knowledge_networks",
          businessLabel: "查找业务知识网络",
          startedAt: "2026-08-08T11:01:56.684460Z",
          completedAt: "2026-08-08T11:01:56.707740Z",
          durationMs: 23,
          status: "completed",
          resultSummary: "定位到 HD供应链业务知识网络_v3。",
        },
        {
          id: "op-search-schema",
          tool: "search_schema",
          businessLabel: "探索知识网络结构",
          startedAt: "2026-08-08T11:02:04.064344Z",
          completedAt: "2026-08-08T11:02:04.273688Z",
          durationMs: 209,
          status: "completed",
          condition: "围绕物料、库存、仓库、供应商检索 Schema",
          resultSummary: "返回 28 个对象、关系与行动候选；候选本身不作为实际使用依据。",
        },
        {
          id: "op-inventory-sql",
          tool: "run_sql",
          businessLabel: "查询库存分布",
          startedAt: "2026-08-08T11:02:21.990530Z",
          completedAt: "2026-08-08T11:02:22.628630Z",
          durationMs: 638,
          status: "completed",
          targetObjectId: "supplychain_hd0202_inventory",
          resourceId: "d9qpqpco8jec73ec20ug",
          condition: "物料编码 = 101-000015",
          fields: ["仓库", "库存状态", "库存数量合计"],
          sql: inventorySql,
          resultSummary: "按仓库和库存状态汇总，库存合计 1,756。",
        },
        {
          id: "op-po-sql",
          tool: "run_sql",
          businessLabel: "按物料查询采购订单供应商",
          startedAt: "2026-08-08T11:02:30.690404Z",
          completedAt: "2026-08-08T11:02:31.386134Z",
          durationMs: 695,
          status: "completed",
          targetObjectId: "supplychain_hd0202_purchase_order",
          resourceId: "d9qpqpco8jec73ec210g",
          condition: "物料编号 = 101-000015",
          fields: ["供应商编号", "供应商名称", "订单数量合计"],
          sql: purchaseOrderSql,
          resultSummary: "没有匹配到采购订单。",
        },
        {
          id: "op-po-fuzzy-sql",
          tool: "run_sql",
          businessLabel: "扩大条件查找采购订单",
          startedAt: "2026-08-08T11:02:38.799483Z",
          completedAt: "2026-08-08T11:02:39.343405Z",
          durationMs: 543,
          status: "completed",
          targetObjectId: "supplychain_hd0202_purchase_order",
          resourceId: "d9qpqpco8jec73ec210g",
          condition: "物料名称或编号包含 101-000015",
          fields: ["物料", "供应商", "订单数量"],
          sql: purchaseOrderFuzzySql,
          resultSummary: "扩大匹配范围后仍无采购订单记录。",
        },
        {
          id: "op-pr-sql",
          tool: "run_sql",
          businessLabel: "查询物料请购记录",
          startedAt: "2026-08-08T11:02:58.047089Z",
          completedAt: "2026-08-08T11:02:58.772173Z",
          durationMs: 725,
          status: "completed",
          targetObjectId: "supplychain_hd0202_purchase_request",
          resourceId: "d9qpqpco8jec73ec2110",
          condition: "物料编号 = 101-000015",
          fields: ["物料", "供应商", "请购数量"],
          sql: purchaseRequestSql,
          resultSummary: "检查请购记录以补充供应商线索。",
        },
        {
          id: "op-material-query",
          tool: "query_object_instance",
          businessLabel: "查询物料对象",
          startedAt: "2026-08-08T11:03:05.768938Z",
          completedAt: "2026-08-08T11:03:05.865277Z",
          durationMs: 96,
          status: "completed",
          targetObjectId: "supplychain_hd0202_material",
          condition: "物料编码 = 101-000015",
          fields: ["物料编码", "物料名称"],
          resultSummary: "确认物料名称为 HD401_外置电池。",
        },
        {
          id: "op-po-name-sql",
          tool: "run_sql",
          businessLabel: "按物料名称再次查询供应商",
          startedAt: "2026-08-08T11:03:13.093482Z",
          completedAt: "2026-08-08T11:03:13.655513Z",
          durationMs: 562,
          status: "completed",
          targetObjectId: "supplychain_hd0202_purchase_order",
          resourceId: "d9qpqpco8jec73ec210g",
          condition: "物料名称 = HD401_外置电池",
          fields: ["供应商编号", "供应商名称", "订单数量合计"],
          sql: purchaseOrderByNameSql,
          resultSummary: "按物料名称查询仍未获得可确认供应商。",
        },
      ],
    },
    {
      id: "int_483a29806fa10fde2e45b6eede7b435e",
      question: "分析对比900-000044和900-000063两款智能球阀的BOM物料差异，是否有共用物料？",
      answerSummary: "完成两款智能球阀的 BOM 明细对比：900-000044 有 1 条直接物料，900-000063 返回 5 条 BOM 明细，并据返回结果判断共用物料。",
      startedAt: "2026-08-08T11:04:22.614420Z",
      completedAt: "2026-08-08T11:04:53.277119Z",
      durationMs: 30662,
      operations: [
        {
          id: "op-bom-sql",
          requestId: "req_7892c814-bd3a-45c5-83eb-6707f0279df1",
          operationId: "op_481d7266ea974c0d6d9e2165c9e29a43",
          tool: "run_sql",
          businessLabel: "对比两款产品的 BOM 物料",
          startedAt: "2026-08-08T11:04:40.302897Z",
          completedAt: "2026-08-08T11:04:40.970884Z",
          durationMs: 667,
          status: "completed",
          targetObjectId: "supplychain_hd0202_bom",
          resourceId: "d9qpqpco8jec73ec20tg",
          condition: "父项物料编码 ∈ 900-000044, 900-000063",
          fields: ["父项物料", "BOM物料", "标准用量", "BOM层级", "替代信息"],
          sql: bomSql,
          resultSummary: "返回两款产品的 BOM 明细，用于比较差异与共用物料。",
        },
      ],
    },
  ],
  objects: [
    { id: "supplychain_hd0202_material", name: "物料", resourceIds: [] },
    { id: "supplychain_hd0202_inventory", name: "库存", resourceIds: ["d9qpqpco8jec73ec20ug"] },
    { id: "supplychain_hd0202_purchase_order", name: "采购订单", resourceIds: ["d9qpqpco8jec73ec210g"] },
    { id: "supplychain_hd0202_purchase_request", name: "物料请购单", resourceIds: ["d9qpqpco8jec73ec2110"] },
    { id: "supplychain_hd0202_bom", name: "产品BOM", resourceIds: ["d9qpqpco8jec73ec20tg"] },
    { id: "supplychain_hd0202_supplier", name: "供应商", resourceIds: [] },
    { id: "supplychain_hd0202_product", name: "产品", resourceIds: [] },
  ],
  relations: [
    { id: "supplychain_hd0202_material2inventory", name: "物料关联库存", sourceObjectId: "supplychain_hd0202_material", targetObjectId: "supplychain_hd0202_inventory", mappingSummary: "物料编码 → 物料编码" },
    { id: "supplychain_hd0202_po2supplier", name: "采购订单关联供应商", sourceObjectId: "supplychain_hd0202_purchase_order", targetObjectId: "supplychain_hd0202_supplier", mappingSummary: "供应商编号 → 供应商编码" },
    { id: "supplychain_hd0202_pr2po", name: "采购订单关联物料请购单", sourceObjectId: "supplychain_hd0202_purchase_order", targetObjectId: "supplychain_hd0202_purchase_request", mappingSummary: "物料编号、来源单据 → 请购单" },
    { id: "supplychain_hd0202_product2bom", name: "产品关联产品BOM", sourceObjectId: "supplychain_hd0202_product", targetObjectId: "supplychain_hd0202_bom", mappingSummary: "产品物料编号 → BOM父项物料编码" },
    { id: "supplychain_hd0202_bom2material", name: "产品BOM关联物料", sourceObjectId: "supplychain_hd0202_bom", targetObjectId: "supplychain_hd0202_material", mappingSummary: "BOM物料编码 → 物料编码" },
  ],
};
