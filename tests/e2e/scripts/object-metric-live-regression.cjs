/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

const assert = require("node:assert/strict");

const playwrightCorePath = process.argv[2];
const executablePath = process.argv[3];

if (!playwrightCorePath || !executablePath) {
  throw new Error(
    "Usage: node object-metric-live-regression.cjs <playwright-core-path> <chromium-executable>",
  );
}

const { chromium } = require(playwrightCorePath);

const baseURL = process.env.E2E_BASE_URL || "http://localhost:8000";
const networkId = "metric_e2e_20261004";
const routes = {
  compositeDraft: "01a105ba-7442-7b63-b32f-e6527c61412d/edit",
  derivedDetail: "01a105b7-6f41-7155-a53d-e7c06fc08033/detail",
  derivedDraft: "01a105b7-6f41-7155-a53d-e7c06fc08033/edit",
  fixedQuarterDraft: "01a105c0-b6be-7558-b9fc-ac5e10ea652d/edit",
  orderAmountDraft: "01a105b0-ce2f-7f2b-9bab-18a506e628c8/edit",
  orderCountDetail: "01a105b4-a54f-704a-bb80-ac38591240f0/detail",
  relationDerivedDetail: "01a105bd-1008-7ab2-abe2-1aa41c4f9a54/detail",
};

function metricUrl(route) {
  return `${baseURL}/studio/knowledge-network/workspace/${networkId}/metrics/${route}`;
}

async function loginIfNeeded(page) {
  await page.waitForLoadState("networkidle");
  if (page.url().includes(":9001/login")) {
    const username = process.env.E2E_USERNAME || process.argv[5];
    const password = process.env.E2E_PASSWORD || process.argv[6];
    const usernameInput = page
      .locator(
        'input[name="account"], input[name="username"], input[type="text"], input[type="email"]',
      )
      .first();
    const passwordInput = page.locator('input[name="password"], input[type="password"]').first();
    if ((await usernameInput.count()) > 0 && (await passwordInput.count()) > 0) {
      if (!username || !password) {
        throw new Error("E2E_USERNAME and E2E_PASSWORD are required for a fresh browser session");
      }
      await usernameInput.fill(username);
      await passwordInput.fill(password);
    }
    await page.getByRole("button", { name: "登录", exact: true }).click();
    await page.waitForURL((url) => url.origin === baseURL && url.pathname.startsWith("/studio/"));
  }
}

async function gotoMetric(page, route) {
  const response = await page.goto(metricUrl(route), { waitUntil: "domcontentloaded" });
  await loginIfNeeded(page);
  await page.waitForLoadState("networkidle");
  try {
    await page.getByRole("heading", { level: 1 }).waitFor({ timeout: 15_000 });
  } catch (error) {
    console.error(
      `PAGE ${response?.status() || "no-response"} ${page.url()} ${await page.title()} :: ${(await page.locator("body").innerText()).slice(0, 500)}`,
    );
    throw error;
  }
}

async function openTrial(page, triggerName = "试算真实数据") {
  await page.getByRole("button", { name: triggerName, exact: true }).click();
  await page.getByRole("button", { name: "开始试算", exact: true }).last().waitFor();
}

async function runTrial(page) {
  const responsePromise = page.waitForResponse(
    (response) => response.request().method() === "POST",
  );
  await page
    .locator(".ant-drawer-content:visible")
    .last()
    .getByRole("button", { name: "开始试算", exact: true })
    .click({ force: true });
  const response = await responsePromise;
  console.log(`TRIAL_RESPONSE ${response.status()} ${response.url()}`);
  await page.getByText(/执行状态：/).waitFor();
}

async function selectVersion(page, label) {
  await page.locator(".ant-select-selector").first().click();
  await page.getByText(label, { exact: true }).last().click();
  await page.locator(".ant-select-selection-item", { hasText: label }).first().waitFor();
}

