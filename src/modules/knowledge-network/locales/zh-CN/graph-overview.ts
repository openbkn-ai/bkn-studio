/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export const graphOverviewPart = {
  graphOverview: {
    title: "全览",
    description: "一次画出知识网络的实例与关系，看整体结构",
    openAction: "全览",
    summary: {
      complete: "{{nodes}} 实例 · {{edges}} 关系",
      sampled: "{{nodes}}/{{totalNodes}} 实例 · {{edges}}/{{totalEdges}} 关系",
      limitedByNodes: "实例超过 {{limit}} 个，按关系轮流取样，优先保证每种关系都有代表",
      limitedByEdges: "关系超过 {{limit}} 条，按关系轮流取样，优先保证每种关系都有代表",
      cached: "上次加载于 {{time}}",
    },
    types: {
      toggle: "对象类 {{count}}",
      toggle_one: "对象类 {{count}}",
      toggle_other: "对象类 {{count}}",
      toggleHidden: "对象类 {{count}} · 隐藏 {{hidden}}",
      toggleHidden_one: "对象类 {{count}} · 隐藏 {{hidden}}",
      toggleHidden_other: "对象类 {{count}} · 隐藏 {{hidden}}",
      hide: "隐藏该类",
      show: "显示该类",
      only: "只看该类",
      all: "显示全部",
      pick: "选中该类实例",
    },
    search: "按名称查找实例",
    handOver: {
      tip: "把选中的实例带到新页面继续查看",
      empty: "点击一个实例（连同邻居），或 Shift + 拖动框选",
      tooMany: "一次最多带 {{limit}} 个实例，请缩小选择",
    },
    drawer: {
      title: "实例属性",
      close: "关闭",
      instanceId: "实例 ID",
      empty: "没有属性",
    },
    layout: {
      run: "重新布局",
      stop: "停止布局",
    },
    neighbours: {
      title: "{{name}} · {{count}} 个邻居",
      more: "另有 {{count}} 种关系",
      more_one: "另有 {{count}} 种关系",
      more_other: "另有 {{count}} 种关系",
    },
    limit: {
      option: "上限 {{value}} 点",
      tip: "最多画多少个实例；换了会重新加载",
    },
    fit: "适配视图",
    reload: "刷新",
    stop: "停止",
    progress: "已取 {{nodes}} 个实例 · {{edges}} 条关系 · 正在读取 {{current}}",
    counting: "总数",
    failed: "加载失败",
    partialFailureLine: "{{count}} 项未读到：{{names}}",
    saturatedLine: "{{count}} 种关系只读了一页：{{names}}",
    noWebgl:
      "浏览器当前无法使用 WebGL，画不出全览。请重启浏览器，或在 chrome://gpu 查看 WebGL 是否被停用",
    empty: "该网络还没有可显示的实例",
    hint: "滚轮缩放 · 点击查看邻居 · Shift + 拖动框选 · Esc 取消",
    back: "返回",
    hint3d: "拖动旋转 · 右键拖动平移 · 滚轮缩放 · 点击查看邻居 · Esc 取消；3D 最多画前 20000 个点",
  },
};
