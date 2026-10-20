/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/**
 * The Cypher the data query page can run: the read-only subset bkn-backend accepts
 * (`adp/bkn/bkn-backend/server/logics/cypher`), plus how the page shows the result.
 *
 * Every example was run against the live backend. Names are placeholders in the shape of a real
 * network (`ObjectType`, `RELATION`, `property`), so an example filled into the editor is a
 * starting point to rename, not a query that runs as it is.
 */

export type ReferenceExample = { query: string; note?: string };
export type ReferenceSection = {
  title: string;
  /** Plain lines; one rule each. */
  rules: string[];
  examples?: ReferenceExample[];
};

type Texts = { zh: string; en: string };
const pick = (texts: Texts, zh: boolean) => (zh ? texts.zh : texts.en);

type Section = { title: Texts; rules: Texts[]; examples?: { query: string; note?: Texts }[] };

const SECTIONS: Section[] = [
  {
    title: { zh: "查询结构", en: "Query shape" },
    rules: [
      {
        zh: "MATCH 模式 [WHERE 条件] RETURN 返回项 [ORDER BY …] [SKIP n] [LIMIT n]",
        en: "MATCH pattern [WHERE condition] RETURN items [ORDER BY …] [SKIP n] [LIMIT n]",
      },
      {
        zh: "只读：必须有 MATCH 和 RETURN；不能 CREATE、MERGE、SET、DELETE、REMOVE。",
        en: "Read-only: MATCH and RETURN are required; no CREATE, MERGE, SET, DELETE or REMOVE.",
      },
      {
        zh: "建议总写 LIMIT；SKIP 和 LIMIT 只接受非负整数。",
        en: "Always write a LIMIT; SKIP and LIMIT take a non-negative integer.",
      },
    ],
    examples: [{ query: "MATCH (a:ObjectType) RETURN a LIMIT 25" }],
  },
  {
    title: { zh: "节点与关系", en: "Nodes and relationships" },
    rules: [
      {
        zh: "节点写成 (变量:对象类)，对象类用 id；含 - 等特殊字符时用反引号，如 (a:`my-type`)。",
        en: "Write a node as (variable:ObjectType), by object type id; quote ids with special characters in backticks, as in (a:`my-type`).",
      },
      {
        zh: "节点第一次出现必须写对象类；一个节点只能有一个对象类。",
        en: "A node's first mention names its object type; a node has exactly one.",
      },
      {
        zh: "关系写成 -[r:关系类]-> 或 <-[:关系类]-，必须且只能写一个关系类；不支持变长 [*1..3] 和双向 <-->。",
        en: "Write a relationship as -[r:RELATION]-> or <-[:RELATION]-, naming exactly one relation type; no variable length [*1..3] and no <-->.",
      },
      {
        zh: "多条路径用逗号并列或写多个 MATCH，靠同名变量连起来。",
        en: "Join several paths with commas or more MATCH clauses, linked by shared variables.",
      },
      {
        zh: "OPTIONAL MATCH 只能接在已经出现的节点上，走一条关系、引入一个新节点。",
        en: "OPTIONAL MATCH must start from a node already matched and follow one relationship to one new node.",
      },
    ],
    examples: [
      { query: "MATCH (a:ObjectType)-[r:RELATION]->(b:OtherType) RETURN a, r, b LIMIT 25" },
      {
        query:
          "MATCH (a:ObjectType)<-[:RELATION_A]-(b:OtherType)-[:RELATION_B]->(c:ThirdType)\nRETURN a, b, c LIMIT 25",
        note: { zh: "一条连续的路径", en: "One continuous path" },
      },
      {
        query:
          "MATCH (a:ObjectType)<-[:RELATION_A]-(b:OtherType), (b)-[:RELATION_B]->(c:ThirdType)\nRETURN a, c LIMIT 25",
        note: { zh: "逗号并列的两条路径", en: "Two paths joined by a comma" },
      },
      {
        query:
          "MATCH (a:ObjectType)\nOPTIONAL MATCH (a)<-[:RELATION]-(b:OtherType)\nRETURN a, count(b) AS n LIMIT 25",
        note: {
          zh: "没有关联的 a 也会返回，n 为 0",
          en: "Returns every a, with n = 0 where nothing is linked",
        },
      },
    ],
  },
  {
    title: { zh: "WHERE 条件", en: "WHERE conditions" },
    rules: [
      {
        zh: "比较：= <> < <= > >=；不等于写 <>，不能写 !=。可以比较两个属性，如 a.x <> a.y。",
        en: "Compare with = <> < <= > >=; not-equal is <>, never !=. Two properties can be compared, as in a.x <> a.y.",
      },
      {
        zh: "IN 后面是常量列表：a.code IN ['A', 'B']；列表里不能有 null。",
        en: "IN takes a literal list: a.code IN ['A', 'B']; no null in the list.",
      },
      {
        zh: "字符串：STARTS WITH、CONTAINS、ENDS WITH，右边只能是字符串常量。",
        en: "Strings: STARTS WITH, CONTAINS, ENDS WITH, against a string literal only.",
      },
      {
        zh: "空值：IS NULL、IS NOT NULL；不能写 = null。",
        en: "Nulls: IS NULL, IS NOT NULL; never = null.",
      },
      {
        zh: "组合：AND、OR、NOT 和括号；不支持 XOR 和 a < b < c 这样的连写。",
        en: "Combine with AND, OR, NOT and parentheses; no XOR and no chained a < b < c.",
      },
      {
        zh: "日期类型的属性可以和 date('2026-08-13')、datetime('2026-08-13T09:30:00') 比较；其他函数不支持。",
        en: "Date-typed properties compare with date('2026-08-13') or datetime('2026-08-13T09:30:00'); no other functions.",
      },
      {
        zh: "条件里不能用聚合（先 RETURN 再看结果）。",
        en: "No aggregates in a condition.",
      },
    ],
    examples: [
      {
        query:
          "MATCH (a:ObjectType)\nWHERE a.status <> 'closed' AND a.code IN ['A', 'B']\nRETURN a LIMIT 25",
      },
      {
        query:
          "MATCH (a:ObjectType)\nWHERE a.name STARTS WITH 'Bra' OR a.name CONTAINS 'many'\nRETURN a LIMIT 25",
      },
      {
        query:
          "MATCH (a:ObjectType) WHERE a.amount > 80 AND a.owner IS NOT NULL RETURN count(*) AS n",
      },
    ],
  },
  {
    title: { zh: "RETURN、聚合与排序", en: "RETURN, aggregates and ordering" },
    rules: [
      {
        zh: "可以返回节点、关系、属性（a.name），用 AS 起别名；不支持 RETURN * 和只返回常量。",
        en: "Return nodes, relationships or properties (a.name), renamed with AS; no RETURN * and no bare constants.",
      },
      {
        zh: "关系变量只能整体返回，不能取属性 r.x。",
        en: "A relationship variable is returned whole; no r.x.",
      },
      {
        zh: "聚合：count(*)、count(x)、count(DISTINCT a.p)、sum、avg、min、max、collect；聚合不能嵌套。",
        en: "Aggregates: count(*), count(x), count(DISTINCT a.p), sum, avg, min, max, collect; no nesting.",
      },
      {
        zh: "RETURN DISTINCT 只用于属性；ORDER BY 按属性、聚合或返回列，不能按节点排序。",
        en: "RETURN DISTINCT works on properties; ORDER BY a property, an aggregate or a returned column, never a node.",
      },
    ],
    examples: [
      {
        query:
          "MATCH (a:ObjectType)<-[:RELATION]-(b:OtherType)\nRETURN a, count(b) AS n, count(DISTINCT b.owner) AS owners, max(b.amount) AS top\nLIMIT 25",
      },
      {
        query:
          "MATCH (a:ObjectType)<-[:RELATION]-(b:OtherType)\nRETURN a.name AS name, count(b) AS n\nORDER BY n DESC SKIP 5 LIMIT 5",
      },
      {
        query:
          "MATCH (a:ObjectType)<-[:RELATION]-(b:OtherType) RETURN a, collect(b.id) AS ids LIMIT 25",
      },
    ],
  },
  {
    title: { zh: "WITH", en: "WITH" },
    rules: [
      {
        zh: "WITH 只能往下传一个属性（WITH DISTINCT a.p AS v）或一个列表（WITH collect(a.p) AS vs），再接 MATCH。",
        en: "WITH passes on one property (WITH DISTINCT a.p AS v) or one list (WITH collect(a.p) AS vs) to the next MATCH.",
      },
      {
        zh: "不能把聚合结果带到下一个 MATCH；用了 WITH 以后不能再返回整个节点。",
        en: "An aggregate cannot be carried into the next MATCH, and a query with WITH cannot return whole nodes.",
      },
    ],
    examples: [
      {
        query:
          "MATCH (a:ObjectType) WHERE a.name = 'X'\nWITH collect(a.id) AS ids\nMATCH (b:OtherType) WHERE b.owner_id IN ids\nRETURN count(*) AS n",
      },
    ],
  },
  {
    title: { zh: "结果怎么显示", en: "How results show" },
    rules: [
      {
        zh: "返回节点或关系时画成图，也可以切到表格；没有节点和关系的结果只显示表格。",
        en: "A result with nodes or relationships draws as a graph, with a table beside it; one without them shows as a table.",
      },
      {
        zh: "虚拟边：每行返回 a AS source、'名称' AS relationType、b AS target，画成两端之间的橙色虚线。",
        en: "Derived edge: return a AS source, 'NAME' AS relationType, b AS target per row, drawn as an orange dashed line between the two.",
      },
      {
        zh: "虚拟边上的数量取同行 collect 的节点个数、列表长度或第一个数字列；同一对节点的多行会累加。",
        en: "Its count is the nodes collected in the row, a list's length or the first number column; rows for the same pair add up.",
      },
      {
        zh: "计算列：和一个节点同行返回的标量（如 count、sum）挂到该节点，在详情里查看，也可选作节点标题；多个节点时，列名写成「变量名_列名」才挂到对应节点，其余只在表格里。",
        en: 'Computed columns: scalars returned beside one node (count, sum and the like) stay with it, readable in its details and usable as its caption; with several nodes, name a column "<variable>_<name>" to attach it, the rest stay in the table.',
      },
    ],
    examples: [
      {
        query:
          "MATCH (a:ObjectType)<-[:RELATION_A]-(b:OtherType)-[:RELATION_B]->(c:ThirdType)\nRETURN a AS source, 'LINKED_TO' AS relationType, c AS target, count(b) AS n\nLIMIT 25",
        note: { zh: "带数量的虚拟边", en: "Derived edge with a count" },
      },
      {
        query:
          "MATCH (a:ObjectType)<-[:RELATION]-(b:OtherType)\nRETURN a, count(b) AS n, max(b.amount) AS top\nORDER BY n DESC LIMIT 25",
        note: { zh: "节点加计算列", en: "Nodes with computed columns" },
      },
    ],
  },
  {
    title: { zh: "不支持", en: "Not supported" },
    rules: [
      {
        zh: "UNION、UNWIND、CALL { } 子查询、EXISTS 子查询。",
        en: "UNION, UNWIND, CALL { } subqueries, EXISTS subqueries.",
      },
      {
        zh: "CASE、列表推导、模式推导、除 date/datetime/localdatetime 外的函数、^ 乘方。",
        en: "CASE, list and pattern comprehensions, functions other than date/datetime/localdatetime, ^.",
      },
      {
        zh: "变长路径、不写类型或写多个类型的关系、双向关系、一个节点多个对象类。",
        en: "Variable-length paths, relationships with no or several types, two-way relationships, several labels on a node.",
      },
      {
        zh: "对节点做 DISTINCT 或排序、条件里用聚合、按常量或条件排序、位置参数（用 $name）。",
        en: "DISTINCT or ORDER BY on nodes, aggregates in conditions, ordering by a constant or condition, positional parameters (use $name).",
      },
    ],
  },
];

/** The reference in the reader's language. */
export function cypherReference(language: string): ReferenceSection[] {
  const zh = language.toLowerCase().startsWith("zh");
  return SECTIONS.map((section) => ({
    title: pick(section.title, zh),
    rules: section.rules.map((rule) => pick(rule, zh)),
    ...(section.examples
      ? {
          examples: section.examples.map((example) => ({
            query: example.query,
            ...(example.note ? { note: pick(example.note, zh) } : {}),
          })),
        }
      : {}),
  }));
}