async function checkSingleAtomic(browser) {
  const page = await browser.newPage();
  await gotoMetric(page, routes.orderAmountDraft);
  const editHeading = page.getByRole("heading", { name: "编辑原子指标 · 销售订单" });
  const isDraft = (await editHeading.count()) > 0;
  if (isDraft) {
    await editHeading.waitFor();
    assert.equal(
      await page.getByRole("switch", { name: "发布后作为逻辑属性使用" }).isChecked(),
      true,
    );
    assert.equal(
      await page.getByRole("textbox", { name: "* 显示名称" }).inputValue(),
      "验收订单金额",
    );
  } else {
    await page.getByRole("heading", { name: "验收订单金额", exact: true }).waitFor();
    await page
      .getByText("验收订单金额 · metric_e2e_20261004_order_amount", { exact: true })
      .waitFor();
  }

  await openTrial(page, isDraft ? "试算真实数据" : "开始试算");
  const identity = page.getByRole("textbox", { name: "* order_id · order_id" });
  await identity.fill("10357");
  await runTrial(page);
  await page.getByText("14485.37", { exact: true }).last().waitFor();
  await page.getByText("执行状态：ok", { exact: true }).waitFor();

  await identity.fill("999999999");
  await runTrial(page);
  await page.getByText("执行状态：no_data", { exact: true }).waitFor();
  await page.close();
}

async function checkLogicPropertyValidation(browser) {
  const page = await browser.newPage();
  await gotoMetric(page, routes.orderAmountDraft);
  const displayName = page.getByRole("textbox", { name: "* 显示名称" });
  await displayName.fill("");
  await page.getByRole("button", { name: "检查配置", exact: true }).click();
  await page.getByText("发现 1 个表单问题", { exact: true }).waitFor();
  await page.getByText("请输入逻辑属性显示名称", { exact: true }).waitFor();
  await displayName.fill("验收订单金额");
  await page.close();
}

async function checkDerivedDraft(browser) {
  const page = await browser.newPage();
  await gotoMetric(page, routes.derivedDraft);
  await page.getByRole("heading", { name: "编辑衍生指标 · 销售订单" }).waitFor();
  await page.getByText("业务口径已形成", { exact: true }).waitFor();
  await page.getByText("验收订单总数 · v1", { exact: true }).waitFor();
  await openTrial(page);
  await runTrial(page);
  await page.getByText("8808", { exact: true }).last().waitFor();
  await page.close();
}

async function checkCompositeDraft(browser) {
  const page = await browser.newPage();
  await gotoMetric(page, routes.compositeDraft);
  await page.getByRole("heading", { name: "编辑复合指标 · 销售订单" }).waitFor();
  assert.equal(
    await page.getByRole("textbox", { name: "第 1 个依赖的公式符号" }).inputValue(),
    "metric_1",
  );
  assert.equal(
    await page.getByRole("textbox", { name: "第 2 个依赖的公式符号" }).inputValue(),
    "metric_2",
  );
  await openTrial(page);
  await runTrial(page);
  await page.getByText("23808", { exact: true }).last().waitFor();
  await page.close();
}

async function checkRelationDerived(browser) {
  const page = await browser.newPage();
  await gotoMetric(page, routes.relationDerivedDetail);
  await selectVersion(page, "v1 · 已发布");
  await page.getByText("关联实例：channel_type 等于 “offline”", { exact: true }).waitFor();
  await openTrial(page, "开始试算");
  await runTrial(page);
  await page.getByText("40", { exact: true }).last().waitFor();
  await page.close();
}

async function checkPublishedVersion(browser) {
  const page = await browser.newPage();
  await gotoMetric(page, routes.orderCountDetail);
  await selectVersion(page, "v1 · 已发布");
  await page.getByText("下游 4", { exact: true }).first().waitFor();
  await openTrial(page, "开始试算");
  await runTrial(page);
  await page.getByText("15000", { exact: true }).last().waitFor();
  await page.close();
}

