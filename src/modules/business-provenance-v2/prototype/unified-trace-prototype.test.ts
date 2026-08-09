/*
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const prototypePath = resolve(process.cwd(), "public/bkn-trace-0.1.4-prototype.html");

describe("BKN Trace 0.1.4 统一高保真原型", () => {
  it("在同一 Studio 框架中提供独立的业务溯源和 Trace 分析入口", () => {
    const html = readFileSync(prototypePath, "utf8");

    expect(html).toContain('id="nav-business-provenance"');
    expect(html).toContain('id="nav-trace-analysis"');
    expect(html).toContain('id="business-provenance-page"');
    expect(html).toContain('id="trace-analysis-page"');
    expect(html).toContain('function switchProduct');
  });

  it("只为业务溯源显示现有企业版标签", () => {
    const html = readFileSync(prototypePath, "utf8");
    const traceNavigation = html.match(/<button[^>]*id="nav-trace-analysis"[^>]*>[\s\S]*?<\/button>/)?.[0] ?? "";

    expect(html).toMatch(/id="nav-business-provenance"[\s\S]*?企业版[\s\S]*?<\/button>/);
    expect(traceNavigation).not.toContain("企业版");
    expect(html).not.toContain("社区版");
  });

  it("Trace 分析包含列表、分页、技术执行链和真实 Operation 标识", () => {
    const html = readFileSync(prototypePath, "utf8");

    expect(html).toContain('id="trace-list"');
    expect(html).toContain('id="trace-pagination"');
    expect(html).toContain('id="trace-detail"');
    expect(html).toContain('id="trace-execution-chain"');
    expect(html).toContain("req_7892c814-bd3a-45c5-83eb-6707f0279df1");
    expect(html).toContain("op_481d7266ea974c0d6d9e2165c9e29a43");
    expect(html).toContain("Trace 未关联");
    expect(html).toContain("Span 未采集");
  });

  it("Trace 列表按 Trace ID 聚合，并单列八次未关联调用", () => {
    const html = readFileSync(prototypePath, "utf8");

    expect(html).toContain("const technicalTraceGroups");
    expect(html).toContain('id="trace-table-body"');
    expect(html).toContain("共 1 条 Trace");
    expect(html).toContain("未关联调用记录 · ${unlinkedOperations.length}");
    expect(html).toContain("list_knowledge_networks");
    expect(html).toContain("search_schema");
    expect(html).toContain("query_object_instance");
    expect(html.match(/tool:"run_sql"/g)).toHaveLength(6);
  });

  it("多条 Trace 只展示真实标识，缺失标识明确标为未记录", () => {
    const html = readFileSync(prototypePath, "utf8");

    expect(html).toContain('requestId:operation.requestId || "未记录"');
    expect(html).toContain('operationId:operation.operationId || "未记录"');
    expect(html).not.toContain("op-list-networks</small>");
    expect(html).not.toContain("op-search-schema</small>");
    expect(html).toContain("req_7892c814-bd3a-45c5-83eb-6707f0279df1");
    expect(html).toContain("op_481d7266ea974c0d6d9e2165c9e29a43");
  });

  it("Trace 与未关联 Operation 都能打开对应技术详情", () => {
    const html = readFileSync(prototypePath, "utf8");

    expect(html).toContain("function renderTechnicalTraceList");
    expect(html).toContain("function openTechnicalTrace");
    expect(html).toContain("function renderTechnicalTraceDetail");
    expect(html).toContain('data-technical-record="${index}"');
    expect(html).toContain("本次调用没有记录 Request ID 与 Operation ID");
  });

  it("单 Trace 工作台展示根输入输出原文和严格的采集完整性", () => {
    const html = readFileSync(prototypePath, "utf8");

    expect(html).toContain('id="trace-root-input"');
    expect(html).toContain('id="trace-root-output"');
    expect(html).toContain("分析对比900-000044和900-000063两款智能球阀的BOM物料差异");
    expect(html).toContain("完成两款智能球阀的 BOM 明细对比");
    expect(html).toContain('id="trace-completeness"');
    expect(html).toContain("部分调用记录");
    expect(html).toContain("无法还原父子调用层级");
  });

  it("技术问题、未观测区间和节点详情都引用真实调用事实", () => {
    const html = readFileSync(prototypePath, "utf8");

    expect(html).toContain('id="trace-technical-findings"');
    expect(html).toContain("CAPTURE-001");
    expect(html).toContain("未观测区间 17.7s");
    expect(html).toContain("未观测区间 12.3s");
    expect(html).toContain('id="trace-operation-detail"');
    expect(html).toContain("Attempt");
    expect(html).toContain("打开关联日志");
    expect(html).toContain("function selectTraceOperation");
  });

  it("社区 Trace 页面不包含企业业务投影", () => {
    const html = readFileSync(prototypePath, "utf8");
    const tracePage = html.match(/<section id="trace-analysis-page"[\s\S]*?<\/section>\s*<\/div>\s*<\/main>/)?.[0] ?? "";

    expect(tracePage).not.toContain("Business Graph");
    expect(tracePage).not.toContain("Evidence Chain");
    expect(tracePage).not.toContain("Snapshot Preview");
    expect(tracePage).not.toContain("知识网络视图");
    expect(tracePage).not.toContain("BKN Agent");
    expect(tracePage).not.toContain("prototype-tag");
    expect(tracePage).not.toContain("Token 数");
    expect(tracePage).not.toContain("模型耗时");
    expect(tracePage).not.toContain("模型成本");
  });

  it("所有常规长文本统一两行截断并支持悬浮和点击全文", () => {
    const html = readFileSync(prototypePath, "utf8");

    expect(html).toContain(".text-clamp-2");
    expect(html).toContain("-webkit-line-clamp:2");
    expect(html).toContain("function longText");
    expect(html).toContain('id="long-text-preview"');
    expect(html).toContain('id="full-text-dialog"');
    expect(html).toContain('id="copy-full-text"');
    expect(html).toContain('id="close-full-text"');
    expect(html).toContain('data-full-text');
  });

  it("只为实际截断文本在鼠标右下方显示紧凑预览", () => {
    const html = readFileSync(prototypePath, "utf8");

    expect(html).toContain("function isTextTruncated");
    expect(html).toContain("scrollHeight > target.clientHeight");
    expect(html).toContain("function positionLongTextPreview");
    expect(html).toContain("event.clientX + 14");
    expect(html).toContain("event.clientY + 14");
    expect(html).toContain("window.innerWidth");
    expect(html).toContain("window.innerHeight");
    expect(html).toContain("width:320px");
    expect(html).toContain('document.addEventListener("mousemove"');
  });

  it("旧业务溯源原型入口跳转到统一入口", () => {
    const redirect = readFileSync(
      resolve(process.cwd(), "public/business-provenance-v2-prototype.html"),
      "utf8",
    );

    expect(redirect).toContain("bkn-trace-0.1.4-prototype.html");
  });
});
