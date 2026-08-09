/*
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const prototypePath = resolve(process.cwd(), 'public/bkn-trace-0.1.4-prototype.html');

describe('业务溯源重构独立原型', () => {
  it('使用现有 OpenBKN Studio 页面框架，而不是自造应用外壳', () => {
    const html = readFileSync(prototypePath, 'utf8');

    expect(html).toContain('id="studio-topbar"');
    expect(html).toContain('id="studio-sidebar"');
    expect(html).toContain('可观测性');
    expect(html).toContain('业务溯源');
    expect(html).toContain('Administrator');
    expect(html).not.toContain('background: #151d2e');
  });

  it('以业务会话列表作为入口，并以当前交互轮次作为统一分析单位', () => {
    const html = readFileSync(prototypePath, 'utf8');

    expect(html).toContain('id="conversation-list"');
    expect(html).toContain('conv_73fc12a00ac46933c3d8015616a1b1b3');
    expect(html).toContain('id="conversation-workspace"');
    expect(html).toContain('data-interaction="0"');
    expect(html).toContain('data-interaction="1"');
    expect(html).toContain('id="interaction-summary"');
    expect(html).toContain('id="interaction-sidebar"');
    expect(html).toContain('id="interaction-search"');
    expect(html).toContain('id="analysis-content"');
    expect(html).toContain('2026/8/8 19:01:45');
    expect(html).toContain('2026-08-08T11:01:45.182186Z');
  });

  it('业务会话列表沿用老版的筛选、列结构和分页，但不保留三个内部标签页', () => {
    const html = readFileSync(prototypePath, 'utf8');

    expect(html).toContain('开始时间</span><span>用户问题</span><span>交互轮次</span><span>业务结果</span><span>Agent</span><span>状态</span><span>证据完整性</span><span>耗时');
    expect(html).toContain('id="conversation-pagination"');
    expect(html).toContain('20 条 / 页');
    expect(html).not.toContain('class="legacy-tabs"');
    expect(html).not.toContain('<button class="active" type="button">业务会话</button>');
  });

  it('为当前轮次提供两种互补视图、共享详情和同源事实操作', () => {
    const html = readFileSync(prototypePath, 'utf8');

    expect(html).toContain('时间链视图');
    expect(html).toContain('知识网络视图');
    expect(html).toContain('id="detail-panel"');
    expect(html).toContain('id="copy-markdown"');
    expect(html).toContain('id="download-markdown"');
    expect(html).toContain('id="analyze-with-agent"');
    expect(html).toContain('function copyCurrentInteractionMarkdown');
    expect(html).toContain('buildInteractionMarkdown(currentInteraction())');
  });

  it('严格区分已触达事实、知识网络上下文和探索候选', () => {
    const html = readFileSync(prototypePath, 'utf8');

    expect(html).toContain('本轮已触达');
    expect(html).toContain('知识网络上下文');
    expect(html).toContain('探索候选');
    expect(html).toContain('候选不作为本轮业务依据');
    expect(html).toContain('尚未提交分析');
    expect(html).toContain('输入原文未记录（当前 Trace 仅保留输入哈希）');
    expect(html).not.toContain('condition:"围绕物料、库存、仓库、供应商检索 Schema"');
    expect(html).not.toContain('result:"确认物料名称为 HD401_外置电池。"');
  });

  it('知识网络视图按对象逐步展开，并回到该对象的真实调用', () => {
    const html = readFileSync(prototypePath, 'utf8');

    expect(html).toContain('选择一个本轮触达对象，查看相关 BKN 关系');
    expect(html).toContain('function relatedOperationsFor');
    expect(html).toContain('function relationEndsFor');
    expect(html).toContain('关联调用');
    expect(html).toContain('data-network-kind="object"');
    expect(html).toContain('data-related-operation');
  });

  it('保留上一轮高保真主体的信息层次', () => {
    const html = readFileSync(prototypePath, 'utf8');

    expect(html).toContain('调用之外间隔');
    expect(html).toContain('复现查询');
    expect(html).toContain('业务知识网络 → 本轮触达对象 → 源 BKN 关系（上下文） → 相邻对象');
    expect(html).toContain('收起轮次');
    expect(html).toContain('关闭详情');
  });

  it('包含业务溯源优化 BKN Agent 的严格结果合同示例', () => {
    const html = readFileSync(prototypePath, 'utf8');

    expect(html).toContain('id="agent-analysis-state"');
    expect(html).toContain('交互示例，未执行真实分析');
    expect(html).toContain('分类结论');
    expect(html).toContain('REC-AGENT-01');
    expect(html).toContain('I1-O4、I1-O5、I1-O8');
    expect(html).toContain('核验证据');
    expect(html).toContain('原型未执行 Agent 规则或提示词版本核验');
    expect(html).toContain('id="copy-agent-markdown"');
    expect(html).toContain('id="download-agent-markdown"');
  });

  it('BKN Agent 将输入采集缺口严格定位到 BKN Trace 内部层', () => {
    const html = readFileSync(prototypePath, 'utf8');

    expect(html).toContain('- BKN Trace：change_required');
    expect(html).toContain('- MCP：not_evaluable');
    expect(html).toContain('- SDK：not_evaluable');
    expect(html).toContain('REC-TRACE-01');
    expect(html).toContain('OperationCallFact');
    expect(html).toContain('不修改 MCP 与业务 SDK 接口');
    expect(html).not.toContain('- SDK：本轮已记录 SQL、资源、条件和 0 行结果，足以复现。');
  });

  it('BKN Agent 失败时保留当前轮次事实 Markdown', () => {
    const html = readFileSync(prototypePath, 'utf8');

    expect(html).toContain('function renderAgentError');
    expect(html).toContain('优化 Agent 暂时不可用');
    expect(html).toContain('id="copy-source-markdown"');
    expect(html).toContain('id="download-source-markdown"');
    expect(html).toContain('模拟失败状态');
  });

  it('调用详情由事实点击打开、手动关闭，并随滚动保持在视口中部', () => {
    const html = readFileSync(prototypePath, 'utf8');

    expect(html).toContain('function openDetailFor');
    expect(html).toContain('function closeDetail');
    expect(html).toContain('id="close-detail"');
    expect(html).toContain('detail-closed');
    expect(html).toContain('top:50%');
    expect(html).toContain('translateY(-50%)');
    expect(html).not.toContain('function alignDetailTo');
  });
});