async function checkFixedQuarter(browser) {
  const page = await browser.newPage();
  await gotoMetric(page, routes.fixedQuarterDraft);
  await page.getByText("指定日期区间", { exact: true }).waitFor();
  await page.getByText("统一使用 UTC", { exact: false }).waitFor();
  await page.getByText("季度", { exact: true }).last().waitFor();
  await openTrial(page);
  await runTrial(page);
  await page.getByRole("columnheader", { name: "时间（UTC）" }).waitFor();
  await page.getByText("2021-01-01 00:00:00", { exact: true }).waitFor();
  await page.getByText("2026-04-01 00:00:00", { exact: true }).waitFor();
  await page.close();
}

async function checkMetricLogicPropertyTrial(browser) {
  const page = await browser.newPage();
  const url = `${baseURL}/studio/knowledge-network/workspace/${networkId}/object-types/order/detail?tab=data&section=logic`;
  await page.goto(url, { waitUntil: "networkidle" });
  await loginIfNeeded(page);
  await page.getByText("逻辑属性试算", { exact: true }).first().waitFor();
  const row = page.getByRole("row").filter({ hasText: "10357" }).first();
  const responsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().includes("/object-types/order/properties"),
  );
  const successPromise = page.getByText(/已完成 1 个对象的逻辑属性试算/).waitFor();
  await row.getByRole("button", { name: "试算", exact: true }).click();
  const response = await responsePromise;
  assert.equal(response.status(), 200, await response.text());
  await row.getByText(/14485\.37/).waitFor();
  await successPromise;
  await page.close();
}

async function checkExistingOrderLogicProperties(browser) {
  const page = await browser.newPage();
  const url = `${baseURL}/studio/knowledge-network/workspace/ecommerce_ops_bkn/object-types/order/detail?tab=data&section=logic`;
  await page.goto(url, { waitUntil: "networkidle" });
  await loginIfNeeded(page);
  await page.getByRole("columnheader", { name: "订单折扣率", exact: true }).waitFor();
  const row = page.getByRole("row").filter({ hasText: "10357" }).first();
  await row.getByRole("button", { name: "试算", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor();
  const responsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().includes("/object-types/order/properties"),
  );
  await dialog.getByRole("button", { name: "开始试算", exact: true }).click();
  const response = await responsePromise;
  assert.equal(response.status(), 500, await response.text());
  await page.getByText(/处理逻辑属性失败|工具执行失败/).waitFor();
  await page.close();
}

async function checkForbiddenMetricPage(browser) {
  const page = await browser.newPage();
  const forbiddenUrls = [];
  const suppressHeaders = [];
  page.on("request", (request) => {
    if (
      request.url().includes("/object-metrics/") ||
      request.url().endsWith(`/knowledge-networks/${networkId}`)
    ) {
      suppressHeaders.push({
        header: request.headers()["x-bkn-client-suppress-error-toast"],
        url: request.url(),
      });
    }
  });
  page.on("response", (response) => {
    if (response.status() === 403) forbiddenUrls.push(response.url());
  });
  await page.goto(metricUrl(routes.orderCountDetail), { waitUntil: "networkidle" });
  await loginIfNeeded(page);
  await page.getByText("无权查看该指标", { exact: true }).waitFor();
  assert.equal(await page.getByText("指标不存在", { exact: true }).count(), 0);
  const permissionMessages = await page.getByText(/没有执行此操作的权限/).evaluateAll((nodes) =>
    nodes.map((node) => ({
      className: node.className,
      parentClassName: node.parentElement?.className,
      grandParentClassName: node.parentElement?.parentElement?.className,
      text: node.textContent,
      visible: Boolean(node.getClientRects().length),
    })),
  );
  assert.equal(
    permissionMessages.filter((item) => item.visible).length,
    0,
    `unexpected permission toasts: ${JSON.stringify(permissionMessages)}; 403 responses: ${forbiddenUrls.join(", ")}; suppress headers: ${JSON.stringify(suppressHeaders)}`,
  );
  await page.close();
}

async function checkQueryEditionForbidden(browser) {
  const page = await browser.newPage();
  await gotoMetric(page, routes.orderCountDetail);
  await selectVersion(page, "v1 · 已发布");
  await openTrial(page, "开始试算");
  const responsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().includes("/api/ontology-query/v1/") &&
      response.url().includes("/object-metrics/") &&
      new URL(response.url()).pathname.endsWith("/data"),
  );
  await page.getByRole("button", { name: "开始试算", exact: true }).last().click();
  const response = await responsePromise;
  assert.equal(response.status(), 403, await response.text());
  await page.close();
}

