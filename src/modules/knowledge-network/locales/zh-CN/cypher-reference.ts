/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { CypherReferenceTexts } from "@/modules/knowledge-network/cypher/cypher-reference";

/** The syntax reference's text; `notes` line up with each section's examples ("" for none). */
export const cypherReferenceZhCN: CypherReferenceTexts = [
  {
    title: "查询结构",
    rules: [
      "MATCH 模式 [WHERE 条件] RETURN 返回项 [ORDER BY …] [SKIP n] [LIMIT n]",
      "只读：必须有 MATCH 和 RETURN；不能 CREATE、MERGE、SET、DELETE、REMOVE。",
      "建议总写 LIMIT；SKIP 和 LIMIT 只接受非负整数。",
    ],
    notes: [""],
  },
  {
    title: "节点与关系",
    rules: [
      "节点写成 (变量:对象类)，对象类用 id；含 - 等特殊字符时用反引号，如 (a:`my-type`)。",
      "节点第一次出现必须写对象类；一个节点只能有一个对象类。",
      "关系写成 -[r:关系类]-> 或 <-[:关系类]-，必须且只能写一个关系类；不支持变长 [*1..3] 和双向 <-->。",
      "多条路径用逗号并列或写多个 MATCH，靠同名变量连起来。",
      "OPTIONAL MATCH 只能接在已经出现的节点上，走一条关系、引入一个新节点。",
    ],
    notes: ["", "一条连续的路径", "逗号并列的两条路径", "没有关联的 a 也会返回，n 为 0"],
  },
  {
    title: "WHERE 条件",
    rules: [
      "比较：= <> < <= > >=；不等于写 <>，不能写 !=。可以比较两个属性，如 a.x <> a.y。",
      "IN 后面是常量列表：a.code IN ['A', 'B']；列表里不能有 null。",
      "字符串：STARTS WITH、CONTAINS、ENDS WITH，右边只能是字符串常量。",
      "空值：IS NULL、IS NOT NULL；不能写 = null。",
      "组合：AND、OR、NOT 和括号；不支持 XOR 和 a < b < c 这样的连写。",
      "日期类型的属性可以和 date('2026-08-13')、datetime('2026-08-13T09:30:00') 比较；其他函数不支持。",
      "条件里不能用聚合（先 RETURN 再看结果）。",
    ],
    notes: ["", "", ""],
  },
  {
    title: "RETURN、聚合与排序",
    rules: [
      "可以返回节点、关系、属性（a.name），用 AS 起别名；不支持 RETURN * 和只返回常量。",
      "关系变量只能整体返回，不能取属性 r.x。",
      "聚合：count(*)、count(x)、count(DISTINCT a.p)、sum、avg、min、max、collect；聚合不能嵌套。",
      "RETURN DISTINCT 只用于属性；ORDER BY 按属性、聚合或返回列，不能按节点排序。",
    ],
    notes: ["", "", ""],
  },
  {
    title: "WITH",
    rules: [
      "WITH 只能往下传一个属性（WITH DISTINCT a.p AS v）或一个列表（WITH collect(a.p) AS vs），再接 MATCH。",
      "不能把聚合结果带到下一个 MATCH；用了 WITH 以后不能再返回整个节点。",
    ],
    notes: [""],
  },
  {
    title: "结果怎么显示",
    rules: [
      "返回节点或关系时画成图，也可以切到表格；没有节点和关系的结果只显示表格。",
      "虚拟边：每行返回 a AS source、'名称' AS relationType、b AS target，画成两端之间的橙色虚线。",
      "虚拟边上的数量取同行 collect 的节点个数、列表长度或第一个数字列；同一对节点的多行会累加。",
      "计算列：和一个节点同行返回的标量（如 count、sum）挂到该节点，在详情里查看，也可选作节点标题；多个节点时，列名写成「变量名_列名」才挂到对应节点，其余只在表格里。",
    ],
    notes: ["带数量的虚拟边", "节点加计算列"],
  },
  {
    title: "不支持",
    rules: [
      "UNION、UNWIND、CALL { } 子查询、EXISTS 子查询。",
      "CASE、列表推导、模式推导、除 date/datetime/localdatetime 外的函数、^ 乘方。",
      "变长路径、不写类型或写多个类型的关系、双向关系、一个节点多个对象类。",
      "对节点做 DISTINCT 或排序、条件里用聚合、按常量或条件排序、位置参数（用 $name）。",
    ],
  },
];
