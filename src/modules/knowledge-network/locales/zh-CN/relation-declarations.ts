/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export const relationDeclarationsPart = {
  relationDeclarations: {
    cardinality: "关系基数",
    cardinalityHint: "从起点到终点，每端的一个实例对应几个对端。",
    cardinalityOption: {
      manyToMany: "多对多",
      manyToOne: "多对一",
      oneToMany: "一对多",
      oneToOne: "一对一",
    },
    characteristic: {
      symmetric: "对称",
      transitive: "传递",
    },
    characteristicHint: {
      symmetric: "A 与 B 有这条关系，则 B 与 A 也有",
      transitive: "A→B、B→C 成立，则 A→C 成立",
    },
    characteristics: "特性",
    characteristicsHint: "只用于起点与终点为同一对象类的关系。数据只存直接的边，使用方按特性展开。",
    cleared: {
      ends: "起点与终点不再是同一对象类，清除了特性。",
      symmetric: "对称关系没有方向，清除了{{names}}。",
    },
    clearedName: {
      cardinality: "一对多或多对一的关系基数",
      characteristics: "特性",
      requiredEnds: "只选一端的必有端",
      reverseName: "反向名称",
    },
    count: {
      atLeastOne: "一个 <from/> 至少对应一个 <to/>",
      atMostOne: "一个 <from/> 最多对应一个 <to/>",
      exactlyOne: "一个 <from/> 对应一个 <to/>",
      oneOrMore: "一个 <from/> 对应一个或多个 <to/>",
      several: "一个 <from/> 可对应多个 <to/>",
    },
    fallbackFor: "替代路径",
    fallbackForHint:
      "起点实例沿所选主要关系没有对端时，由本关系给出对端。候选为起点、终点相同的主要关系。",
    fallbackForMissing: "{{id}}（不在候选中）",
    fallbackForOption: "{{name}}（{{id}}）",
    fallbackForNone: "不作为替代路径",
    fallbackPaths: "以本关系为主关系的替代路径",
    importance: "重要程度",
    importanceHint: "辅助关系在主要关系答不了、或问题明确涉及时才使用。",
    importanceOption: {
      primary: "主要",
      secondary: "辅助",
    },
    listTag: {
      fallbackFor: "替代：{{name}}",
      secondary: "辅助",
      unconfirmed: "规则推测",
    },
    mappingChange: {
      resourceKept_one:
        "{{count}} 个关系属性按列名读取。更换后，它读取「{{resource}}」中的同名列。",
      resourceKept_other:
        "{{count}} 个关系属性按列名读取。更换后，它们读取「{{resource}}」中的同名列。",
      resourceMissing:
        "关系属性 {{names}} 读取的列在「{{resource}}」中没有，保存会被拒绝。关系属性暂不能在 Studio 中编辑。",
      resourceOk: "更换",
      resourceTitle: "更换中间资源？",
      toDirect_one: "这个关系有 {{count}} 个关系属性，改为直接关系后将被删除。",
      toDirect_other: "这个关系有 {{count}} 个关系属性，改为直接关系后将被删除。",
      toDirectOk: "改为直接关系",
      toDirectTitle: "改为直接关系？",
    },
    notDeclared: "未声明",
    relationProperties_one: "关系属性：{{count}} 个",
    relationProperties_other: "关系属性：{{count}} 个",
    relationPropertiesHint: "关系属性暂不能在 Studio 中编辑，保存关系类时保持不变。",
    requiredBoth: "两端都必有",
    requiredEndOption: {
      source: "{{name}}（起点）",
      target: "{{name}}（终点）",
    },
    requiredEndsHint: "勾选的一端，每个实例都至少有一个对端。",
    requiredEnd: {
      source: "每个{{source}}至少有一个{{target}}",
      target: "每个{{target}}至少有一个{{source}}",
    },
    requiredEnds: "必有端",
    reverseName: "反向名称",
    reverseNameHint: "从终点看向起点时的名称。正向为「{{name}}」。",
    sentenceEnd: "。",
    sentenceSeparator: "；",
    separator: "、",
    title: "关系声明",
    verification: "关联依据",
    verificationOption: {
      confirmed: "真实标识",
      none: "未声明",
      unconfirmed: "规则推测",
    },
    verificationHint: {
      confirmed: "按外键或业务 ID 关联",
      unconfirmed: "按规则推测关联，结果标为待确认",
    },
    verificationShort: {
      confirmed: "真实标识",
      unconfirmed: "规则推测",
    },
  },
} as const;
