/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { test } from "vitest";

const prototypePath = path.resolve("public/bkn-trace-0.1.4-prototype.html");
const html = await readFile(prototypePath, "utf8");
const logsPrototypePath = path.resolve("public/openbkn-logs-0.1.4-prototype.html");
const logsHtml = await readFile(logsPrototypePath, "utf8");

test("综合原型内联 JavaScript 语法有效", () => {
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1]);
  assert.ok(scripts.length > 0);
  scripts.forEach((source) => new vm.Script(source));
});

test("日志原型内联 JavaScript 语法有效", () => {
  const scripts = [...logsHtml.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1]);
  assert.ok(scripts.length > 0);
  scripts.forEach((source) => new vm.Script(source));
});

test("日志详情使用贴右限高面板并仅滚动正文", () => {
  assert.match(logsHtml, /\.detail\{[^}]*right:24px[^}]*width:min\(420px,calc\(100vw - 48px\)\)[^}]*max-height:min\(620px,calc\(100vh - 120px\)\)/);
  assert.match(logsHtml, /\.detail-head\{[^}]*flex:0 0 auto/);
  assert.match(logsHtml, /\.detail-body\{[^}]*flex:1 1 auto[^}]*overflow-y:auto/);
});

test("日志工作台使用标准内容宽度和条件式两行全文预览", () => {
  assert.doesNotMatch(logsHtml, /max-width:1680px/);
  assert.match(logsHtml, /grid-template-columns:264px minmax\(0,1fr\)/);
  assert.match(logsHtml, /\.clamp-2\{[^}]*-webkit-line-clamp:2/);
  assert.match(logsHtml, /id="cell-hover-preview"/);
  assert.match(logsHtml, /scrollHeight>[^;]*clientHeight/);
  assert.match(logsHtml, /scrollWidth>[^;]*clientWidth/);
});

test("业务溯源原型不把缺失事实包装为完整证据", () => {
  assert.match(html, />业务溯源</);
  assert.match(html, /部分可溯源/);
  assert.match(html, /Evidence Completeness: partial/);
  assert.doesNotMatch(html, /新版业务溯源分析/);
  assert.doesNotMatch(html, /Evidence Completeness: complete/);
  assert.doesNotMatch(html, /完整可溯源/);
});

test("业务调用详情分离动作、业务元素、调用方式和实际结果", () => {
  assert.match(html, /<h3>做了什么<\/h3>/);
  assert.match(html, /<h3>操作哪个业务元素<\/h3>/);
  assert.match(html, /<h3>怎么调用<\/h3>/);
  assert.match(html, /<h3>实际结果<\/h3>/);
  assert.match(html, /<h3>链路解释<\/h3>/);
  assert.match(html, /derivedEvidence:\["I1-O4","I1-O5"\]/);
  assert.match(html, /当前事实未提供源 BKN 属性绑定/);
});

test("知识网络视图消费结构化关系且 Trace 与未关联调用分开", () => {
  assert.match(html, /source:"采购订单",target:"供应商"/);
  assert.doesNotMatch(html, /split\("关联"\)/);
  assert.match(html, /technicalTraceGroups/);
  assert.match(html, /reduce\(\(groups,item\)/);
  assert.match(html, /共 1 条 Trace/);
  assert.match(html, /未关联调用记录/);
});

test("Agent 建议原型明确缺少核验证据而不补造", () => {
  assert.match(html, /核验证据：not_evaluable/);
  assert.match(html, /原型未执行 Trace 接口合同核验/);
  assert.match(html, /原型未执行 Agent 规则或提示词版本核验/);
});

test("Conversation 源事实只定位业务会话，不伪造调用详情", () => {
  assert.match(logsHtml, /打开业务会话/);
  assert.match(logsHtml, /Agent 业务会话日志/);
  assert.match(logsHtml, /source_fact_type:x\.conversationID\?"bkn_trace_conversation"/);
  assert.doesNotMatch(logsHtml, /查看业务调用详情/);
});

test("日志检索提供完整业务模块筛选且不补造空模块记录", () => {
  [
    "领域知识网络", "可观测性", "执行工厂", "数据资源知识网络", "模型管理", "系统管理",
  ].forEach((label) => assert.match(logsHtml, new RegExp(`>${label}<`)));
  assert.match(logsHtml, /id="log-start"/);
  assert.match(logsHtml, /id="log-end"/);
  assert.match(logsHtml, /当前时间范围内没有操作日志/);
  assert.match(logsHtml, /Agent 业务会话日志/);
  assert.match(logsHtml, /打开业务会话/);
});

test("可观测性设置原型使用固定 30 天归档且不暴露归档配置", () => {
  assert.match(html, /id="nav-observability-settings"/);
  assert.match(html, /id="observability-settings-page"/);
  assert.match(html, /超过 30 天/);
  assert.match(html, /归档完成并校验成功后，将自动清理对应热数据/);
  assert.doesNotMatch(html, /id="archive-retention-days"/);
  assert.doesNotMatch(html, /id="archive-delete-after"/);
});

test("当前接口缺口不冒充归档空状态并保留实际范围列", () => {
  assert.match(html, /当前无法判断是否有可归档数据/);
  assert.match(html, /没有新增数据时不创建空任务/);
  assert.match(html, /实际数据范围/);
  assert.match(html, /尚无归档记录/);
  assert.match(html, /id="start-manual-archive"[^>]*disabled/);
  assert.match(html, /尚未归档且早于自然日截止时间/);
  assert.doesNotMatch(html, /服务端水位/);
});

test("设置页展示当前真实来源而不直接暴露采集实现枚举", () => {
  assert.match(html, /OpenTelemetry/);
  assert.match(html, /BKN Safe 管理审计/);
  assert.match(html, /用户访问日志/);
  assert.match(html, /安全审计日志/);
  assert.doesNotMatch(html, />direct_otlp</);
  assert.doesNotMatch(html, />source_adapter</);
});

test("可观测性设置按可落地的五段信息架构展示", () => {
  ["运行概览", "采集来源", "存储与保留", "历史数据归档", "最近归档"].forEach((label) => {
    assert.match(html, new RegExp(`>${label}<`));
  });
  assert.match(html, />覆盖业务模块</);
  assert.match(html, />最近更新时间</);
  assert.match(html, />热存储</);
  assert.match(html, />保留口径</);
  assert.doesNotMatch(html, /采样率/);
  assert.doesNotMatch(html, /只归档不清理/);
});

test("存储与保留不暴露无管理动作的内部 Trace 存储", () => {
  assert.match(html, />运行日志</);
  assert.match(html, />审计日志</);
  assert.doesNotMatch(html, />Trace 查询索引</);
  assert.doesNotMatch(html, />Interaction 调用事实</);
  assert.match(html, /已结束交互轮次/);
});
