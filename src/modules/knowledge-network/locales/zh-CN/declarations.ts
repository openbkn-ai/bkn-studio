/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export const declarationsPart = {
  declarations: {
    field: {
      aliases: "别名",
      cardinality: "基数",
      constraints: "取值约束",
      fallback_for: "替代路径",
      importance: "重要程度",
      lifecycle: "生命周期",
      properties: "关系属性",
      required: "必填",
      reverse_name: "反向名称",
      semantic: "语义",
      verification: "关联依据",
    },
    kind: {
      action_type: "行动类",
      object_type: "对象类",
      relation_type: "关系类",
    },
    listSeparator: "、",
    cleared: {
      confirm: "清除声明并导入",
      definition: "{{kind}} · {{name}}",
      description:
        "导入的文件没有携带以下声明，例如 2.x 包或旧版 JSON 导出。继续导入会清除它们，此操作无法撤销。想保留这些声明，请取消后改用 3.0 包导入。",
      empty: "后端没有列出具体会清除哪些声明。",
      moreProperties: "另有 {{count}} 个属性，展开查看",
      moreProperties_one: "另有 {{count}} 个属性，展开查看",
      moreProperties_other: "另有 {{count}} 个属性，展开查看",
      ownFields: "{{kind}}本身：{{fields}}",
      propertyFields: "{{property}}：{{fields}}",
      title: "覆盖会清除已有的声明",
    },
    exportRefused: {
      checkDescription:
        "以下参数的取值来源写在了旧位置，3.0 包不接受这种写法。可以先到对应定义中修正后再导出，也可以按 2.x 导出；2.x 包不包含 3.0 声明。",
      checkTitle: "需要先处理参数才能按 3.0 导出",
      exportV2: "导出为 2.x",
      notReadableDescription:
        "写出的 3.0 包没有通过 3.0 规则的回读检查，原因如下。可以按 2.x 导出；2.x 包不包含 3.0 声明。",
      notReadableTitle: "无法按 3.0 导出",
    },
    networkCheck: {
      action: "网络体检",
      clean: "没有发现问题",
      cleanDescription: "行动类和逻辑属性的参数写法都正确。",
      close: "关闭",
      columnCurrent: "当前写法",
      columnOwner: "所属定义",
      columnParameter: "参数",
      columnSuggested: "建议写法",
      conflict: "会覆盖已有值",
      description:
        "以下参数的取值来源写法有误：执行时会被忽略，按 3.0 导出也会被拒绝。请到所属定义中修正。",
      invalidHint: "无效参数没有建议写法，取值来源只能是属性、输入或常量，需要手工修正。",
      invalidTitle: "无效参数（{{total}}）",
      loadFailed: "体检没有完成",
      logicProperty: "逻辑属性 {{name}}",
      misplacedTitle: "错位参数（{{total}}）",
      recheck: "重新检查",
      title: "网络体检 · {{name}}",
    },
  },
} as const;
