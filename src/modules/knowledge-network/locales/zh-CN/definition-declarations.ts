/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export const definitionDeclarationsPart = {
  definitionDeclarations: {
    aliasProblem: {
      comma: "别名「{{alias}}」不能含逗号",
      duplicate: "别名「{{alias}}」重复",
      empty: "别名不能为空",
      otherProperty: "别名「{{alias}}」是 {{property}} 的名称",
      ownName: "别名「{{alias}}」与名称相同",
      tooLong: "别名「{{alias}}」超过 {{max}} 个字符",
      tooMany: "别名至多 {{max}} 个",
    },
    aliases: "别名",
    aliasesHint:
      "其他叫法，如简称、旧称、英文名，用于概念召回和理解问题。至多 {{max}} 个，每个至多 {{length}} 个字符，按回车或逗号分隔。",
    aliasesPlaceholder: "输入后按回车",
    banner: {
      action_type: "此行动类已弃用：{{reason}}",
      object_type: "此对象类已弃用：{{reason}}",
      relation_type: "此关系类已弃用：{{reason}}",
    },
    bannerReplacedBy: "请改用",
    deleteRefused: {
      references: "引用它的定义",
      title: "不能删除「{{name}}」",
    },
    deprecatedTag: "已弃用",
    kind: {
      action_type: "行动类",
      object_type: "对象类",
      relation_type: "关系类",
    },
    noAliases: "暂无别名",
    lifecycle: "生命周期",
    lifecycleHint: "已弃用的定义照常可以查看、编辑和查询，只是不再被概念召回。",
    lifecycleOption: {
      active: "使用中",
      deprecated: "已弃用",
    },
    reason: "弃用原因",
    reasonPlaceholder: "说明为什么不再使用，以及该怎么做",
    reasonRequired: "请填写弃用原因",
    refusalOpen: "查看{{kind}} {{id}}",
    refusalTitle: "后端没有接受这些声明：{{description}}",
    replacedBy: "替代定义",
    replacedByHint: "可选。只能选同类中仍在使用的定义。",
    replacedByMissing: "{{id}}（不存在或无权查看）",
    replacedByPlaceholder: "搜索名称",
  },
} as const;
