/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

// Synthetic layout stress test using the real Eval styles and Ant Design components.
// Requires the Vite dev server; does not authenticate, call Eval APIs or change data.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require(process.argv[2] || "playwright-core");
const output = process.env.EVAL_LAYOUT_OUTPUT || "/tmp/eval-layout-regression";
fs.mkdirSync(output, { recursive: true });

(async () => {
  const browser = await chromium.launch({
    executablePath: process.argv[3] || undefined,
    headless: true,
    args: ["--no-sandbox"],
  });
  const checks = [];
  try {
    const page = await browser.newPage();
    await page.route("**/studio/eval-layout-fixture", (route) =>
      route.fulfill({ contentType: "text/html", body: '<html lang="zh-CN"><body></body></html>' }),
    );
    await page.goto(
      `${process.env.E2E_BASE_URL || "http://localhost:8000"}/studio/eval-layout-fixture`,
    );
    await page.evaluate(async () => {
      const { default: RefreshRuntime } = await import("/studio/@react-refresh");
      RefreshRuntime.injectIntoGlobalHook(window);
      window.$RefreshReg$ = () => {};
      window.$RefreshSig$ = () => (type) => type;
      window.__vite_plugin_react_preamble_installed__ = true;
      const { default: React } = await import("/studio/node_modules/.vite/deps/react.js");
      const dom = await import("/studio/node_modules/.vite/deps/react-dom_client.js");
      const { createRoot } = dom.default || dom;
      const antd = await import("/studio/node_modules/.vite/deps/antd.js");
      const { Button, ConfigProvider, Descriptions, Tag } = antd.default || antd;
      const { EvalPaginatedTable } =
        await import("/studio/src/modules/knowledge-network/eval/EvalPaginatedTable.tsx");
      const css = async (name) =>
        (await import(`/studio/src/modules/knowledge-network/eval/${name}.module.css`)).default;
      const [run, workspace, resource, agents, result, history, execution, ai] = await Promise.all(
        [
          "EvalMultiRunPanel",
          "EvalWorkspaceScene",
          "EvalOverviewResourcesPanel",
          "EvalAgentComparisonWorkspace",
          "EvalAgentComparisonResult",
          "EvalRunComparisonDrawer",
          "EvalExecutionDetails",
          "EvalAiGenerationDrawer",
        ].map(css),
      );
      await import("/studio/src/styles/global.css");
      const h = React.createElement;
      const long = "供应链E2E · 采购订单 / 属性值类型一致 · ".repeat(30);
      const id = "srcbillentryid_".repeat(100);
      const shell = (name, child, className) =>
        h(
          "section",
          {
            key: name,
            "data-fixture": name,
            className,
            style: {
              flex: "0 0 auto",
              width: "min(340px, calc(100vw - 48px))",
              minWidth: 0,
              padding: 12,
              border: "1px solid #ddd",
              boxSizing: "border-box",
              background: "white",
            },
          },
          h("h3", null, name),
          child,
        );
      const cards = [long, id, "短标题"].map((text) =>
        h(
          "li",
          { key: text },
          h(
            "button",
            { className: run.caseChoice, "aria-label": text },
            h(
              "span",
              { className: run.caseChoiceTitle, title: text, "data-two-lines": true },
              text,
            ),
            h(
              "span",
              { className: run.caseChoiceMeta },
              h(Tag, { color: "error" }, "未通过"),
              "已完成",
              "4913 ms",
            ),
          ),
        ),
      );
      const table = (child) =>
        h(EvalPaginatedTable, {
          rowKey: "id",
          pagination: false,
          dataSource: [{ id: "1" }],
          columns: [{ title: "用例", render: () => child }],
        });
      const app = h(
        ConfigProvider,
        null,
        h(
          "main",
          {
            style: {
              padding: 12,
              display: "flex",
              flexWrap: "wrap",
              alignItems: "flex-start",
              gap: 16,
            },
          },
          shell("用例导航：两行及全文", h("ul", { className: run.caseChoiceList }, cards)),
          shell(
            "用例库：长标题",
            table(
              h(
                Button,
                { type: "link", className: workspace.caseListLink },
                h("strong", { title: long, "data-two-lines": true }, long),
                h(
                  "span",
                  { className: workspace.caseListMeta, title: id, "data-single-line": true },
                  id,
                ),
              ),
            ),
            workspace.root,
          ),
          shell(
            "资源名称及抽屉标题",
            h(
              "div",
              { className: resource.resourceHeading },
              h("span", null, "◇"),
              h("strong", null, id),
            ),
          ),
          shell(
            "智能体已选标签",
            h(
              "div",
              { className: agents.selected },
              h(
                Tag,
                { closable: true },
                h(
                  "span",
                  { className: agents.selectedLabel, title: id, "data-two-lines": true },
                  id,
                ),
              ),
            ),
            agents.workspace,
          ),
          shell(
            "智能体对比表头",
            table(
              h(
                "div",
                { className: result.agentHeader },
                h("strong", { title: long, "data-two-lines": true }, long),
                h("span", { title: id, "data-two-lines": true }, id),
              ),
            ),
            result.result,
          ),
          shell(
            "表格长链接",
            table(h(Button, { type: "link", className: result.caseName, title: id }, id)),
          ),
          shell(
            "历史对比详情",
            h(Descriptions, {
              bordered: true,
              column: 1,
              className: history.summary,
              items: [{ key: "agent", label: "智能体", children: id }],
            }),
            history.panel,
          ),
          shell(
            "结果 JSON 与回答",
            h(
              "div",
              { className: run.panel },
              h("p", { className: run.agentAnswer }, long),
              h(
                "pre",
                { className: run.codeBlock },
                JSON.stringify({ input: id, output: long }, null, 2),
              ),
            ),
          ),
          shell(
            "执行证据长文本",
            h(
              "div",
              { className: execution.details },
              id,
              h(
                "pre",
                { className: execution.evidence },
                Array.from({ length: 80 }, () => id).join("\n"),
              ),
            ),
          ),
          shell(
            "AI 操作计划",
            h(
              "div",
              { className: ai.proposalHeader },
              h("div", null, h("strong", null, id), h("span", null, long)),
            ),
          ),
        ),
      );
      createRoot(document.body).render(app);
    });
    await page.locator("[data-fixture]").first().waitFor();
    for (const width of [1600, 1280, 1024, 680]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.waitForTimeout(150);
      const result = await page.evaluate(() => {
        const fixtures = [...document.querySelectorAll("[data-fixture]")].map((el) => ({
          name: el.dataset.fixture,
          width: el.clientWidth,
          scrollWidth: el.scrollWidth,
        }));
        const titles = [...document.querySelectorAll("[data-two-lines]")].map((el) => {
          const probe = el.cloneNode(false);
          probe.textContent = "单行";
          probe.style.cssText =
            "position:absolute;visibility:hidden;max-height:none;-webkit-line-clamp:unset";
          el.parentElement.append(probe);
          const lineHeight = probe.getBoundingClientRect().height;
          probe.remove();
          return {
            fixture: el.closest("[data-fixture]").dataset.fixture,
            textLength: el.textContent.length,
            titleLength: el.title.length,
            height: el.getBoundingClientRect().height,
            lineHeight,
            width: el.clientWidth,
            scrollWidth: el.scrollWidth,
            clamp: getComputedStyle(el).webkitLineClamp,
          };
        });
        const singleLines = [...document.querySelectorAll("[data-single-line]")].map((el) => ({
          whiteSpace: getComputedStyle(el).whiteSpace,
          overflow: getComputedStyle(el).overflow,
          ellipsis: getComputedStyle(el).textOverflow,
        }));
        const close = document.querySelector(".ant-tag-close-icon");
        return {
          documentWidth: document.documentElement.clientWidth,
          documentScrollWidth: document.documentElement.scrollWidth,
          fixtures,
          titles,
          singleLines,
          closeVisible: close?.getBoundingClientRect().width > 0,
        };
      });
      fs.writeFileSync(path.join(output, "latest-metrics.json"), JSON.stringify(result, null, 2));
      for (const item of result.fixtures)
        assert(item.scrollWidth <= item.width + 1, `${width}: ${item.name} overflowed`);
      for (const item of result.titles) {
        assert(
          item.height <= item.lineHeight * 2 + 1,
          `${width}: ${item.fixture} title exceeds two lines (${item.height} / ${item.lineHeight})`,
        );
        assert(item.scrollWidth <= item.width + 1, `${width}: title overflows horizontally`);
        assert.equal(
          item.textLength,
          item.titleLength,
          "Full title must remain available on hover",
        );
        assert.equal(item.clamp, "2");
      }
      for (const item of result.singleLines) {
        assert.equal(
          item.whiteSpace,
          "nowrap",
          "Existing single-line metadata must not expand into paragraphs",
        );
        assert.equal(item.overflow, "hidden");
        assert.equal(item.ellipsis, "ellipsis");
      }
      assert(result.closeVisible, "Long agent label must not hide the remove action");
      assert(result.documentScrollWidth <= result.documentWidth, "Page has horizontal overflow");
      checks.push({ viewport: width, ...result });
      await page.screenshot({ path: path.join(output, `layout-${width}.png`), fullPage: true });
    }
    console.log(
      "PASS: 11 Eval long-content scenarios at 1600, 1280, 1024 and 680 px; two-line titles, full-text hover, visible remove action and no page overflow.",
    );
  } finally {
    fs.writeFileSync(path.join(output, "layout-checks.json"), JSON.stringify(checks, null, 2));
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
