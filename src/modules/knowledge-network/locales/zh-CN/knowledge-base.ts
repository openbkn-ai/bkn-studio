/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export const knowledgeBasePart = {
  workspaceKnowledgeBases: "知识库",
  knowledgeBasesDescription: "挂载知识库后，这个知识网络可以检索其中的文档。",
  knowledgeBasesTitle: "知识库",
  knowledgeBasesUsageTip:
    "挂载后，知识网络回答问题时可以检索这些知识库里的文档。只能挂载你有查询权限的知识库；知识库本身仍在知识库里管理。",
  knowledgeBasesMount: "挂载知识库",
  knowledgeBasesRefresh: "刷新",
  knowledgeBasesEmpty: "还没有挂载知识库",
  knowledgeBasesEmptyDescription: "挂载后，这个知识网络可以检索知识库里的文档。",
  knowledgeBasesNoVisible: "这个知识网络还没有挂载知识库。",
  knowledgeBasesColumnName: "知识库",
  knowledgeBasesColumnStatus: "状态",
  knowledgeBasesColumnMountTime: "挂载时间",
  knowledgeBasesColumnMountedBy: "挂载人",
  knowledgeBasesColumnActions: "操作",
  knowledgeBasesStatusReady: "可检索",
  knowledgeBasesStatusMissing: "已失效",
  knowledgeBasesStatusMissingHint:
    "这个知识库已被删除，或当前部署没有知识库服务。检索时会跳过它，可以解除挂载。",
  knowledgeBasesMissingName: "已不存在的知识库",
  knowledgeBasesDetach: "解除挂载",
  knowledgeBasesDetachAction: "解除挂载「{{name}}」",
  knowledgeBasesDetachConfirmTitle: "解除挂载这个知识库？",
  knowledgeBasesDetachConfirmContent:
    "解除后，这个知识网络不再检索它。知识库本身和其中的文档不受影响。",
  knowledgeBasesDetachSuccess: "已解除挂载。",
  knowledgeBasesLoadFailed: "已挂载的知识库暂时读取不到",
  knowledgeBasesNotSupportedTitle: "当前部署没有知识库服务",
  knowledgeBasesNotSupportedDescription: "安装并启用知识库服务后，才能挂载知识库。",
  knowledgeBasesFailure: {
    gone: "所选的知识库已不存在，请刷新后重新选择。",
    noPermission: "你对所选的知识库没有查询权限，申请通过后再挂载。",
    notSupported: "当前部署没有知识库服务，暂时不能挂载知识库。",
    unavailable: "知识库服务暂时没有响应，请稍后重试。",
    other: "没有完成，请稍后重试。",
  },
  knowledgeBasesPicker: {
    title: "挂载知识库",
    search: "按名称搜索知识库",
    hint: "只列出你有查询权限的知识库。",
    mounted: "已挂载",
    documents: "{{count}} 篇文档",
    documents_one: "{{count}} 篇文档",
    documents_other: "{{count}} 篇文档",
    none: "没有你可以查询的知识库。需要先获得知识库的查询权限。",
    noMatch: "没有名称包含「{{keyword}}」的知识库。",
    loadFailed: "知识库列表暂时读取不到",
    confirm: "挂载",
    success: "已挂载 {{count}} 个知识库。",
    success_one: "已挂载 {{count}} 个知识库。",
    success_other: "已挂载 {{count}} 个知识库。",
    nothingNew: "所选的知识库都已挂载。",
    requestFor: "申请「{{name}}」的查询权限：",
  },
  knowledgeBasesPreview: {
    contracts: "供应商合同",
    incidents: "交付异常报告",
    manuals: "产品手册",
  },
} as const;
