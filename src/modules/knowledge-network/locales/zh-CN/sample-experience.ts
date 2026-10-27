/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export const sampleExperiencePart = {
  sampleExperience: {
    title: "场景体验",
    expand: "展开场景体验",
    collapse: "收起场景体验",
    progress: "已完成 {{done}}/{{total}}",
    position: "第 {{current}} / {{total}} 题",
    businessDate: "参考答案基于样例冻结数据，业务日期为 {{date}}。",
    previous: "上一题",
    next: "下一题",
    try: "体验",
    skip: "跳过",
    showAnswer: "查看参考答案",
    referenceAnswer: "参考答案",
    referenceQuery: "参考查询",
    runReference: "运行参考查询",
    compareHint: "对照页面输出，结论是否与参考答案一致？",
    match: "一致",
    mismatch: "不一致",
    judgedMatch: "已确认：一致",
    judgedMismatch: "已确认：不一致",
    summary: "本页 {{total}} 题已全部体验：一致 {{matched}} 题，不一致 {{mismatched}} 题。",
    restart: "重新体验",
  },
} as const;
