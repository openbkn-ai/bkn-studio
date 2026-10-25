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
      "MATCH 模式 [WHERE 条件] RETURN 返回项 [ORDER BY …] [SKIP n] [LIMIT n]；可以用 WITH ['a', 'b'] AS codes 开头定义常量，供后面的条件使用。",
      "只读：必须有 RETURN；不能 CREATE、MERGE、SET、DELETE、REMOVE。",
      "不写 LIMIT 时最多返回 1000 行，返回满时状态栏会提示可能还有更多；LIMIT 上限 10000；一条查询最多 8 条关系、9 个节点。",
    ],
    notes: ["", "开头定义常量"],
  },
  {
    title: "节点与关系",
    rules: [
      "节点写成 (变量:对象类)，对象类用 id；含 - 等特殊字符时用反引号，如 (a:`my-type`)。节点第一次出现必须写对象类，可带内联属性 {prop: value}。",
      "关系写成 -[r:关系类]->、<-[r:关系类]- 或无向 -[r:关系类]-，必须且只能写一个关系类。给关系起变量名并在 RETURN 里返回，图上才有连线。",
      "多条路径用逗号并列或写多个 MATCH，同名变量指同一个节点；不共享变量的路径会两两组合。有两部分既没连起来、又都没有任何条件时会被拒，请用关系类或 a.code = b.code 这类相等条件连起来，或给其中一边加条件。",
      "OPTIONAL MATCH 写一条关系，把一个新节点挂到前面已经找到的节点上：匹配不到时这一行保留，新节点为空。它引入的节点不能再被后面的 MATCH 或 WHERE 要求。",
    ],
    notes: [
      "",
      "内联属性定位一个对象",
      "一条连续的路径，关系都带变量",
      "逗号并列的两条路径",
      "没有关联的 a 也会返回，n 为 0",
    ],
  },
  {
    title: "WHERE 条件",
    rules: [
      "比较：= <> < <= > >=；不等于写 <>（!= 也接受）。两边可以都是属性，如 a.x <> a.y，也可以写算术，如 a.amount * a.rate > 100。",
      "IN 后面是列表：a.code IN ['A', 'B']，或用参数 IN $list。",
      "字符串：STARTS WITH、CONTAINS、ENDS WITH，只用于字符串属性，按字面子串匹配，% 和 _ 不是通配符。",
      "空值：IS NULL、IS NOT NULL；不能写 = null。",
      "组合：AND、OR、NOT 和括号；不支持 XOR。日期写 date('2026-08-13')。",
    ],
    notes: ["", "", ""],
  },
  {
    title: "RETURN、聚合与排序",
    rules: [
      "可以返回节点、关系、属性（a.name），用 AS 起别名；条件也能作为一列，值为 true、false 或空。",
      "聚合：count(*)、count(x)、count(DISTINCT a.p)、sum、avg、min、max。没有 GROUP BY，按 RETURN 里的其余列自动分组。",
      "collect(x) 把每组收成列表，{k: v} 构造映射；collect 不能和 count、sum 等聚合同时返回，计数请单独查。",
      "算术 + - * / %：两个整数相除会被拒，要小数时一边乘 1.0；% 只用于整数。",
      "CASE WHEN … THEN … ELSE … END 和 coalesce(a, b)：各分支要么都是数字，要么都不是。",
      "DISTINCT 和 ORDER BY 只用于属性、聚合或返回列，不用于节点和关系本身；节点和关系本来就按身份去重。聚合或 DISTINCT 之后只能按返回的值排序。",
      "UNION ALL 把几段查询的结果接在一起，UNION 还会去掉重复的行，两者不能混用：每段返回同样的列（名称和顺序一致，用 AS 对齐），可以各带 ORDER BY、LIMIT，只能返回值，不能返回节点、关系和 collect。",
    ],
    notes: ["", "", "CASE 分类计数和算术比例", "", "UNION ALL 并列两段计数"],
  },
  {
    title: "WITH",
    rules: [
      "聚合后过滤：放在所有 MATCH 之后，如 WITH a, count(*) AS n WHERE n > 100，再 RETURN；后面可以再接 WITH 计算和过滤，只有第一个 WITH 能聚合（比较两个列表时第二个 WITH 的 collect 除外）。聚合的 WITH 之后，RETURN 也可以只写 count(*) 等聚合，对分组再统计，返回一行。",
      "WITH 之后，RETURN 可以直接返回传下来的节点，例如把过滤后的分组画成虚拟边。",
      "把一个属性的值传给下一个 MATCH：WITH DISTINCT a.p AS v（或 collect(a.p) AS vs），再接 MATCH … WHERE b.q = v（或 b.q IN vs）；之后不能再接 WITH。",
      "比较两个列表（和上一条按值过滤是两种不同的写法）：两段各自 collect 一个属性，第二个 WITH 把第一个列表传下去，并 collect 第二个列表；RETURN 只写 size(l1)、size(l2) 和共有元素个数 size([x IN l1 WHERE x IN l2])，返回一行，不能返回列表本身。",
      "把节点传给下一个 MATCH：WITH a, count(b) AS total，再接 MATCH (a)-…，第二段可以再聚合，RETURN 和 ORDER BY 可以用 total；查询含聚合时，用到 total 就要把它也作为单独一列返回。WITH 不聚合时，每个节点按匹配到的行数重复传下去，计数会成倍增加。",
    ],
    notes: [
      "聚合后过滤",
      "把值传给下一个 MATCH",
      "比较两个列表",
      "把节点传给下一个 MATCH，画成带数量的虚拟边",
    ],
  },
  {
    title: "结果怎么显示",
    rules: [
      "返回节点或关系时画成图，也可以切到表格；没有节点和关系的结果只显示表格。只返回节点、没返回关系时，图上没有连线。",
      "虚拟边：每行返回 a AS source、'名称' AS relationType、b AS target，画成两端之间的橙色虚线。",
      "虚拟边的一端也可以是一个值（如 b.status AS target），画成空心虚线的值节点：同一名称下相同的值是同一个节点，节点按值归类；两端都是值的行不画。",
      "虚拟边上的数量取同行 collect 的节点个数（如 collect({via: c}) AS evidence）、列表长度或第一个数字列；同一对节点的多行会累加。",
      "计算列：和一个节点同行返回的标量（如 count、sum）挂到该节点，在详情里查看，也可选作节点标题；多个节点时，列名写成「变量名_列名」才挂到对应节点，其余只在表格里。",
    ],
    notes: ["带数量的虚拟边", "带证据的虚拟边", "按值归类的虚拟边", "节点加计算列"],
  },
  {
    title: "执行计划",
    rules: [
      "在查询前加 EXPLAIN，或点「执行计划」：只检查和规划查询，不读数据。结果列出查询形式、节点、关系、条件、分组、返回列、排序、最多返回的行数、会读的属性和提醒。",
      "写错时的报错和改法与真正执行时相同；带 WITH、多段 MATCH 或多跳的查询，可以先看一眼计划再执行。",
      "提醒会指出：模式里有没被关系、共享节点或 a.code = b.code 这类相等条件连起来的部分（结果会两两组合）；没写 LIMIT 时最多返回 1000 行；行范围被你的访问权限收窄；collect 的证据达到 10000 行会被拒。",
      "执行计划看不出对象类的数据存在哪里：下一节里数据集上不支持的写法，执行计划照样通过，执行时才被拒。",
    ],
    notes: ["先看计划再执行"],
  },
  {
    title: "数据集和索引上的对象类",
    rules: [
      "对象类绑定的是数据集或索引（不是 SQL 数据源），或一条查询跨多个数据源时，服务端逐个对象类读取数据，再在内存里关联，只支持基础写法。",
      "可以用：MATCH、多跳、OPTIONAL MATCH；WHERE；返回属性和聚合，ORDER BY、SKIP、LIMIT；WITH 聚合后过滤、按上一段的值过滤；返回节点、关系和虚拟边，和 SQL 数据源上一样画图；UNION / UNION ALL，每段各自读取。",
      "会被拒：CASE、coalesce；对分组再统计、比较两个列表、把节点传给下一个 MATCH；collect。",
      "要读的数据太多或超时会被拒（ReadBudgetExceeded），加条件或 LIMIT 缩小范围。只有关系类能按键关联：只靠 a.code = b.code 这类相等条件连起来的两个节点会先全部读出再两两组合，容易超限，执行计划也不会提醒。",
    ],
    notes: ["数据集上可用：过滤、分组和排序"],
  },
  {
    title: "不支持",
    rules: [
      "UNWIND、变长路径 [:R*1..3]、XOR、乘方 ^、关系属性 r.x。",
      "date() / datetime() / localdatetime()、coalesce()、size()（只用于 WITH 收集的列表）和聚合以外的函数调用。",
      "第二个 WITH 之后再 MATCH；做过聚合的 WITH 之后再 collect（比较两个列表时第二个 WITH 的 collect 除外）。",
      "对节点或关系用 DISTINCT（RETURN DISTINCT n、collect(DISTINCT n)）、按节点或关系排序；collect 与 count、sum 等聚合同时返回。",
    ],
  },
];
