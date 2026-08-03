/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export const homeZhCN = {
  home: {
    description: "OpenBKN 统一工作台，从这里进入知识建模、数据治理与能力编排。",
    greeting: {
      afternoon: "下午好，{{name}}",
      evening: "晚上好，{{name}}",
      morning: "早上好，{{name}}",
    },
    quickActions: {
      empty: "当前账号没有可用的模块入口，请联系管理员分配权限。",
      title: "快捷入口",
    },
    recent: {
      empty: "还没有最近访问记录，从上方入口开始工作后会出现在这里。",
      forget: "从最近访问中移除",
      kind: {
        "data-resource": "数据资源",
        "execution-unit": "执行单元",
        "knowledge-network": "知识网络",
      },
      title: "最近访问",
    },
    tagline: "统一工作台",
    title: "工作台",
  },
} as const;