async function checkDerivedLineage(browser) {
  const page = await browser.newPage();
  await gotoMetric(page, routes.derivedDetail);
  await page.getByText("验收订单总数", { exact: true }).first().waitFor();
  assert.equal(await page.getByText("当前没有可访问的定义", { exact: true }).count(), 0);
  await page.close();
}

async function checkObjectTypeIndexStatus(browser) {
  const page = await browser.newPage();
  const listUrl = `${baseURL}/studio/knowledge-network/workspace/ecommerce_ops_bkn/object-types?q=order`;
  await page.goto(listUrl, { waitUntil: "networkidle" });
  await loginIfNeeded(page);
  const orderRow = page.getByRole("row").filter({ hasText: "销售订单" }).first();
  await orderRow.waitFor();
  assert.equal(await orderRow.getByText("资源未建索引", { exact: true }).count(), 0);
  await page.goto(
    `${baseURL}/studio/knowledge-network/workspace/ecommerce_ops_bkn/object-types/order/detail`,
    { waitUntil: "networkidle" },
  );
  await page.getByText("资源已建索引", { exact: true }).waitFor();
  await page.close();
}

async function main() {
  const browserProcess = await chromium.launch({ executablePath, headless: true });
  const browser = await browserProcess.newContext();
  const accessToken = process.env.E2E_ACCESS_TOKEN || process.argv[7];
  if (accessToken) {
    await browser.addCookies([
      {
        name: "bkn_access_token",
        url: baseURL,
        value: accessToken,
      },
    ]);
  }
  const failures = [];
  const allCases = [
    ["live-single-atomic", checkSingleAtomic],
    ["live-logic-property-validation", checkLogicPropertyValidation],
    ["live-derived-draft", checkDerivedDraft],
    ["live-composite-draft", checkCompositeDraft],
    ["live-relation-derived", checkRelationDerived],
    ["live-published-version", checkPublishedVersion],
    ["live-fixed-quarter-utc", checkFixedQuarter],
    ["live-metric-logic-property", checkMetricLogicPropertyTrial],
    ["live-existing-order-logic-properties", checkExistingOrderLogicProperties],
    ["live-forbidden-metric-page", checkForbiddenMetricPage],
    ["live-query-edition-forbidden", checkQueryEditionForbidden],
    ["live-derived-lineage", checkDerivedLineage],
    ["live-object-type-index-status", checkObjectTypeIndexStatus],
  ];
  const caseFilter = process.argv[4];
  const requestedCases = new Set(caseFilter ? caseFilter.split(",") : []);
  const cases = requestedCases.size
    ? allCases.filter(([name]) => requestedCases.has(name))
    : allCases;

  try {
    for (const [name, check] of cases) {
      const startedAt = Date.now();
      try {
        await check(browser);
        console.log(`PASS ${name} ${Date.now() - startedAt}ms`);
      } catch (error) {
        failures.push({ name, error });
        console.error(`FAIL ${name}: ${error.stack || error.message || error}`);
        for (const page of browser.pages()) {
          console.error(
            `STATE ${page.url()} ${await page.title()} :: ${(await page.locator("body").innerText()).slice(0, 800)}`,
          );
        }
      }
    }
  } finally {
    await browser.close().catch(() => undefined);
    await browserProcess.close().catch(() => undefined);
  }

  if (failures.length) {
    throw new Error(`${failures.length} live object-metric regression case(s) failed`);
  }
  console.log(`PASS all ${cases.length} live object-metric regression cases`);
}

void main();
